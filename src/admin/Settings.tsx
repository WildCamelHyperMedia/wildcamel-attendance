import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { fetchSettings, updateSettings } from '../lib/api'
import type { AppSettings } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import { getPosition } from '../lib/geo'
import { setDisplayTz } from '../lib/time'
import { Button, Notice, Skeleton, Spinner } from '../components/ui'

// A curated shortlist plus whatever the browser knows.
const COMMON_TZ = [
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

export default function Settings() {
  const [, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState('150')
  const [tz, setTz] = useState('Asia/Dubai')

  const load = useCallback(async () => {
    setError(null)
    try {
      const s = await fetchSettings()
      setSettings(s)
      if (s) {
        setLat(s.office_lat?.toString() ?? '')
        setLng(s.office_lng?.toString() ?? '')
        setRadius(String(s.office_radius_m))
        setTz(s.display_tz)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function useMyLocation() {
    setLocating(true)
    setError(null)
    const geo = await getPosition()
    setLocating(false)
    if (geo.status === 'ok') {
      setLat(geo.coords.lat.toFixed(6))
      setLng(geo.coords.lng.toFixed(6))
    } else {
      setError(
        geo.status === 'denied'
          ? 'Location permission denied — enter coordinates manually.'
          : "Couldn't read your location — enter coordinates manually.",
      )
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    const latNum = lat.trim() === '' ? null : Number(lat)
    const lngNum = lng.trim() === '' ? null : Number(lng)
    const radiusNum = Number(radius)
    if ((latNum !== null && Number.isNaN(latNum)) || (lngNum !== null && Number.isNaN(lngNum))) {
      setError('Latitude and longitude must be numbers (or both blank).')
      setSaving(false)
      return
    }
    if (!Number.isFinite(radiusNum) || radiusNum <= 0) {
      setError('Radius must be a positive number of meters.')
      setSaving(false)
      return
    }
    try {
      await updateSettings({
        office_lat: latNum,
        office_lng: lngNum,
        office_radius_m: Math.round(radiusNum),
        display_tz: tz,
      })
      setDisplayTz(tz)
      setSaved(true)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const tzOptions = Array.from(
    new Set([tz, Intl.DateTimeFormat().resolvedOptions().timeZone, ...COMMON_TZ].filter(Boolean)),
  )

  if (loading) return <Skeleton className="h-96 max-w-2xl" />

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-fg-3">
          The office location decides whether a check-in is labelled Office or
          Remote. All times across both apps display in the timezone below.
        </p>
      </header>

      {error && <Notice>{error}</Notice>}
      {saved && <Notice tone="info">Settings saved.</Notice>}

      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-4 rounded-xl border border-edge bg-dusk-800 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-display text-sm font-bold tracking-wide text-fg-2">
              Office location
            </h2>
            <Button type="button" variant="subtle" onClick={useMyLocation} disabled={locating}>
              {locating ? <Spinner /> : 'Use my current location'}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude" value={lat} onChange={setLat} placeholder="25.2048" inputMode="decimal" />
            <Field label="Longitude" value={lng} onChange={setLng} placeholder="55.2708" inputMode="decimal" />
          </div>
          <Field
            label="Radius (meters)"
            value={radius}
            onChange={setRadius}
            inputMode="numeric"
            hint="How close to the office counts as “Office”. Default 150m."
          />
          <p className="text-xs text-fg-3">
            Leave latitude and longitude blank to treat every located check-in as
            Remote. Office-only employees can't check in until this is set.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-edge bg-dusk-800 p-5">
          <h2 className="text-display text-sm font-bold tracking-wide text-fg-2">
            Display timezone
          </h2>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
              Timezone
            </span>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg focus:border-accent-500 focus:outline-none"
            >
              {tzOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-fg-3">
            Data is stored in UTC; this only changes how times are shown.
          </p>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  hint,
  ...rest
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-fg-3">{hint}</span>}
    </label>
  )
}
