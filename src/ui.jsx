import { useState } from 'react'
import { SOURCE_STYLES, SOURCES, STAGES } from './data'
import { formatDate, formatPeso, isOverdue, useStore } from './store'

// ---------- small shared bits ----------

export function SourceBadge({ source }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLES[source] || 'bg-stone-100 text-stone-700 border-stone-300'}`}>
      {source}
    </span>
  )
}

export function StageBadge({ stage }) {
  const s = STAGES.find((x) => x.id === stage)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color }} />
      {s?.label || stage}
    </span>
  )
}

const btnBase = 'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-wagreen/60 disabled:opacity-40 disabled:cursor-not-allowed'

export function Button({ variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-wagreen text-white hover:bg-deepgreen active:bg-deepgreen/90 shadow-sm',
    secondary: 'bg-white text-navy border border-stone-300 hover:border-navy/50 hover:bg-stone-50 active:bg-stone-100',
    danger: 'bg-white text-terracotta border border-terracotta/40 hover:bg-terracotta hover:text-white active:bg-terracotta/90',
    ghost: 'text-navy/70 hover:bg-navy/5 hover:text-navy active:bg-navy/10',
  }
  return <button className={`${btnBase} ${variants[variant]} ${className}`} {...props} />
}

export const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-navy placeholder:text-stone-400 focus:border-wagreen focus:outline-none focus:ring-2 focus:ring-wagreen/25'

// ---------- Add / Edit lead modal ----------

export function LeadModal({ lead, onClose }) {
  const { actions } = useStore()
  const editing = !!lead
  const [form, setForm] = useState({
    name: lead?.name || '',
    business: lead?.business || '',
    phone: lead?.phone || '',
    source: lead?.source || 'Manual',
    value: lead?.value ?? '',
    stage: lead?.stage || 'new',
    nextFollowUp: lead?.nextFollowUp || '',
  })
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.phone.trim()) errs.phone = 'Phone number is required'
    else if (!/^\+?[\d\s-]{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload = { ...form, name: form.name.trim(), phone: form.phone.trim(), value: Number(form.value) || 0, nextFollowUp: form.nextFollowUp || null }
    if (editing) actions.updateLead(lead.id, payload, 'Lead details edited')
    else actions.addLead(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editing ? 'Edit lead' : 'New lead'}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close" className="h-8 w-8 !p-0 text-xl leading-none">×</Button>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/70">Name *</label>
            <input className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. Maria Santos" />
            {errors.name && <p className="mt-1 text-xs text-terracotta">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/70">Business type</label>
            <input className={inputCls} value={form.business} onChange={set('business')} placeholder="e.g. Sari-sari Store (Quezon City)" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy/70">WhatsApp number *</label>
            <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+63 9xx xxx xxxx" />
            {errors.phone && <p className="mt-1 text-xs text-terracotta">{errors.phone}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/70">Source</label>
              <select className={inputCls} value={form.source} onChange={set('source')}>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/70">Deal value (₱)</label>
              <input type="number" min="0" className={inputCls} value={form.value} onChange={set('value')} placeholder="15000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/70">Stage</label>
              <select className={inputCls} value={form.stage} onChange={set('stage')}>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/70">Next follow-up</label>
              <input type="date" className={inputCls} value={form.nextFollowUp} onChange={set('nextFollowUp')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Add lead'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------- Lead detail drawer ----------

export function LeadDrawer({ lead, onClose, onEdit }) {
  const { actions } = useStore()
  const [noteText, setNoteText] = useState('')

  if (!lead) return null
  const waNumber = lead.phone.replace(/[^\d]/g, '').replace(/^0/, '63')
  const waLink = `https://wa.me/${waNumber}`

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-navy/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{lead.name}</h2>
                <StageBadge stage={lead.stage} />
              </div>
              <p className="mt-0.5 text-sm text-navy/60">{lead.business || '—'}</p>
            </div>
            <Button variant="ghost" onClick={onClose} aria-label="Close" className="h-8 w-8 !p-0 text-xl leading-none">×</Button>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-navy/50">Deal value</p>
              <p className="font-semibold">{formatPeso(lead.value)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-navy/50">Source</p>
              <div className="mt-0.5"><SourceBadge source={lead.source} /></div>
            </div>
            <div>
              <p className="text-xs font-medium text-navy/50">Phone</p>
              <p>{lead.phone}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-navy/50">Next follow-up</p>
              <p className={isOverdue(lead.nextFollowUp) ? 'font-semibold text-amber' : ''}>
                {formatDate(lead.nextFollowUp)}{isOverdue(lead.nextFollowUp) ? ' · overdue' : ''}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className={`${btnBase} flex-1 bg-wagreen px-3 py-2 text-white shadow-sm hover:bg-deepgreen active:bg-deepgreen/90`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.2L2.1 22l4.9-1.5A9.9 9.9 0 1 0 12.04 2Zm5.8 14.1c-.25.7-1.45 1.35-2 1.4-.55.05-1.05.15-2.9-.6-2.3-.95-3.75-3.3-3.85-3.45-.1-.15-.9-1.25-.9-2.4 0-1.15.6-1.7.8-1.95.2-.25.45-.3.6-.3h.45c.15 0 .35-.05.55.4.2.5.7 1.75.75 1.85.05.15.1.3 0 .45-.1.15-.15.25-.3.4l-.45.5c-.15.15-.3.3-.15.6.15.3.7 1.2 1.5 1.9 1.05.9 1.9 1.2 2.2 1.35.3.15.45.1.6-.05.15-.15.7-.8.9-1.1.2-.3.35-.25.65-.15.3.15 1.85.9 2.15 1.05.3.15.5.2.55.3.05.15.05.7-.2 1.4Z"/></svg>
              Chat on WhatsApp
            </a>
            <Button variant="secondary" onClick={() => onEdit(lead)}>Edit</Button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notes</h3>
              <span className="text-xs text-navy/40">{(lead.notes || []).length}</span>
            </div>
            <div className="space-y-2">
              {(lead.notes || []).length === 0 && (
                <p className="rounded-lg border border-dashed border-stone-300 bg-cream px-3 py-4 text-center text-sm text-navy/50">No notes yet — jot down what matters here.</p>
              )}
              {(lead.notes || []).slice().reverse().map((nt, i) => (
                <div key={i} className="rounded-lg border border-stone-200 bg-cream px-3 py-2 text-sm">
                  <p>{nt.text}</p>
                  <p className="mt-1 text-[11px] text-navy/40">{formatDate(nt.at)}</p>
                </div>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (!noteText.trim()) return; actions.addNote(lead.id, noteText.trim()); setNoteText('') }}
            >
              <input className={inputCls} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…" />
              <Button type="submit" disabled={!noteText.trim()}>Add</Button>
            </form>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Activity log</h3>
            <ol className="space-y-0">
              {(lead.activity || []).length === 0 && <p className="text-sm text-navy/50">No activity yet.</p>}
              {(lead.activity || []).slice().reverse().map((a, i, arr) => (
                <li key={i} className="relative flex gap-3 pb-3 pl-1 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[4.5px] top-4 h-full w-px bg-stone-200" />}
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-wagreen" />
                  <div>
                    <p className="text-sm">{a.text}</p>
                    <p className="text-[11px] text-navy/40">{formatDate(a.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <Button variant="danger" onClick={() => { actions.deleteLead(lead.id); onClose() }}>Delete lead</Button>
          </div>
        </div>
      </aside>
    </div>
  )
}
