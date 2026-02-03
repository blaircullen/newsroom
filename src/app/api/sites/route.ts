import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sites = await prisma.publishTarget.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const masked = sites.map((s) => ({
    ...s,
    apiKey: s.apiKey ? '••••••••' : null,
    password: s.password ? '••••••••' : null,
    clientSecret: s.clientSecret ? '••••••••' : null,
  }));

  return NextResponse.json(masked);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, type, url, apiKey, username, password, blogId, clientId, clientSecret, myshopifyDomain } = body;

  if (!name || !type || !url) {
    return NextResponse.json({ error: 'Name, type, and URL are required' }, { status: 400 });
  }
  if (type === 'ghost' && !apiKey) {
    return NextResponse.json({ error: 'Ghost Admin API Key is required' }, { status: 400 });
  }
  if (type === 'wordpress' && (!username || !password)) {
    return NextResponse.json({ error: 'WordPress username and application password are required' }, { status: 400 });
  }
  if (type === 'shopify' && (!clientId || !clientSecret || !myshopifyDomain)) {
    return NextResponse.json({ error: 'Shopify Client ID, Client Secret, and myshopify domain are required' }, { status: 400 });
  }

  const existing = await prisma.publishTarget.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: 'A site with this name already exists' }, { status: 409 });
  }

  const site = await prisma.publishTarget.create({
    data: {
      name,
      type,
      url: url.replace(/\/+$/, ''),
      apiKey: type === 'ghost' ? apiKey : null,
      username: type === 'wordpress' ? username : null,
      password: type === 'wordpress' ? password : null,
      blogId: type === 'shopify' ? (blogId || null) : null,
      clientId: type === 'shopify' ? clientId : null,
      clientSecret: type === 'shopify' ? clientSecret : null,
      myshopifyDomain: type === 'shopify' ? myshopifyDomain : null,
    },
  });

  return NextResponse.json(
    {
      ...site,
      apiKey: site.apiKey ? '••••••••' : null,
      password: site.password ? '••••••••' : null,
      clientSecret: site.clientSecret ? '••••••••' : null,
    },
    { status: 201 }
  );
}
