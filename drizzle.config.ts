// drizzle-kit config: generates SQL migrations from src/lib/db/schema.ts into drizzle/ (migrate runs in real mode only).
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
