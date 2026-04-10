'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-white text-xl font-semibold mb-2">Revisá tu mail</h2>
        <p className="text-slate-400 text-sm">
          Enviamos un link de acceso a <span className="text-blue-400">{email}</span>.
          <br />Hacé click en el link para ingresar.
        </p>
        <p className="text-slate-500 text-xs mt-4">El link expira en 15 minutos.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8">
      <h2 className="text-white text-xl font-semibold mb-1">Ingresá a tu cuenta</h2>
      <p className="text-slate-400 text-sm mb-6">Te enviamos un link por mail. Sin contraseña.</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-slate-300 text-sm mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold py-3 rounded-lg transition"
        >
          {loading ? 'Enviando...' : 'Enviar link de acceso'}
        </button>
      </form>
    </div>
  )
}
