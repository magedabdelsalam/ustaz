import { NextRequest, NextResponse } from 'next/server'
import { AITutorService } from '@/lib/ai-tutor-service'

// Singleton or create a new instance as needed
const aiTutorService = new AITutorService()

export async function POST(req: NextRequest) {
  try {
    const { lessonId, score, total, difficulty } = await req.json()
    if (!lessonId || typeof score !== 'number' || typeof total !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
    }
    // Call the backend adaptive mastery logic
    const result = aiTutorService.processAssessmentResult({ lessonId, score, total, difficulty })
    return NextResponse.json(result)
  } catch (error) {
    console.error('API /api/assessment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 