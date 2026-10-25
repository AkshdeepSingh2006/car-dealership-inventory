import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import App from './App'

test('shows the project title', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Car Dealership Inventory' })).toBeTruthy()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

test('registers a regular user and offers sign in', async () => {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 1, email: 'buyer@example.com', role: 'user' }),
  })
  vi.stubGlobal('fetch', request)

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))

  await waitFor(() => {
    expect(request).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'buyer@example.com', password: 'secret123' }),
      }),
    )
  })
  expect(await screen.findByText('Account created. Sign in to continue.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
})

test('shows the API error when registration email already exists', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ detail: 'Email already registered' }),
  }))

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))

  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Email already registered',
  )
})

test('signs in and keeps the access token for later vehicle requests', async () => {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'test-token', token_type: 'bearer' }),
  })
  vi.stubGlobal('fetch', request)

  render(<App />)
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  await waitFor(() => {
    expect(request).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'buyer@example.com', password: 'secret123' }),
      }),
    )
  })
  expect(await screen.findByText('Signed in as buyer@example.com')).toBeTruthy()
  expect(sessionStorage.getItem('access_token')).toBe('test-token')
})

test('shows an error for incorrect login credentials', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ detail: 'Invalid email or password' }),
  }))

  render(<App />)
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'wrong-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Invalid email or password',
  )
  expect(sessionStorage.getItem('access_token')).toBeNull()
})

