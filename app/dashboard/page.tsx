'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

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
  intake: 'Intake',
  submission_preparation: 'Preparando',
  marketed: 'En mercado',
  quoted: 'Cotizado',
  negotiation: 'Negociación',
  ordered: 'Orden firme',
  bound: 'Cerrado',
  documentation: 'Documentación',
  invoiced: 'Facturado',
  closed: 'Completado',
  lost: 'Perdido',
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

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroStage, setFiltroStage] = useState('TODOS')
  const [filtroRamo, setFiltroRamo] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('pipeline_dashboard_view').select('*').order('last_activity_at', { ascending: false }),
      supabase.from('pipeline_kpis_view').select('*').limit(1).single(),
    ]).then(([{ data: opps, error: e1 }, { data: k, error: e2 }]) => {
      if (e1) console.error('opps error:', e1)
      if (e2) console.error('kpis error:', e2)
      setOpportunities(opps || [])
      setKpis(k)
      setLoading(false)
    })
  }, [])

  const ramos = ['Todos', ...Array.from(new Set(opportunities.map(o => o.ramo).filter(Boolean)))]

  const filtrados = opportunities.filter(o => {
    const matchStage = filtroStage === 'TODOS' || o.stage === filtroStage
    const matchRamo = filtroRamo === 'Todos' || o.ramo === filtroRamo
    const matchBusq = !busqueda ||
      o.insured_name?.toLowerCase().includes(busqueda.toLowerCase()) ||
      o.title?.toLowerCase().includes(busqueda.toLowerCase())
    return matchStage && matchRamo && matchBusq
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Pipeline de Negocios</h1>
            <p className="text-slate-500 text-xs">nizur.io</p>
          </div>
          <a href="mailto:flow@nizur.io"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            + Nuevo submission
          </a>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: kpis.total, color: 'text-white' },
              { label: 'En proceso', value: kpis.en_proceso, color: 'text-blue-400' },
              { label: 'Ganados/Cerrados', value: kpis.ganados_o_cerrados, color: 'text-green-400' },
              { label: 'Sin mov. +3d', value: kpis.sin_mov_mas_3_dias, color: 'text-red-400' },
              { label: 'Deadline <7d', value: kpis.deadline_menos_7_dias, color: 'text-orange-400' },
              { label: 'Prima estimada', value: fmtUSD(kpis.prima_estimada_total), color: 'text-cyan-400', small: true },
              { label: 'Brokerage est.', value: fmtUSD(kpis.brokerage_estimado_total), color: 'text-emerald-400', small: true },
              { label: 'Revenue pond.', value: fmtUSD(kpis.revenue_ponderado_total), color: 'text-violet-400', small: true },
              { label: 'Perdidos', value: kpis.perdidos, color: 'text-slate-400' },
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
          <input
            type="text"
            placeholder="Buscar asegurado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
          />
          <div className="flex gap-1 flex-wrap">
            {STAGE_GROUPS.map(s => (
              <button key={s.value} onClick={() => setFiltroStage(s.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  filtroStage === s.value
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500">
            {ramos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Tabla */}
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
                    {['Asegurado', 'Ramo', 'Límite', 'Prima', 'Weight', 'Docs', 'Deadline', 'Sin mov.', 'Estado'].map(h => (
                      <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((o, i) => {
                    const dlAlert = o.deadline_at && new Date(o.deadline_at) <= new Date(Date.now() + 7*86400000)
                    const movAlert = o.days_without_movement > 3
                    const hasMissing = o.missing_open_count > 0
                    return (
                      <tr key={o.id}
                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium text-sm">{o.insured_name || o.title}</div>
                          <div className="text-slate-500 text-xs">{o.country}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs bg-slate-700/50 px-2 py-0.5 rounded">{o.ramo || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{fmtUSD(o.limit_amount)}</td>
                        <td className="px-4 py-3">
                          {o.estimated_premium
                            ? <span className="text-green-400 text-xs font-medium">{fmtUSD(o.estimated_premium)}</span>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs">{o.weight_percent ? `${o.weight_percent}%` : '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 items-center">
                            {o.documents_count > 0 && (
                              <span className="text-blue-400 text-xs">📎{o.documents_count}</span>
                            )}
                            {hasMissing && (
                              <span className="text-orange-400 text-xs">⚠️{o.missing_open_count}</span>
                            )}
                            {o.quotes_count > 0 && (
                              <span className="text-purple-400 text-xs">💬{o.quotes_count}</span>
                            )}
                            {!o.documents_count && !hasMissing && !o.quotes_count && (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {o.deadline_at
                            ? <span className={`text-xs font-medium ${dlAlert ? 'text-orange-400' : 'text-slate-400'}`}>
                                {fmtDate(o.deadline_at)}{dlAlert ? ' 🔔' : ''}
                              </span>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${movAlert ? 'text-red-400' : 'text-slate-400'}`}>
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
            {filtrados.length} oportunidad{filtrados.length !== 1 ? 'es' : ''} · Actualizado {new Date().toLocaleTimeString('es-AR')}
          </div>
        )}
      </div>
    </main>
  )
}
