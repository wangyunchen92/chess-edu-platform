/**
 * Voice playback utility.
 *
 * Architecture:
 * 1. Primary: ChatTTS backend API (when available) — uses real voice seeds
 * 2. Fallback: Web Speech API (browser built-in TTS)
 *
 * ChatTTS voice assignments:
 * - 豆丁老师 (douding): 知性女声 seed_3798 — 温柔沉稳
 * - 小琪 (xiaoqi): 年轻女性 seed_6615 — 活泼清脆
 */

// ── Voice Configuration ───────────────────────────────────────────

interface VoiceProfile {
  /** ChatTTS seed number */
  seed: number
  /** ChatTTS seed file name (for reference) */
  seedFile: string
  /** Web Speech API fallback: speech rate */
  fallbackRate: number
  /** Web Speech API fallback: pitch */
  fallbackPitch: number
}

const VOICE_PROFILES: Record<string, VoiceProfile> = {
  douding: {
    seed: 3798,
    seedFile: '知性女声_seed3798',
    fallbackRate: 0.9,
    fallbackPitch: 1.0,
  },
  xiaoqi: {
    seed: 6615,
    seedFile: '年轻女性_seed6615',
    fallbackRate: 1.05,
    fallbackPitch: 1.5,
  },
}

// ── ChatTTS API (when backend TTS service is available) ───────────

const CHATTTS_API_URL = '/api/v1/tts/synthesize'

let currentAudio: HTMLAudioElement | null = null

async function tryPlayViaChatTTS(text: string, character: string): Promise<boolean> {
  const profile = VOICE_PROFILES[character] ?? VOICE_PROFILES.douding
  try {
    const resp = await fetch(CHATTTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        seed: profile.seed,
        speed: character === 'xiaoqi' ? 1.1 : 0.95,
      }),
    })
    if (!resp.ok) return false

    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    currentAudio = new Audio(url)
    currentAudio.onended = () => {
      URL.revokeObjectURL(url)
      currentAudio = null
    }
    await currentAudio.play()
    return true
  } catch {
    return false
  }
}

// ── Web Speech API Fallback ───────────────────────────────────────

function playViaWebSpeech(text: string, character: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'

  const profile = VOICE_PROFILES[character] ?? VOICE_PROFILES.douding
  utterance.rate = profile.fallbackRate
  utterance.pitch = profile.fallbackPitch

  // Try to find a Chinese voice
  const voices = window.speechSynthesis.getVoices()
  const zhVoice = voices.find((v) => v.lang.startsWith('zh'))
  if (zhVoice) {
    utterance.voice = zhVoice
  }

  window.speechSynthesis.speak(utterance)
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Play text as speech with character-specific voice.
 * Tries ChatTTS API first, falls back to Web Speech API.
 */
export async function playVoice(text: string, character: string): Promise<void> {
  stopVoice()

  // Try ChatTTS first
  const success = await tryPlayViaChatTTS(text, character)
  if (success) return

  // Fallback to Web Speech
  playViaWebSpeech(text, character)
}

/**
 * Stop any currently playing speech.
 */
export function stopVoice(): void {
  // Stop ChatTTS audio
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  // Stop Web Speech
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Check if speech is currently playing.
 */
export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused) return true
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return true
  return false
}

export default { playVoice, stopVoice, isSpeaking }
