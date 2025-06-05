// API route for TutorContext persistence. Handles loading and saving context per user and subject.
import { NextRequest, NextResponse } from 'next/server';
import { persistenceService } from '@/lib/persistenceService';
import { TutorContext } from '@/lib/ai-tutor-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const subjectId = searchParams.get('subjectId');

  if (!userId || !subjectId) {
    return NextResponse.json({ error: 'userId and subjectId are required' }, { status: 400 });
  }

  const context = await persistenceService.loadTutorContext(userId, subjectId);
  return NextResponse.json({ context });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, subjectId, context } = body as { userId: string; subjectId: string; context: TutorContext };

  if (!userId || !subjectId || !context) {
    return NextResponse.json({ error: 'userId, subjectId, and context are required' }, { status: 400 });
  }

  await persistenceService.saveTutorContext(userId, subjectId, context);
  return NextResponse.json({ success: true });
} 