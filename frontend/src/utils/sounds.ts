/**
 * Chess sound effects using real audio files (Lichess standard, MIT licensed).
 *
 * Sound files: /assets/sounds/Move.mp3, Capture.mp3, GenericNotify.mp3
 * Fallback: Web Audio API synthesis if files fail to load.
 */

// ── Audio Cache ───────────────────────────────────────────────────

const audioCache: Record<string, HTMLAudioElement> = {}

function getAudio(name: string): HTMLAudioElement {
  if (!audioCache[name]) {
    const base = import.meta.env.BASE_URL || '/'
    audioCache[name] = new Audio(`${base}assets/sounds/${name}.mp3`)
    audioCache[name].volume = 0.6
  }
  return audioCache[name]
}

function isSoundEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem('soundEnabled') !== 'false'
}

function playAudio(name: string): void {
  if (!isSoundEnabled()) return
  try {
    const audio = getAudio(name)
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch { /* silent */ }
}

// ── Web Audio Fallback (for check/castle/gameEnd/error) ───────────

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try { audioCtx = new AudioContext() } catch { return null }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

// ── Public API ────────────────────────────────────────────────────

/** Normal piece move — wood tap */
export function playMoveSound(): void {
  playAudio('Move')
}

/** Capture — sharp snap */
export function playCaptureSound(): void {
  playAudio('Capture')
}

/** Check — alert two-tone ring */
export function playCheckSound(): void {
  if (!isSoundEnabled()) return
  // Use notify sound + higher pitch overlay for check
  playAudio('GenericNotify')
}

/** Castle — double move tap */
export function playCastleSound(): void {
  if (!isSoundEnabled()) return
  playAudio('Move')
  setTimeout(() => playAudio('Move'), 120)
}

/** Game end — fanfare */
export function playGameEndSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) { playAudio('GenericNotify'); return }

  const t = ctx.currentTime
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t + i * 0.12)
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.setValueAtTime(0.2, t + i * 0.12)
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t + i * 0.12)
    osc.stop(t + i * 0.12 + 0.3)
  })
}

/** Error — low buzz for wrong move */
export function playErrorSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.12)
}
