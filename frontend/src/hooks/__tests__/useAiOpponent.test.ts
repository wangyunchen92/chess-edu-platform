// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAiOpponent } from '../useAiOpponent'

// Mock EngineManager
vi.mock('@/engine', () => ({
  EngineManager: {
    getInstance: vi.fn(),
  },
}))

import { EngineManager } from '@/engine'

describe('useAiOpponent', () => {
  let mockEngine: {
    ensureReady: ReturnType<typeof vi.fn>
    getBestMove: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEngine = {
      ensureReady: vi.fn().mockResolvedValue(undefined),
      getBestMove: vi.fn().mockResolvedValue('e2e4'),
    }
    ;(EngineManager.getInstance as any).mockReturnValue(mockEngine)
  })

  it('calls onMove when enabled', async () => {
    const onMove = vi.fn()
    renderHook(() => useAiOpponent('fen1', true, onMove))
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('e2e4'))
  })

  it('does not call onMove when disabled', async () => {
    const onMove = vi.fn()
    renderHook(() => useAiOpponent('fen1', false, onMove))
    await new Promise((r) => setTimeout(r, 50))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('ignores stale results after fen change', async () => {
    const onMove = vi.fn()
    mockEngine.getBestMove = vi.fn().mockImplementation(
      (fen: string) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(fen === 'fen1' ? 'stale' : 'fresh'), 40),
        ),
    )
    const { rerender } = renderHook(
      ({ fen }) => useAiOpponent(fen, true, onMove),
      { initialProps: { fen: 'fen1' } },
    )
    rerender({ fen: 'fen2' })

    await new Promise((r) => setTimeout(r, 150))
    expect(onMove).not.toHaveBeenCalledWith('stale')
    expect(onMove).toHaveBeenCalledWith('fresh')
  })

  it('surfaces error after two failed attempts', async () => {
    mockEngine.getBestMove = vi.fn().mockRejectedValue(new Error('engine exploded'))
    const onMove = vi.fn()
    const { result } = renderHook(() => useAiOpponent('fen1', true, onMove))
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(onMove).not.toHaveBeenCalled()
  })
})
