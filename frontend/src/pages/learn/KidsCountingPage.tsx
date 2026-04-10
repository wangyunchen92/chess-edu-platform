import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CountingLevel {
  level: number
  gridSize: number
  pieces: { type: string; color: 'w' | 'b'; pos: [number, number] }[]
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

type GamePhase = 'select' | 'play' | 'result'

// ---------------------------------------------------------------------------
// Level data (10 levels)
// ---------------------------------------------------------------------------

const COUNTING_LEVELS: CountingLevel[] = [
  // ===== L1-10: Single piece counting ("How many squares can this piece attack?") =====
  {
    level: 1,
    gridSize: 6,
    pieces: [{ type: 'R', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u8F66\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['6', '8', '10', '12'],
    correctIndex: 2,
    explanation: '\u8F66\u80FD\u6C34\u5E73\u548C\u7AD6\u76F4\u653B\u51FB\uFF0C\u5728\u8FD9\u4E2A\u4F4D\u7F6E\u5171\u80FD\u653B\u51FB10\u4E2A\u683C\u5B50\uFF01',
  },
  {
    level: 2,
    gridSize: 6,
    pieces: [{ type: 'B', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u8C61\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['5', '7', '9', '11'],
    correctIndex: 2,
    explanation: '\u8C61\u6CBF\u5BF9\u89D2\u7EBF\u653B\u51FB\uFF0C\u5728\u8FD9\u4E2A\u4F4D\u7F6E\u5171\u80FD\u653B\u51FB9\u4E2A\u683C\u5B50\uFF01',
  },
  {
    level: 3,
    gridSize: 6,
    pieces: [{ type: 'N', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u9A6C\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['4', '6', '8', '10'],
    correctIndex: 2,
    explanation: '\u9A6C\u8D70\u201CL\u201D\u5F62\uFF0C\u5728\u4E2D\u5FC3\u4F4D\u7F6E\u5171\u67098\u4E2A\u8DF3\u7684\u65B9\u5411\uFF01',
  },
  {
    // Rook at corner (0,0): row 5 + col 5 = 10 squares
    level: 4,
    gridSize: 6,
    pieces: [{ type: 'R', color: 'w', pos: [0, 0] }],
    question: '\u89D2\u843D\u7684\u8F66\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['8', '10', '12', '14'],
    correctIndex: 1,
    explanation: '\u8F66\u5728\u89D2\u843D\u4E5F\u80FD\u653B\u51FB\u540C\u884C5\u4E2A+\u540C\u52175\u4E2A=10\u4E2A\u683C\u5B50\uFF01',
  },
  {
    // Bishop at corner (0,0): only diagonal down-right, 5 squares
    level: 5,
    gridSize: 6,
    pieces: [{ type: 'B', color: 'w', pos: [0, 0] }],
    question: '\u89D2\u843D\u7684\u8C61\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['3', '5', '7', '9'],
    correctIndex: 1,
    explanation: '\u8C61\u5728\u89D2\u843D\u53EA\u6709\u4E00\u6761\u5BF9\u89D2\u7EBF\uFF0C\u80FD\u653B\u51FB5\u4E2A\u683C\u5B50\uFF01',
  },
  {
    // Knight at corner (0,0): only (1,2) and (2,1) = 2 squares
    level: 6,
    gridSize: 6,
    pieces: [{ type: 'N', color: 'w', pos: [0, 0] }],
    question: '\u89D2\u843D\u7684\u9A6C\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['2', '4', '6', '8'],
    correctIndex: 0,
    explanation: '\u9A6C\u5728\u89D2\u843D\u53EA\u80FD\u8DF3\u52302\u4E2A\u4F4D\u7F6E\uFF01\u8FB9\u89D2\u7684\u9A6C\u5F88\u5F31\u54E6\uFF01',
  },
  {
    // Queen at center (3,3): 10 (rook) + 9 (bishop) = 19 squares
    level: 7,
    gridSize: 6,
    pieces: [{ type: 'Q', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u540E\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['15', '17', '19', '21'],
    correctIndex: 2,
    explanation: '\u540E=\u8F66+\u8C61\uFF0C\u5728\u4E2D\u5FC3\u80FD\u653B\u51FB\u76F4\u7EBF10+\u659C\u7EBF9=19\u4E2A\u683C\u5B50\uFF01',
  },
  {
    // Knight at (1,1): can go to (0,3)(2,3)(3,0)(3,2) = 4 squares
    level: 8,
    gridSize: 6,
    pieces: [{ type: 'N', color: 'w', pos: [1, 1] }],
    question: '\u8FD9\u4E2A\u9A6C\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['2', '4', '6', '8'],
    correctIndex: 1,
    explanation: '\u9A6C\u5728(1,1)\u53EF\u4EE5\u8DF3\u5230(0,3)\u3001(2,3)\u3001(3,0)\u3001(3,2)\uFF0C\u51714\u4E2A\u683C\u5B50\uFF01',
  },
  {
    // Rook at edge (0,3): row 5 + col 5 = 10
    level: 9,
    gridSize: 6,
    pieces: [{ type: 'R', color: 'w', pos: [0, 3] }],
    question: '\u8FD9\u4E2A\u8F66\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['8', '10', '12', '14'],
    correctIndex: 1,
    explanation: '\u8F66\u65E0\u8BBA\u5728\u54EA\u91CC\uFF0C\u5728\u7A7A\u68CB\u76D8\u4E0A\u90FD\u80FD\u653B\u51FB10\u4E2A\u683C\u5B50\uFF01',
  },
  {
    // Queen at corner (0,0): row 5 + col 5 + diag 5 = 15 squares
    level: 10,
    gridSize: 6,
    pieces: [{ type: 'Q', color: 'w', pos: [0, 0] }],
    question: '\u89D2\u843D\u7684\u540E\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['11', '13', '15', '17'],
    correctIndex: 2,
    explanation: '\u540E\u5728\u89D2\u843D\uFF1A\u6A2A5+\u7AD65+\u659C5=15\u4E2A\u683C\u5B50\uFF01',
  },
  // ===== L11-20: Find which piece can capture =====
  {
    level: 11,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [5, 0] },
      { type: 'B', color: 'w', pos: [5, 5] },
      { type: 'p', color: 'b', pos: [5, 3] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8F66', '\u8C61', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u8F66\u53EF\u4EE5\u6C34\u5E73\u79FB\u52A8\u5230\u9ED1\u5175\u7684\u4F4D\u7F6E\uFF0C\u800C\u8C61\u53EA\u80FD\u8D70\u659C\u7EBF\uFF0C\u4ECE(5,5)\u5230(5,3)\u662F\u6A2A\u7EBF\u4E0D\u662F\u659C\u7EBF\uFF01',
  },
  {
    level: 12,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [4, 2] },
      { type: 'R', color: 'w', pos: [0, 0] },
      { type: 'p', color: 'b', pos: [2, 3] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8F66', '\u9A6C', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 1,
    explanation: '\u9A6C\u4ECE(4,2)\u8DF3\u201CL\u201D\u5F62\u5230(2,3)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01\u8F66\u5728(0,0)\u4E0D\u5728\u540C\u884C\u540C\u5217\u3002',
  },
  {
    level: 13,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'w', pos: [5, 0] },
      { type: 'N', color: 'w', pos: [0, 5] },
      { type: 'p', color: 'b', pos: [3, 2] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u540E', '\u9A6C', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u540E\u80FD\u8D70\u659C\u7EBF\uFF0C\u4ECE(5,0)\u659C\u8D70\u5230(3,2)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01',
  },
  {
    // Rook at (0,2), Bishop at (4,0), pawn at (4,2)
    // Rook: (0,2) to (4,2) same column -> can capture
    // Bishop: (4,0) to (4,2) same row, not diagonal -> cannot
    level: 14,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [0, 2] },
      { type: 'B', color: 'w', pos: [4, 0] },
      { type: 'p', color: 'b', pos: [4, 2] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8F66', '\u8C61', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u8F66\u4ECE(0,2)\u6CBF\u7AD6\u7EBF\u5230(4,2)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01\u8C61\u53EA\u80FD\u8D70\u659C\u7EBF\u3002',
  },
  {
    // Knight at (2,1), Bishop at (0,4), pawn at (0,2)
    // Knight: (2,1) -> (0,2) yes! L-shape (-2,+1)
    // Bishop: (0,4) to (0,2) same row -> no
    level: 15,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [2, 1] },
      { type: 'B', color: 'w', pos: [0, 4] },
      { type: 'p', color: 'b', pos: [0, 2] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u9A6C', '\u8C61', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u9A6C\u4ECE(2,1)\u8DF3L\u5F62\u5230(0,2)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01',
  },
  {
    // Both can capture: Queen at (3,0) -> (3,4) same row; Rook at (0,4) -> (3,4) same col
    level: 16,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'w', pos: [3, 0] },
      { type: 'R', color: 'w', pos: [0, 4] },
      { type: 'p', color: 'b', pos: [3, 4] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u540E', '\u8F66', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 2,
    explanation: '\u540E\u6CBF\u884C\u5230(3,4)\uFF0C\u8F66\u6CBF\u5217\u5230(3,4)\uFF0C\u90FD\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01',
  },
  {
    // Neither can: Bishop at (0,0) diag hits (1,1)(2,2)..., Knight at (5,5) -> (3,4)(4,3)(3,4)
    // Target at (2,4): Bishop diag from (0,0) goes (1,1)(2,2)(3,3)... no. Knight from (5,5)->(3,4)(4,3)... no (2,4) is not an L from (5,5)
    // Wait: (5,5) knight targets: (3,4)(4,3)(3,4) -- let me recalc: (-2,-1)=(3,4), (-2,+1)=(3,6)OOB, (-1,-2)=(4,3), (-1,+2)=(4,7)OOB, (1,-2)=(6,3)OOB, (1,+2)=(6,7)OOB, (2,-1)=(7,4)OOB, (2,+1)=(7,6)OOB
    // So knight targets (3,4) and (4,3). Target is (2,4) -- neither can reach
    // Bishop from (0,0): (1,1)(2,2)(3,3)(4,4)(5,5). No (2,4) not on diagonal
    level: 17,
    gridSize: 6,
    pieces: [
      { type: 'B', color: 'w', pos: [0, 0] },
      { type: 'N', color: 'w', pos: [5, 5] },
      { type: 'p', color: 'b', pos: [2, 4] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8C61', '\u9A6C', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 3,
    explanation: '\u8C61\u7684\u659C\u7EBF\u5230\u4E0D\u4E86(2,4)\uFF0C\u9A6C\u4E5F\u8DF3\u4E0D\u5230(2,4)\uFF0C\u90FD\u5403\u4E0D\u6389\uFF01',
  },
  {
    // Rook at (2,0), Knight at (0,3), pawn at (2,5)
    // Rook: same row (2,0)->(2,5) yes
    // Knight: (0,3) targets (-2,2)OOB (-2,4)OOB (-1,1) (-1,5) (1,1) (1,5) (2,2) (2,4) -> (-1,5) is invalid, (1,5) is valid!
    // Wait (0,3): (-2,2)=(-2,2)OOB, (-2,4)=(-2,4)OOB, (-1,1)=(-1,1)OOB, (-1,5)=(-1,5)OOB, (1,1)=(1,1), (1,5)=(1,5), (2,2)=(2,2), (2,4)=(2,4)
    // Target (2,5): not in knight targets. So only rook.
    level: 18,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [2, 0] },
      { type: 'N', color: 'w', pos: [0, 3] },
      { type: 'p', color: 'b', pos: [2, 5] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8F66', '\u9A6C', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u8F66\u4ECE(2,0)\u6CBF\u884C\u5230(2,5)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01\u9A6C\u8DF3\u4E0D\u5230\u3002',
  },
  {
    // Bishop at (5,0) -> diag (4,1)(3,2)(2,3)(1,4)(0,5), target (1,4) on diagonal -> yes
    // Queen at (0,0) -> (1,4)? row 0->1, col 0->4, not same row/col/diag -> no
    // Actually (0,0) diag: (1,1)(2,2)... not (1,4). Row/col also no. So only bishop.
    level: 19,
    gridSize: 6,
    pieces: [
      { type: 'B', color: 'w', pos: [5, 0] },
      { type: 'Q', color: 'w', pos: [0, 0] },
      { type: 'p', color: 'b', pos: [1, 4] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8C61', '\u540E', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u8C61\u4ECE(5,0)\u659C\u8D70\u5230(1,4)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01\u540E\u7684\u8DEF\u7EBF\u5230\u4E0D\u4E86\u3002',
  },
  {
    // Knight at (4,3), Rook at (1,0), pawn at (2,4)
    // Knight from (4,3): (2,2)(2,4)(3,1)(3,5)(5,1)(5,5) -- (2,4) yes!
    // Rook from (1,0): row 1 or col 0, target (2,4) neither -> no
    level: 20,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [4, 3] },
      { type: 'R', color: 'w', pos: [1, 0] },
      { type: 'p', color: 'b', pos: [2, 4] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u9A6C', '\u8F66', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u9A6C\u4ECE(4,3)\u8DF3L\u5F62\u5230(2,4)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01',
  },
  // ===== L21-30: Comprehensive =====
  {
    level: 21,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [0, 0] },
      { type: 'R', color: 'b', pos: [0, 5] },
    ],
    question: '\u8C01\u66F4\u5371\u9669\uFF1F\uFF08\u8C01\u80FD\u5403\u6389\u5BF9\u65B9\uFF09',
    options: ['\u767D\u8F66', '\u9ED1\u8F66', '\u4E00\u6837\u5371\u9669', '\u90FD\u5B89\u5168'],
    correctIndex: 2,
    explanation: '\u4E24\u4E2A\u8F66\u5728\u540C\u4E00\u884C\uFF0C\u4E92\u76F8\u90FD\u80FD\u653B\u51FB\u5230\u5BF9\u65B9\uFF01',
  },
  {
    level: 22,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'w', pos: [3, 3] },
      { type: 'p', color: 'b', pos: [1, 1] },
      { type: 'p', color: 'b', pos: [3, 0] },
      { type: 'p', color: 'b', pos: [5, 5] },
    ],
    question: '\u767D\u540E\u80FD\u5403\u6389\u51E0\u4E2A\u9ED1\u5175\uFF1F',
    options: ['1', '2', '3', '\u5168\u90E8'],
    correctIndex: 3,
    explanation: '\u540E\u80FD\u8D70\u76F4\u7EBF\u548C\u659C\u7EBF\uFF0C(1,1)\u659C\u7EBF\u3001(3,0)\u76F4\u7EBF\u3001(5,5)\u659C\u7EBF\u90FD\u80FD\u653B\u51FB\u5230\uFF01',
  },
  {
    level: 23,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [3, 3] },
      { type: 'p', color: 'b', pos: [1, 2] },
      { type: 'p', color: 'b', pos: [1, 4] },
      { type: 'p', color: 'b', pos: [2, 1] },
      { type: 'p', color: 'b', pos: [5, 2] },
    ],
    question: '\u767D\u9A6C\u80FD\u5403\u6389\u51E0\u4E2A\u9ED1\u5175\uFF1F',
    options: ['1', '2', '3', '4'],
    correctIndex: 2,
    explanation: '\u9A6C\u4ECE(3,3)\u80FD\u8DF3\u5230(1,2)\u3001(1,4)\u3001(2,1)\u3001(4,1)\u3001(4,5)\u3001(5,2)\u3001(5,4)\u3001(2,5)\uFF0C\u5176\u4E2D(1,2)\u3001(1,4)\u3001(5,2)\u6709\u9ED1\u5175\uFF0C\u5171\u53EF\u54033\u4E2A\uFF01',
  },
  {
    level: 24,
    gridSize: 6,
    pieces: [
      { type: 'B', color: 'w', pos: [0, 0] },
      { type: 'R', color: 'w', pos: [5, 5] },
      { type: 'p', color: 'b', pos: [2, 2] },
      { type: 'p', color: 'b', pos: [5, 0] },
      { type: 'p', color: 'b', pos: [0, 5] },
    ],
    question: '\u767D\u65B9\u603B\u5171\u80FD\u5403\u6389\u51E0\u4E2A\u9ED1\u5175\uFF1F',
    options: ['1', '2', '3', '\u5168\u90E8'],
    correctIndex: 3,
    explanation: '\u8C61\u80FD\u659C\u7EBF\u5403(2,2)\uFF0C\u8F66\u80FD\u6A2A\u7EBF\u5403(5,0)\u548C\u7AD6\u7EBF\u5403(0,5)\uFF0C\u5168\u90E8\u90FD\u80FD\u5403\u6389\uFF01',
  },
  {
    // "Which square is safest?" White queen at (3,3).
    // (0,1): queen can reach via col? no. row? no. diag? 3-0=3, 3-1=2, not equal -> safe!
    // (5,0): 3->5=2, 3->0=3, not same row/col. diag: |5-3|=2, |0-3|=3 -> no. Safe!
    // (0,3): same col as queen -> dangerous
    // (3,5): same row as queen -> dangerous
    // So (0,1) and (5,0) are safe, (0,3) and (3,5) are dangerous. Pick (0,1) as correct answer.
    level: 25,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'b', pos: [3, 3] },
    ],
    question: '\u54EA\u4E2A\u683C\u5B50\u6700\u5B89\u5168\uFF1F\uFF08\u4E0D\u88AB\u9ED1\u540E\u653B\u51FB\uFF09',
    options: ['a6 (0,0)', 'b6 (0,1)', 'd6 (0,3)', 'f4 (3,5)'],
    correctIndex: 1,
    explanation: '(0,0)\u5728\u540E\u7684\u659C\u7EBF\u4E0A\uFF0C(0,3)\u5728\u540C\u5217\uFF0C(3,5)\u5728\u540C\u884C\u3002\u53EA\u6709(0,1)\u4E0D\u5728\u540E\u7684\u653B\u51FB\u8303\u56F4\uFF01',
  },
  {
    // How many pieces can attack d4 (row3, col3)?
    // Rook at (3,0): same row -> yes
    // Bishop at (0,0): diag (1,1)(2,2)(3,3) -> yes
    // Knight at (5,4): (5-3=2, 4-3=1) -> L-shape yes!
    // Knight at (0,5): (0-3=-3, 5-3=2) -> not L-shape -> no
    level: 26,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'b', pos: [3, 0] },
      { type: 'B', color: 'b', pos: [0, 0] },
      { type: 'N', color: 'b', pos: [5, 4] },
      { type: 'N', color: 'b', pos: [0, 5] },
    ],
    question: '\u51E0\u4E2A\u9ED1\u68CB\u5B50\u80FD\u653B\u51FBd4\u683C\u5B50(3,3)\uFF1F',
    options: ['1', '2', '3', '4'],
    correctIndex: 2,
    explanation: '\u8F66\u540C\u884C\u3001\u8C61\u659C\u7EBF\u3001\u9A6C(5,4)\u8DF3L\u5F62\u90FD\u80FD\u653B\u51FB(3,3)\uFF0C\u51713\u4E2A\uFF01\u9A6C(0,5)\u8DF3\u4E0D\u5230\u3002',
  },
  {
    // Who is more dangerous? White bishop at (2,2) vs black rook at (2,5)
    // Bishop attacks: diag 9 squares. Rook attacks: row+col = 10 squares.
    // Rook is more dangerous (attacks more squares)
    level: 27,
    gridSize: 6,
    pieces: [
      { type: 'B', color: 'w', pos: [2, 2] },
      { type: 'R', color: 'b', pos: [2, 5] },
    ],
    question: '\u8C01\u80FD\u653B\u51FB\u66F4\u591A\u683C\u5B50\uFF1F',
    options: ['\u767D\u8C61', '\u9ED1\u8F66', '\u4E00\u6837\u591A', '\u90FD\u5F88\u5C11'],
    correctIndex: 1,
    explanation: '\u8C61\u5728(2,2)\u653B\u51FB9\u4E2A\u683C\u5B50\uFF0C\u8F66\u5728(2,5)\u653B\u51FB10\u4E2A\u683C\u5B50\uFF0C\u8F66\u66F4\u5F3A\uFF01',
  },
  {
    // Queen at (0,0) with blockers: pawn at (0,3) blocks row, pawn at (2,0) blocks column, pawn at (2,2) blocks diagonal
    // Queen attacks: row (0,1)(0,2) = 2; col (1,0) = 1; diag (1,1) = 1; total = 4
    // But can also capture the pawns: (0,3)(2,0)(2,2) = 3 more if they are enemy
    // All pawns are black, queen is white, so queen can capture them but is blocked after
    // Squares attacked: (0,1)(0,2)(0,3) + (1,0)(2,0) + (1,1)(2,2) = 7
    level: 28,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'w', pos: [0, 0] },
      { type: 'p', color: 'b', pos: [0, 3] },
      { type: 'p', color: 'b', pos: [2, 0] },
      { type: 'p', color: 'b', pos: [2, 2] },
    ],
    question: '\u767D\u540E\u88AB\u9ED1\u5175\u6321\u4F4F\u4E86\uFF0C\u8FD8\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['5', '7', '9', '11'],
    correctIndex: 1,
    explanation: '\u540E\u88AB\u6321\u4F4F\u540E\uFF1A\u6A2A\u5411(0,1)(0,2)(0,3)\u30013\u4E2A\uFF0C\u7AD6\u5411(1,0)(2,0)\u30012\u4E2A\uFF0C\u659C\u5411(1,1)(2,2)\u30012\u4E2A\uFF0C\u5171\u653B\u51FB7\u4E2A\u683C\u5B50\uFF01',
  },
  {
    // Two knights: white at (2,2), black at (4,3)
    // White knight from (2,2): (0,1)(0,3)(1,0)(1,4)(3,0)(3,4)(4,1)(4,3) -- can attack (4,3)!
    // Black knight from (4,3): (2,2)(2,4)(3,1)(3,5)(5,1)(5,5) -- can attack (2,2)!
    // Both can attack each other
    level: 29,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [2, 2] },
      { type: 'N', color: 'b', pos: [4, 3] },
    ],
    question: '\u4E24\u4E2A\u9A6C\u7684\u5173\u7CFB\u662F\uFF1F',
    options: ['\u767D\u9A6C\u80FD\u5403\u9ED1\u9A6C', '\u9ED1\u9A6C\u80FD\u5403\u767D\u9A6C', '\u4E92\u76F8\u80FD\u5403', '\u4E92\u76F8\u5B89\u5168'],
    correctIndex: 2,
    explanation: '\u767D\u9A6C(2,2)\u80FD\u8DF3\u5230(4,3)\uFF0C\u9ED1\u9A6C(4,3)\u80FD\u8DF3\u5230(2,2)\uFF0C\u4E92\u76F8\u90FD\u80FD\u653B\u51FB\uFF01',
  },
  {
    // Complex: How many black pawns are safe from all white pieces?
    // White: Rook at (0,0), Bishop at (5,5)
    // Black pawns at: (0,4), (2,1), (3,4), (4,0)
    // Rook (0,0) attacks: row 0 and col 0 -> (0,4) yes, (4,0) yes
    // Bishop (5,5) attacks: diags -> (4,4)(3,3)(2,2)(1,1)(0,0) -- none of the pawns
    //   other diag: nothing upward-left from (5,5) in bounds
    // So (0,4) and (4,0) attacked. (2,1) and (3,4) are safe. Answer: 2
    level: 30,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [0, 0] },
      { type: 'B', color: 'w', pos: [5, 5] },
      { type: 'p', color: 'b', pos: [0, 4] },
      { type: 'p', color: 'b', pos: [2, 1] },
      { type: 'p', color: 'b', pos: [3, 4] },
      { type: 'p', color: 'b', pos: [4, 0] },
    ],
    question: '\u51E0\u4E2A\u9ED1\u5175\u662F\u5B89\u5168\u7684\uFF1F\uFF08\u4E0D\u88AB\u767D\u65B9\u653B\u51FB\uFF09',
    options: ['0', '1', '2', '3'],
    correctIndex: 2,
    explanation: '\u8F66\u653B\u51FB\u540C\u884C(0,4)\u548C\u540C\u5217(4,0)\uFF0C\u8C61\u659C\u7EBF\u6CA1\u6709\u9ED1\u5175\u3002(2,1)\u548C(3,4)\u662F\u5B89\u5168\u7684\uFF0C\u51712\u4E2A\uFF01',
  },
]

const PIECE_IMAGES: Record<string, string> = {
  K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP',
  k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP',
}

function getPieceImageKey(type: string, color: 'w' | 'b'): string {
  return color === 'w' ? PIECE_IMAGES[type] : PIECE_IMAGES[type.toLowerCase()]
}

const BASE = import.meta.env.BASE_URL || '/'
const pieceSvg = (key: string) => `${BASE}assets/pieces/${key}.svg`

// ---------------------------------------------------------------------------
// CSS animations
// ---------------------------------------------------------------------------

const AnimationStyles: React.FC = () => (
  <style>{`
    @keyframes kids-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    @keyframes kids-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
    @keyframes kids-star-pop {
      0% { transform: scale(0) rotate(-30deg); opacity: 0; }
      60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes kids-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .kids-bounce { animation: kids-bounce 0.5s ease; }
    .kids-shake { animation: kids-shake 0.4s ease; }
    .kids-star-pop { animation: kids-star-pop 0.5s ease forwards; }
    .kids-float { animation: kids-float 2s ease-in-out infinite; }
  `}</style>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KidsCountingPage: React.FC = () => {
  const navigate = useNavigate()

  // Progress
  const [completedLevels, setCompletedLevels] = useState<number[]>([])
  const [starsMap, setStarsMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('select')
  const [currentLevel, setCurrentLevel] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [levelStars, setLevelStars] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)

  // Load progress
  useEffect(() => {
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          const items = data.filter((p: any) => p.game_type === 'counting' && p.completed)
          setCompletedLevels(items.map((p: any) => p.level - 1))
          const stars: Record<number, number> = {}
          items.forEach((p: any) => { stars[p.level - 1] = p.stars })
          setStarsMap(stars)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const levelConfig = COUNTING_LEVELS[currentLevel]

  // Build piece map for display
  const pieceMap = useMemo(() => {
    if (!levelConfig) return new Map<string, { type: string; color: 'w' | 'b' }>()
    const map = new Map<string, { type: string; color: 'w' | 'b' }>()
    levelConfig.pieces.forEach((p) => {
      map.set(`${p.pos[0]},${p.pos[1]}`, { type: p.type, color: p.color })
    })
    return map
  }, [levelConfig])

  const startLevel = useCallback((index: number) => {
    setCurrentLevel(index)
    setSelectedOption(null)
    setFeedback(null)
    setWrongAttempts(0)
    setShowExplanation(false)
    setPhase('play')
  }, [])

  const handleOptionClick = useCallback((optionIndex: number) => {
    if (!levelConfig || feedback === 'correct') return

    setSelectedOption(optionIndex)

    if (optionIndex === levelConfig.correctIndex) {
      setFeedback('correct')
      setShowExplanation(true)

      const stars = wrongAttempts === 0 ? 3 : wrongAttempts === 1 ? 2 : 1
      setLevelStars(stars)

      const newCompleted = [...new Set([...completedLevels, currentLevel])]
      const newStars = { ...starsMap, [currentLevel]: Math.max(starsMap[currentLevel] ?? 0, stars) }
      setCompletedLevels(newCompleted)
      setStarsMap(newStars)

      learnApi.updateKidsProgress({
        game_type: 'counting',
        level: currentLevel + 1,
        stars,
      }).catch(() => {})

      setTimeout(() => setPhase('result'), 2000)
    } else {
      setFeedback('wrong')
      setWrongAttempts((prev) => prev + 1)
      setTimeout(() => {
        setFeedback(null)
        setSelectedOption(null)
      }, 800)
    }
  }, [levelConfig, feedback, wrongAttempts, currentLevel, completedLevels, starsMap])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl flex items-center justify-center">
        <AnimationStyles />
        <div className="text-center">
          <div className="text-5xl kids-float mb-3">{'\uD83D\uDD22'}</div>
          <p className="text-gray-500 text-lg">{'\u52A0\u8F7D\u4E2D...'}</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Level select
  // ---------------------------------------------------------------------------

  if (phase === 'select') {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-4 md:p-6">
        <AnimationStyles />

        <button
          onClick={() => navigate('/learn?tab=kids')}
          className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm">{'\u8FD4\u56DE\u513F\u7AE5\u4E50\u56ED'}</span>
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{'\uD83D\uDD22'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{'\u6570\u4E00\u6570'}</h1>
          <p className="text-gray-500 mt-1">{'\u89C2\u5BDF\u68CB\u76D8\uFF0C\u56DE\u7B54\u95EE\u9898'}</p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-lg mx-auto">
          {COUNTING_LEVELS.map((level, index) => {
            const isCompleted = completedLevels.includes(index)
            return (
              <button
                key={index}
                onClick={() => startLevel(index)}
                className={`relative rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all duration-200 border-2 ${
                  isCompleted
                    ? 'bg-white/80 border-yellow-300 shadow-md hover:scale-105 cursor-pointer'
                    : 'bg-white/80 border-orange-200 shadow-md hover:scale-105 hover:shadow-lg cursor-pointer'
                }`}
              >
                <span className="text-2xl font-bold text-gray-700">{level.level}</span>
                {isCompleted && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <span key={s} className={`text-sm ${s <= (starsMap[index] ?? 0) ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {'\u2B50'}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Result
  // ---------------------------------------------------------------------------

  if (phase === 'result') {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center">
        <AnimationStyles />
        <div className="text-center space-y-6">
          <div className="text-6xl kids-float">{'\uD83C\uDF89'}</div>
          <h2 className="text-2xl font-bold text-gray-800">{'\u56DE\u7B54\u6B63\u786E\uFF01'}</h2>
          <p className="text-gray-600 text-lg">
            {wrongAttempts === 0 ? '\u4E00\u6B21\u5C31\u7B54\u5BF9\u4E86\uFF01' : `\u7B2C ${wrongAttempts + 1} \u6B21\u7B54\u5BF9`}
          </p>

          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className="text-4xl kids-star-pop"
                style={{ animationDelay: `${(s - 1) * 0.2}s`, opacity: 0, color: s <= levelStars ? '#FACC15' : '#D1D5DB' }}
              >
                {'\u2B50'}
              </span>
            ))}
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={() => setPhase('select')}
              className="px-6 py-3 rounded-full bg-white border-2 border-orange-200 text-orange-600 font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
            >
              {'\u8FD4\u56DE\u5173\u5361'}
            </button>
            {currentLevel < COUNTING_LEVELS.length - 1 && (
              <button
                onClick={() => startLevel(currentLevel + 1)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                {'\u4E0B\u4E00\u5173'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Play
  // ---------------------------------------------------------------------------

  if (!levelConfig) return null

  const gridSize = levelConfig.gridSize

  return (
    <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-4 md:p-6">
      <AnimationStyles />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setPhase('select')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm">{'\u8FD4\u56DE'}</span>
        </button>
        <div className="text-sm text-gray-600">
          {'\u7B2C'} {levelConfig.level} {'\u5173'}
        </div>
      </div>

      {/* Board (read-only) */}
      <div className="flex justify-center mb-4">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {Array.from({ length: gridSize }, (_, row) =>
            Array.from({ length: gridSize }, (_, col) => {
              const key = `${row},${col}`
              const piece = pieceMap.get(key)
              const isLight = (row + col) % 2 === 0

              return (
                <div
                  key={key}
                  className={`relative flex items-center justify-center rounded-lg ${
                    isLight ? 'bg-amber-100/60' : 'bg-amber-200/40'
                  }`}
                  style={{
                    width: 'clamp(44px, calc((100vw - 64px) / 6), 64px)',
                    height: 'clamp(44px, calc((100vw - 64px) / 6), 64px)',
                  }}
                >
                  {piece && (
                    <img
                      src={pieceSvg(getPieceImageKey(piece.type, piece.color))}
                      alt={piece.type}
                      className="w-3/4 h-3/4 drop-shadow-md"
                      draggable={false}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Question */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-5 py-3 shadow-lg border border-white/50">
          <span className="text-lg">{'\uD83E\uDD14'}</span>
          <span className="text-base font-bold text-gray-700">
            {levelConfig.question}
          </span>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-4">
        {levelConfig.options.map((option, index) => {
          const isSelected = selectedOption === index
          const isCorrectOption = index === levelConfig.correctIndex
          const showCorrect = feedback === 'correct' && isCorrectOption
          const showWrong = feedback === 'wrong' && isSelected

          return (
            <button
              key={index}
              onClick={() => handleOptionClick(index)}
              disabled={feedback === 'correct'}
              className={`py-4 px-3 rounded-2xl text-lg font-bold transition-all duration-200 border-2 ${
                showCorrect
                  ? 'bg-green-100 border-green-400 text-green-700 kids-bounce'
                  : showWrong
                    ? 'bg-red-50 border-red-300 text-red-500 kids-shake'
                    : 'bg-white/80 border-orange-100 text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:scale-105 shadow-md'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div className="max-w-sm mx-auto bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 text-sm font-medium">
            {levelConfig.explanation}
          </p>
        </div>
      )}

      {/* Feedback */}
      <div className="text-center h-8 mt-2">
        {feedback === 'wrong' && (
          <span className="text-red-400 font-bold text-lg kids-shake inline-block">
            {'\u518D\u60F3\u60F3\u770B\uFF01'}
          </span>
        )}
      </div>
    </div>
  )
}

export default KidsCountingPage
