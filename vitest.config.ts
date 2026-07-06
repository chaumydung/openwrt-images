// Vitest configuration: scopes test discovery to tests/**/*.test.ts and aliases @ to src/.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
