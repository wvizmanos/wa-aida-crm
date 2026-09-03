import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { STAGE_IDS, SOURCE_IDS, sampleLeads, sampleFollowUps } from './data'
import { api, forceDemo, getConnection, saveConnection, clearConnection, setDemoFlag, ApiError } from './api'

/* Sheets-backed store (migration Phase 1).
 * - The Google Sheet is the only source of truth in live mode.
 * - localStorage is a read cache ("last known snapshot") so a cold open
 *   still renders when the backend is unreachable — visibly marked.
 * - Mutations are optimistic with refetch-on-settle.
 * - Follow-up dates have no Leads-sheet column; like the old app they
 *   live on-device (waaida-followups) until the Reminders phase wires
 *   them to fu_save/fu_list.
 */

const CACHE_KEY = 'waaida-cache-v1'
const FOLLOWUPS_KEY = 'waaida-followups'
const FU_DONE_KEY = 'waaida-fu-done'
const LINK_SEEN_KEY = 'waaida-link-seen'
const LINK_POLL_MS = 60000

// Maps a raw sheet row (reference/Code.gs list_) to the app lead model.
function mapRow(r) {
  return {
    id: Number(r.id) || Number(r._row) || 0,
    name: r.name || 'Unnamed',
    phone: String(r.phone || ''),
    source: SOURCE_IDS.includes(r.source) ? r.source : 'manual',
    product: r.product || 'Other',
    stage: STAGE_IDS.includes(r.stage) ? r.stage : 'new',
    value: Number(String(r.value || '0').replace(/[^0-9]/g, '')) || 0,
    intent: Number(r.intent) || 50,
    notes: r.notes || '',
    created: r.created || '',
    activity: parseAct(r.activity),
    nextFollowUp: null, // filled from the local follow-ups map below
  }
}

function parseAct(raw) {
  try {
    const a = JSON.parse(raw || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function loadCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (parsed && Array.isArray(parsed.leads)) return parsed
  } catch { /* corrupted cache falls through */ }
  return null
}

function loadFollowUps() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLLOWUPS_KEY))
    if (parsed && typeof parsed === 'object') return parsed
  } catch { /* ignore */ }
  return {}
}

function loadFuDone() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FU_DONE_KEY))
    if (Array.isArray(parsed)) return parsed
  } catch { /* ignore */ }
  return []
}

// Last-seen open counts per link id, so new client opens can raise a badge.
function loadLinkSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LINK_SEEN_KEY))
    if (parsed && typeof parsed === 'object') return parsed
  } catch { /* ignore */ }
  return {}
}

function parseOpens(raw) {
  try {
    const a = JSON.parse(raw || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [demoMode, setDemoMode] = useState(forceDemo) // top priority — zero backend traffic when true
  const [connState, setConnState] = useState('demo') // 'demo' | 'live' | 'offline'
  const [busy, setBusy] = useState(false) // any in-flight load/mutation
  const [leads, setLeads] = useState(() => (forceDemo() ? sampleLeads() : (loadCache()?.leads || sampleLeads())))
  const [meta, setMeta] = useState(null) // {sheetName, count, sheetUrl} from the backend
  const [toasts, setToasts] = useState([])
  const [followUps, setFollowUps] = useState(loadFollowUps)
  const [fuDone, setFuDone] = useState(loadFuDone)
  const [demoEdits, setDemoEdits] = useState(null) // demo-mode only: mutated sample leads
  const [links, setLinks] = useState([]) // tracked links (live mode only)
  const [linkBadges, setLinkBadges] = useState({}) // { leadId: opens-since-last-seen }
  const linkSeenRef = useRef(loadLinkSeen)
  const linksRef = useRef([])
  const docLeadsRef = useRef(leads)
  docLeadsRef.current = leads

  const hasSavedUrl = () => !!getConnection().url
  const demoRef = useRef(demoMode)
  demoRef.current = demoMode
  const authFailedRef = useRef(false) // wrong token → stay usable in demo mode
  const mountedRef = useRef(false)

  function pushToast(msg, kind = 'info') {
    const t = { id: Date.now() + Math.random(), msg, kind }
    setToasts((ts) => [...ts, t])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), 5000)
  }

  // ---------- follow-ups (local until the Reminders phase) ----------
  useEffect(() => {
    localStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(followUps))
  }, [followUps])
  useEffect(() => {
    localStorage.setItem(FU_DONE_KEY, JSON.stringify(fuDone))
  }, [fuDone])

  // Persist the last-known snapshot for offline cold starts.
  useEffect(() => {
    if (demoMode) return
    localStorage.setItem(CACHE_KEY, JSON.stringify({ leads, cachedAt: new Date().toISOString() }))
  }, [leads, demoMode])

  // ---------- loading ----------
  async function loadLive() {
    setBusy(true)
    try {
      const rows = await api.list()
      if (!Array.isArray(rows)) throw new ApiError('server', 'Unexpected response from the backend')
      const mapped = rows.map(mapRow)
      authFailedRef.current = false
      setLeads(mapped)
      setConnState('live')
      // pull meta quietly for the Settings screen (never blocks the list)
      api.meta().then(setMeta).catch(() => {})
      loadLinks(true)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') {
        authFailedRef.current = true
        setDemoEdits(null); demoBaseRef.current = null
        pushToast(err.message, 'error')
      } else {
        const cached = loadCache()
        if (cached && cached.leads.length) {
          setLeads(cached.leads)
          pushToast("Can't reach the sheet — showing cached data", 'error')
        } else {
          setDemoEdits(null); demoBaseRef.current = null
          pushToast(err.message || 'Connection failed', 'error')
        }
      }
      setConnState('offline')
      return false
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    if (!demoMode && hasSavedUrl()) loadLive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After a successful mutation, quietly adopt the server's truth
  // (backend-minted ids, activity log entries, sheet ordering).
  function refetchOnSettle() {
    if (demoRef.current || authFailedRef.current || !hasSavedUrl()) return
    api.list()
      .then((rows) => {
        if (Array.isArray(rows)) {
          setLeads(rows.map(mapRow))
          setConnState('live')
        }
      })
      .catch(() => setConnState('offline'))
  }

  function run(op) {
    // Wraps a backend call with busy flag + error surface.
    setBusy(true)
    return op
      .then((res) => {
        setBusy(false)
        return res
      })
      .catch((err) => {
        setBusy(false)
        if (err instanceof ApiError && err.code === 'unauthorized') {
          authFailedRef.current = true
          setConnState('offline')
          pushToast(err.message, 'error')
        } else {
          setConnState('offline')
          pushToast(err.message || 'Save failed — kept locally, will retry next change', 'error')
        }
        throw err
      })
  }

  // ---------- tracked links (live mode; demo shows a connect hint) ----------
  function absorbLinks(rows, notify) {
    const parsed = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      leadId: String(r.leadId || ''),
      url: r.url || '',
      channel: r.channel || 'whatsapp',
      created: r.created || '',
      opens: parseOpens(r.opens),
    }))
    linksRef.current = parsed
    setLinks(parsed)
    // Raise a badge when a lead's links gained opens since we last looked.
    // Links this browser has never seen get a silent baseline — otherwise
    // every historical open would light up on first connect.
    if (notify) {
      const seen = { ...linkSeenRef.current }
      const counts = {}
      parsed.forEach((ln) => {
        const known = Object.prototype.hasOwnProperty.call(seen, ln.id)
        const prev = Number(seen[ln.id]) || 0
        if (!known) {
          seen[ln.id] = ln.opens.length
        } else if (ln.opens.length > prev && ln.leadId) {
          counts[ln.leadId] = (counts[ln.leadId] || 0) + (ln.opens.length - prev)
          seen[ln.id] = ln.opens.length
        }
      })
      linkSeenRef.current = seen
      localStorage.setItem(LINK_SEEN_KEY, JSON.stringify(seen))
      if (Object.keys(counts).length) {
        setLinkBadges((b) => {
          const next = { ...b }
          Object.entries(counts).forEach(([leadId, n]) => { next[leadId] = (next[leadId] || 0) + n })
          return next
        })
        const named = Object.keys(counts)
          .map((leadId) => docLeadsRef.current?.find((l) => String(l.id) === leadId)?.name)
          .filter(Boolean)[0]
        pushToast(named ? `📡 ${named} opened your link` : '📡 A tracked link was opened', 'info')
      }
    }
  }

  async function loadLinks(notify = false) {
    if (demoRef.current || authFailedRef.current || !hasSavedUrl()) return
    try {
      absorbLinks(await api.links(), notify)
    } catch { /* links are auxiliary — never block the app */ }
  }

  useEffect(() => {
    if (connState !== 'live' || demoMode) return undefined
    const iv = setInterval(() => loadLinks(true), LINK_POLL_MS)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState, demoMode])

  function clearLinkBadge(leadId) {
    setLinkBadges((b) => {
      const next = { ...b }
      delete next[String(leadId)]
      return next
    })
  }

  const nowISO = () => new Date().toISOString()

  // Demo mode (and wrong-token fallback) mutates a private copy of the
  // sample data — never the live leads, never the backend.
  const demoBaseRef = useRef(null)
  const leadsRef = useRef(leads)
  leadsRef.current = leads

  function updateLeads(fn) {
    if (demoRef.current || authFailedRef.current) {
      if (!demoBaseRef.current) {
        demoBaseRef.current = leadsRef.current?.length ? leadsRef.current : sampleLeads()
        // first demo mutation adopts the canned sample follow-ups so the
        // queue keeps working on the mutated sample set
        if (demoRef.current && !authFailedRef.current) {
          setFollowUps((f) => ({ ...sampleFollowUps(), ...f }))
        }
      }
      demoBaseRef.current = fn(demoBaseRef.current)
      setDemoEdits(demoBaseRef.current)
    } else {
      setLeads(fn)
    }
  }

  const actions = {
    // ---- add: adopt the backend-minted integer id (never mint positives locally) ----
    addLead(data) {
      // Sheet-safe phone: production stores digits only (a leading "+" makes
      // Sheets parse the cell as a formula → #ERROR!). Keep wa.me working.
      const phone = String(data.phone || '').replace(/[\s-]/g, '').replace(/^\+/, '')
      const localNextFollowUp = data.nextFollowUp || null
      if (demoMode || authFailedRef.current) {
        const lead = {
          id: -Date.now(), // negative temp id: can never collide with sheet ids
          name: data.name,
          phone,
          source: data.source || 'manual',
          product: data.product || 'Other',
          stage: data.stage || 'new',
          value: Number(data.value) || 0,
          intent: 50,
          notes: data.notes || '',
          created: nowISO(),
          activity: [{ t: 'created', ts: nowISO(), label: 'Lead captured' }],
        }
        updateLeads((ls) => [lead, ...ls])
        if (localNextFollowUp) setFollowUps((f) => ({ ...f, [String(lead.id)]: localNextFollowUp }))
        pushToast('Lead added (demo data only)', 'success')
        return
      }
      const tempId = -Date.now()
      const optimistic = { ...data, phone, id: tempId, created: nowISO(), intent: 50, activity: [{ t: 'created', ts: nowISO(), label: 'Lead captured' }] }
      setLeads((ls) => [optimistic, ...ls])
      run(api.add({ ...data, phone, value: Number(data.value) || 0 }))
        .then(async (res) => {
          const realId = Number(res && res.id) || 0
          if (realId) {
            setLeads((ls) => ls.map((l) => (l.id === tempId ? { ...l, id: realId } : l)))
            if (localNextFollowUp) {
              setFollowUps((f) => {
                const next = { ...f }
                delete next[String(tempId)]
                next[String(realId)] = localNextFollowUp
                return next
              })
            }
          }
          refetchOnSettle()
          pushToast('Lead saved to the sheet', 'success')
        })
        .catch(() => {})
    },

    // ---- stage (kanban drag, modal stage select) ----
    moveLead(id, stage) {
      updateLeads((ls) =>
        ls.map((l) =>
          l.id === id
            ? { ...l, stage, activity: [...(l.activity || []), { t: 'stage', ts: nowISO(), label: 'Moved to ' + stage }] }
            : l
        )
      )
      if (demoMode || authFailedRef.current) return
      run(api.stage(id, stage))
        .then(() => refetchOnSettle())
        .catch(() => {})
    },

    // ---- deal value ----
    setValue(id, value) {
      updateLeads((ls) =>
        ls.map((l) =>
          l.id === id
            ? { ...l, value: Number(value) || 0, activity: [...(l.activity || []), { t: 'stage', ts: nowISO(), label: 'Deal value set to ₱' + (Number(value) || 0) }] }
            : l
        )
      )
      if (demoMode || authFailedRef.current) return
      run(api.value(id, Number(value) || 0))
        .then(() => refetchOnSettle())
        .catch(() => {})
    },

    // ---- notes: the sheet stores one notes string (column 9) ----
    saveNotes(id, text) {
      updateLeads((ls) =>
        ls.map((l) =>
          l.id === id
            ? { ...l, notes: text, activity: [...(l.activity || []), { t: 'note', ts: nowISO(), label: 'Note added' }] }
            : l
        )
      )
      if (demoMode || authFailedRef.current) return
      run(api.note(id, text))
        .then(() => refetchOnSettle())
        .catch(() => {})
    },

    // ---- follow-ups: local-only until the Reminders phase ----
    setFollowUp(id, date) {
      setFollowUps((f) => {
        const next = { ...f }
        if (date) next[String(id)] = date
        else delete next[String(id)]
        return next
      })
    },
    markFollowUpDone(id) {
      const dt = new Date()
      dt.setDate(dt.getDate() + 3)
      const p = (x) => String(x).padStart(2, '0')
      const next = `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
      this.setFollowUp(id, next)
      setFuDone((d) => [...d, { leadId: String(id), at: nowISO() }])
      pushToast('Follow-up done — next one in 3 days', 'success')
    },

    deleteLead(id) {
      updateLeads((ls) => ls.filter((l) => l.id !== id))
      setFollowUps((f) => {
        const next = { ...f }
        delete next[String(id)]
        return next
      })
      if (demoMode || authFailedRef.current) {
        pushToast('Lead deleted (demo data only)', 'success')
        return
      }
      run(api.delete(id))
        .then(() => {
          refetchOnSettle()
          pushToast('Lead deleted — links, proposals and reminders cascaded', 'success')
        })
        .catch(() => {})
    },

    async connect(url, token) {
      if (!url || !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
        throw new ApiError('server', 'Paste the Apps Script Web App URL (ends in /exec)')
      }
      saveConnection(url, token)
      authFailedRef.current = false
      setDemoMode(false)
      setDemoEdits(null); demoBaseRef.current = null
      const ok = await loadLive()
      if (ok) pushToast('Connected — loaded from your sheet', 'success')
    },

    disconnect() {
      clearConnection()
      authFailedRef.current = false
      setDemoEdits(null); demoBaseRef.current = null
      setDemoMode(true)
      setConnState('demo')
      setMeta(null)
      setLinks([])
      setLinkBadges({})
      pushToast('Disconnected — showing demo data', 'info')
    },

    useDemoData(on) {
      setDemoFlag(on)
      if (on) {
        authFailedRef.current = false
        setDemoEdits(null); demoBaseRef.current = null
        setDemoMode(true)
        setConnState('demo')
        setMeta(null)
        setLinks([])
        setLinkBadges({})
      } else {
        setDemoMode(false)
        if (hasSavedUrl()) loadLive()
        else {
          setConnState('demo')
          pushToast('Paste your Apps Script URL to connect', 'info')
        }
      }
    },

    reload() {
      if (!demoMode && hasSavedUrl()) loadLive()
    },

    // ---- tracked links (Phase 2; live mode only, like the old app) ----
    async createLink(lead, url, channel) {
      const res = await run(api.createLink(lead.id, url, channel))
      if (res && res.id) {
        // activity parity with the old app: log "Link sent via <channel>"
        api.actLog(lead.id, 'Link sent via ' + channel).catch(() => {})
        refetchOnSettle()
        await loadLinks(false)
      }
      return res
    },
    async deleteLink(linkId) {
      await run(api.deleteLink(linkId))
      await loadLinks(false)
    },
    // Opening a lead's drawer acknowledges its open-pings.
    markLinkSeen(leadId) {
      const seen = { ...linkSeenRef.current }
      linksRef.current
        .filter((ln) => String(ln.leadId) === String(leadId))
        .forEach((ln) => { seen[ln.id] = ln.opens.length })
      linkSeenRef.current = seen
      localStorage.setItem(LINK_SEEN_KEY, JSON.stringify(seen))
      clearLinkBadge(leadId)
    },

    linksFor(leadId) {
      return linksRef.current.filter((ln) => String(ln.leadId) === String(leadId))
    },
  }

  // Leads served to the UI: demo edits override the sample set; live
  // leads get their local follow-up dates attached.
  const uiLeads = useMemo(() => {
    if (demoMode || authFailedRef.current) {
      const base = demoEdits || leads
      const fu = demoMode && !demoEdits ? sampleFollowUps() : followUps
      return base.map((l) => ({ ...l, nextFollowUp: fu[String(l.id)] || null }))
    }
    return leads.map((l) => ({ ...l, nextFollowUp: followUps[String(l.id)] || null }))
  }, [leads, demoMode, demoEdits, followUps])

  const sync = {
    // pill state: 'demo' | 'live' | 'offline' (+ busy → 'Saving…')
    status: busy ? 'saving' : demoMode || authFailedRef.current ? 'demo' : connState,
    connState: demoMode || authFailedRef.current ? 'demo' : connState,
    busy,
    demoMode: demoMode || authFailedRef.current,
    meta,
    toasts,
    followUpsCompletedThisWeek: fuDone.filter((d) => {
      const t = new Date(d.at).getTime()
      const now = new Date()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      monday.setHours(0, 0, 0, 0)
      return t >= monday.getTime()
    }).length,
  }

  return <StoreContext.Provider value={{ leads: uiLeads, actions, sync, pushToast, links, linkBadges }}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

// All dates are handled as local calendar dates (YYYY-MM-DD) to avoid UTC off-by-one issues.
export function localISO(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function todayISO() {
  return localISO(new Date())
}

export function isOverdue(dateStr) {
  return !!dateStr && dateStr < todayISO()
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const dt = new Date(dateStr + 'T12:00:00')
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export function formatPeso(n) {
  return '₱' + Number(n).toLocaleString('en-PH')
}

export function relTime(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (isNaN(t)) return String(iso)
  const diff = Math.max(0, Date.now() - t)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return m + 'm'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h'
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'd'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}
