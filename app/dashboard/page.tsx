'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Negocio = {
  id: string
  asegurado: string
  actividad: string
  actividad_categoria: string
  ramo: string
  ubicacion: string
  pais: string
  suma_asegurada_usd: number
  prima_neta_estimada: number
  brokerage_usd: number
  brokerage_pct: number
  estado: string
  fecha_ingreso: string
  ultima_actualizacion: string
  vigencia_desde: string
  vigencia_hasta: string
  deadline_presentacion: string
  broker_origen: string
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
  CERRADO_GANADO: '✅ Cerrado',
  CERRADO_PERDIDO: '❌ Perdido',
}

const CATEGORIAS = [
  'Todas',
  'Agronegocios/Granos',
  'Distribución/Logística',
  'Retail/Supermercados',
  'Manufactura Alimentos',
  'Manufactura Industrial',
  'Construcción/Ing.Civil',
  'Oil&Gas/Energía',
  'Siderurgia/Minería',
  'Product Recall/CPI',
  'Servicios Profesionales',
  'Tecnología/Software',
  'Otras',
]

function diasParaDeadline(fecha: string | null) {
  if (!fecha) return null
  const diff = new Date(fecha).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function diasSinMov(ultima: string) {
  const diff = Date.now() - new Date(ultima).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtUSD(n: number | null) {
  if (!n) return '—'
  return `USD ${n.toLocaleString('es-AR')}`
}

export default function Dashboard() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [busqueda, setBusqueda] = useState('')

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

  const filtrados = negocios.filter(n => {
    const matchEstado = filtroEstado === 'TODOS' || n.estado === filtroEstado
    const matchCat = filtroCategoria === 'Todas' || n.actividad_categoria === filtroCategoria
    const matchBusq = !busqueda || n.asegurado.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchCat && matchBusq
  })

  const totalPrima = filtrados.reduce((s, n) => s + (n.prima_neta_estimada || 0), 0)
  const totalBrokerage = filtrados.reduce((s, n) => s + (n.brokerage_usd || 0), 0)

  const stats = {
    total: negocios.length,
    nuevos: negocios.filter(n => n.estado === 'NUEVO').length,
    enProceso: negocios.filter(n => ['EN_ANALISIS', 'COTIZADO', 'ORDEN_FIRME'].includes(n.estado)).length,
    cerrados: negocios.filter(n => n.estado === 'CERRADO_GANADO').length,
    alertasMov: negocios.filter(n => diasSinMov(n.ultima_actualizacion) > 3).length,
    alertasDeadline: negocios.filter(n => {
      const d = diasParaDeadline(n.deadline_presentacion)
      return d !== null && d <= 7 && d >= 0
    }).length,
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧊</span>
            <div>
              <h1 className="text-xl font-bold text-white">Pipeline de Negocios</h1>
              <p className="text-slate-400 text-xs">nizur.io — Powered by Jaina</p>
            </div>
          </div>
          <a href="mailto:flow@nizur.io" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <span>+</span> Nuevo submission
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-white', sub: '' },
            { label: 'Nuevos', value: stats.nuevos, color: 'text-blue-400', sub: '' },
            { label: 'En proceso', value: stats.enProceso, color: 'text-yellow-400', sub: '' },
            { label: 'Ganados', value: stats.cerrados, color: 'text-green-400', sub: '' },
            { label: '⚠️ Sin mov.', value: stats.alertasMov, color: 'text-red-400', sub: '>3 días' },
            { label: '🔔 Deadline', value: stats.alertasDeadline, color: 'text-orange-400', sub: '<7 días' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
              {s.sub && <div className="text-slate-500 text-xs">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {/* Búsqueda */}
          <input
            type="text"
            placeholder="Buscar asegurado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
          />

          {/* Estado */}
          <div className="flex gap-1 flex-wrap">
            {['TODOS', 'NUEVO', 'EN_ANALISIS', 'COTIZADO', 'ORDEN_FIRME', 'CERRADO_GANADO'].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${filtroEstado === e ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                {e === 'TODOS' ? 'Todos' : ESTADO_LABELS[e]}
              </button>
            ))}
          </div>

          {/* Categoría */}
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500">
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Totales filtrados */}
        {(totalPrima > 0 || totalBrokerage > 0) && (
          <div className="flex gap-4 mb-4 text-sm">
            <span className="text-slate-400">Prima estimada: <span className="text-white font-medium">{fmtUSD(totalPrima)}</span></span>
            <span className="text-slate-400">Brokerage: <span className="text-green-400 font-medium">{fmtUSD(totalBrokerage)}</span></span>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center text-slate-400 py-16 text-sm">Cargando negocios...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-sm">No hay negocios con estos filtros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Asegurado', 'Categoría', 'Ramo', 'Límite / Prima', 'Vigencia', 'Deadline', 'Estado', 'Sin mov.'].map(h => (
                      <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((neg, i) => {
                    const dias = diasSinMov(neg.ultima_actualizacion)
                    const dlDias = diasParaDeadline(neg.deadline_presentacion)
                    const dlAlert = dlDias !== null && dlDias <= 7 && dlDias >= 0
                    return (
                      <tr key={neg.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium text-sm">{neg.asegurado}</div>
                          <div className="text-slate-500 text-xs">{neg.pais || neg.ubicacion}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs bg-slate-700/50 px-2 py-0.5 rounded">
                            {neg.actividad_categoria || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{neg.ramo}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-300 text-xs">{fmtUSD(neg.suma_asegurada_usd)}</div>
                          {neg.prima_neta_estimada > 0 && (
                            <div className="text-green-400 text-xs">Prima: {fmtUSD(neg.prima_neta_estimada)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {neg.vigencia_desde ? (
                            <div>{fmtDate(neg.vigencia_desde)}<br/>{fmtDate(neg.vigencia_hasta)}</div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {neg.deadline_presentacion ? (
                            <div className={`text-xs font-medium ${dlAlert ? 'text-orange-400' : 'text-slate-400'}`}>
                              {fmtDate(neg.deadline_presentacion)}
                              {dlAlert && <span className="ml-1">🔔 {dlDias}d</span>}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ESTADO_COLORS[neg.estado] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                            {ESTADO_LABELS[neg.estado] || neg.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${dias > 3 ? 'text-red-400' : 'text-slate-400'}`}>
                            {dias}d {dias > 3 ? '⚠️' : ''}
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
