import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// If the Supabase env vars are missing (e.g. repo secrets not set yet), the
// supabase client throws on import. Catch that and show a readable message
// instead of a blank white page.
async function boot() {
  try {
    const { default: App } = await import('./App.tsx')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (err) {
    root.render(
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          background: '#120e1a',
          color: '#f4f1fa',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Configuration needed</h1>
        <p style={{ maxWidth: 420, color: '#b4acc6', fontSize: 14 }}>
          {err instanceof Error ? err.message : 'Failed to start.'}
        </p>
        <p style={{ maxWidth: 420, color: '#948ba8', fontSize: 13 }}>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          in your <code>.env</code> (local) or repo secrets (deploy), then rebuild.
        </p>
      </div>,
    )
  }
}

boot()
