import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Try full query first, fall back to basic query if Shopify columns don't exist
    let sites: any[];
    try {
      sites = await prisma.$queryRaw`
        SELECT id, name, type, url, api_key, username, password, blog_id,
               client_id, client_secret, myshopify_domain, is_active, created_at, updated_at
        FROM publish_targets
        ORDER BY created_at DESC
      `;
    } catch (colErr: any) {
      // Shopify columns don't exist yet - use basic query
      console.log('[Sites API] Falling back to basic query:', colErr.message);
      sites = await prisma.$queryRaw`
        SELECT id, name, type, url, api_key, username, password, is_active, created_at, updated_at
        FROM publish_targets
        ORDER BY created_at DESC
      `;
    }

    const mapped = sites.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      url: s.url,
      apiKey: s.api_key ? '••••••••' : null,
      username: s.username,
      password: s.password ? '••••••••' : null,
      blogId: s.blog_id || null,
      clientId: s.client_id || null,
      clientSecret: s.client_secret ? '••••••••' : null,
      myshopifyDomain: s.myshopify_domain || null,
      isActive: s.is_active,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
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

    // Check if site exists using raw query
    const existing: any[] = await prisma.$queryRaw`SELECT id FROM publish_targets WHERE name = ${name} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A site with this name already exists' }, { status: 409 });
    }

    // Insert using raw query to avoid schema mismatch
    const cleanUrl = url.replace(/\/+$/, '');
    // Generate a cuid-compatible ID (25 chars starting with 'c')
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const id = 'c' + (timestamp + randomPart).substring(0, 24);

    await prisma.$executeRaw`
      INSERT INTO publish_targets (id, name, type, url, api_key, username, password, blog_id, client_id, client_secret, myshopify_domain, is_active, created_at, updated_at)
      VALUES (
        ${id},
        ${name},
        ${type},
        ${cleanUrl},
        ${type === 'ghost' ? apiKey : null},
        ${type === 'wordpress' ? username : null},
        ${type === 'wordpress' ? password : null},
        ${type === 'shopify' ? blogId || null : null},
        ${type === 'shopify' ? clientId : null},
        ${type === 'shopify' ? clientSecret : null},
        ${type === 'shopify' ? myshopifyDomain : null},
        true,
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json(
      {
        id,
        name,
        type,
        url: cleanUrl,
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
