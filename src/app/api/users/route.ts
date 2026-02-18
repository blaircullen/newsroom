import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isValidEmail } from '@/lib/validation';

// GET /api/users - List users (admin only)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { articles: true } },
    },
    orderBy: { name: 'asc' },
    take: 500, // Reasonable limit for admin user list
  });

  return NextResponse.json(users);
}


// POST /api/users - Create user (admin only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, name, password, role } = body;

  // Validate required fields
  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  // Validate email format
  const normalizedEmail = email.toLowerCase().trim();
  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Validate password strength
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  if (password.length > 72) {
    return NextResponse.json({ error: 'Password must be under 72 characters' }, { status: 400 });
  }

  // Validate name length
  if (name.trim().length > 255) {
    return NextResponse.json({ error: 'Name must be under 255 characters' }, { status: 400 });
  }

  // Validate role if provided
  const validRoles = ['WRITER', 'EDITOR', 'ADMIN'];
  const userRole = typeof role === 'string' && validRoles.includes(role) ? role : 'WRITER';

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      passwordHash,
      role: userRole as 'WRITER' | 'EDITOR' | 'ADMIN',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}

// PATCH /api/users - Update user (admin only)
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, name, email, role, isActive, password } = body;

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Prevent admin from deactivating themselves
  if (id === session.user.id && isActive === false) {
    return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
  }

  // Prevent admin from demoting themselves
  if (id === session.user.id && role && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  // Validate role if provided
  const validRoles = ['WRITER', 'EDITOR', 'ADMIN'];
  if (role !== undefined && !validRoles.includes(role as string)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Validate password strength if provided
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (password.length > 72) {
      return NextResponse.json({ error: 'Password must be under 72 characters' }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) updateData.name = name.trim();
  if (typeof email === 'string' && email.trim()) updateData.email = email.toLowerCase().trim();
  if (typeof role === 'string') updateData.role = role;
  if (typeof isActive === 'boolean') updateData.isActive = isActive;
  if (typeof password === 'string') updateData.passwordHash = await bcrypt.hash(password, 12);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    // Handle unique constraint violation (email already exists)
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    throw error;
  }
}
