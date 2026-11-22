const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const rules = [
  { name: 'AWS access key id', pattern: /AKIA[0-9A-Z]{16}/g },
  {
    name: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  },
  { name: 'Slack token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'Stripe live secret key', pattern: /sk_live_[A-Za-z0-9]{16,}/g },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  {
    name: 'JSON Web Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
];

const skippedFiles = new Set([
  'scripts/check-secrets.js',
  '.gitleaks.toml',
  'package-lock.json',
]);

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
)
  .trim()
  .split('\n')
  .filter((file) => file.length > 0 && !skippedFiles.has(file));

const findings = [];

for (const file of files) {
  let content;

  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (content.includes('\u0000')) {
    continue;
  }

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;

    while ((match = rule.pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push(`${file}:${line}: ${rule.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Potential secrets detected:\n${findings.join('\n')}`);
  process.exit(1);
}

console.log(`No secrets detected in ${files.length} files.`);
