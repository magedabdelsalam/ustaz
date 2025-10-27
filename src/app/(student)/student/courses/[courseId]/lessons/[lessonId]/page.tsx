'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import * as InteractiveComponents from '@/components/interactive'
import type { ComponentType } from '@/types'

interface LessonRow {
  id: string
  course_id: string
  title: string
}

interface SlideRow {
  id: string
  position: number
  blocks_json: unknown
}

interface SlideBlock {
  id: string
  type: ComponentType
  data: unknown
}

export default function StudentLessonViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const courseId = params?.courseId as string
  const lessonId = params?.lessonId as string

  const [lesson, setLesson] = useState<LessonRow | null>(null)
  const [slides, setSlides] = useState<SlideRow[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [showAIHints, setShowAIHints] = useState(false)
  const [aiHint, setAIHint] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadingHint, setLoadingHint] = useState(false)

  const userId = user?.id ?? null

  const loadLesson = useMemo(() => async () => {
    if (!userId || !lessonId) return
    setIsLoading(true)
    try {
      const { data: lessonData, error: lErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single()
      if (lErr) throw lErr
      setLesson(lessonData)

      const { data: slidesData, error: sErr } = await supabase
        .from('slides')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('position', { ascending: true })
      if (sErr) throw sErr
      setSlides(slidesData ?? [])
    } catch (e) {
      console.error('Failed to load lesson', e)
    } finally {
      setIsLoading(false)
    }
  }, [userId, lessonId])

  useEffect(() => {
    if (!loading) loadLesson()
  }, [loading, loadLesson])

  async function getAIHint(level: 1 | 2 | 3) {
    if (!lesson || slides.length === 0) return
    setLoadingHint(true)
    try {
      const currentSlide = slides[currentSlideIndex]
      const blocks = (Array.isArray(currentSlide?.blocks_json) ? currentSlide.blocks_json : []) as SlideBlock[]

      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an AI tutor helping a student understand lesson "${lesson.title}". Provide hint level ${level} (1=subtle, 2=moderate, 3=detailed) for the current slide content.`
            },
            {
              role: 'user',
              content: `Current slide blocks: ${JSON.stringify(blocks, null, 2)}. Give me a hint level ${level}.`
            }
          ],
          courseContext: { courseId, lessonId, slideId: currentSlide?.id }
        })
      })
      const data = await response.json()
      setAIHint(data.content || 'No hint available.')
    } catch (e) {
      console.error('AI hint failed', e)
      setAIHint('Unable to get hint. Try again.')
    } finally {
      setLoadingHint(false)
    }
  }

  if (loading || isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }

  if (!user || !lesson) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Lesson not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Unable to load lesson or you do not have access.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentSlide = slides[currentSlideIndex]
  const blocks = (Array.isArray(currentSlide?.blocks_json) ? currentSlide.blocks_json : []) as SlideBlock[]

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAIHints(!showAIHints)}>
            {showAIHints ? 'Hide AI hints' : 'Show AI hints'}
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/student/courses/${courseId}`)}>
            Back to course
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-4">
          {slides.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">No slides available yet.</CardContent>
            </Card>
          )}

          {currentSlide && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Slide {currentSlideIndex + 1} of {slides.length}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {blocks.length === 0 && (
                    <p className="text-sm text-gray-500 italic">This slide is empty.</p>
                  )}
                  {blocks.map((block) => {
                    const Component = InteractiveComponents[
                      block.type.split('-').map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)).join('') as keyof typeof InteractiveComponents
                    ]
                    if (!Component) {
                      return (
                        <div key={block.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                          <div className="font-medium">Unknown block type: {block.type}</div>
                          <pre className="text-xs mt-1">{JSON.stringify(block.data, null, 2)}</pre>
                        </div>
                      )
                    }
                    return (
                      <div key={block.id}>
                        <Component
                          id={block.id}
                          content={block.data}
                          onInteraction={(action, data) => console.log('Interaction:', action, data)}
                        />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  disabled={currentSlideIndex === 0}
                  onClick={() => setCurrentSlideIndex(i => i - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={currentSlideIndex >= slides.length - 1}
                  onClick={() => setCurrentSlideIndex(i => i + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>

        {showAIHints && (
          <Card className="w-80 shrink-0">
            <CardHeader>
              <CardTitle className="text-base">AI Hints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => getAIHint(1)} disabled={loadingHint}>
                  Hint 1
                </Button>
                <Button size="sm" variant="outline" onClick={() => getAIHint(2)} disabled={loadingHint}>
                  Hint 2
                </Button>
                <Button size="sm" variant="outline" onClick={() => getAIHint(3)} disabled={loadingHint}>
                  Hint 3
                </Button>
              </div>
              {loadingHint && <p className="text-sm text-gray-500">Loading hint…</p>}
              {aiHint && !loadingHint && (
                <div className="text-sm p-3 bg-blue-50 border border-blue-200 rounded">
                  {aiHint}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

