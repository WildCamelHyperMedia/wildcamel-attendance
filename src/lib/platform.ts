// Coarse platform detection for showing the right "turn on location" steps.
// UA sniffing is inherently imperfect, but it's only used to pick which help
// text to show — never to gate behaviour. iOS detection mirrors src/lib/push.ts
// (iPadOS 13+ reports as MacIntel, so touch points disambiguate).

export type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'other'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const isIos =
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Mac/i.test(ua)) return 'macos'
  if (/Win/i.test(ua)) return 'windows'
  return 'other'
}
