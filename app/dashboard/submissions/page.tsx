'use client'
import { TopBar } from '@/components/TopBar'
import { motion } from 'framer-motion'

export default function SubmissionsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Submissions" />
      <div className="flex-1 overflow-y-auto p-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mt-16 text-center"
        >
          <div className="text-5xl mb-4">📥</div>
          <h2 className="text-white font-bold text-xl mb-2">Submissions</h2>
          <p className="text-slate-400 text-sm mb-6">
            Inbox de submissions procesados automáticamente por Jaina desde <span className="text-blue-400">flow@nizur.io</span>
          </p>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 text-left space-y-3">
            <div className="text-slate-300 text-sm font-medium">Próximamente</div>
            <ul className="text-slate-400 text-xs space-y-1.5">
              <li>• Lista de mails procesados con estado de extracción</li>
              <li>• Datos extraídos vs. datos faltantes por submission</li>
              <li>• Reenvío y corrección manual de datos</li>
              <li>• Vinculación submission → oportunidad</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
