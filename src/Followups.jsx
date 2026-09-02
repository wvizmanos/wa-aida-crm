import { formatDate, isOverdue, todayISO, useStore } from './store'
import { SourceBadge, StageBadge, inputCls } from './ui'
import { SOURCES, STAGES } from './data'
import { useMemo, useState } from 'react'

export default function Followups({ onOpenLead }) {
  const { leads, actions } = useStore()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads
      .filter((l) => l.nextFollowUp)
      .filter((l) => (sourceFilter === 'All' ? true : l.source === sourceFilter))
      .filter((l) => (q ? [l.name, l.business].join(' ').toLowerCase().includes(q) : true))
      .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp))
  }, [leads, search, sourceFilter])

  const overdue = rows.filter((l) => isOverdue(l.nextFollowUp))
  const dueToday = rows.filter((l) => l.nextFollowUp === todayISO())
  const upcoming = rows.filter((l) => l.nextFollowUp > todayISO())

  function Row({ lead }) {
    const od = isOverdue(lead.nextFollowUp)
    return (
      <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${od ? 'border-amber/50 bg-amber/10' : 'border-stone-200 bg-white'}`}>
        <button onClick={() => onOpenLead(lead.id)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{lead.name}</p>
            <StageBadge stage={lead.stage} />
            <SourceBadge source={lead.source} />
            {od && <span className="rounded-full bg-amber px-2 py-0.5 text-[11px] font-semibold text-white">Overdue</span>}
          </div>
          <p className="mt-0.5 truncate text-sm text-navy/50">{lead.business}</p>
        </button>
        <div className="flex items-center gap-3 sm:justify-end">
          <div className="text-right">
            <p className={`text-sm font-semibold ${od ? 'text-amber' : ''}`}>{formatDate(lead.nextFollowUp)}</p>
            <p className="text-[11px] text-navy/40">
              {od ? `${Math.abs(daysUntil(lead.nextFollowUp))} day${Math.abs(daysUntil(lead.nextFollowUp)) === 1 ? '' : 's'} overdue` : daysUntil(lead.nextFollowUp) === 0 ? 'Due today' : `in ${daysUntil(lead.nextFollowUp)} days`}
            </p>
          </div>
          <button
            onClick={() => actions.markFollowUpDone(lead.id)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-deepgreen px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-deepgreen/85 active:bg-deepgreen/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-deepgreen/50"
          >
            ✓ Mark done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Overdue" value={overdue.length} tone="amber" />
        <Stat label="Due today" value={dueToday.length} tone="green" />
        <Stat label="Upcoming" value={upcoming.length} tone="navy" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} sm:w-56`} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${inputCls} sm:w-36`} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option>All</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <Section title="Overdue">
              {overdue.map((l) => <Row key={l.id} lead={l} />)}
            </Section>
          )}
          {dueToday.length > 0 && (
            <Section title="Due today">
              {dueToday.map((l) => <Row key={l.id} lead={l} />)}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming">
              {upcoming.map((l) => <Row key={l.id} lead={l} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function daysUntil(dateStr) {
  const now = new Date(todayISO() + 'T12:00:00')
  const then = new Date(dateStr + 'T12:00:00')
  return Math.round((then - now) / 86400000)
}

function Stat({ label, value, tone }) {
  const tones = {
    amber: 'bg-amber/10 border-amber/40 text-amber',
    green: 'bg-wagreen/10 border-wagreen/40 text-deepgreen',
    navy: 'bg-navy/5 border-navy/15 text-navy',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-navy/50">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-wagreen/50 bg-white px-6 py-14 text-center">
      <p className="text-4xl">🎉</p>
      <p className="mt-3 font-semibold">No follow-ups due 🎉</p>
      <p className="mt-1 text-sm text-navy/50">You're all caught up. Set a next follow-up date on a lead to see it here.</p>
    </div>
  )
}
