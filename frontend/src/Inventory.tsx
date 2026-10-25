import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import CarArtwork from './CarArtwork'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

type Vehicle = {
  id: number
  make: string
  model: string
  category: string
  price: string
  quantity: number
}

type VehicleForm = {
  make: string
  model: string
  category: string
  price: string
  quantity: string
}

const emptyVehicle: VehicleForm = {
  make: '', model: '', category: '', price: '', quantity: '0',
}

type Props = {
  token: string
  email: string
  role: 'user' | 'admin'
  onSignOut: () => void
  onUnauthorized: () => void
}

export default function Inventory({ token, email, role, onSignOut, onUnauthorized }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filters, setFilters] = useState({ make: '', model: '', category: '', min_price: '', max_price: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicle)
  const [restockAmounts, setRestockAmounts] = useState<Record<number, string>>({})
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [cartVehicle, setCartVehicle] = useState<Vehicle | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [purchaseComplete, setPurchaseComplete] = useState<Vehicle | null>(null)
  const [cartError, setCartError] = useState('')
  const cartDialog = useRef<HTMLDivElement>(null)

  async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (response.status === 401) {
      onUnauthorized()
      throw new Error('Session expired. Sign in again.')
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed. Please try again.')
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>
  }

  useEffect(() => {
    let active = true
    apiRequest<Vehicle[]>('/api/vehicles')
      .then((items) => { if (active) setVehicles(items) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load vehicles.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (vehicles.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setFeaturedIndex((index) => (index + 1) % vehicles.length), 7000)
    return () => window.clearInterval(timer)
  }, [vehicles.length])

  useEffect(() => {
    if (!cartOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cartDialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => previousFocus?.focus()
  }, [cartOpen])

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    const query = new URLSearchParams()
    for (const [name, value] of Object.entries(filters)) {
      if (value.trim()) query.append(name, value.trim())
    }
    try {
      const path = query.size ? `/api/vehicles/search?${query}` : '/api/vehicles'
      setVehicles(await apiRequest<Vehicle[]>(path))
      setFeaturedIndex(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not search vehicles.')
    } finally {
      setLoading(false)
    }
  }

  function addToCart(vehicle: Vehicle) {
    setCartVehicle(vehicle)
    setPurchaseComplete(null)
    setCartError('')
    setCartOpen(true)
  }

  function closeCart() {
    if (busyId !== null) return
    setCartOpen(false)
    setPurchaseComplete(null)
    setCartError('')
  }

  function handleCartKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeCart()
    }
    if (event.key !== 'Tab') return
    const buttons = Array.from(cartDialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
    if (buttons.length === 0) return
    if (event.shiftKey && document.activeElement === buttons[0]) {
      event.preventDefault()
      buttons[buttons.length - 1].focus()
    } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
      event.preventDefault()
      buttons[0].focus()
    }
  }

  async function purchase() {
    if (!cartVehicle) return
    const vehicle = cartVehicle
    setError('')
    setCartError('')
    setBusyId(vehicle.id)
    try {
      const updated = await apiRequest<Vehicle>(`/api/vehicles/${vehicle.id}/purchase`, { method: 'POST' })
      setVehicles((items) => items.map((item) => item.id === updated.id ? updated : item))
      setCartVehicle(null)
      setPurchaseComplete(vehicle)
    } catch (cause) {
      setCartError(cause instanceof Error ? cause.message : 'Could not purchase vehicle.')
    } finally {
      setBusyId(null)
    }
  }

  function openCreate() {
    setEditingId(null)
    setVehicleForm(emptyVehicle)
    setFormOpen(true)
    setError('')
  }

  function openEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id)
    setVehicleForm({
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      price: String(vehicle.price),
      quantity: String(vehicle.quantity),
    })
    setFormOpen(true)
    setError('')
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    const payload = { ...vehicleForm, quantity: Number(vehicleForm.quantity) }
    const path = editingId === null ? '/api/vehicles' : `/api/vehicles/${editingId}`
    try {
      const saved = await apiRequest<Vehicle>(path, {
        method: editingId === null ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      setVehicles((items) => editingId === null
        ? [...items, saved]
        : items.map((item) => item.id === saved.id ? saved : item))
      setFormOpen(false)
      setNotice(editingId === null ? 'Vehicle added.' : 'Vehicle updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save vehicle.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model}?`)) return
    setError('')
    setNotice('')
    setBusyId(vehicle.id)
    try {
      await apiRequest<void>(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' })
      setVehicles((items) => items.filter((item) => item.id !== vehicle.id))
      setNotice('Vehicle deleted.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete vehicle.')
    } finally {
      setBusyId(null)
    }
  }

  async function restock(event: FormEvent<HTMLFormElement>, vehicle: Vehicle) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusyId(vehicle.id)
    try {
      const updated = await apiRequest<Vehicle>(`/api/vehicles/${vehicle.id}/restock`, {
        method: 'POST',
        body: JSON.stringify({ quantity: Number(restockAmounts[vehicle.id] || '1') }),
      })
      setVehicles((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Restocked ${vehicle.make} ${vehicle.model}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restock vehicle.')
    } finally {
      setBusyId(null)
    }
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-[#252a2b] px-4 py-3 text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30'
  const buttonClass = 'rounded-xl bg-amber-400 px-5 py-3 font-bold text-[#161a1b] transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-50'
  const featured = vehicles[featuredIndex % vehicles.length]
  const money = (price: string) => Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <main className="min-h-screen bg-[#15191a] px-4 pb-28 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-amber-400/50 bg-amber-400/10 text-xl font-black text-amber-400">D</div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">Dealership</p>
              <h2 className="text-sm font-semibold tracking-wide text-zinc-300">Inventory</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="text-xs text-zinc-400 sm:text-sm">Signed in as {email}</span>
            <button className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-amber-400 hover:text-amber-300" onClick={onSignOut} type="button">Sign out</button>
          </div>
        </header>

        <div className="grid gap-6 py-10 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">Your next drive starts here</p>
            <h1 className="mt-5 max-w-xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">Find a car that <span className="text-amber-400">moves you.</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-400">Browse the live inventory, find your fit, and purchase while stock is available.</p>
            <a className="mt-8 inline-flex rounded-xl border border-white/25 px-5 py-3 font-semibold text-white transition hover:border-amber-400 hover:text-amber-300" href="#inventory">Explore inventory <span aria-hidden="true" className="ml-3">↗</span></a>
          </div>
          {featured && !loading && (
            <section aria-label="Featured vehicle" className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#252b2c] p-6 shadow-[0_24px_70px_rgba(0,0,0,.25)] sm:p-8">
              <div aria-hidden="true" className="absolute -right-16 -top-20 size-80 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">In the spotlight</p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Featured: {featured.make} {featured.model}</h2>
                  <p className="mt-2 text-sm uppercase tracking-widest text-zinc-400">{featured.category}</p>
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300">{String(featuredIndex % vehicles.length + 1).padStart(2, '0')} / {String(vehicles.length).padStart(2, '0')}</span>
              </div>
              <CarArtwork className="relative mx-auto my-4 h-auto w-full max-w-lg drop-shadow-2xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Listed price</p>
                  <p className="mt-1 text-3xl font-black">{money(featured.price)}</p>
                  <p className="mt-1 text-sm text-zinc-400">{featured.quantity > 0 ? `${featured.quantity} available now` : 'Currently out of stock'}</p>
                </div>
                <div className="flex gap-2">
                  <button aria-label="Previous featured vehicle" className="grid size-11 place-items-center rounded-full border border-white/25 text-xl hover:border-amber-400 hover:text-amber-400" disabled={vehicles.length < 2} onClick={() => setFeaturedIndex((index) => (index - 1 + vehicles.length) % vehicles.length)} type="button">‹</button>
                  <button aria-label="Next featured vehicle" className="grid size-11 place-items-center rounded-full bg-amber-400 text-xl text-[#15191a] hover:bg-amber-300 disabled:opacity-50" disabled={vehicles.length < 2} onClick={() => setFeaturedIndex((index) => (index + 1) % vehicles.length)} type="button">›</button>
                </div>
              </div>
            </section>
          )}
        </div>

        <form className="rounded-[1.75rem] border border-white/10 bg-[#202526] p-5 sm:p-7" onSubmit={search}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Refine your search</p>
              <h2 className="mt-2 text-2xl font-bold">Search vehicles</h2>
            </div>
            <p className="text-sm text-zinc-400">All vehicles are shown below by default.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm font-semibold text-zinc-300">Search make
              <input className={inputClass} onChange={(event) => updateFilter('make', event.target.value)} value={filters.make} />
            </label>
            <label className="text-sm font-semibold text-zinc-300">Search model
              <input className={inputClass} onChange={(event) => updateFilter('model', event.target.value)} value={filters.model} />
            </label>
            <label className="text-sm font-semibold text-zinc-300">Search category
              <input className={inputClass} onChange={(event) => updateFilter('category', event.target.value)} value={filters.category} />
            </label>
            <label className="text-sm font-semibold text-zinc-300">Minimum price
              <input className={inputClass} min="0" onChange={(event) => updateFilter('min_price', event.target.value)} step="0.01" type="number" value={filters.min_price} />
            </label>
            <label className="text-sm font-semibold text-zinc-300">Maximum price
              <input className={inputClass} min="0" onChange={(event) => updateFilter('max_price', event.target.value)} step="0.01" type="number" value={filters.max_price} />
            </label>
          </div>
          <button className={`${buttonClass} mt-6`} disabled={loading} type="submit">Search vehicles <span aria-hidden="true">→</span></button>
        </form>

        {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200" role="alert">{error}</p>}
        {notice && <p className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200" role="status">{notice}</p>}

        <div className="mt-12 flex flex-wrap items-end justify-between gap-4" id="inventory">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">The collection</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Available vehicles</h2>
            {!loading && <p className="mt-2 text-sm text-zinc-400">{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} in this view</p>}
          </div>
          {role === 'admin' && <button className={buttonClass} onClick={openCreate} type="button">Add vehicle</button>}
        </div>

        {role === 'admin' && formOpen && (
          <form className="mt-5 rounded-2xl border border-amber-400/30 bg-[#202526] p-5 sm:p-7" onSubmit={saveVehicle}>
            <h3 className="text-xl font-bold">{editingId === null ? 'Add vehicle' : 'Edit vehicle'}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(['make', 'model', 'category', 'price', 'quantity'] as const).map((field) => (
                <label className="text-sm font-semibold text-zinc-300" key={field}>
                  {field[0].toUpperCase() + field.slice(1)}
                  <input
                    className={inputClass}
                    min={field === 'price' ? '0.01' : field === 'quantity' ? '0' : undefined}
                    onChange={(event) => setVehicleForm((current) => ({ ...current, [field]: event.target.value }))}
                    required
                    step={field === 'price' ? '0.01' : field === 'quantity' ? '1' : undefined}
                    type={field === 'price' || field === 'quantity' ? 'number' : 'text'}
                    value={vehicleForm[field]}
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button className={buttonClass} disabled={saving} type="submit">{saving ? 'Saving…' : 'Save vehicle'}</button>
              <button className="rounded-xl border border-white/25 px-4 py-2 font-semibold hover:border-white/50" onClick={() => setFormOpen(false)} type="button">Cancel</button>
            </div>
          </form>
        )}

        {loading ? <p className="mt-8 text-zinc-400" role="status">Loading vehicles…</p> : vehicles.length === 0 ? (
          <p className="mt-8 rounded-xl border border-white/10 bg-[#202526] p-6 text-zinc-400">No vehicles found.</p>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle, index) => {
              const name = `${vehicle.make} ${vehicle.model}`
              return (
                <article className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#202526] transition hover:-translate-y-1 hover:border-amber-400/40" key={vehicle.id}>
                  <div className={`relative h-44 overflow-hidden ${index % 3 === 0 ? 'bg-[#343b3b]' : index % 3 === 1 ? 'bg-[#303735]' : 'bg-[#3b3833]'}`}>
                    <div aria-hidden="true" className="absolute -right-8 -top-16 size-56 rounded-full bg-amber-400/10 blur-2xl" />
                    <CarArtwork className="relative mx-auto mt-1 h-44 w-full max-w-xs transition duration-300 group-hover:scale-105" />
                    <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${vehicle.quantity > 0 ? 'bg-emerald-300 text-[#14211b]' : 'bg-zinc-700 text-zinc-200'}`}>{vehicle.quantity > 0 ? 'Available' : 'Sold out'}</span>
                  </div>
                  <div className="p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">{vehicle.category}</p>
                  <h3 className="mt-2 text-2xl font-bold">{name}</h3>
                  <div className="mt-5 flex items-end justify-between gap-2 border-t border-white/10 pt-4">
                    <div><p className="text-xs uppercase tracking-widest text-zinc-500">Price</p><p className="mt-1 text-xl font-black">{money(vehicle.price)}</p></div>
                    <p className="text-sm text-zinc-400">{vehicle.quantity} in stock</p>
                  </div>
                  <button
                    className={`${buttonClass} mt-5 w-full`}
                    disabled={vehicle.quantity === 0 || busyId === vehicle.id}
                    onClick={() => addToCart(vehicle)}
                    type="button"
                  >Purchase {name} <span aria-hidden="true">↗</span></button>
                  {role === 'admin' && (
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <div className="flex flex-wrap gap-4">
                        <button className="font-semibold text-zinc-200 hover:text-amber-400" onClick={() => openEdit(vehicle)} type="button">Edit {name}</button>
                        <button className="font-semibold text-red-300 hover:text-red-200" disabled={busyId === vehicle.id} onClick={() => deleteVehicle(vehicle)} type="button">Delete {name}</button>
                      </div>
                      <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(event) => restock(event, vehicle)}>
                        <label className="min-w-28 flex-1 text-sm font-semibold text-zinc-300">Restock quantity for {name}
                          <input className={inputClass} min="1" onChange={(event) => setRestockAmounts((current) => ({ ...current, [vehicle.id]: event.target.value }))} required step="1" type="number" value={restockAmounts[vehicle.id] || '1'} />
                        </label>
                        <button className="rounded-xl border border-white/25 px-4 py-3 font-semibold hover:border-amber-400 hover:text-amber-400 disabled:opacity-50" disabled={busyId === vehicle.id} type="submit">Restock {name}</button>
                      </form>
                    </div>
                  )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <button
        className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full border border-amber-300/40 bg-amber-400 px-5 py-3 font-bold text-[#161a1b] shadow-[0_12px_35px_rgba(0,0,0,.4)] transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-7 sm:right-7"
        onClick={() => { setPurchaseComplete(null); setCartError(''); setCartOpen(true) }}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M3 4h2l2.2 10h11.6l2-7H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><circle cx="9" cy="19" fill="currentColor" r="1.5"/><circle cx="18" cy="19" fill="currentColor" r="1.5"/></svg>
        Cart ({cartVehicle ? 1 : 0})
      </button>

      {cartOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCart() }}>
          <div
            aria-labelledby="cart-title"
            aria-modal="true"
            className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#242a2b] p-6 text-white shadow-2xl sm:p-8"
            onKeyDown={handleCartKeyDown}
            ref={cartDialog}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">Dealership inventory</p>
                <h2 className="mt-2 text-2xl font-bold" id="cart-title">{purchaseComplete ? 'Purchase complete' : 'Your cart'}</h2>
              </div>
              <button aria-label="Close cart" className="rounded-full border border-white/20 px-3 py-1 text-xl text-zinc-300 hover:border-white/50 hover:text-white disabled:opacity-50" disabled={busyId !== null} onClick={closeCart} type="button">×</button>
            </div>

            {purchaseComplete ? (
              <div className="mt-7">
                <p className="text-lg font-semibold text-emerald-300">You purchased {purchaseComplete.make} {purchaseComplete.model}.</p>
                <p className="mt-2 text-sm text-zinc-400">The inventory stock has been updated.</p>
                <button className={`${buttonClass} mt-7 w-full`} onClick={closeCart} type="button">Continue browsing</button>
              </div>
            ) : cartVehicle ? (
              <div className="mt-7">
                <p className="text-sm text-zinc-400">Review your choice before buying. Your cart holds one vehicle at a time.</p>
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#303738] p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{cartVehicle.category}</p>
                  <h3 className="mt-2 text-xl font-bold">{cartVehicle.make} {cartVehicle.model}</h3>
                  <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
                    <div><p className="text-xs text-zinc-400">Listed price</p><p className="mt-1 text-xl font-bold">{money(cartVehicle.price)}</p></div>
                    <p className="text-sm text-zinc-400">1 vehicle</p>
                  </div>
                </div>
                {cartError && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200" role="alert">{cartError}</p>}
                <button className={`${buttonClass} mt-6 w-full`} disabled={busyId !== null} onClick={purchase} type="button">{busyId !== null ? 'Purchasing…' : 'Confirm purchase'}</button>
                <div className="mt-4 flex justify-between gap-4 text-sm">
                  <button className="font-semibold text-zinc-300 hover:text-white disabled:opacity-50" disabled={busyId !== null} onClick={() => { setCartVehicle(null); closeCart() }} type="button">Remove from cart</button>
                  <button className="font-semibold text-zinc-300 hover:text-white disabled:opacity-50" disabled={busyId !== null} onClick={closeCart} type="button">Continue browsing</button>
                </div>
              </div>
            ) : (
              <div className="mt-7">
                <p className="text-zinc-400">Your cart is empty.</p>
                <button className={`${buttonClass} mt-6 w-full`} onClick={closeCart} type="button">Continue browsing</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
