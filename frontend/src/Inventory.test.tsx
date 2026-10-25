import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

test('features real API vehicles and lets users browse them without hiding the inventory', async () => {
  signInAs('user')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([
    corolla,
    { ...corolla, id: 13, model: 'Prius', quantity: 0 },
  ])))

  render(<App />)

  const feature = await screen.findByRole('region', { name: 'Featured vehicle' })
  expect(within(feature).getByText('Featured: Toyota Corolla')).toBeTruthy()
  fireEvent.click(within(feature).getByRole('button', { name: 'Next featured vehicle' }))
  expect(within(feature).getByText('Featured: Toyota Prius')).toBeTruthy()
  expect(screen.getByText('Toyota Corolla')).toBeTruthy()
  expect(screen.getByText('Toyota Prius')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Purchase Toyota Prius' }) as HTMLButtonElement).disabled).toBe(true)
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

test('reviews one vehicle in the cart before purchasing and disables zero stock', async () => {
  signInAs('user')
  const request = vi.fn()
    .mockResolvedValueOnce(response([corolla, { ...corolla, id: 13, model: 'Prius', quantity: 0 }]))
    .mockResolvedValueOnce(response({ ...corolla, quantity: 1 }))
  vi.stubGlobal('fetch', request)

  render(<App />)
  await screen.findByText('Toyota Corolla')
  expect((screen.getByRole('button', { name: 'Purchase Toyota Prius' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Purchase Toyota Corolla' }))
  expect(request).toHaveBeenCalledTimes(1)
  const cart = screen.getByRole('dialog', { name: 'Your cart' })
  expect(within(cart).getByText('Toyota Corolla')).toBeTruthy()
  expect(within(cart).getByText('25,000.00')).toBeTruthy()
  fireEvent.click(within(cart).getByRole('button', { name: 'Continue browsing' }))
  expect(request).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Cart (1)' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your cart' })).getByRole('button', { name: 'Confirm purchase' }))

  await waitFor(() => {
    expect(request).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/vehicles/12/purchase',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer test-token' } }),
    )
  })
  expect(await screen.findByText('1 in stock')).toBeTruthy()
  expect(within(screen.getByRole('dialog', { name: 'Purchase complete' })).getByText('You purchased Toyota Corolla.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Cart (0)' })).toBeTruthy()
})

test('removing the selected car does not purchase it', async () => {
  signInAs('user')
  const request = vi.fn().mockResolvedValue(response([corolla]))
  vi.stubGlobal('fetch', request)

  render(<App />)
  await screen.findByText('Toyota Corolla')
  fireEvent.click(screen.getByRole('button', { name: 'Purchase Toyota Corolla' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your cart' })).getByRole('button', { name: 'Remove from cart' }))

  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Cart (0)' })).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(1)
  expect(screen.getByText('2 in stock')).toBeTruthy()
})

test('shows a failed purchase in the cart and keeps the selection', async () => {
  signInAs('user')
  const request = vi.fn()
    .mockResolvedValueOnce(response([corolla]))
    .mockResolvedValueOnce(response({ detail: 'Vehicle is out of stock' }, false))
  vi.stubGlobal('fetch', request)

  render(<App />)
  await screen.findByText('Toyota Corolla')
  fireEvent.click(screen.getByRole('button', { name: 'Purchase Toyota Corolla' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your cart' })).getByRole('button', { name: 'Confirm purchase' }))

  expect(await within(screen.getByRole('dialog', { name: 'Your cart' })).findByRole('alert')).toHaveProperty('textContent', 'Vehicle is out of stock')
  expect(screen.getByRole('button', { name: 'Cart (1)' })).toBeTruthy()
  expect(screen.getByText('2 in stock')).toBeTruthy()
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
