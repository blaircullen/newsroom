import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sites = await prisma.publishTarget.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const mapped = sites.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      url: s.url,
      apiKey: s.apiKey ? '••••••••' : null,
      username: s.username,
      password: s.password ? '••••••••' : null,
      blogId: s.blogId,
      clientId: s.clientId,
      clientSecret: s.clientSecret ? '••••••••' : null,
      myshopifyDomain: s.myshopifyDomain,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error('[Sites API] GET error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch sites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const cleanUrl = url.replace(/\/+$/, '');

    // Encrypt sensitive credentials before storing
    const encryptedApiKey = type === 'ghost' && apiKey ? encrypt(apiKey) : null;
    const encryptedPassword = type === 'wordpress' && password ? encrypt(password) : null;
    const encryptedClientSecret = type === 'shopify' && clientSecret ? encrypt(clientSecret) : null;

    const site = await prisma.publishTarget.create({
      data: {
        name,
        type,
        url: cleanUrl,
        apiKey: encryptedApiKey,
        username: type === 'wordpress' ? username : null,
        password: encryptedPassword,
        blogId: type === 'shopify' ? blogId || null : null,
        clientId: type === 'shopify' ? clientId : null,
        clientSecret: encryptedClientSecret,
        myshopifyDomain: type === 'shopify' ? myshopifyDomain : null,
      },
    });

    return NextResponse.json(
      {
        id: site.id,
        name: site.name,
        type: site.type,
        url: site.url,
        apiKey: apiKey ? '••••••••' : null,
        password: password ? '••••••••' : null,
        clientSecret: clientSecret ? '••••••••' : null
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[Sites API] POST error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create site' }, { status: 500 });
  }
}
