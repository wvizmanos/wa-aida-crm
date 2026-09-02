export const STAGES = [
  { id: 'new', label: 'New', color: '#16213e' },
  { id: 'contacted', label: 'Contacted', color: '#0e7490' },
  { id: 'qualified', label: 'Qualified', color: '#1b5e20' },
  { id: 'quoted', label: 'Quoted', color: '#f59e0b' },
  { id: 'won', label: 'Won', color: '#25d366' },
  { id: 'lost', label: 'Lost', color: '#c75b39' },
]

export const SOURCES = ['FB Ads', 'Manual', 'CSV Import']

export const SOURCE_STYLES = {
  'FB Ads': 'bg-blue-100 text-blue-800 border-blue-200',
  Manual: 'bg-stone-100 text-stone-700 border-stone-300',
  'CSV Import': 'bg-violet-100 text-violet-800 border-violet-200',
}

// Dates are generated relative to "today" so overdue states stay realistic.
function d(offsetDays) {
  const dt = new Date()
  dt.setHours(12, 0, 0, 0)
  dt.setDate(dt.getDate() + offsetDays)
  const p = (x) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

let n = 0
const id = () => `lead-${++n}`

export const seedLeads = () => [
  {
    id: id(), name: 'Maria Santos', business: 'Sari-sari Store (Quezon City)', phone: '+639171234567',
    source: 'FB Ads', value: 12000, stage: 'new', lastContact: d(-1), nextFollowUp: d(1),
    notes: [{ at: d(-1), text: 'Inquired about inventory tracking for her store. Wants to try before committing.' }],
    activity: [{ at: d(-1), text: 'Lead created from FB Ads inquiry' }],
  },
  {
    id: id(), name: 'Juan Dela Cruz', business: 'Dela Cruz Construction Manpower', phone: '+639182345678',
    source: 'Manual', value: 85000, stage: 'contacted', lastContact: d(-2), nextFollowUp: d(0),
    notes: [{ at: d(-2), text: 'Needs worker scheduling + payroll reminders for 40 crew members.' }],
    activity: [{ at: d(-2), text: 'Lead created manually' }, { at: d(-2), text: 'First WhatsApp message sent' }],
  },
  {
    id: id(), name: 'Ana Reyes', business: "Ana's Siomai Franchise (3 branches)", phone: '+639203456789',
    source: 'FB Ads', value: 45000, stage: 'qualified', lastContact: d(-3), nextFollowUp: d(-2),
    notes: [{ at: d(-3), text: 'Confirmed budget approved. Asked for supplier order tracking too.' }],
    activity: [{ at: d(-3), text: 'Qualified after discovery call' }],
  },
  {
    id: id(), name: 'Carlo Mendoza', business: 'Mendoza Print Shop (Davao)', phone: '+639194567890',
    source: 'CSV Import', value: 25000, stage: 'quoted', lastContact: d(-5), nextFollowUp: d(-1),
    notes: [{ at: d(-5), text: 'Sent quotation for Pro plan. Comparing us with a spreadsheet setup.' }],
    activity: [{ at: d(-5), text: 'Quotation ₱25,000 sent via WhatsApp' }],
  },
  {
    id: id(), name: 'Grace Lim', business: 'Grace Beauty Supplies', phone: '+639175678901',
    source: 'Manual', value: 30000, stage: 'won', lastContact: d(-8), nextFollowUp: null,
    notes: [{ at: d(-8), text: 'Closed! Paid full year upfront. Onboarded her two staff.' }],
    activity: [{ at: d(-8), text: 'Deal won 🎉 — ₱30,000' }],
  },
  {
    id: id(), name: 'Roberto Villanueva', business: 'RV Bike Parts & Repair', phone: '+639186789012',
    source: 'FB Ads', value: 8000, stage: 'new', lastContact: null, nextFollowUp: d(2),
    notes: [], activity: [{ at: d(0), text: 'Lead created from FB Ads inquiry' }],
  },
  {
    id: id(), name: 'Liza Aquino', business: 'Aquino Rice Dealer (Bulacan)', phone: '+639197890123',
    source: 'CSV Import', value: 60000, stage: 'contacted', lastContact: d(-4), nextFollowUp: d(-3),
    notes: [{ at: d(-4), text: 'Wants customer credit tracking (utang list). Very interested.' }],
    activity: [{ at: d(-4), text: 'First WhatsApp message sent' }],
  },
  {
    id: id(), name: 'Paolo Garcia', business: 'PG Milk Tea Shop', phone: '+639208901234',
    source: 'Manual', value: 15000, stage: 'qualified', lastContact: d(-2), nextFollowUp: d(3),
    notes: [{ at: d(-2), text: 'Two branches, wants daily sales summary pushed to WhatsApp.' }],
    activity: [{ at: d(-2), text: 'Qualified after demo' }],
  },
  {
    id: id(), name: 'Michelle Torres', business: 'Torres Catering Services', phone: '+639179012345',
    source: 'FB Ads', value: 95000, stage: 'quoted', lastContact: d(-6), nextFollowUp: d(0),
    notes: [{ at: d(-6), text: 'Sent ₱95,000 annual quote. Booking season peaks in December.' }],
    activity: [{ at: d(-6), text: 'Quotation ₱95,000 sent via WhatsApp' }],
  },
  {
    id: id(), name: 'Danilo Ramos', business: 'Ramos Hardware & Electrical', phone: '+639180123456',
    source: 'CSV Import', value: 40000, stage: 'new', lastContact: d(-1), nextFollowUp: d(4),
    notes: [{ at: d(-1), text: 'Referred by Grace Lim. Store in Pampanga with 3 staff.' }],
    activity: [{ at: d(-1), text: 'Lead created from CSV import' }],
  },
  {
    id: id(), name: 'Katrina Bautista', business: 'KB Online Fashion Resale', phone: '+639191234567',
    source: 'Manual', value: 6500, stage: 'won', lastContact: d(-12), nextFollowUp: null,
    notes: [{ at: d(-12), text: 'Small but recurring seller. Monthly plan.' }],
    activity: [{ at: d(-12), text: 'Deal won 🎉 — ₱6,500' }],
  },
  {
    id: id(), name: 'Ferdinand Cruz', business: 'FF Auto Repair Shop', phone: '+639202345678',
    source: 'FB Ads', value: 18000, stage: 'contacted', lastContact: d(-7), nextFollowUp: d(1),
    notes: [{ at: d(-7), text: 'Replied once, went quiet. Try voice note next time.' }],
    activity: [{ at: d(-7), text: 'First WhatsApp message sent' }],
  },
  {
    id: id(), name: 'Sofia Navarro', business: 'Navarro Bakeshop (Cebu)', phone: '+639173456789',
    source: 'Manual', value: 22000, stage: 'qualified', lastContact: d(-3), nextFollowUp: d(-4),
    notes: [{ at: d(-3), text: 'Wants order tracking for custom cakes. Decision this week.' }],
    activity: [{ at: d(-3), text: 'Qualified after store visit' }],
  },
  {
    id: id(), name: 'Ricardo Flores', business: 'Flores Water Refilling Station', phone: '+639184567890',
    source: 'CSV Import', value: 5000, stage: 'lost', lastContact: d(-20), nextFollowUp: null,
    notes: [{ at: d(-20), text: 'Chose a free app instead. Revisit in 6 months.' }],
    activity: [{ at: d(-20), text: 'Marked lost — went with a free competitor' }],
  },
  {
    id: id(), name: 'Jasmine Ocampo', business: "Jasmine's Ukay-Ukay Boutique", phone: '+639195678901',
    source: 'FB Ads', value: 150000, stage: 'quoted', lastContact: d(-1), nextFollowUp: d(2),
    notes: [{ at: d(-1), text: 'Biggest deal in pipeline. Multi-branch, 5 locations. Wants barangay-level delivery reports.' }],
    activity: [{ at: d(-1), text: 'Quotation ₱150,000 sent via WhatsApp' }],
  },
]
