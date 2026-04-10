import LoginForm from '@/components/LoginForm'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🧊</div>
          <h1 className="text-4xl font-bold text-white tracking-tight">nizur.io</h1>
          <p className="text-blue-300 mt-2 text-lg">Plataforma de Reaseguros</p>
          <p className="text-slate-400 mt-1 text-sm">Powered by Jaina</p>
        </div>

        <LoginForm />

        <p className="text-center text-slate-500 text-xs mt-8">
          ¿No tenés acceso? Contactá a{' '}
          <a href="mailto:flow@nizur.io" className="text-blue-400 hover:underline">
            flow@nizur.io
          </a>
        </p>
      </div>
    </main>
  )
}
