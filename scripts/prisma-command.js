const { spawnSync } = require('node:child_process');

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('Specify a Prisma command to run.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required. Configure it before running database commands.',
  );
  process.exit(1);
}

let prismaCli;
try {
  prismaCli = require.resolve('prisma/build/index.js');
} catch {
  console.error(
    'Prisma CLI is not installed. Install it with "npm install --save-dev prisma" before running this command.',
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCli, ...command], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Failed to start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}

process.exitCode = result.status ?? 1;
