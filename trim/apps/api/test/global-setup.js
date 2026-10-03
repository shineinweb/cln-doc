const { execSync } = require('node:child_process');
const path = require('node:path');

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

module.exports = async function globalSetup() {
  const databaseDir = path.resolve(__dirname, '../../../packages/database');
  execSync('pnpm exec prisma migrate deploy', {
    cwd: databaseDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
  });
};
