import { PrismaClient, Role, UserStatus, PortfolioCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1 Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stellaraid.com' },
    update: {},
    create: {
      email: 'admin@stellaraid.com',
      name: 'System Admin',
      passwordHash: '$2b$10$e8wW5.jG3x8y7mF3u8P8ee4b4n8m0k9l8j7h6g5f4d3s2a1', // dummy hashed password
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      walletAddress: 'GAADMIN1234567890STELLARAIDADDRESS',
    },
  });
  console.log(`Created Admin: ${admin.email}`);

  // 3 Artist Accounts with Portfolios
  const artistUsers = [];
  for (let i = 1; i <= 3; i++) {
    const artistUser = await prisma.user.upsert({
      where: { email: `artist${i}@stellaraid.com` },
      update: {},
      create: {
        email: `artist${i}@stellaraid.com`,
        name: `Artist Master ${i}`,
        passwordHash: '$2b$10$e8wW5.jG3x8y7mF3u8P8ee4b4n8m0k9l8j7h6g5f4d3s2a1',
        role: Role.ARTIST,
        status: UserStatus.ACTIVE,
        walletAddress: `GARTIST${i}1234567890STELLARAIDADDRESS`,
        artist: {
          create: {
            bio: `Creative digital artist specializing in illustration and UI design #${i}`,
            tagline: `Crafting visual experiences #${i}`,
            skills: ['Illustration', 'UI/UX', 'Digital Art'],
            isVerified: true,
            portfolios: {
              create: [
                {
                  title: `Portfolio Showpiece #${i}`,
                  description: `A collection of prime digital artwork and designs for project ${i}`,
                  category: PortfolioCategory.ILLUSTRATION,
                  coverImageUrl: `https://images.unsplash.com/photo-artist-${i}.png`,
                  isPublished: true,
                },
              ],
            },
          },
        },
      },
      include: { artist: true },
    });
    artistUsers.push(artistUser);
    console.log(`Created Artist: ${artistUser.email}`);
  }

  // 3 Client Accounts
  const clientUsers = [];
  for (let i = 1; i <= 3; i++) {
    const clientUser = await prisma.user.upsert({
      where: { email: `client${i}@stellaraid.com` },
      update: {},
      create: {
        email: `client${i}@stellaraid.com`,
        name: `Client Patron ${i}`,
        passwordHash: '$2b$10$e8wW5.jG3x8y7mF3u8P8ee4b4n8m0k9l8j7h6g5f4d3s2a1',
        role: Role.CLIENT,
        status: UserStatus.ACTIVE,
        walletAddress: `GCLIENT${i}1234567890STELLARAIDADDRESS`,
      },
    });
    clientUsers.push(clientUser);
    console.log(`Created Client: ${clientUser.email}`);
  }

  // 2 Active Services (belonging to Artist 1)
  if (artistUsers[0].artist) {
    const service1 = await prisma.service.create({
      data: {
        artistId: artistUsers[0].artist.id,
        title: 'Custom Character Design & Digital Concept Art',
        description: 'High-resolution digital character design with source files.',
        category: 'ILLUSTRATION',
        priceUsdc: 250.00,
        deliveryDays: 5,
        revisions: 3,
        features: ['High-res PNG/JPG', 'Source PSD', 'Commercial License'],
        isActive: true,
      },
    });
    const service2 = await prisma.service.create({
      data: {
        artistId: artistUsers[0].artist.id,
        title: 'Complete UI/UX Design System & Figma Kit',
        description: 'Modern, responsive web app design system created in Figma.',
        category: 'UI_UX',
        priceUsdc: 500.00,
        deliveryDays: 7,
        revisions: 5,
        features: ['Figma File', 'Design Tokens', 'Interactive Prototype'],
        isActive: true,
      },
    });
    console.log(`Created Services: ${service1.title}, ${service2.title}`);
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
