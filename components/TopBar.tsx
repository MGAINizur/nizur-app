'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function TopBar({ title }: { title?: string }) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null)
    })
  }, [])

  const handleSignOut = async () => {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/')
  }

  return (
    <header className="h-[60px] border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {title && <h1 className="text-white font-semibold text-sm">{title}</h1>}
      </div>
      <div className="flex items-center gap-4">
        <a
          href="mailto:flow@nizur.io"
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          + Nuevo submission
        </a>
        {userEmail && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-bold">
              {userEmail[0].toUpperCase()}
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-slate-300 text-xs transition"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
