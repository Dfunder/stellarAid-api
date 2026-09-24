/**
 * Seed the marketplace skill taxonomy.
 *
 * Run with `npx prisma db seed` (configured in package.json).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SKILLS: Array<{ name: string; slug: string; category: string }> = [
  { name: 'Illustration', slug: 'illustration', category: 'Art & Illustration' },
  { name: 'Digital Painting', slug: 'digital-painting', category: 'Art & Illustration' },
  { name: 'Concept Art', slug: 'concept-art', category: 'Art & Illustration' },
  { name: 'Logo Design', slug: 'logo-design', category: 'Graphic Design' },
  { name: 'Branding', slug: 'branding', category: 'Graphic Design' },
  { name: 'Typography', slug: 'typography', category: 'Graphic Design' },
  { name: 'UI Design', slug: 'ui-design', category: 'Product Design' },
  { name: 'UX Research', slug: 'ux-research', category: 'Product Design' },
  { name: 'Web Design', slug: 'web-design', category: 'Product Design' },
  { name: 'Photography', slug: 'photography', category: 'Photo & Video' },
  { name: 'Photo Editing', slug: 'photo-editing', category: 'Photo & Video' },
  { name: 'Motion Graphics', slug: 'motion-graphics', category: 'Animation & 3D' },
  { name: '3D Modeling', slug: '3d-modeling', category: 'Animation & 3D' },
  { name: 'Animation', slug: 'animation', category: 'Animation & 3D' },
  { name: 'Copywriting', slug: 'copywriting', category: 'Writing' },
  { name: 'Content Strategy', slug: 'content-strategy', category: 'Writing' },
  { name: 'Sound Design', slug: 'sound-design', category: 'Audio' },
  { name: 'Music Production', slug: 'music-production', category: 'Audio' },
  { name: 'Movie Production', slug: 'movie-production', category: 'image' },

];

async function main(): Promise<void> {
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: { name: skill.name, category: skill.category },
      create: skill,
    });
  }
  console.log(`Seeded ${SKILLS.length} skills.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
