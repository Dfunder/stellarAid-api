/**
 * Seed the marketplace taxonomy: browsable categories (with sub-categories),
 * the flat tag vocabulary, and the skill taxonomy used on artist profiles.
 *
 * Idempotent — every row is upserted by its unique slug/name, so running
 * this multiple times converges rather than duplicating or erroring.
 *
 * Run with `npx prisma db seed` (configured in package.json).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategorySeed {
  readonly name: string;
  readonly slug: string;
  readonly children: ReadonlyArray<{ readonly name: string; readonly slug: string }>;
}

const CATEGORIES: readonly CategorySeed[] = [
  {
    name: 'Illustration',
    slug: 'illustration',
    children: [
      { name: 'Character Design', slug: 'illustration-character-design' },
      { name: 'Concept Art', slug: 'illustration-concept-art' },
      { name: "Children's Book Illustration", slug: 'illustration-childrens-book' },
    ],
  },
  {
    name: 'UI/UX',
    slug: 'ui-ux',
    children: [
      { name: 'Web Design', slug: 'ui-ux-web-design' },
      { name: 'Mobile App Design', slug: 'ui-ux-mobile-app-design' },
      { name: 'Design Systems', slug: 'ui-ux-design-systems' },
    ],
  },
  {
    name: '3D',
    slug: '3d',
    children: [
      { name: '3D Modeling', slug: '3d-modeling' },
      { name: '3D Animation', slug: '3d-animation' },
      { name: 'Product Visualization', slug: '3d-product-visualization' },
    ],
  },
  {
    name: 'Photography',
    slug: 'photography',
    children: [
      { name: 'Portrait', slug: 'photography-portrait' },
      { name: 'Landscape', slug: 'photography-landscape' },
      { name: 'Product Photography', slug: 'photography-product' },
    ],
  },
  {
    name: 'Animation',
    slug: 'animation',
    children: [
      { name: '2D Animation', slug: 'animation-2d' },
      { name: 'Motion Graphics', slug: 'animation-motion-graphics' },
      { name: 'Character Animation', slug: 'animation-character' },
    ],
  },
  {
    name: 'Branding',
    slug: 'branding',
    children: [
      { name: 'Logo Design', slug: 'branding-logo-design' },
      { name: 'Brand Identity', slug: 'branding-identity' },
      { name: 'Packaging Design', slug: 'branding-packaging' },
    ],
  },
  {
    name: 'Typography',
    slug: 'typography',
    children: [
      { name: 'Lettering', slug: 'typography-lettering' },
      { name: 'Type Design', slug: 'typography-type-design' },
      { name: 'Calligraphy', slug: 'typography-calligraphy' },
    ],
  },
];

const TAGS: readonly string[] = [
  'Photoshop',
  'Illustrator',
  'Figma',
  'Blender',
  'After Effects',
  'Procreate',
  'Cinema 4D',
  'InDesign',
  'Sketch',
  'Character Design',
  'Digital Painting',
  '3D Modeling',
  'Motion Graphics',
  'Logo Design',
  'Typography',
  'Watercolor',
  'Concept Art',
  'UI Design',
  'UX Research',
  'Branding',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
];

async function seedCategories(): Promise<number> {
  let count = 0;
  for (const category of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { name: category.name, slug: category.slug },
    });
    count += 1;

    for (const child of category.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id },
        create: { name: child.name, slug: child.slug, parentId: parent.id },
      });
      count += 1;
    }
  }
  return count;
}

async function seedTags(): Promise<number> {
  for (const name of TAGS) {
    const slug = slugify(name);
    await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
  }
  return TAGS.length;
}

async function seedSkills(): Promise<number> {
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: { name: skill.name, category: skill.category },
      create: skill,
    });
  }
  return SKILLS.length;
}

async function main(): Promise<void> {
  const categoryCount = await seedCategories();
  const tagCount = await seedTags();
  const skillCount = await seedSkills();
  console.log(
    `Seeded ${categoryCount} categories (incl. sub-categories), ${tagCount} tags, ${skillCount} skills.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
