import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const VALID_FEATURES = [
  'dashboard', 'story_ideas', 'hot_articles',
  'editor', 'image_picker', 'calendar', 'analytics_hub',
  'social_queue', 'publish_modal', 'command_palette',
  'admin_sites', 'admin_users', 'admin_voice_profiles',
  'admin_social_accounts', 'admin_competitors', 'admin_feature_usage',
];

const VALID_ACTIONS = [
  'view', 'click', 'dismiss', 'create', 'save_draft', 'submit',
  'ai_import', 'open', 'select_image', 'navigate_month', 'go_today',
  'change_period', 'create_post', 'generate_caption', 'approve',
  'send_now', 'retry', 'delete', 'search', 'publish', 'schedule',
  'filter', 'sort', 'pull_to_refresh', 'toggle', 'edit',
  'save', 'generate', 'test', 'connect', 'regenerate',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feature, action, metadata } = body;

    if (!feature || !action) {
      return NextResponse.json(
        { error: 'feature and action are required' },
        { status: 400 }
      );
    }

    if (typeof feature !== 'string' || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'feature and action must be strings' },
        { status: 400 }
      );
    }

    if (!VALID_FEATURES.includes(feature)) {
      return NextResponse.json(
        { error: `Invalid feature: ${feature}` },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    // Get user role from session (aggregate tracking, no user ID stored)
    let role: 'WRITER' | 'EDITOR' | 'ADMIN' | undefined;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.role) {
        role = session.user.role as 'WRITER' | 'EDITOR' | 'ADMIN';
      }
    } catch {
      // Session read failed — still record the event without role
    }

    await prisma.featureEvent.create({
      data: {
        feature,
        action,
        metadata: metadata ?? undefined,
        role: role ?? null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('[Tracking API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record event' },
      { status: 500 }
    );
  }
}
