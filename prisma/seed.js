if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to run the seed command.');
  process.exit(1);
}

console.log('Seed scaffold: no seed data is configured yet.');
