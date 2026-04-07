import { useState, useEffect } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg'

export interface BreakpointResult {
  breakpoint: Breakpoint
  isMobile: boolean   // < md (< 768)
  isTablet: boolean   // md (768-1023)
  isDesktop: boolean  // >= lg (>= 1024)
}

const QUERIES = {
  lg: '(min-width: 1024px)',
  md: '(min-width: 768px)',
  sm: '(min-width: 480px)',
} as const

function getBreakpoint(lg: boolean, md: boolean, sm: boolean): Breakpoint {
  if (lg) return 'lg'
  if (md) return 'md'
  if (sm) return 'sm'
  return 'xs'
}

function getSSRDefault(): BreakpointResult {
  return { breakpoint: 'lg', isMobile: false, isTablet: false, isDesktop: true }
}

export function useBreakpoint(): BreakpointResult {
  const [result, setResult] = useState<BreakpointResult>(() => {
    if (typeof window === 'undefined') return getSSRDefault()
    const lg = window.matchMedia(QUERIES.lg).matches
    const md = window.matchMedia(QUERIES.md).matches
    const sm = window.matchMedia(QUERIES.sm).matches
    const bp = getBreakpoint(lg, md, sm)
    return { breakpoint: bp, isMobile: !md, isTablet: md && !lg, isDesktop: lg }
  })

  useEffect(() => {
    const mqLg = window.matchMedia(QUERIES.lg)
    const mqMd = window.matchMedia(QUERIES.md)
    const mqSm = window.matchMedia(QUERIES.sm)

    const update = () => {
      const bp = getBreakpoint(mqLg.matches, mqMd.matches, mqSm.matches)
      setResult({
        breakpoint: bp,
        isMobile: !mqMd.matches,
        isTablet: mqMd.matches && !mqLg.matches,
        isDesktop: mqLg.matches,
      })
    }

    mqLg.addEventListener('change', update)
    mqMd.addEventListener('change', update)
    mqSm.addEventListener('change', update)

    return () => {
      mqLg.removeEventListener('change', update)
      mqMd.removeEventListener('change', update)
      mqSm.removeEventListener('change', update)
    }
  }, [])

  return result
}
