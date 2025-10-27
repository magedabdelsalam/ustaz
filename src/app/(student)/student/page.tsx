'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface SectionRow {
  id: string
  course_id: string
  name: string
}

interface CourseRow {
  id: string
  title: string
  subject: string | null
  grade_level: string | null
}

export default function StudentDashboardPage() {
  const { user, loading } = useAuth()
  const [joinCode, setJoinCode] = useState('')
  const [sections, setSections] = useState<Array<{ section: SectionRow; course: CourseRow }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const userId = user?.id ?? null

  const loadEnrollments = useMemo(() => async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      // Fetch enrolled sections
      const { data: enrolls, error: enrErr } = await supabase
        .from('enrollments')
        .select('section_id')
        .eq('student_user_id', userId)
        .eq('status', 'active')
      if (enrErr) throw enrErr
      const sectionIds = (enrolls ?? []).map(e => e.section_id)
      if (sectionIds.length === 0) {
        setSections([])
        return
      }

      const { data: sectionRows, error: secErr } = await supabase
        .from('sections')
        .select('*')
        .in('id', sectionIds)
      if (secErr) throw secErr

      const courseIds = (sectionRows ?? []).map(s => s.course_id)
      const { data: courseRows, error: crsErr } = await supabase
        .from('courses')
        .select('id, title, subject, grade_level')
        .in('id', courseIds)
      if (crsErr) throw crsErr

      const courseMap = new Map(courseRows?.map(c => [c.id, c]) as Array<[string, CourseRow]>)
      setSections((sectionRows ?? []).map(s => ({ section: s as SectionRow, course: courseMap.get(s.course_id)! })))
    } catch (e) {
      console.error('Failed to load enrollments', e)
      setSections([])
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!loading) loadEnrollments()
  }, [loading, loadEnrollments])

  async function handleJoin() {
    if (!userId || !joinCode.trim()) {
      toast.error('Please enter a join code')
      return
    }
    
    try {
      // Resolve join code to a course
      const { data: course, error: codeErr } = await supabase
        .from('courses')
        .select('id')
        .eq('join_code', joinCode.trim())
        .single()
      
      if (codeErr || !course) {
        toast.error('Invalid join code. Please check and try again.')
        return
      }

      // Use RPC or server action ideally; for MVP, find a section and attempt insert (will be blocked by RLS if not allowed)
      const { data: section, error: secErr } = await supabase
        .from('sections')
        .select('id')
        .eq('course_id', course.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      
      if (secErr || !section) {
        toast.error('No sections available for this course')
        return
      }

      const insertRow = { section_id: section.id, student_user_id: userId, status: 'active' as const }
      const { error: enrErr } = await supabase.from('enrollments').insert(insertRow)
      
      if (enrErr) {
        toast.error('Failed to join course. Please try again.')
        console.warn('Enrollment insert failed (likely RLS server-only); ignoring in client', enrErr)
        return
      }
      
      toast.success('Successfully joined the course!')
      setJoinCode('')
      await loadEnrollments()
    } catch (e) {
      toast.error('Failed to join course. Please try again.')
      console.error('Join via code failed', e)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Please sign in to access your courses.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Student dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Join a course</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter join code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <Button onClick={handleJoin}>Join</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading && (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        )}
        {!isLoading && sections.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No courses yet</EmptyTitle>
              <EmptyDescription>
                You haven't enrolled in any classes. Use the join code above to get started!
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {!isLoading && sections.map(({ section, course }) => (
          <Card key={section.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{course.title}</CardTitle>
                <Badge variant="secondary">{section.name}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                {course.subject && <div>Subject: {course.subject}</div>}
                {course.grade_level && <div>Grade: {course.grade_level}</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


