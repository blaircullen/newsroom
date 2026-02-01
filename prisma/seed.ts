import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('changeme123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@m3media.com' },
    update: {},
    create: {
      email: 'admin@m3media.com',
      name: 'Managing Editor',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      bio: 'Managing Editor at M3 Media',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // Create sample writer
  const writerPassword = await bcrypt.hash('writer123', 12);
  const writer = await prisma.user.upsert({
    where: { email: 'writer@m3media.com' },
    update: {},
    create: {
      email: 'writer@m3media.com',
      name: 'Sample Writer',
      passwordHash: writerPassword,
      role: Role.WRITER,
      bio: 'Staff writer at M3 Media',
    },
  });
  console.log(`✅ Writer user created: ${writer.email}`);

  // Create sample tags
  const tagNames = [
    'Breaking News', 'Politics', 'Technology', 'Sports',
    'Entertainment', 'Business', 'Opinion', 'Health',
    'Science', 'Culture', 'World', 'Local',
  ];

  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { slug: name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
      },
    });
  }
  console.log(`✅ ${tagNames.length} tags created`);

  // Create sample publish targets
  await prisma.publishTarget.upsert({
    where: { name: 'M3 Media Main' },
    update: {},
    create: {
      name: 'M3 Media Main',
      type: 'ghost',
      url: 'https://m3media.com',
      apiKey: 'placeholder-key',
    },
  });

  await prisma.publishTarget.upsert({
    where: { name: 'M3 Sports' },
    update: {},
    create: {
      name: 'M3 Sports',
      type: 'wordpress',
      url: 'https://sports.m3media.com',
      username: 'admin',
      password: 'placeholder',
    },
  });
  console.log('✅ Publish targets created');

  console.log('\n🎉 Seeding complete!');
  console.log('\nDefault credentials:');
  console.log('  Admin: admin@m3media.com / changeme123');
  console.log('  Writer: writer@m3media.com / writer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
