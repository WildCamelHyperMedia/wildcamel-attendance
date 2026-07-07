import { useEffect, useState } from 'react'
import {
  disablePush,
  enablePush,
  isSubscribed,
  pushSupport,
  type PushSupport,
} from '../lib/push'
import { Button, Notice, Spinner } from './ui'

// The explicit notifications enable/disable control. Never auto-prompts.
// On an iPhone Safari tab it shows Add-to-Home-Screen guidance instead.
export function PushToggle({ employeeId }: { employeeId: string }) {
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const s = pushSupport()
    setSupport(s)
    if (s.kind === 'supported') isSubscribed().then(setSubscribed)
  }, [])

  if (!support) return null

  if (support.kind === 'no-vapid-key' || support.kind === 'unsupported') {
    // Push not configured yet, or the browser can't do it — hide silently.
    return null
  }

  if (support.kind === 'ios-needs-install') {
    return (
      <div className="rounded-xl border border-edge bg-dusk-800 p-4">
        <p className="text-sm font-medium text-fg">Task notifications</p>
        <p className="mt-1 text-xs text-fg-3">
          To get notified on iPhone, first add this app to your Home Screen: tap
          the <span className="text-fg-2">Share</span> icon, then{' '}
          <span className="text-fg-2">Add to Home Screen</span>. Open it from there
          and you'll be able to turn on notifications.
        </p>
      </div>
    )
  }

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (subscribed) {
        await disablePush()
        setSubscribed(false)
      } else {
        await enablePush(employeeId)
        setSubscribed(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-edge bg-dusk-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">Task notifications</p>
          <p className="mt-0.5 text-xs text-fg-3">
            {subscribed
              ? 'On — this device gets pinged when Rudy assigns you a task.'
              : 'Get a push when Rudy assigns you a task.'}
          </p>
        </div>
        <Button variant={subscribed ? 'ghost' : 'accent'} onClick={toggle} disabled={busy}>
          {busy ? <Spinner /> : subscribed ? 'Turn off' : 'Enable'}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      )}
    </div>
  )
}
