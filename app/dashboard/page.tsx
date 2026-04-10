'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Negocio = {
  id: string
  asegurado: string
  actividad: string
  ramo: string
  suma_asegurada_usd: number
  estado: string
  fecha_ingreso: string
  ultima_actualizacion: string
  broker_origen: string
  ubicacion: string
  pais: string
}

const ESTADO_COLORS: Record<string, string> = {
  NUEVO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  EN_ANALISIS: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  COTIZADO: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ORDEN_FIRME: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  CERRADO_GANADO: 'bg-green-500/20 text-green-300 border-green-500/30',
  CERRADO_PERDIDO: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const ESTADO_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  EN_ANALISIS: 'En análisis',
  COTIZADO: 'Cotizado',
  ORDEN_FIRME: 'Orden en firme',
  CERRADO_GANADO: '✅ Cerrado ganado',
  CERRADO_PERDIDO: '❌ Cerrado perdido',
}

function diasSinMovimiento(ultima: string) {
  const diff = Date.now() - new Date(ultima).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function Dashboard() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('TODOS')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('negocios')
      .select('*')
      .order('fecha_ingreso', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setNegocios(data || [])
        setLoading(false)
      })
  }, [])

  const filtrados = filtroEstado === 'TODOS'
    ? negocios
    : negocios.filter(n => n.estado === filtroEstado)

  const stats = {
    total: negocios.length,
    nuevos: negocios.filter(n => n.estado === 'NUEVO').length,
    enProceso: negocios.filter(n => ['EN_ANALISIS', 'COTIZADO', 'ORDEN_FIRME'].includes(n.estado)).length,
    cerrados: negocios.filter(n => n.estado === 'CERRADO_GANADO').length,
    alerta: negocios.filter(n => diasSinMovimiento(n.ultima_actualizacion) > 3).length,
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧊</span>
              <h1 className="text-2xl font-bold text-white">Pipeline de Negocios</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">nizur.io — Powered by Jaina</p>
          </div>
          <a
            href="mailto:flow@nizur.io"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Nuevo submission
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Nuevos', value: stats.nuevos, color: 'text-blue-400' },
            { label: 'En proceso', value: stats.enProceso, color: 'text-yellow-400' },
            { label: 'Cerrados ganados', value: stats.cerrados, color: 'text-green-400' },
            { label: '⚠️ Sin movimiento', value: stats.alerta, color: 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-slate-400 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['TODOS', 'NUEVO', 'EN_ANALISIS', 'COTIZADO', 'ORDEN_FIRME', 'CERRADO_GANADO'].map(estado => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                filtroEstado === estado
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {estado === 'TODOS' ? 'Todos' : ESTADO_LABELS[estado]}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center text-slate-400 py-16">Cargando negocios...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center text-slate-400 py-16">No hay negocios en este estado.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-4">Asegurado</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-4">Ramo</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-4">Suma asegurada</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-4">Estado</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-4">Sin movimiento</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-4">Broker</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((neg, i) => {
                  const dias = diasSinMovimiento(neg.ultima_actualizacion)
                  return (
                    <tr key={neg.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition ${i % 2 === 0 ? '' : 'bg-slate-800/30'}`}>
                      <td className="px-6 py-4">
                        <div className="text-white font-medium text-sm">{neg.asegurado}</div>
                        <div className="text-slate-500 text-xs">{neg.actividad}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm">{neg.ramo}</td>
                      <td className="px-6 py-4 text-slate-300 text-sm">
                        {neg.suma_asegurada_usd ? `USD ${neg.suma_asegurada_usd.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${ESTADO_COLORS[neg.estado] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                          {ESTADO_LABELS[neg.estado] || neg.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${dias > 3 ? 'text-red-400' : 'text-slate-400'}`}>
                          {dias} días {dias > 3 ? '⚠️' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{neg.broker_origen || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
