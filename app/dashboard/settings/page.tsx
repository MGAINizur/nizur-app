'use client'
import { TopBar } from '@/components/TopBar'
import { motion } from 'framer-motion'

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Configuración" />
      <div className="flex-1 overflow-y-auto p-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mt-16 text-center"
        >
          <div className="text-5xl mb-4">⚙️</div>
          <h2 className="text-white font-bold text-xl mb-2">Configuración</h2>
          <p className="text-slate-400 text-sm">Próximamente: usuarios, empresa, preferencias</p>
        </motion.div>
      </div>
    </div>
  )
}
