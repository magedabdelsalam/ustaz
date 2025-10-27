'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CourseRow {
  id: string
  title: string
  subject: string | null
  grade_level: string | null
  description: string | null
}

interface LessonRow {
  id: string
  title: string
  position: number
}

interface AssignmentRow {
  id: string
  title: string
  type: string
  due_at: string | null
}

export default function StudentCourseOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const courseId = params?.courseId as string

  const [course, setCourse] = useState<CourseRow | null>(null)
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const userId = user?.id ?? null

  const loadCourse = useMemo(() => async () => {
    if (!userId || !courseId) return
    setIsLoading(true)
    try {
      const { data: courseData, error: cErr } = await supabase
        .from('courses')
        .select('id, title, subject, grade_level, description')
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

      const { data: assignmentsData, error: aErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .order('due_at', { ascending: true })
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{course.title}</h1>
          <div className="text-sm text-gray-600 space-x-3 mt-1">
            {course.subject && <span>Subject: {course.subject}</span>}
            {course.grade_level && <span>Grade: {course.grade_level}</span>}
          </div>
          {course.description && (
            <p className="text-sm text-gray-700 mt-2">{course.description}</p>
          )}
        </div>
        <Button variant="secondary" onClick={() => router.push('/student')}>
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lessons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lessons.length === 0 && (
            <p className="text-sm text-gray-600">No lessons available yet.</p>
          )}
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer transition"
              onClick={() => router.push(`/student/courses/${courseId}/lessons/${lesson.id}`)}
            >
              <div className="font-medium text-sm">{lesson.title}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 && (
            <p className="text-sm text-gray-600">No assignments yet.</p>
          )}
          {assignments.map((a) => (
            <div
              key={a.id}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer transition"
              onClick={() => router.push(`/student/assignments/${a.id}`)}
            >
              <div className="font-medium text-sm">{a.title}</div>
              <div className="text-xs text-gray-600 mt-1">
                Type: {a.type} {a.due_at && `• Due: ${new Date(a.due_at).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

