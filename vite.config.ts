import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Path relatif supaya build jalan di GitHub Pages (https://user.github.io/nama-repo/)
  // tanpa perlu menulis nama repo di sini.
  base: './',
  plugins: [react()],
})
