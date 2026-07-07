// Browser geolocation. NOTE: this is user-spoofable and cannot read the office
// Wi-Fi SSID, so the office/remote label it feeds is informational deterrence,
// not proof of presence. The real classification happens server-side in the
// check_in / check_out RPCs; we only pass coordinates.

export interface Coords {
  lat: number
  lng: number
  accuracy_m: number
}

export type GeoResult =
  | { status: 'ok'; coords: Coords }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'unsupported' }

export function getPosition(timeoutMs = 10000): Promise<GeoResult> {
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
        else resolve({ status: 'unavailable' })
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}
