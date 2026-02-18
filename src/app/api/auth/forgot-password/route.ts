import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { isValidEmail } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.toLowerCase().trim();

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent.' },
        { status: 200 }
      );
    }

    // Rate limit: check for recent token (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentToken) {
      // Already sent recently, return success to prevent enumeration
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent.' },
        { status: 200 }
      );
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (user && user.isActive) {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save token to database
      await prisma.passwordResetToken.create({
        data: {
          token,
          email: user.email,
          expiresAt,
        },
      });

      // Send email (don't await to prevent timing attacks)
      void sendPasswordResetEmail(user.email, user.name, token);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      { message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Error:', error);
    return NextResponse.json(
      { message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 }
    );
  }
}
