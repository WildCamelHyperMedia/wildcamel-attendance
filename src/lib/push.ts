import { supabase } from './supabase'

// Web Push subscription management. All free-tier, standard Web Push — no
// third-party push provider. The VAPID public key ships in the frontend; the
// private key lives only as an Edge Function secret.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushSupport =
  | { kind: 'supported' }
  | { kind: 'ios-needs-install' } // iOS Safari tab — must Add to Home Screen first
  | { kind: 'unsupported' }
  | { kind: 'no-vapid-key' }

function isIos(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; detect touch to disambiguate.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return { kind: 'no-vapid-key' }
  const hasApis =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isIos() && !isStandalone()) return { kind: 'ios-needs-install' }
  if (!hasApis) return { kind: 'unsupported' }
  return { kind: 'supported' }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

// The base path the app is served from (e.g. "/repo/") so the SW scope is right.
function swUrl() {
  return new URL('sw.js', document.baseURI).href
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  return navigator.serviceWorker.register(swUrl(), {
    scope: new URL('.', document.baseURI).pathname,
  })
}

export async function isSubscribed(): Promise<boolean> {
  if (pushSupport().kind !== 'supported') return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

/** Request permission, subscribe, and persist to the DB. Returns true on success. */
export async function enablePush(employeeId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Push is not configured (missing VAPID key).')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications permission was not granted.')
  }

  const reg = await getRegistration()
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error('Could not read the push subscription keys.')
  }

  // Upsert on the unique endpoint. RLS ensures we can only write our own row.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      employee_id: employeeId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Unsubscribe this device and remove its DB row. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}
