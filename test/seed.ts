import { createUser } from './factories/user.factory';
import { cleanup } from './test-utils';

async function main() {
  await cleanup();

  const user1 = await createUser({ email: 'testuser1@example.com' });
  const user2 = await createUser({ email: 'testuser2@example.com' });

  console.log('Seeding complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
