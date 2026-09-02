import { createContext, useContext, useEffect, useState } from 'react'
import { seedLeads } from './data'

const STORAGE_KEY = 'wa-aida-leads-v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted storage falls through to seed */ }
  return seedLeads()
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [leads, setLeads] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads))
  }, [leads])

  const actions = {
    addLead(data) {
      const lead = {
        id: `lead-${Date.now()}`,
        notes: [],
        activity: [{ at: localISO(new Date()), text: 'Lead created' }],
        ...data,
      }
      setLeads((ls) => [lead, ...ls])
      return lead
    },
    updateLead(id, patch, activityText) {
      setLeads((ls) =>
        ls.map((l) => {
          if (l.id !== id) return l
          const next = { ...l, ...patch }
          if (activityText) {
            next.activity = [...(l.activity || []), { at: localISO(new Date()), text: activityText }]
          }
          return next
        })
      )
    },
    deleteLead(id) {
      setLeads((ls) => ls.filter((l) => l.id !== id))
    },
    moveLead(id, stage) {
      this.updateLead(id, { stage }, `Moved to ${stage.charAt(0).toUpperCase() + stage.slice(1)}`)
    },
    addNote(id, text) {
      setLeads((ls) =>
        ls.map((l) =>
          l.id === id
            ? {
                ...l,
                notes: [...(l.notes || []), { at: localISO(new Date()), text }],
                activity: [...(l.activity || []), { at: localISO(new Date()), text: 'Note added' }],
              }
            : l
        )
      )
    },
    markFollowUpDone(id) {
      const d = new Date()
      d.setDate(d.getDate() + 3)
      const next = localISO(d)
      this.updateLead(id, { nextFollowUp: next }, 'Follow-up completed — next one scheduled in 3 days')
    },
  }

  return <StoreContext.Provider value={{ leads, actions }}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

export function formatPeso(n) {
  return '₱' + Number(n).toLocaleString('en-PH')
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
