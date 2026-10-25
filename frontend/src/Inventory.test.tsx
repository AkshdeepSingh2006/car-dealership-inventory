import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import App from './App'

const corolla = {
  id: 12,
  make: 'Toyota',
  model: 'Corolla',
  category: 'Sedan',
  price: '25000.00',
  quantity: 2,
}

function response(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 409, json: async () => data }
}

function signInAs(role: 'user' | 'admin') {
  sessionStorage.setItem('access_token', 'test-token')
  sessionStorage.setItem('email', `${role}@example.com`)
  sessionStorage.setItem('role', role)
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

test('loads vehicles with the token and hides admin controls from users', async () => {
  signInAs('user')
  const request = vi.fn().mockResolvedValue(response([corolla]))
  vi.stubGlobal('fetch', request)

  render(<App />)

  expect(await screen.findByText('Toyota Corolla')).toBeTruthy()
  expect(screen.getByText('2 in stock')).toBeTruthy()
  expect(request).toHaveBeenCalledWith(
    'http://localhost:8000/api/vehicles',
    expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
  )
  expect(screen.queryByRole('button', { name: 'Add vehicle' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit Toyota Corolla' })).toBeNull()
})

test('sends combined search filters to the API', async () => {
  signInAs('user')
  const request = vi.fn()
    .mockResolvedValueOnce(response([corolla]))
    .mockResolvedValueOnce(response([]))
  vi.stubGlobal('fetch', request)

  render(<App />)
  await screen.findByText('Toyota Corolla')
  fireEvent.change(screen.getByLabelText('Search make'), { target: { value: 'Toyota' } })
  fireEvent.change(screen.getByLabelText('Search category'), { target: { value: 'Sedan' } })
  fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '20000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search vehicles' }))

  await waitFor(() => {
    expect(request).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/vehicles/search?make=Toyota&category=Sedan&min_price=20000',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
    )
  })
  expect(await screen.findByText('No vehicles found.')).toBeTruthy()
})

test('purchases one vehicle and disables purchase at zero stock', async () => {
  signInAs('user')
  const request = vi.fn()
    .mockResolvedValueOnce(response([corolla, { ...corolla, id: 13, model: 'Prius', quantity: 0 }]))
    .mockResolvedValueOnce(response({ ...corolla, quantity: 1 }))
  vi.stubGlobal('fetch', request)

  render(<App />)
  await screen.findByText('Toyota Corolla')
  expect((screen.getByRole('button', { name: 'Purchase Toyota Prius' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Purchase Toyota Corolla' }))

  await waitFor(() => {
    expect(request).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/vehicles/12/purchase',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer test-token' } }),
    )
  })
  expect(await screen.findByText('1 in stock')).toBeTruthy()
})

test('admin can create a vehicle through the API', async () => {
  signInAs('admin')
  const request = vi.fn()
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response(corolla))
  vi.stubGlobal('fetch', request)

  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add vehicle' }))
  fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Toyota' } })
  fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Corolla' } })
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Sedan' } })
  fireEvent.change(screen.getByLabelText('Price'), { target: { value: '25000' } })
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }))

  await waitFor(() => {
    expect(request).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/vehicles',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ make: 'Toyota', model: 'Corolla', category: 'Sedan', price: '25000', quantity: 2 }),
      }),
    )
  })
  expect(await screen.findByText('Toyota Corolla')).toBeTruthy()
})

test('admin can edit and delete a vehicle', async () => {
  signInAs('admin')
  const request = vi.fn()
    .mockResolvedValueOnce(response([corolla]))
    .mockResolvedValueOnce(response({ ...corolla, model: 'Camry' }))
    .mockResolvedValueOnce({ ok: true, status: 204 })
  vi.stubGlobal('fetch', request)
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))

  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Toyota Corolla' }))
  fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Camry' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }))

  expect(await screen.findByText('Toyota Camry')).toBeTruthy()
  expect(request).toHaveBeenCalledWith(
    'http://localhost:8000/api/vehicles/12',
    expect.objectContaining({ method: 'PUT' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Delete Toyota Camry' }))
  await waitFor(() => expect(screen.queryByText('Toyota Camry')).toBeNull())
  expect(request).toHaveBeenLastCalledWith(
    'http://localhost:8000/api/vehicles/12',
    expect.objectContaining({ method: 'DELETE' }),
  )
})

test('admin can restock an out-of-stock vehicle', async () => {
  signInAs('admin')
  const empty = { ...corolla, quantity: 0 }
  const request = vi.fn()
    .mockResolvedValueOnce(response([empty]))
    .mockResolvedValueOnce(response({ ...corolla, quantity: 3 }))
  vi.stubGlobal('fetch', request)

  render(<App />)
  await screen.findByText('Toyota Corolla')
  fireEvent.change(screen.getByLabelText('Restock quantity for Toyota Corolla'), {
    target: { value: '3' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Restock Toyota Corolla' }))

  await waitFor(() => {
    expect(request).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/vehicles/12/restock',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ quantity: 3 }) }),
    )
  })
  expect(await screen.findByText('3 in stock')).toBeTruthy()
})
