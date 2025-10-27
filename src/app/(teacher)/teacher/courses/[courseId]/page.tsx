'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface CourseRow {
  id: string
  title: string
  subject: string | null
  grade_level: string | null
  description: string | null
  join_code: string
  state: string
}

interface LessonRow {
  id: string
  title: string
  position: number
}

interface SectionRow {
  id: string
  name: string
}

interface AssignmentRow {
  id: string
  title: string
  type: string
  due_at: string | null
}

export default function CourseOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const courseId = params?.courseId as string

  const [course, setCourse] = useState<CourseRow | null>(null)
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [sections, setSections] = useState<SectionRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const userId = user?.id ?? null

  const loadCourse = useMemo(() => async () => {
    if (!userId || !courseId) return
    setIsLoading(true)
    try {
      const { data: courseData, error: cErr } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()
      if (cErr) throw cErr
      setCourse(courseData)

      const { data: lessonsData, error: lErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true })
      if (lErr) throw lErr
      setLessons(lessonsData ?? [])

      const { data: sectionsData, error: sErr } = await supabase
        .from('sections')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true })
      if (sErr) throw sErr
      setSections(sectionsData ?? [])

      const { data: assignmentsData, error: aErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
      if (aErr) throw aErr
      setAssignments(assignmentsData ?? [])
    } catch (e) {
      console.error('Failed to load course', e)
    } finally {
      setIsLoading(false)
    }
  }, [userId, courseId])

  useEffect(() => {
    if (!loading) loadCourse()
  }, [loading, loadCourse])

  async function createLesson() {
    if (!userId || !courseId) return
    const title = prompt('Lesson title:')
    if (!title?.trim()) return
    const position = lessons.length
    const { error } = await supabase
      .from('lessons')
      .insert({ course_id: courseId, title: title.trim(), position })
    if (error) {
      console.error('Create lesson failed', error)
      return
    }
    await loadCourse()
  }

  async function createSection() {
    if (!userId || !courseId) return
    const name = prompt('Section name (e.g., Period 1):')
    if (!name?.trim()) return
    const { error } = await supabase
      .from('sections')
      .insert({ course_id: courseId, name: name.trim() })
    if (error) {
      console.error('Create section failed', error)
      return
    }
    await loadCourse()
  }

  if (loading || isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }

  if (!user || !course) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Course not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Unable to load course or you do not have access.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{course.title}</h1>
          <div className="text-sm text-gray-600 space-x-3 mt-1">
            {course.subject && <span>Subject: {course.subject}</span>}
            {course.grade_level && <span>Grade: {course.grade_level}</span>}
            <span className="font-mono font-medium">Join code: {course.join_code}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push('/teacher')}>
          Back
        </Button>
      </div>

      <Tabs defaultValue="lessons" className="w-full">
        <TabsList>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={createLesson}>New lesson</Button>
          </div>
          {lessons.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">No lessons yet.</CardContent>
            </Card>
          )}
          {lessons.map((lesson) => (
            <Card key={lesson.id} className="hover:shadow-sm transition cursor-pointer" onClick={() => router.push(`/teacher/courses/${courseId}/lessons/${lesson.id}/editor`)}>
              <CardHeader>
                <CardTitle className="text-base">{lesson.title}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={createSection}>New section</Button>
          </div>
          {sections.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">No sections yet.</CardContent>
            </Card>
          )}
          {sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-base">{section.name}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => router.push(`/teacher/courses/${courseId}/assignments/new`)}>
              New assignment
            </Button>
          </div>
          {assignments.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">No assignments yet.</CardContent>
            </Card>
          )}
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-base">{a.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  Type: {a.type} {a.due_at && `• Due: ${new Date(a.due_at).toLocaleDateString()}`}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

