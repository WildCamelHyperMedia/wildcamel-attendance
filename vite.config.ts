import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' makes asset URLs relative so the build works on GitHub Pages
// (served from https://<user>.github.io/<repo>/) without knowing the repo name.
// Routing uses HashRouter, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
