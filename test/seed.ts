import { Role, UserStatus } from '@prisma/client';
import { createUser } from './factories/user.factory';
import { cleanup } from './test-utils';

async function main() {
  await cleanup();

  await createUser({
    email: 'testuser1@example.com',
    name: 'Test User One',
    role: Role.ARTIST,
    status: UserStatus.ACTIVE,
  });
  await createUser({
    email: 'testuser2@example.com',
    name: 'Test User Two',
    role: Role.CLIENT,
    status: UserStatus.ACTIVE,
  });

  console.log('Seeding complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
