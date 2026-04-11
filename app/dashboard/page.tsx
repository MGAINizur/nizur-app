'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Opportunity = {
  id: string
  title: string
  company_name: string
  category: string
  ramo: string
  insured_name: string
  country: string
  currency: string
  limit_amount: number
  estimated_premium: number
  brokerage_estimated: number
  weight_percent: number
  weighted_revenue: number
  policy_start: string
  policy_end: string
  deadline_at: string
  stage: string
  priority_score: number
  owner_name: string
  updated_at: string
  last_activity_at: string
  days_without_movement: number
  documents_count: number
  missing_open_count: number
  quotes_count: number
  submission_id: string
}

type Quote = {
  id: string
  market_id: string
  quote_status: string
  line_percent: number
  premium_amount: number
  brokerage_percent: number
  deductible_summary: string
  exclusions_summary: string
  subjectivities_summary: string
  quote_received_at: string
  raw_quote_json: any
}

type Market = {
  id: string
  market_name: string
  country: string
  market_type: string
}

type KPIs = {
  total: number
  intake: number
  en_proceso: number
  ganados_o_cerrados: number
  perdidos: number
  sin_mov_mas_3_dias: number
  deadline_menos_7_dias: number
  prima_estimada_total: number
  brokerage_estimado_total: number
  revenue_ponderado_total: number
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  intake: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  submission_preparation: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  marketed: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  quoted: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  negotiation: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  ordered: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  bound: 'bg-green-500/20 text-green-300 border-green-500/30',
  documentation: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  invoiced: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  closed: 'bg-green-700/20 text-green-400 border-green-700/30',
  lost: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake', submission_preparation: 'Preparando',
  marketed: 'En mercado', quoted: 'Cotizado', negotiation: 'Negociación',
  ordered: 'Orden firme', bound: 'Cerrado', documentation: 'Documentación',
  invoiced: 'Facturado', closed: 'Completado', lost: 'Perdido',
}

const QUOTE_STATUS_COLORS: Record<string, string> = {
  indicative: 'text-cyan-400', firm: 'text-green-400', accepted: 'text-green-500',
  declined: 'text-red-400', expired: 'text-slate-500', superseded: 'text-slate-400',
  rejected: 'text-red-500',
}

const STAGE_GROUPS = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Intake', value: 'intake' },
  { label: 'Preparando', value: 'submission_preparation' },
  { label: 'En mercado', value: 'marketed' },
  { label: 'Cotizado', value: 'quoted' },
  { label: 'Negociación', value: 'negotiation' },
  { label: 'Orden firme', value: 'ordered' },
  { label: 'Cerrado', value: 'bound' },
  { label: 'Perdido', value: 'lost' },
]

// ─── FORMATTERS ───────────────────────────────────────────────────────────────

function fmtUSD(n: number | null) {
  if (!n) return '—'
  if (n >= 1_000_000_000) return `USD ${(n/1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `USD ${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `USD ${(n/1_000).toFixed(0)}K`
  return `USD ${n.toLocaleString('es-AR')}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtPct(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(1)}%`
}

// ─── PLACEMENT GAP COMPONENT ─────────────────────────────────────────────────

function PlacementGapBar({ quotes }: { quotes: Quote[] }) {
  const totalSigned = quotes.filter(q => ['accepted', 'firm'].includes(q.quote_status))
    .reduce((s, q) => s + (q.line_percent || 0), 0)
  const totalQuoted = quotes.filter(q => ['indicative', 'firm', 'accepted'].includes(q.quote_status))
    .reduce((s, q) => s + (q.line_percent || 0), 0)
  const gap = Math.max(0, 100 - totalSigned)

  if (quotes.length === 0) return <div className="text-slate-500 text-xs">Sin cotizaciones</div>

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Signed: <span className="text-green-400 font-medium">{fmtPct(totalSigned)}</span></span>
        <span>Quoted: <span className="text-purple-400 font-medium">{fmtPct(totalQuoted)}</span></span>
        <span className={gap > 0 ? 'text-orange-400 font-medium' : 'text-green-400 font-medium'}>
          Gap: {fmtPct(gap)}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
        <div className="h-full bg-green-500 rounded-l" style={{ width: `${Math.min(totalSigned, 100)}%` }} />
        <div className="h-full bg-purple-500/60" style={{ width: `${Math.min(Math.max(totalQuoted - totalSigned, 0), 100 - totalSigned)}%` }} />
      </div>
    </div>
  )
}

// ─── OPPORTUNITY DETAIL MODAL ────────────────────────────────────────────────

function OpportunityModal({ opp, onClose }: { opp: Opportunity, onClose: () => void }) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [markets, setMarkets] = useState<Record<string, Market>>({})
  const [activeTab, setActiveTab] = useState<'overview' | 'market_map' | 'docs'>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('quotes').select('*').eq('opportunity_id', opp.id).order('quote_received_at', { ascending: false }),
      supabase.from('markets').select('*'),
    ]).then(([{ data: q }, { data: m }]) => {
      setQuotes(q || [])
      const mMap: Record<string, Market> = {}
      for (const market of m || []) mMap[market.id] = market
      setMarkets(mMap)
      setLoading(false)
    })
  }, [opp.id])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STAGE_COLORS[opp.stage] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                {STAGE_LABELS[opp.stage] || opp.stage}
              </span>
              <span className="text-slate-500 text-xs">{opp.ramo}</span>
            </div>
            <h2 className="text-white font-bold text-lg">{opp.insured_name || opp.title}</h2>
            <div className="text-slate-400 text-sm mt-0.5">{opp.country} · {fmtUSD(opp.limit_amount)} límite · Weight {fmtPct(opp.weight_percent)}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {(['overview', 'market_map', 'docs'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              {tab === 'overview' ? 'Overview' : tab === 'market_map' ? '📊 Market Map' : '📁 Docs'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? <div className="text-slate-400 text-sm">Cargando...</div> : (

            activeTab === 'overview' ? (
              <div className="space-y-4">
                {/* Key metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'TIV / Límite', value: fmtUSD(opp.limit_amount) },
                    { label: 'Prima estimada', value: fmtUSD(opp.estimated_premium), color: 'text-green-400' },
                    { label: 'Brokerage est.', value: fmtUSD(opp.brokerage_estimated), color: 'text-emerald-400' },
                    { label: 'Revenue pond.', value: fmtUSD(opp.weighted_revenue), color: 'text-violet-400' },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-800 rounded-xl p-3">
                      <div className={`font-bold text-base ${m.color || 'text-white'}`}>{m.value}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Details */}
                <div className="bg-slate-800/60 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    ['Ramo', opp.ramo],
                    ['País', opp.country],
                    ['Vigencia', opp.policy_start ? `${fmtDate(opp.policy_start)} — ${fmtDate(opp.policy_end)}` : '—'],
                    ['Deadline', opp.deadline_at ? fmtDate(opp.deadline_at) : '—'],
                    ['Sin movimiento', `${opp.days_without_movement} días`],
                    ['Cotizaciones', String(opp.quotes_count)],
                    ['Documentos', String(opp.documents_count)],
                    ['Faltantes abiertos', String(opp.missing_open_count)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-400">{k}</span>
                      <span className="text-white">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Placement gap */}
                {quotes.length > 0 && (
                  <div className="bg-slate-800/60 rounded-xl p-4">
                    <div className="text-slate-300 text-sm font-medium mb-3">Placement Progress</div>
                    <PlacementGapBar quotes={quotes} />
                  </div>
                )}
              </div>

            ) : activeTab === 'market_map' ? (
              <div className="space-y-4">
                {/* Placement gap bar */}
                {quotes.length > 0 && (
                  <div className="bg-slate-800/60 rounded-xl p-4">
                    <div className="text-slate-300 text-sm font-medium mb-3">Placement Gap</div>
                    <PlacementGapBar quotes={quotes} />
                  </div>
                )}

                {/* Market map table */}
                {quotes.length === 0 ? (
                  <div className="text-slate-400 text-sm bg-slate-800/40 rounded-xl p-6 text-center">
                    No hay cotizaciones registradas para este negocio.
                    <div className="text-slate-500 text-xs mt-1">Registrá la primera cotización con: <code className="bg-slate-700 px-1 rounded">@Jaina registrá cotización de [mercado] para {opp.insured_name}</code></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-700">
                          {['Mercado', 'Línea %', 'Prima', 'Estado', 'Deducible', 'Subjetividades', 'Fecha'].map(h => (
                            <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {quotes.map(q => {
                          const market = markets[q.market_id]
                          const statusColor = QUOTE_STATUS_COLORS[q.quote_status] || 'text-slate-400'
                          return (
                            <tr key={q.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                              <td className="px-3 py-2">
                                <div className="text-white text-sm font-medium">{market?.market_name || 'TBC'}</div>
                                {market?.country && <div className="text-slate-500 text-xs">{market.country}</div>}
                              </td>
                              <td className="px-3 py-2 text-sm text-white font-medium">{fmtPct(q.line_percent)}</td>
                              <td className="px-3 py-2 text-sm text-green-400">{q.premium_amount ? fmtUSD(q.premium_amount) : '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs font-medium ${statusColor}`}>
                                  {q.quote_status?.toUpperCase() || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-400 text-xs">{q.deductible_summary || '—'}</td>
                              <td className="px-3 py-2 text-slate-400 text-xs max-w-[150px] truncate">{q.subjectivities_summary || '—'}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{fmtDate(q.quote_received_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            ) : (
              // Docs tab
              <div className="text-slate-400 text-sm space-y-2">
                <div className="flex gap-2 text-xs">
                  <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">📎 {opp.documents_count} docs</span>
                  {opp.missing_open_count > 0 && <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded">⚠️ {opp.missing_open_count} faltantes</span>}
                </div>
                <div className="bg-slate-800/40 rounded-xl p-4 text-center">
                  <div className="text-slate-300 text-sm mb-1">Documentos en Supabase Storage</div>
                  <div className="text-slate-500 text-xs">Acceso a documentos via dashboard v2 — próximamente</div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-700 flex gap-2">
          <a href={`mailto:flow@nizur.io?subject=Re: ${opp.title}`}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            ✉️ Enviar mail
          </a>
          <div className="text-slate-500 text-xs self-center ml-auto">
            Ref: {opp.id.substring(0, 8)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroStage, setFiltroStage] = useState('TODOS')
  const [filtroRamo, setFiltroRamo] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('pipeline_dashboard_view').select('*').order('last_activity_at', { ascending: false }),
      supabase.from('pipeline_kpis_view').select('*').limit(1).single(),
    ]).then(([{ data: opps }, { data: k }]) => {
      setOpportunities(opps || [])
      setKpis(k)
      setLoading(false)
    })
  }, [])

  const ramos = ['Todos', ...Array.from(new Set(opportunities.map(o => o.ramo).filter(Boolean)))]

  const filtrados = opportunities.filter(o => {
    const matchStage = filtroStage === 'TODOS' || o.stage === filtroStage
    const matchRamo = filtroRamo === 'Todos' || o.ramo === filtroRamo
    const matchBusq = !busqueda || o.insured_name?.toLowerCase().includes(busqueda.toLowerCase()) || o.title?.toLowerCase().includes(busqueda.toLowerCase())
    return matchStage && matchRamo && matchBusq
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      {selectedOpp && <OpportunityModal opp={selectedOpp} onClose={() => setSelectedOpp(null)} />}

      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Facultative Cockpit</h1>
            <p className="text-slate-500 text-xs">nizur.io · Pipeline de Reaseguro Facultativo</p>
          </div>
          <a href="mailto:flow@nizur.io" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            + Nuevo submission
          </a>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: kpis.total, color: 'text-white' },
              { label: 'En proceso', value: kpis.en_proceso, color: 'text-blue-400' },
              { label: 'Ganados', value: kpis.ganados_o_cerrados, color: 'text-green-400' },
              { label: 'Sin mov. +3d', value: kpis.sin_mov_mas_3_dias, color: 'text-red-400' },
              { label: 'Deadline <7d', value: kpis.deadline_menos_7_dias, color: 'text-orange-400' },
              { label: 'Prima estimada', value: fmtUSD(kpis.prima_estimada_total), color: 'text-cyan-400', small: true },
              { label: 'Brokerage est.', value: fmtUSD(kpis.brokerage_estimado_total), color: 'text-emerald-400', small: true },
              { label: 'Revenue pond.', value: fmtUSD(kpis.revenue_ponderado_total), color: 'text-violet-400', small: true },
              { label: 'Perdidos', value: kpis.perdidos, color: 'text-slate-500' },
              { label: 'Intake', value: kpis.intake, color: 'text-slate-400' },
            ].map(k => (
              <div key={k.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <div className={`font-bold ${k.color} ${(k as any).small ? 'text-sm' : 'text-2xl'}`}>{k.value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input type="text" placeholder="Buscar asegurado..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48" />
          <div className="flex gap-1 flex-wrap">
            {STAGE_GROUPS.map(s => (
              <button key={s.value} onClick={() => setFiltroStage(s.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${filtroStage === s.value ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500">
            {ramos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center text-slate-400 py-16 text-sm">Cargando pipeline...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-sm">
              {opportunities.length === 0 ? 'Pipeline vacío — enviá un submission a flow@nizur.io' : 'No hay negocios con estos filtros.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Asegurado', 'Ramo', 'Límite', 'Prima', 'Weight', 'Gap', 'Deadline', 'Sin mov.', 'Estado'].map(h => (
                      <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((o, i) => {
                    const dlAlert = o.deadline_at && new Date(o.deadline_at) <= new Date(Date.now() + 7*86400000)
                    const movAlert = o.days_without_movement > 3
                    return (
                      <tr key={o.id} onClick={() => setSelectedOpp(o)}
                        className={`border-b border-slate-700/50 hover:bg-slate-700/40 transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium text-sm">{o.insured_name || o.title}</div>
                          <div className="text-slate-500 text-xs">{o.country}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs bg-slate-700/50 px-2 py-0.5 rounded">{o.ramo || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{fmtUSD(o.limit_amount)}</td>
                        <td className="px-4 py-3">
                          {o.estimated_premium ? <span className="text-green-400 text-xs font-medium">{fmtUSD(o.estimated_premium)}</span>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{fmtPct(o.weight_percent)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 items-center">
                            {o.quotes_count > 0 ? (
                              <span className="text-purple-400 text-xs">💬{o.quotes_count}</span>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                            {o.missing_open_count > 0 && <span className="text-orange-400 text-xs">⚠️{o.missing_open_count}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {o.deadline_at ? <span className={`text-xs ${dlAlert ? 'text-orange-400 font-medium' : 'text-slate-400'}`}>
                            {fmtDate(o.deadline_at)}{dlAlert ? ' 🔔' : ''}
                          </span> : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${movAlert ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                            {o.days_without_movement}d{movAlert ? ' ⚠️' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STAGE_COLORS[o.stage] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                            {STAGE_LABELS[o.stage] || o.stage}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtrados.length > 0 && (
          <div className="text-slate-500 text-xs mt-2 text-right">
            {filtrados.length} oportunidad{filtrados.length !== 1 ? 'es' : ''} · Click para ver detalle
          </div>
        )}
      </div>
    </main>
  )
}
