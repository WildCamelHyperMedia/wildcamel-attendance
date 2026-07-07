import lockupDusk from './assets/brand/lockup-dusk.png'

// Temporary shell — replaced by the real app in Phase 3.
// Serves as a living smoke test of the Neon Dusk theme tokens.
function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="spectrum-strand" />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <img
          src={lockupDusk}
          alt="Wild Camel — Media Production"
          className="w-full max-w-md select-none"
          draggable={false}
        />
        <p className="text-display text-lg font-bold text-fg-2">
          Attendance is being built
        </p>
        <p className="max-w-sm text-sm text-fg-3">
          The check-in app for the Wild Camel team is on its way. Nothing to
          see here yet — come back soon.
        </p>
      </main>
    </div>
  )
}

export default App
