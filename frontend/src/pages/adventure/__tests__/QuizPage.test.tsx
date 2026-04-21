// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import QuizPage from '../QuizPage'

// Mock adventure API
vi.mock('@/api/adventure', () => ({
  adventureApi: {
    startChallenge: vi.fn(),
    getQuiz: vi.fn(),
    completeChallenge: vi.fn(),
  },
}))

import { adventureApi } from '@/api/adventure'

const MOCK_BANK = {
  challenge_id: 'meadow_exam',
  pass_threshold: 3,
  total_questions: 5,
  reward_xp: 100,
  questions: [
    {
      id: 'q1', text: '国王一次能走几步？', answer: 'A',
      options: [{ key: 'A', text: '1 步（任意方向）' }, { key: 'B', text: '2 步' },
                { key: 'C', text: '8 步' }, { key: 'D', text: '想走多远走多远' }],
      explanation: '国王行动慢。',
    },
    {
      id: 'q2', text: 'Q2?', answer: 'D',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E2.',
    },
    {
      id: 'q3', text: 'Q3?', answer: 'C',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E3.',
    },
    {
      id: 'q4', text: 'Q4?', answer: 'B',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E4.',
    },
    {
      id: 'q5', text: 'Q5?', answer: 'A',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E5.',
    },
  ],
}

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/adventure/quiz/meadow_exam']}>
      <Routes>
        <Route path="/adventure/quiz/:challengeId" element={<QuizPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('QuizPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    ;(adventureApi.startChallenge as any).mockResolvedValue({
      data: { data: { id: 'rec-1', status: 'pending', challenge_type: 'meadow_exam' } },
    })
    ;(adventureApi.getQuiz as any).mockResolvedValue({
      data: { data: MOCK_BANK },
    })
  })

  it('renders first question with 4 options after loading', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('国王一次能走几步？')).toBeTruthy()
    })
    expect(screen.getByText('1 步（任意方向）')).toBeTruthy()
    expect(screen.getByText('2 步')).toBeTruthy()
    expect(screen.getByText('8 步')).toBeTruthy()
    expect(screen.getByText('想走多远走多远')).toBeTruthy()
  })

  it('shows correct feedback and next button when user picks right answer', async () => {
    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))
    fireEvent.click(screen.getByText('1 步（任意方向）'))
    expect(await screen.findByText(/国王行动慢/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /下一题/ })).toBeTruthy()
  })

  it('shows wrong feedback with correct answer when user picks wrong', async () => {
    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))
    fireEvent.click(screen.getByText('2 步'))
    expect(await screen.findByText(/国王行动慢/)).toBeTruthy()
    expect(screen.getByText(/正确答案/)).toBeTruthy()
  })

  it('submits answers and shows pass result when server confirms passed', async () => {
    ;(adventureApi.completeChallenge as any).mockResolvedValue({
      data: { data: { id: 'rec-1', status: 'passed', quiz_score: 4, passed_at: '2026-04-20T12:00:00Z' } },
    })

    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))

    // Answer all 5 questions
    for (let i = 0; i < 5; i++) {
      // Click first option in each question (options are rendered as buttons with text "A." prefix)
      const buttons = screen.getAllByRole('button')
      const optionBtn = buttons.find(b => b.textContent?.startsWith('A.'))
      if (!optionBtn) throw new Error(`round ${i}: no A option button found`)
      fireEvent.click(optionBtn)
      const nextBtn = await screen.findByRole('button', { name: /下一题|提交/ })
      fireEvent.click(nextBtn)
    }

    await waitFor(() => {
      expect(adventureApi.completeChallenge).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /毕业|通过/ })).toBeTruthy()
    })
  })

  it('shows retry result when server confirms failed', async () => {
    ;(adventureApi.completeChallenge as any).mockResolvedValue({
      data: { data: { id: 'rec-1', status: 'failed', quiz_score: 2 } },
    })

    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))

    for (let i = 0; i < 5; i++) {
      const buttons = screen.getAllByRole('button')
      const optionBtn = buttons.find(b => b.textContent?.startsWith('A.'))
      if (!optionBtn) throw new Error(`round ${i}: no A option button found`)
      fireEvent.click(optionBtn)
      const nextBtn = await screen.findByRole('button', { name: /下一题|提交/ })
      fireEvent.click(nextBtn)
    }

    await waitFor(() => {
      expect(screen.getByText(/再接再厉|未通过/)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /重新挑战/ })).toBeTruthy()
  })

  it('persists answers to sessionStorage on each selection', async () => {
    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))
    fireEvent.click(screen.getByText('1 步（任意方向）'))
    await waitFor(() => {
      const saved = sessionStorage.getItem('quiz_rec-1')
      expect(saved).toContain('"q1":"A"')
    })
  })
})
