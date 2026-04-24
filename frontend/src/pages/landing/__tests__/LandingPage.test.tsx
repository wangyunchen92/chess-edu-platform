// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from '../LandingPage'

describe('LandingPage', () => {
  it('renders brand name and slogan', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/棋境大陆/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/让孩子在家|国际象棋/).length).toBeGreaterThan(0)
  })

  it('CTA button has correct href to /register', () => {
    render(
      <MemoryRouter initialEntries={['/landing?code=DY2026']}>
        <LandingPage />
      </MemoryRouter>,
    )
    const cta = screen.getByRole('link', { name: /开始试玩/ })
    expect(cta.getAttribute('href')).toContain('/register')
    expect(cta.getAttribute('href')).toContain('code=DY2026')
  })

  it('defaults invite code to empty when no URL param', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    )
    const cta = screen.getByRole('link', { name: /开始试玩/ })
    expect(cta.getAttribute('href')).toContain('/register')
  })
})
