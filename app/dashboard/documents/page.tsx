'use client'
import { TopBar } from '@/components/TopBar'
import { motion } from 'framer-motion'

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Documentos" />
      <div className="flex-1 overflow-y-auto p-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mt-16 text-center"
        >
          <div className="text-5xl mb-4">📁</div>
          <h2 className="text-white font-bold text-xl mb-2">Documentos</h2>
          <p className="text-slate-400 text-sm mb-6">
            Todos los documentos generados por Jaina — Slips, UW Summaries, BWs, NDBs, NCRs
          </p>
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-500">
            Próximamente: acceso directo a Supabase Storage con preview y descarga
          </div>
        </motion.div>
      </div>
    </div>
  )
}
