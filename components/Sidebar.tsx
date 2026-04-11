'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
  {
    section: 'Pipeline',
    items: [
      { href: '/dashboard', label: 'Cockpit', icon: '🎯' },
      { href: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    ]
  },
  {
    section: 'Operaciones',
    items: [
      { href: '/dashboard/submissions', label: 'Submissions', icon: '📥' },
      { href: '/dashboard/markets', label: 'Mercados', icon: '🌐' },
      { href: '/dashboard/closing', label: 'Closing', icon: '✅' },
    ]
  },
  {
    section: 'Sistema',
    items: [
      { href: '/dashboard/documents', label: 'Documentos', icon: '📁' },
      { href: '/dashboard/settings', label: 'Configuración', icon: '⚙️' },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen bg-slate-900/95 border-r border-slate-700/60 flex flex-col overflow-hidden shrink-0 sticky top-0"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/60 min-h-[60px]">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <span className="text-blue-400 font-bold text-sm tracking-wide">nizur</span>
              <span className="text-slate-500 text-xs">.io</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-700/50 ml-auto"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-4">
        {NAV.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <div className="px-4 mb-1">
                <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
                  {group.section}
                </span>
              </div>
            )}
            {group.items.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ x: collapsed ? 0 : 2 }}
                    className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-lg transition cursor-pointer ${
                      active
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                    }`}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-sm font-medium whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Jaina status */}
      <div className={`border-t border-slate-700/60 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-2 ${collapsed ? '' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
          {!collapsed && (
            <span className="text-slate-400 text-xs">Jaina online</span>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
