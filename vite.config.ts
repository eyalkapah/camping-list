import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the bundle works under https://<user>.github.io/<repo>/
// without hard-coding the repository name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist' },
})
