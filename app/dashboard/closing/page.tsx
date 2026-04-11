'use client'
import { TopBar } from '@/components/TopBar'
import { motion } from 'framer-motion'

export default function ClosingPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Closing OS" />
      <div className="flex-1 overflow-y-auto p-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mt-16 text-center"
        >
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-white font-bold text-xl mb-2">Closing OS</h2>
          <p className="text-slate-400 text-sm mb-6">
            Generación automática de documentos de cierre desde el dashboard
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: '📊', label: 'BW Final', desc: 'Excel con economics por capa' },
              { icon: '📄', label: 'NDB', desc: 'Nota de Débito a la cedente' },
              { icon: '📑', label: 'NCR', desc: 'Nota de Crédito por reasegurador' },
            ].map(doc => (
              <div key={doc.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{doc.icon}</div>
                <div className="text-white text-sm font-medium">{doc.label}</div>
                <div className="text-slate-500 text-xs mt-1">{doc.desc}</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-500">
            Próximamente: generar BW/NDB/NCR con un click desde el pipeline
          </div>
        </motion.div>
      </div>
    </div>
  )
}
