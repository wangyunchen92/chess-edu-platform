// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// jsdom doesn't implement matchMedia; Modal -> useBreakpoint relies on it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

import DoudingWelcome from '../DoudingWelcome'

describe('DoudingWelcome', () => {
  it('renders douding greeting when open', () => {
    render(
      <MemoryRouter>
        <DoudingWelcome open={true} onClose={() => {}} onAccept={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/豆丁|Hi/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /来一局|开始/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /先看看|跳过/ })).toBeTruthy()
  })

  it('does not render when open is false', () => {
    const { queryByText } = render(
      <MemoryRouter>
        <DoudingWelcome open={false} onClose={() => {}} onAccept={() => {}} />
      </MemoryRouter>,
    )
    expect(queryByText(/豆丁|Hi/)).toBeNull()
  })

  it('calls onAccept when user clicks 来一局', () => {
    const onAccept = vi.fn()
    render(
      <MemoryRouter>
        <DoudingWelcome open={true} onClose={() => {}} onAccept={onAccept} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /来一局|开始/ }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when user clicks 先看看', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <DoudingWelcome open={true} onClose={onClose} onAccept={() => {}} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /先看看|跳过/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
