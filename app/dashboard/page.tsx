'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Opportunity = {
  id: string
  title: string
  category: string
  ramo: string
  insured_name: string
  country: string
  currency: string
  limit_amount: number
  estimated_premium: number
  brokerage_estimated: number
  policy_start: string
  policy_end: string
  deadline_at: string
  stage: string
  priority_score: number
  owner: string
  updated_at: string
  last_activity_at: string
  days_without_movement_live: number
  days_to_deadline: number
}

type KPIs = {
  total: number
  nuevos: number
  en_proceso: number
  ganados: number
  sin_mov_mas_3_dias: number
  deadline_menos_7_dias: number
  prima_estimada_total: number
  brokerage_estimado_total: number
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_review: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  quoted: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  bound: 'bg-green-500/20 text-green-300 border-green-500/30',
  closed: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevo',
  in_review: 'En análisis',
  quoted: 'Cotizado',
  bound: 'Cerrado',
  closed: 'Perdido',
}

function fmtUSD(n: number | null) {
  if (!n) return '—'
  if (n >= 1000000000) return `USD ${(n/1000000000).toFixed(1)}B`
  if (n >= 1000000) return `USD ${(n/1000000).toFixed(1)}M`
  return `USD ${n.toLocaleString('es-AR')}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
      supabase.from('pipeline_dashboard_view').select('*').order('updated_at', { ascending: false }),
      supabase.from('pipeline_kpis_view').select('*').single(),
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
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Pipeline de Negocios</h1>
            <p className="text-slate-500 text-xs">nizur.io</p>
          </div>
          <a href="mailto:flow@nizur.io" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            + Nuevo submission
          </a>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              { label: 'Total', value: kpis.total, color: 'text-white' },
              { label: 'Nuevos', value: kpis.nuevos, color: 'text-blue-400' },
              { label: 'En proceso', value: kpis.en_proceso, color: 'text-yellow-400' },
              { label: 'Ganados', value: kpis.ganados, color: 'text-green-400' },
              { label: 'Sin mov. +3d', value: kpis.sin_mov_mas_3_dias, color: 'text-red-400' },
              { label: 'Deadline <7d', value: kpis.deadline_menos_7_dias, color: 'text-orange-400' },
              { label: 'Prima total', value: fmtUSD(kpis.prima_estimada_total), color: 'text-cyan-400', small: true },
              { label: 'Brokerage', value: fmtUSD(kpis.brokerage_estimado_total), color: 'text-emerald-400', small: true },
            ].map(k => (
              <div key={k.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <div className={`font-bold ${k.color} ${(k as any).small ? 'text-base' : 'text-2xl'}`}>{k.value}</div>
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
            {['TODOS', 'new', 'in_review', 'quoted', 'bound', 'closed'].map(s => (
              <button key={s} onClick={() => setFiltroStage(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${filtroStage === s ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {s === 'TODOS' ? 'Todos' : STAGE_LABELS[s]}
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
            <div className="text-center text-slate-400 py-16 text-sm">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-sm">No hay negocios con estos filtros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Asegurado', 'Ramo', 'Límite', 'Prima', 'Deadline', 'Estado', 'Sin mov.'].map(h => (
                      <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((o, i) => {
                    const dlAlert = o.days_to_deadline !== null && o.days_to_deadline <= 7 && o.days_to_deadline >= 0
                    const movAlert = o.days_without_movement_live > 3
                    return (
                      <tr key={o.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium text-sm">{o.insured_name || o.title}</div>
                          <div className="text-slate-500 text-xs">{o.country}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs bg-slate-700/50 px-2 py-0.5 rounded">{o.ramo || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{fmtUSD(o.limit_amount)}</td>
                        <td className="px-4 py-3">
                          {o.estimated_premium ? (
                            <span className="text-green-400 text-xs font-medium">{fmtUSD(o.estimated_premium)}</span>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {o.deadline_at ? (
                            <span className={`text-xs font-medium ${dlAlert ? 'text-orange-400' : 'text-slate-400'}`}>
                              {fmtDate(o.deadline_at)}{dlAlert ? ` 🔔` : ''}
                            </span>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STAGE_COLORS[o.stage] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                            {STAGE_LABELS[o.stage] || o.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${movAlert ? 'text-red-400' : 'text-slate-400'}`}>
                            {o.days_without_movement_live} días {movAlert ? '⚠️' : ''}
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
      </div>
    </main>
  )
}
