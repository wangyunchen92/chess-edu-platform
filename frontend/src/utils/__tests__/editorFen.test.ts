import { describe, it, expect } from 'vitest'
import { validateEditorFen } from '../editorFen'

describe('validateEditorFen', () => {
  it('accepts the standard starting position', () => {
    expect(
      validateEditorFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBeNull()
  })

  it('accepts a simple legal endgame', () => {
    expect(validateEditorFen('4k3/8/8/Q7/8/8/8/4K3 w - - 0 1')).toBeNull()
  })

  it('rejects when white king is missing', () => {
    expect(validateEditorFen('4k3/8/8/8/8/8/8/8 w - - 0 1')).toMatch(/白方.*国王/)
  })

  it('rejects when black king is missing', () => {
    expect(validateEditorFen('8/8/8/8/8/8/8/4K3 w - - 0 1')).toMatch(/黑方.*国王/)
  })

  it('rejects when there are two white kings', () => {
    expect(validateEditorFen('4k3/8/8/8/8/8/8/KK6 w - - 0 1')).toMatch(/白方.*国王/)
  })

  it('rejects adjacent kings', () => {
    expect(validateEditorFen('8/8/8/3Kk3/8/8/8/8 w - - 0 1')).toMatch(/相邻/)
  })

  it('rejects position where opponent is in check (side-to-move wrong)', () => {
    // 白先但黑王被白车将军 — 非法
    expect(validateEditorFen('3k3R/8/8/8/8/8/8/3K4 w - - 0 1')).toMatch(/非法|将军/)
  })

  it('rejects malformed FEN', () => {
    expect(validateEditorFen('not-a-fen')).toMatch(/格式/)
  })
})
