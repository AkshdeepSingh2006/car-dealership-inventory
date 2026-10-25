import { useEffect, useState, type FormEvent } from 'react'

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not search vehicles.')
    } finally {
      setLoading(false)
    }
  }

  async function purchase(vehicle: Vehicle) {
    setError('')
    setNotice('')
    setBusyId(vehicle.id)
    try {
      const updated = await apiRequest<Vehicle>(`/api/vehicles/${vehicle.id}/purchase`, { method: 'POST' })
      setVehicles((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Purchased ${vehicle.make} ${vehicle.model}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not purchase vehicle.')
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

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200'
  const buttonClass = 'rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-50'

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">Car Dealership Inventory</p>
            <h1 className="mt-2 text-4xl font-bold">Inventory</h1>
            <p className="mt-2 text-slate-600">Signed in as {email}</p>
          </div>
          <button className={buttonClass} onClick={onSignOut} type="button">Sign out</button>
        </header>

        <form className="mt-8 rounded-2xl bg-white p-5 shadow-sm sm:p-7" onSubmit={search}>
          <h2 className="text-xl font-bold">Search vehicles</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm font-semibold">Search make
              <input className={inputClass} onChange={(event) => updateFilter('make', event.target.value)} value={filters.make} />
            </label>
            <label className="text-sm font-semibold">Search model
              <input className={inputClass} onChange={(event) => updateFilter('model', event.target.value)} value={filters.model} />
            </label>
            <label className="text-sm font-semibold">Search category
              <input className={inputClass} onChange={(event) => updateFilter('category', event.target.value)} value={filters.category} />
            </label>
            <label className="text-sm font-semibold">Minimum price
              <input className={inputClass} min="0" onChange={(event) => updateFilter('min_price', event.target.value)} step="0.01" type="number" value={filters.min_price} />
            </label>
            <label className="text-sm font-semibold">Maximum price
              <input className={inputClass} min="0" onChange={(event) => updateFilter('max_price', event.target.value)} step="0.01" type="number" value={filters.max_price} />
            </label>
          </div>
          <button className={`${buttonClass} mt-5`} disabled={loading} type="submit">Search vehicles</button>
        </form>

        {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
        {notice && <p className="mt-6 rounded-xl bg-green-50 p-4 text-green-800" role="status">{notice}</p>}

        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Available vehicles</h2>
          {role === 'admin' && <button className={buttonClass} onClick={openCreate} type="button">Add vehicle</button>}
        </div>

        {role === 'admin' && formOpen && (
          <form className="mt-5 rounded-2xl bg-white p-5 shadow-sm sm:p-7" onSubmit={saveVehicle}>
            <h3 className="text-xl font-bold">{editingId === null ? 'Add vehicle' : 'Edit vehicle'}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(['make', 'model', 'category', 'price', 'quantity'] as const).map((field) => (
                <label className="text-sm font-semibold" key={field}>
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
              <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold" onClick={() => setFormOpen(false)} type="button">Cancel</button>
            </div>
          </form>
        )}

        {loading ? <p className="mt-8 text-slate-600" role="status">Loading vehicles…</p> : vehicles.length === 0 ? (
          <p className="mt-8 rounded-xl bg-white p-6 text-slate-600">No vehicles found.</p>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => {
              const name = `${vehicle.make} ${vehicle.model}`
              return (
                <article className="rounded-2xl bg-white p-6 shadow-sm" key={vehicle.id}>
                  <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">{vehicle.category}</p>
                  <h3 className="mt-2 text-2xl font-bold">{name}</h3>
                  <p className="mt-3 text-slate-600">Price: {Number(vehicle.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="mt-1 text-slate-600">{vehicle.quantity} in stock</p>
                  <button
                    className={`${buttonClass} mt-5 w-full`}
                    disabled={vehicle.quantity === 0 || busyId === vehicle.id}
                    onClick={() => purchase(vehicle)}
                    type="button"
                  >Purchase {name}</button>
                  {role === 'admin' && (
                    <div className="mt-5 border-t border-slate-200 pt-5">
                      <div className="flex gap-3">
                        <button className="font-semibold text-slate-700 hover:underline" onClick={() => openEdit(vehicle)} type="button">Edit {name}</button>
                        <button className="font-semibold text-red-700 hover:underline" disabled={busyId === vehicle.id} onClick={() => deleteVehicle(vehicle)} type="button">Delete {name}</button>
                      </div>
                      <form className="mt-4 flex items-end gap-2" onSubmit={(event) => restock(event, vehicle)}>
                        <label className="flex-1 text-sm font-semibold">Restock quantity for {name}
                          <input className={inputClass} min="1" onChange={(event) => setRestockAmounts((current) => ({ ...current, [vehicle.id]: event.target.value }))} required step="1" type="number" value={restockAmounts[vehicle.id] || '1'} />
                        </label>
                        <button className={buttonClass} disabled={busyId === vehicle.id} type="submit">Restock {name}</button>
                      </form>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
