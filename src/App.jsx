import { useState } from 'react'
import Board from './Board'
import Followups from './Followups'
import Analytics from './Analytics'
import { LeadDrawer, LeadModal } from './ui'
import { useStore } from './store'

const TABS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'analytics', label: 'Analytics' },
]

export default function App() {
  const { leads } = useStore()
  const [tab, setTab] = useState('pipeline')
  const [openLeadId, setOpenLeadId] = useState(null)
  const [modalLead, setModalLead] = useState(null) // null = closed, 'new' = add, object = edit

  const openLead = leads.find((l) => l.id === openLeadId) || null
  const overdueCount = leads.filter((l) => l.nextFollowUp && l.nextFollowUp < new Date().toISOString().slice(0, 10)).length

  return (
    <div className="flex h-screen flex-col">
      <header className="shrink-0 border-b border-stone-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-wagreen text-sm font-bold text-white">A</span>
            <div>
              <h1 className="text-base font-bold leading-tight">WA AIDA</h1>
              <p className="text-[11px] leading-tight text-navy/50">Lead & pipeline tracker</p>
            </div>
          </div>
          <nav className="flex gap-1 rounded-xl bg-cream p-1 text-[13px] sm:text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                  tab === t.id ? 'bg-white text-navy shadow-sm' : 'text-navy/60 hover:text-navy'
                }`}
              >
                {t.label}
                {t.id === 'followups' && overdueCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-white">
                    {overdueCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'pipeline' && <Board onOpenLead={setOpenLeadId} onNewLead={() => setModalLead('new')} />}
        {tab === 'followups' && <Followups onOpenLead={setOpenLeadId} />}
        {tab === 'analytics' && <Analytics />}
      </main>

      <LeadDrawer
        lead={openLead}
        onClose={() => setOpenLeadId(null)}
        onEdit={(lead) => setModalLead(lead)}
      />
      {modalLead !== null && (
        <LeadModal
          lead={modalLead === 'new' ? null : modalLead}
          onClose={() => setModalLead(null)}
        />
      )}
    </div>
  )
}
