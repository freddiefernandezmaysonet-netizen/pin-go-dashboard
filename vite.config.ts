import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define:
    command === 'build'
      ? {
          'import.meta.env.VITE_API_BASE': JSON.stringify('/backend'),
          'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/backend'),
        }
      : undefined,
}))
