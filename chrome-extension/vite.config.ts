import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(import.meta.dirname, 'src')}`,
    },
  },
  plugins: [
    react(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `${pkg.name}-${pkg.version}.zip` }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
