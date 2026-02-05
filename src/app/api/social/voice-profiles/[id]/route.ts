import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT /api/social/voice-profiles/[id] - Update voice profile (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Validate ID format
    if (!/^c[a-z0-9]{24}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid voice profile ID format' }, { status: 400 });
    }

    // Check if voice profile exists
    const existing = await prisma.siteVoiceProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Voice profile not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { voiceDescription, systemPrompt, customNotes, sampleArticleIds } = body;

    // Build update data object
    const updateData: Record<string, unknown> = {};

    if (voiceDescription !== undefined) {
      if (typeof voiceDescription !== 'string' || !voiceDescription.trim()) {
        return NextResponse.json({ error: 'voiceDescription must be a non-empty string' }, { status: 400 });
      }
      updateData.voiceDescription = voiceDescription.trim();
    }

    if (systemPrompt !== undefined) {
      if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
        return NextResponse.json({ error: 'systemPrompt must be a non-empty string' }, { status: 400 });
      }
      updateData.systemPrompt = systemPrompt.trim();
    }

    if (customNotes !== undefined) {
      if (customNotes !== null && typeof customNotes !== 'string') {
        return NextResponse.json({ error: 'customNotes must be a string or null' }, { status: 400 });
      }
      updateData.customNotes = customNotes ? customNotes.trim() : null;
    }

    if (sampleArticleIds !== undefined) {
      if (!Array.isArray(sampleArticleIds) || !sampleArticleIds.every((id) => typeof id === 'string')) {
        return NextResponse.json({ error: 'sampleArticleIds must be an array of strings' }, { status: 400 });
      }
      updateData.sampleArticleIds = sampleArticleIds;
    }

    // If no valid fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update the voice profile
    const updated = await prisma.siteVoiceProfile.update({
      where: { id },
      data: updateData,
      include: {
        publishTarget: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] Error updating voice profile:', error);
    return NextResponse.json(
      { error: 'Failed to update voice profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/voice-profiles/[id] - Delete voice profile (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Validate ID format
    if (!/^c[a-z0-9]{24}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid voice profile ID format' }, { status: 400 });
    }

    // Check if voice profile exists
    const existing = await prisma.siteVoiceProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Voice profile not found' }, { status: 404 });
    }

    // Delete the voice profile
    await prisma.siteVoiceProfile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting voice profile:', error);
    return NextResponse.json(
      { error: 'Failed to delete voice profile' },
      { status: 500 }
    );
  }
}
