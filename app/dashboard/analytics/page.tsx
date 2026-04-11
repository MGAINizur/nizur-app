'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { TopBar } from '@/components/TopBar'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, FunnelChart, Funnel, LabelList,
} from 'recharts'

const RAMO_COLORS: Record<string, string> = {
  'Power Generation': '#3b82f6',
  'Property': '#10b981',
  'RC General': '#f59e0b',
  'Property OAR': '#10b981',
}

const STAGE_COLORS_CHART: Record<string, string> = {
  intake: '#64748b',
  submission_preparation: '#3b82f6',
  marketed: '#06b6d4',
  quoted: '#a855f7',
  negotiation: '#eab308',
  ordered: '#f97316',
  bound: '#22c55e',
  lost: '#ef4444',
}

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  submission_preparation: 'Preparando',
  marketed: 'En mercado',
  quoted: 'Cotizado',
  negotiation: 'Negociación',
  ordered: 'Orden firme',
  bound: 'Cerrado',
  lost: 'Perdido',
}

function fmtUSD(n: number) {
  if (!n) return '$0'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm shadow-xl">
        <p className="text-slate-300 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmtUSD(p.value) : p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AnalyticsPage() {
  const [opps, setOpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      sb.from('opportunities')
        .select('id, title, stage, ramo, estimated_premium, brokerage_estimated, weight_percent, weighted_revenue, limit_amount, last_activity_at')
        .then(({ data }) => {
          setOpps(data || [])
          setLoading(false)
        })
    })
  }, [])

  // Pipeline funnel data
  const stages = ['intake', 'submission_preparation', 'marketed', 'quoted', 'negotiation', 'ordered', 'bound']
  const funnelData = stages.map(s => ({
    name: STAGE_LABELS[s],
    value: opps.filter(o => o.stage === s).length,
    fill: STAGE_COLORS_CHART[s],
  })).filter(d => d.value > 0)

  // By ramo pie
  const ramoMap: Record<string, number> = {}
  opps.forEach(o => {
    const ramo = (o.ramo || 'Otro').replace('Property OAR', 'Property')
    ramoMap[ramo] = (ramoMap[ramo] || 0) + 1
  })
  const ramoData = Object.entries(ramoMap).map(([name, value]) => ({ name, value }))

  // Brokerage by ramo bar
  const brokerageByRamo: Record<string, number> = {}
  opps.forEach(o => {
    const ramo = (o.ramo || 'Otro').replace('Property OAR', 'Property')
    brokerageByRamo[ramo] = (brokerageByRamo[ramo] || 0) + (o.brokerage_estimated || 0)
  })
  const brokerageData = Object.entries(brokerageByRamo).map(([name, value]) => ({ name, value }))

  // Stage distribution bar
  const stageData = stages.map(s => ({
    name: STAGE_LABELS[s],
    negocios: opps.filter(o => o.stage === s).length,
    prima: opps.filter(o => o.stage === s).reduce((sum, o) => sum + (o.estimated_premium || 0), 0),
  }))

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4']

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Analytics" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[1400px] mx-auto space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Prima estimada total', value: fmtUSD(opps.reduce((s, o) => s + (o.estimated_premium || 0), 0)), color: 'text-cyan-400' },
              { label: 'Brokerage estimado', value: fmtUSD(opps.reduce((s, o) => s + (o.brokerage_estimated || 0), 0)), color: 'text-emerald-400' },
              { label: 'Revenue ponderado', value: fmtUSD(opps.reduce((s, o) => s + (o.weighted_revenue || 0), 0)), color: 'text-violet-400' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4"
              >
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-slate-400 text-sm mt-1">{card.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Pipeline por stage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
            >
              <h3 className="text-white font-medium text-sm mb-4">Negocios por stage</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="negocios" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Por ramo pie */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
            >
              <h3 className="text-white font-medium text-sm mb-4">Distribución por ramo</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ramoData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={false}>
                    {ramoData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Brokerage por ramo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
            >
              <h3 className="text-white font-medium text-sm mb-4">Brokerage estimado por ramo</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={brokerageData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtUSD} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Brokerage" radius={[4, 4, 0, 0]}>
                    {brokerageData.map((entry, i) => (
                      <Cell key={i} fill={RAMO_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Prima por stage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
            >
              <h3 className="text-white font-medium text-sm mb-4">Prima estimada por stage</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageData.filter(d => d.prima > 0)} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtUSD} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="prima" name="Prima" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {opps.length === 0 && (
            <div className="text-center text-slate-400 py-16 text-sm">
              <div className="text-3xl mb-2">📊</div>
              <div>Sin datos aún — los gráficos aparecerán cuando haya oportunidades en el pipeline</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
