'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/TopBar'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Opportunity = {
  id: string
  title: string
  stage: string
  ramo: string
  insured_name: string
  country: string
  currency: string
  limit_amount: number
  estimated_premium: number
  brokerage_estimated: number
  orden_percent: number
  prima_orden: number
  weight_percent: number
  weighted_revenue: number
  policy_start: string
  policy_end: string
  deadline_at: string
  priority_score: number
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
  if (n === null || n === undefined || n === 0) return '—'
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtPct(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(1)}%`
}

function cleanName(name: string | null): string {
  if (!name) return '—'
  let n = name.replace(/\s*—\s*(Property OAR|Property|RC General|Power Generation|Power Gen)[\s\S]*/i, '').trim()
  if (n === n.toUpperCase() && n.length > 6) {
    n = n.toLowerCase().replace(/(?:^|\s|\/)([a-zà-ÿ])/g, (_: string, c: string) => c.toUpperCase())
  }
  return n
}

function cleanRamo(ramo: string | null): string {
  if (!ramo) return '—'
  return ramo.replace(/Property OAR/gi, 'Property').replace(/Power Generation/gi, 'Power Gen')
}

// ─── MINI PIPELINE BAR ────────────────────────────────────────────────────────

function PipelineBar({ opportunities }: { opportunities: Opportunity[] }) {
  const stages = ['intake', 'submission_preparation', 'marketed', 'quoted', 'negotiation', 'ordered', 'bound']
  const counts = stages.map(s => ({ stage: s, count: opportunities.filter(o => o.stage === s).length }))
  const max = Math.max(...counts.map(c => c.count), 1)

  return (
    <div className="flex items-end gap-1 h-8">
      {counts.map(({ stage, count }) => (
        <div key={stage} className="flex flex-col items-center gap-0.5 flex-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(count / max) * 32}px` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className={`w-full rounded-sm ${
              stage === 'bound' ? 'bg-green-500' :
              stage === 'negotiation' || stage === 'quoted' ? 'bg-yellow-500' :
              'bg-blue-500'
            } opacity-70`}
          />
        </div>
      ))}
    </div>
  )
}

// ─── PLACEMENT GAP ────────────────────────────────────────────────────────────

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
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(totalSigned, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-green-500 rounded-l"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(totalQuoted - totalSigned, 0), 100 - totalSigned)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          className="h-full bg-purple-500/60"
        />
      </div>
    </div>
  )
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, small, delay }: { label: string, value: string | number, color: string, small?: boolean, delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay || 0 }}
      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 hover:border-slate-600 transition"
    >
      <div className={`font-bold ${color} ${small ? 'text-sm' : 'text-2xl'}`}>{value}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
    </motion.div>
  )
}

// ─── OPPORTUNITY MODAL ────────────────────────────────────────────────────────

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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-700 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STAGE_COLORS[opp.stage] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {STAGE_LABELS[opp.stage] || opp.stage}
                </span>
                <span className="text-slate-500 text-xs">{cleanRamo(opp.ramo)}</span>
              </div>
              <h2 className="text-white font-bold text-lg">{cleanName(opp.insured_name || opp.title)}</h2>
              <div className="text-slate-400 text-sm mt-0.5">
                {opp.country && `${opp.country} · `}{cleanRamo(opp.ramo)} · {fmtUSD(opp.limit_amount)} límite · Weight {fmtPct(opp.weight_percent)}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">×</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            {(['overview', 'market_map', 'docs'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
                {tab === 'overview' ? '📋 Overview' : tab === 'market_map' ? '📊 Market Map' : '📁 Docs'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-5">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              activeTab === 'overview' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'TIV / Límite', value: fmtUSD(opp.limit_amount) },
                      { label: 'Prima total', value: fmtUSD(opp.estimated_premium) },
                      { label: `Orden ${fmtPct(opp.orden_percent)}`, value: fmtUSD(opp.prima_orden), color: 'text-green-400' },
                      { label: 'Brokerage s/orden', value: fmtUSD(opp.prima_orden ? opp.prima_orden * 0.07 : opp.brokerage_estimated), color: 'text-emerald-400' },
                    ].map(m => (
                      <div key={m.label} className="bg-slate-800 rounded-xl p-3">
                        <div className={`font-bold text-base ${(m as any).color || 'text-white'}`}>{m.value}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ['Ramo', cleanRamo(opp.ramo)],
                      ['País', opp.country || '—'],
                      ['Vigencia', opp.policy_start ? `${fmtDate(opp.policy_start)} — ${fmtDate(opp.policy_end)}` : '—'],
                      ['Deadline', opp.deadline_at ? fmtDate(opp.deadline_at) : '—'],
                      ['Sin movimiento', `${opp.days_without_movement} días`],
                      ['Cotizaciones', String(opp.quotes_count || 0)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-white">{v}</span>
                      </div>
                    ))}
                  </div>
                  {quotes.length > 0 && (
                    <div className="bg-slate-800/60 rounded-xl p-4">
                      <div className="text-slate-300 text-sm font-medium mb-3">Placement Progress</div>
                      <PlacementGapBar quotes={quotes} />
                    </div>
                  )}
                </motion.div>

              ) : activeTab === 'market_map' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {quotes.length > 0 && (
                    <div className="bg-slate-800/60 rounded-xl p-4">
                      <div className="text-slate-300 text-sm font-medium mb-3">Placement Gap</div>
                      <PlacementGapBar quotes={quotes} />
                    </div>
                  )}
                  {quotes.length === 0 ? (
                    <div className="text-slate-400 text-sm bg-slate-800/40 rounded-xl p-6 text-center">
                      No hay cotizaciones registradas.
                      <div className="text-slate-500 text-xs mt-1">
                        Usá <code className="bg-slate-700 px-1 rounded">@Jaina registrá cotización de [mercado] para {cleanName(opp.insured_name)}</code>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="border-b border-slate-700">
                            {['Mercado', 'Línea %', 'Prima', 'Estado', 'Deducible', 'Fecha'].map(h => (
                              <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-2">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {quotes.map(q => {
                            const market = markets[q.market_id]
                            return (
                              <tr key={q.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                <td className="px-3 py-2">
                                  <div className="text-white text-sm font-medium">{market?.market_name || 'TBC'}</div>
                                  {market?.country && <div className="text-slate-500 text-xs">{market.country}</div>}
                                </td>
                                <td className="px-3 py-2 text-sm text-white font-medium">{fmtPct(q.line_percent)}</td>
                                <td className="px-3 py-2 text-sm text-green-400">{q.premium_amount ? fmtUSD(q.premium_amount) : '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-xs font-medium ${QUOTE_STATUS_COLORS[q.quote_status] || 'text-slate-400'}`}>
                                    {q.quote_status?.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-400 text-xs">{q.deductible_summary || '—'}</td>
                                <td className="px-3 py-2 text-slate-500 text-xs">{fmtDate(q.quote_received_at)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>

              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="bg-slate-800/40 rounded-xl p-6 text-center">
                    <div className="text-slate-300 text-sm mb-1">📁 Documentos</div>
                    <div className="text-slate-500 text-xs">Acceso a docs en Supabase Storage — dashboard v2</div>
                  </div>
                </motion.div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 flex gap-2 items-center">
            <a href={`mailto:flow@nizur.io?subject=Re: ${opp.title}`}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              ✉️ Enviar mail
            </a>
            <span className="text-slate-600 text-xs ml-auto font-mono">{opp.id.substring(0, 8)}</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [sessionUser, setSessionUser] = useState<string | null>(null)
  const [filtroStage, setFiltroStage] = useState('TODOS')
  const [filtroRamo, setFiltroRamo] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Wait for auth session before querying
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthChecked(true)
      console.log('[dashboard] session:', session?.user?.email, 'expires:', session?.expires_at)
      if (!session) {
        console.warn('[dashboard] no session — trying getUser fallback')
        // Fallback: try getUser which can refresh the session
        supabase.auth.getUser().then(({ data: { user } }) => {
          console.log('[dashboard] getUser fallback:', user?.email)
          if (user) loadData(supabase)
          else setLoading(false)
        })
        return
      }
      setSessionUser(session.user.email || null)
      loadData(supabase)
    })

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadData(supabase)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadData(supabase: ReturnType<typeof createClient>) {
    const { data: rawOpps, error } = await supabase
      .from('opportunities')
      .select(`
        id, title, stage, weight_percent, weighted_revenue,
        limit_amount, estimated_premium, brokerage_estimated,
        orden_percent, prima_orden,
        policy_start, policy_end, deadline_at, priority_score,
        created_at, updated_at, last_activity_at, company_id, submission_id,
        ramo, category
      `)
      .order('last_activity_at', { ascending: false })

    if (error) {
      console.error('Error loading opportunities:', error.message, error.code)
      setLoading(false)
      return
    }

    console.log('[dashboard] loaded opportunities:', rawOpps?.length, rawOpps?.[0])

    const opps = ((rawOpps || []) as any[]).map((o: any) => ({
      ...o,
      insured_name: o.title,
      country: null,
      currency: 'USD',
      owner_name: null,
      orden_percent: o.orden_percent ?? 10,
      prima_orden: o.prima_orden ?? 0,
      days_without_movement: o.last_activity_at
        ? Math.floor((Date.now() - new Date(o.last_activity_at).getTime()) / 86400000)
        : 0,
      documents_count: 0,
      missing_open_count: 0,
      quotes_count: 0,
    }))

    setOpportunities(opps)

    const now = Date.now()
    const k: KPIs = {
      total: opps.length,
      intake: opps.filter((o: any) => o.stage === 'intake').length,
      en_proceso: opps.filter((o: any) => ['submission_preparation','marketed','quoted','negotiation'].includes(o.stage)).length,
      ganados_o_cerrados: opps.filter((o: any) => ['bound','documentation','invoiced','closed'].includes(o.stage)).length,
      perdidos: opps.filter((o: any) => o.stage === 'lost').length,
      sin_mov_mas_3_dias: opps.filter((o: any) => o.days_without_movement > 3 && !['closed','lost'].includes(o.stage)).length,
      deadline_menos_7_dias: opps.filter((o: any) => o.deadline_at && new Date(o.deadline_at).getTime() <= now + 7*86400000 && !['closed','lost'].includes(o.stage)).length,
      prima_estimada_total: opps.reduce((s: number, o: any) => s + (o.estimated_premium || 0), 0),
      brokerage_estimado_total: opps.reduce((s: number, o: any) => s + (o.brokerage_estimated || 0), 0),
      revenue_ponderado_total: opps.reduce((s: number, o: any) => s + (o.weighted_revenue || 0), 0),
    }
    setKpis(k)
    setLoading(false)
  }

  const ramos = ['Todos', ...Array.from(new Set(opportunities.map(o => o.ramo).filter(Boolean)))]
  const filtrados = opportunities.filter(o => {
    const matchStage = filtroStage === 'TODOS' || o.stage === filtroStage
    const matchRamo = filtroRamo === 'Todos' || o.ramo === filtroRamo
    const matchBusq = !busqueda || o.insured_name?.toLowerCase().includes(busqueda.toLowerCase()) || o.title?.toLowerCase().includes(busqueda.toLowerCase())
    return matchStage && matchRamo && matchBusq
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Facultative Cockpit" />

      <div className="flex-1 overflow-y-auto p-5">
        {selectedOpp && <OpportunityModal opp={selectedOpp} onClose={() => setSelectedOpp(null)} />}

        <div className="max-w-[1400px] mx-auto space-y-5">

          {/* KPIs */}
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : kpis ? (
            <>
              {/* Pipeline mini bar */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs font-medium">Pipeline por stage</span>
                  <span className="text-slate-500 text-xs">{kpis.total} negocios totales</span>
                </div>
                <PipelineBar opportunities={opportunities} />
                <div className="flex gap-3 mt-2">
                  {['intake','submission_preparation','marketed','quoted','negotiation','ordered','bound'].map(s => (
                    <div key={s} className="text-[10px] text-slate-500">{STAGE_LABELS[s]}: {opportunities.filter(o => o.stage === s).length}</div>
                  ))}
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total" value={kpis.total} color="text-white" delay={0} />
                <KpiCard label="En proceso" value={kpis.en_proceso} color="text-blue-400" delay={0.05} />
                <KpiCard label="Ganados" value={kpis.ganados_o_cerrados} color="text-green-400" delay={0.1} />
                <KpiCard label="Sin mov. +3d" value={kpis.sin_mov_mas_3_dias} color="text-red-400" delay={0.15} />
                <KpiCard label="Deadline <7d" value={kpis.deadline_menos_7_dias} color="text-orange-400" delay={0.2} />
                <KpiCard label="Prima estimada" value={fmtUSD(kpis.prima_estimada_total)} color="text-cyan-400" small delay={0.25} />
                <KpiCard label="Brokerage est." value={fmtUSD(kpis.brokerage_estimado_total)} color="text-emerald-400" small delay={0.3} />
                <KpiCard label="Revenue pond." value={fmtUSD(kpis.revenue_ponderado_total)} color="text-violet-400" small delay={0.35} />
                <KpiCard label="Perdidos" value={kpis.perdidos} color="text-slate-500" delay={0.4} />
                <KpiCard label="Intake" value={kpis.intake} color="text-slate-400" delay={0.45} />
              </div>
            </>
          ) : null}

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Buscar asegurado..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 transition"
            />
            <div className="flex gap-1 flex-wrap">
              {STAGE_GROUPS.map(s => (
                <motion.button
                  key={s.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFiltroStage(s.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    filtroStage === s.value
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {s.label}
                </motion.button>
              ))}
            </div>
            <select
              value={filtroRamo}
              onChange={e => setFiltroRamo(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500 transition"
            >
              {ramos.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {(filtroStage !== 'TODOS' || filtroRamo !== 'Todos' || busqueda) && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { setFiltroStage('TODOS'); setFiltroRamo('Todos'); setBusqueda('') }}
                className="text-slate-500 hover:text-slate-300 text-xs transition"
              >
                ✕ Limpiar
              </motion.button>
            )}
          </div>

          {/* Table */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="text-center text-slate-400 py-16 text-sm">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Cargando pipeline...
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center text-slate-400 py-16 text-sm">
                {opportunities.length === 0
                  ? <div>
                      <div className="text-2xl mb-2">📭</div>
                      <div>Pipeline vacío — enviá un submission a <span className="text-blue-400">flow@nizur.io</span></div>
                      {authChecked && !sessionUser && (
                        <div className="mt-3 text-orange-400 text-xs">⚠️ Sesión no detectada — <a href="/" className="underline">volvé a loguearte</a></div>
                      )}
                    </div>
                  : 'No hay negocios con estos filtros.'}

              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {['Asegurado', 'Ramo', 'Límite', 'Prima total', 'Orden %', 'Prima/Orden', 'Brokerage', 'Weight', 'Brok×W', 'Gap', 'Deadline', 'Sin mov.', 'Estado'].map(h => (
                        <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filtrados.map((o, i) => {
                        const dlAlert = o.deadline_at && new Date(o.deadline_at) <= new Date(Date.now() + 7*86400000)
                        const movAlert = o.days_without_movement > 3
                        return (
                          <motion.tr
                            key={o.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            onClick={() => setSelectedOpp(o)}
                            className={`border-b border-slate-700/50 hover:bg-slate-700/40 transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="text-white font-medium text-sm">{cleanName(o.insured_name || o.title)}</div>
                              {o.country && <div className="text-slate-500 text-xs">{o.country}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-slate-300 text-xs bg-slate-700/50 px-2 py-0.5 rounded">{cleanRamo(o.ramo)}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-300 text-xs">{fmtUSD(o.limit_amount)}</td>
                            <td className="px-4 py-3">
                              {o.estimated_premium
                                ? <span className="text-slate-300 text-xs">{fmtUSD(o.estimated_premium)}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-cyan-400 text-xs font-medium">{fmtPct(o.orden_percent)}</span>
                            </td>
                            <td className="px-4 py-3">
                              {o.prima_orden
                                ? <span className="text-green-400 text-xs font-medium">{fmtUSD(o.prima_orden)}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {o.brokerage_estimated
                                ? <span className="text-emerald-400 text-xs">{fmtUSD(o.prima_orden ? o.prima_orden * 0.07 : o.brokerage_estimated)}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{fmtPct(o.weight_percent)}</td>
                            <td className="px-4 py-3">
                              {o.prima_orden && o.weight_percent
                                ? <span className="text-violet-400 text-xs font-medium">{fmtUSD(o.prima_orden * 0.07 * o.weight_percent / 100)}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {o.quotes_count > 0
                                ? <span className="text-purple-400 text-xs">💬 {o.quotes_count}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {o.deadline_at
                                ? <span className={`text-xs ${dlAlert ? 'text-orange-400 font-medium' : 'text-slate-400'}`}>
                                    {fmtDate(o.deadline_at)}{dlAlert ? ' 🔔' : ''}
                                  </span>
                                : <span className="text-slate-600 text-xs">—</span>}
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
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filtrados.length > 0 && (
            <div className="text-slate-500 text-xs text-right">
              {filtrados.length} oportunidad{filtrados.length !== 1 ? 'es' : ''} · Click para ver detalle
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
