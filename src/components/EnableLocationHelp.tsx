import type { GeoFailure } from '../lib/geo'
import { detectPlatform, type Platform } from '../lib/platform'
import { Button, SpectrumStrand } from './ui'

// Platform-specific "turn on location" steps. Single source of truth — kept in
// sync with docs/LOCATION_SETUP.md. The 'unavailable'/'timeout' cases are almost
// always the OS Location Services gate (the common Mac/mobile cause), so those
// steps come first; 'denied' leads with the per-site permission.

interface Guide {
  browser: string
  steps: string[]
}

const GUIDES: Record<Platform, Guide[]> = {
  macos: [
    {
      browser: 'Chrome on Mac',
      steps: [
        'Apple menu → System Settings → Privacy & Security → Location Services → turn it On.',
        'In that same list, find Google Chrome and switch it On.',
        'Back here, click the icon just left of the web address and set Location to Allow.',
        'Reload the page and tap Try again.',
      ],
    },
    {
      browser: 'Safari on Mac',
      steps: [
        'Apple menu → System Settings → Privacy & Security → Location Services → turn it On, and tick Safari.',
        'Safari → Settings → Websites → Location → set this site to Allow.',
        'Reload the page and tap Try again.',
      ],
    },
  ],
  ios: [
    {
      browser: 'iPhone / iPad',
      steps: [
        'Settings → Privacy & Security → Location Services → turn it On.',
        'Scroll down to Safari (or Chrome) → set Location to “While Using the App”.',
        'Come back here, reload, and tap Allow when asked.',
      ],
    },
  ],
  android: [
    {
      browser: 'Android (Chrome)',
      steps: [
        'Swipe down and make sure Location is On.',
        'Settings → Apps → Chrome → Permissions → Location → Allow.',
        'In Chrome, tap the icon left of the address → Permissions → Location → Allow.',
        'Reload the page and tap Try again.',
      ],
    },
  ],
  windows: [
    {
      browser: 'This browser',
      steps: [
        'Click the icon just left of the web address → set Location to Allow.',
        'Reload the page and tap Try again.',
      ],
    },
  ],
  other: [
    {
      browser: 'This browser',
      steps: [
        'Open your browser’s site settings for this page and allow Location.',
        'Check your device’s Location Services / location setting is on.',
        'Reload the page and tap Try again.',
      ],
    },
  ],
}

const TITLES: Record<GeoFailure, string> = {
  denied: 'Location is blocked for this site',
  unavailable: 'Turn on Location Services',
  timeout: 'Location took too long',
  unsupported: "Location isn't available here",
}

const INTROS: Record<GeoFailure, string> = {
  denied:
    'Your browser is blocking location for this site. Allow it, then try again.',
  unavailable:
    "Your device's Location Services are likely off for this browser. This is the usual reason on Mac and phones — here's how to switch it on.",
  timeout:
    "We couldn't get a location in time. Make sure Location Services are on, then try again — near a window helps.",
  unsupported:
    "This browser can't share your location. You can still check in — you'll just be marked Unknown. Try a different browser if you'd like it labelled.",
}

export function EnableLocationHelp({
  reason,
  onClose,
  onRetry,
}: {
  reason: GeoFailure
  onClose: () => void
  onRetry?: () => void
}) {
  const guides = reason === 'unsupported' ? [] : GUIDES[detectPlatform()]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-2xl border border-edge bg-dusk-800 sm:rounded-2xl"
      >
        <SpectrumStrand />
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-display text-lg font-bold">{TITLES[reason]}</h2>
            <p className="mt-1 text-sm text-fg-2">{INTROS[reason]}</p>
          </div>

          {guides.map((guide) => (
            <div key={guide.browser}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-3">
                {guide.browser}
              </p>
              <ol className="space-y-1.5">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-fg-2">
                    <span className="text-accent-300">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            {onRetry && (
              <Button className="flex-1" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
