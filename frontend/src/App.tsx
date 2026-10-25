import { useState, type FormEvent } from 'react'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type AuthMode = 'login' | 'register'

export default function App() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState(() => sessionStorage.getItem('email') || '')
  const [password, setPassword] = useState('')
  const [signedIn, setSignedIn] = useState(() => Boolean(sessionStorage.getItem('access_token')))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode)
    setMessage('')
    setError('')
    setPassword('')
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setPending(true)

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(typeof data.detail === 'string' ? data.detail : 'Please check your details and try again.')
        return
      }

      setPassword('')
      if (mode === 'register') {
        setMode('login')
        setMessage('Account created. Sign in to continue.')
      } else {
        sessionStorage.setItem('access_token', data.access_token)
        sessionStorage.setItem('email', email)
        setSignedIn(true)
      }
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function signOut() {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('email')
    setSignedIn(false)
    setPassword('')
    setMessage('')
    setError('')
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
        <section className="flex flex-col justify-between bg-slate-900 px-7 py-10 text-white sm:px-12 sm:py-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">Dealership inventory</p>
            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Car Dealership Inventory</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-300">
              Create an account or sign in to access your dealership.
            </p>
          </div>
          <p className="mt-12 text-sm text-slate-400">Find your next vehicle in one place.</p>
        </section>

        <section className="flex flex-col justify-center px-7 py-10 sm:px-12 sm:py-14">
          {signedIn ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">Welcome back</p>
              <h2 className="mt-3 text-3xl font-bold">You are signed in</h2>
              <p className="mt-4 text-slate-600">Signed in as {email}</p>
              <button className="mt-8 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-700" onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-6 border-b border-slate-200">
                <button
                  className={`border-b-2 pb-3 font-semibold ${mode === 'login' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500'}`}
                  onClick={() => selectMode('login')}
                  type="button"
                >
                  Log in
                </button>
                <button
                  className={`border-b-2 pb-3 font-semibold ${mode === 'register' ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500'}`}
                  onClick={() => selectMode('register')}
                  type="button"
                >
                  Create account
                </button>
              </div>

              <h2 className="mt-8 text-3xl font-bold">{mode === 'register' ? 'Create your account' : 'Sign in to your account'}</h2>
              <p className="mt-2 text-slate-600">
                {mode === 'register' ? 'Register as a customer to browse and purchase vehicles.' : 'Enter your details to continue.'}
              </p>

              {message && <p className="mt-6 rounded-xl bg-green-50 p-4 text-green-800" role="status">{message}</p>}
              {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700" role="alert">{error}</p>}

              <form className="mt-8 space-y-5" onSubmit={submitAuth}>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="email">Email</label>
                  <input
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    id="email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="password">Password</label>
                  <input
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    id="password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <button
                  className="w-full rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? 'Please wait…' : mode === 'register' ? 'Register' : 'Sign in'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

