import { useState, type FormEvent } from 'react'

import Inventory from './Inventory'
import CarArtwork from './CarArtwork'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type AuthMode = 'login' | 'register'

export default function App() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState(() => sessionStorage.getItem('email') || '')
  const [password, setPassword] = useState('')
  const [signedIn, setSignedIn] = useState(() => Boolean(sessionStorage.getItem('access_token')))
  const [role, setRole] = useState<'user' | 'admin'>(() => sessionStorage.getItem('role') === 'admin' ? 'admin' : 'user')
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
        sessionStorage.setItem('role', data.role)
        setRole(data.role === 'admin' ? 'admin' : 'user')
        setSignedIn(true)
      }
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function signOut(expired = false) {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('email')
    sessionStorage.removeItem('role')
    setSignedIn(false)
    setPassword('')
    setMessage(expired ? 'Session expired. Sign in again.' : '')
    setError('')
  }

  if (signedIn) {
    return (
      <Inventory
        email={email}
        onSignOut={() => signOut()}
        onUnauthorized={() => signOut(true)}
        role={role}
        token={sessionStorage.getItem('access_token') || ''}
      />
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#15191a] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#202526] shadow-[0_30px_90px_rgba(0,0,0,.3)] lg:grid-cols-[1.05fr_1fr]">
        <section className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-[#2c3333] px-7 py-10 text-white sm:px-12 sm:py-14">
          <div aria-hidden="true" className="absolute -right-28 -top-28 size-96 rounded-full bg-amber-400/10 blur-3xl" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-400">Dealership inventory</p>
            <h1 className="mt-10 text-4xl font-black leading-tight tracking-tight sm:text-5xl">Car Dealership Inventory</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-300">
              Discover the live collection. Find your next drive.
            </p>
          </div>
          <CarArtwork className="relative -mb-8 mt-6 h-auto w-full max-w-lg self-center drop-shadow-2xl" />
          <p className="relative mt-6 text-sm text-zinc-400">Find your next vehicle in one place.</p>
        </section>

        <section className="flex flex-col justify-center px-7 py-10 sm:px-12 sm:py-14">
          <div>
              <div className="flex gap-6 border-b border-white/10">
                <button
                  className={`border-b-2 pb-3 font-semibold ${mode === 'login' ? 'border-amber-400 text-white' : 'border-transparent text-zinc-400'}`}
                  onClick={() => selectMode('login')}
                  type="button"
                >
                  Log in
                </button>
                <button
                  className={`border-b-2 pb-3 font-semibold ${mode === 'register' ? 'border-amber-400 text-white' : 'border-transparent text-zinc-400'}`}
                  onClick={() => selectMode('register')}
                  type="button"
                >
                  Create account
                </button>
              </div>

              <h2 className="mt-8 text-3xl font-bold">{mode === 'register' ? 'Create your account' : 'Sign in to your account'}</h2>
              <p className="mt-2 text-zinc-400">
                {mode === 'register' ? 'Register as a customer to browse and purchase vehicles.' : 'Enter your details to continue.'}
              </p>

              {message && <p className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200" role="status">{message}</p>}
              {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200" role="alert">{error}</p>}

              <form className="mt-8 space-y-5" onSubmit={submitAuth}>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="email">Email</label>
                  <input
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-white/15 bg-[#2b3132] px-4 py-3 text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
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
                    className="mt-2 w-full rounded-xl border border-white/15 bg-[#2b3132] px-4 py-3 text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                    id="password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <button
                  className="w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-[#161a1b] hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? 'Please wait…' : mode === 'register' ? 'Register' : 'Sign in'}
                </button>
              </form>
          </div>
        </section>
      </div>
    </main>
  )
}

