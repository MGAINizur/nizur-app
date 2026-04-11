'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { TopBar } from '@/components/TopBar'

type Market = {
  id: string
  market_name: string
  country: string
  market_type: string
  am_best_rating: string
  active: boolean
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      sb.from('markets').select('*').order('market_name').then(({ data }) => {
        setMarkets(data || [])
        setLoading(false)
      })
    })
  }, [])

  const filtered = markets.filter(m =>
    !search || m.market_name?.toLowerCase().includes(search.toLowerCase()) || m.country?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Mercados" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[1200px] mx-auto space-y-4">

          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="Buscar mercado o país..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56 transition"
            />
            <span className="text-slate-500 text-xs">{filtered.length} reaseguradores</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-sm">
              <div className="text-3xl mb-2">🌐</div>
              <div>{markets.length === 0 ? 'Sin mercados registrados aún' : 'No hay mercados con ese criterio'}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 hover:border-slate-500 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-white font-medium text-sm">{m.market_name}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{m.country}</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full mt-1 ${m.active ? 'bg-green-400' : 'bg-slate-600'}`} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    {m.market_type && (
                      <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded">{m.market_type}</span>
                    )}
                    {m.am_best_rating && (
                      <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded">A.M. Best: {m.am_best_rating}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
