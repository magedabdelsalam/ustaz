'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export default function LessonEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const courseId = params?.courseId as string
  const lessonId = params?.lessonId as string

  const [lesson, setLesson] = useState<LessonRow | null>(null)
  const [slides, setSlides] = useState<SlideRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  async function addSlide() {
    if (!userId || !lessonId) return
    const position = slides.length
    const { error } = await supabase
      .from('slides')
      .insert({ lesson_id: lessonId, position, blocks_json: [] })
    if (error) {
      console.error('Add slide failed', error)
      return
    }
    await loadLesson()
  }

  async function deleteSlide(slideId: string) {
    if (!userId) return
    if (!confirm('Delete this slide?')) return
    const { error } = await supabase.from('slides').delete().eq('id', slideId)
    if (error) {
      console.error('Delete slide failed', error)
      return
    }
    await loadLesson()
  }

  async function addBlockToSlide(slideId: string) {
    const blockType = prompt('Block type (e.g., explainer, multiple-choice):') as ComponentType | null
    if (!blockType) return

    const slide = slides.find(s => s.id === slideId)
    if (!slide) return

    const blocks = (Array.isArray(slide.blocks_json) ? slide.blocks_json : []) as SlideBlock[]
    const newBlock: SlideBlock = {
      id: `block-${Date.now()}`,
      type: blockType,
      data: { title: 'New block', description: 'Edit in JSON or via UI' }
    }
    blocks.push(newBlock)

    const { error } = await supabase
      .from('slides')
      .update({ blocks_json: blocks as unknown as import('@/types/supabase').Json })
      .eq('id', slideId)
    if (error) {
      console.error('Add block failed', error)
      return
    }
    await loadLesson()
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{lesson.title} – Editor</h1>
        <Button variant="secondary" onClick={() => router.push(`/teacher/courses/${courseId}`)}>
          Back to course
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={addSlide}>Add slide</Button>
      </div>

      {slides.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-gray-600">No slides yet. Add your first slide.</CardContent>
        </Card>
      )}

      {slides.map((slide, idx) => {
        const blocks = (Array.isArray(slide.blocks_json) ? slide.blocks_json : []) as SlideBlock[]
        return (
          <Card key={slide.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Slide {idx + 1}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addBlockToSlide(slide.id)}>
                    Add block
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteSlide(slide.id)}>
                    Delete slide
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 && (
                <p className="text-sm text-gray-500 italic">No blocks yet. Add a block to get started.</p>
              )}
              {blocks.map((block) => (
                <div key={block.id} className="p-3 mb-2 bg-gray-50 rounded border text-sm">
                  <div className="font-medium">{block.type}</div>
                  <pre className="text-xs text-gray-600 mt-1 overflow-auto">
                    {JSON.stringify(block.data, null, 2)}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

