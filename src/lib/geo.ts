// Browser geolocation. NOTE: this is user-spoofable and cannot read the office
// Wi-Fi SSID, so the office/remote label it feeds is informational deterrence,
// not proof of presence. The real classification happens server-side in the
// check_in / check_out RPCs; we only pass coordinates.

export interface Coords {
  lat: number
  lng: number
  accuracy_m: number
}

// Distinct failure reasons so the UI can give actionable, platform-specific
// guidance. 'unavailable' (POSITION_UNAVAILABLE) most often means the OS-level
// Location Services gate is off for the browser — the usual Mac/mobile cause.
export type GeoResult =
  | { status: 'ok'; coords: Coords }
  | { status: 'denied' } // site/browser permission blocked
  | { status: 'unavailable' } // POSITION_UNAVAILABLE — usually OS Location Services off
  | { status: 'timeout' } // TIMEOUT — no fix in time
  | { status: 'unsupported' } // browser has no geolocation API

export type GeoFailure = Exclude<GeoResult['status'], 'ok'>

function getOnce(options: PositionOptions): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ status: 'unsupported' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          status: 'ok',
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: Math.round(pos.coords.accuracy),
          },
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) resolve({ status: 'denied' })
        else if (err.code === err.TIMEOUT) resolve({ status: 'timeout' })
        else resolve({ status: 'unavailable' }) // POSITION_UNAVAILABLE or anything else
      },
      options,
    )
  })
}

// Coarse accuracy is deliberate: for a 150 m office radius it's plenty, and it
// avoids high-accuracy GPS which Macs don't have (they use Wi-Fi/CoreLocation)
// and which is slow / times out on phones indoors. One retry (longer timeout,
// fresh fix) covers a transient timeout/unavailable. Never rejects.
export async function getPosition(): Promise<GeoResult> {
  const first = await getOnce({
    enableHighAccuracy: false,
    timeout: 15000,
    maximumAge: 60000,
  })
  if (first.status !== 'timeout' && first.status !== 'unavailable') return first

  // Retry once with more time and a guaranteed-fresh fix.
  return getOnce({ enableHighAccuracy: false, timeout: 20000, maximumAge: 0 })
}

export type PermissionHint = 'granted' | 'denied' | 'prompt' | 'unknown'

// UX hint ONLY — never gate the actual getCurrentPosition call on this. Safari's
// Permissions API is unreliable for geolocation (reports 'prompt' even when
// denied, and doesn't fire change events), so treat anything but 'denied' as
// non-authoritative.
export async function permissionHint(): Promise<PermissionHint> {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state as PermissionHint
  } catch {
    return 'unknown'
  }
}
