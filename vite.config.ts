import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {landingKnowledgePlugin} from './scripts/landingKnowledgePlugin'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), landingKnowledgePlugin()],
  build: { rollupOptions: { input: { app: "index.html", landing: "home.html" } } },
  define:
    command === 'build'
      ? {
          'import.meta.env.VITE_API_BASE': JSON.stringify('/backend'),
          'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/backend'),
        }
      : undefined,
}))
