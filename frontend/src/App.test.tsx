import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import App from './App'

test('shows the project title', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Car Dealership Inventory' })).toBeTruthy()
})

