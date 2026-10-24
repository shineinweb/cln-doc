import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default async function setup(): Promise<void> {
  const root = fileURLToPath(new URL('..', import.meta.url))
  execSync('pnpm exec prisma db push --skip-generate --accept-data-loss', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'mysql://instagram:instagram@127.0.0.1:3306/instagram_ai_test',
    },
  })
}
