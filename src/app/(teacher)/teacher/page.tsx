'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface CourseRow {
  id: string
  school_id: string
  title: string
  subject: string | null
  grade_level: string | null
  description: string | null
  join_code: string
  state: string
  created_at: string | null
}

export default function TeacherDashboardPage() {
  const { user, loading } = useAuth()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const userId = user?.id ?? null

  const fetchCourses = useMemo(
    () => async () => {
      if (!userId) return
      setIsLoading(true)
      try {
        // Find schools where the user is a teacher
        const { data: memberships, error: memErr } = await supabase
          .from('school_members')
          .select('school_id, role')
          .eq('user_id', userId)
          .eq('role', 'teacher')

        if (memErr) throw memErr
        const schoolIds = (memberships ?? []).map(m => m.school_id)
        if (schoolIds.length === 0) {
          setCourses([])
          return
        }

        const { data: courseRows, error: courseErr } = await supabase
          .from('courses')
          .select('*')
          .in('school_id', schoolIds)
          .order('created_at', { ascending: false })

        if (courseErr) throw courseErr
        setCourses(courseRows ?? [])
      } catch (e) {
        console.error('Failed to load teacher courses', e)
        toast.error('Failed to load courses. Please try again.')
        setCourses([])
      } finally {
        setIsLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    if (!loading) fetchCourses()
  }, [loading, fetchCourses])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
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
            <p className="text-sm text-gray-600">Please sign in to access the teacher dashboard.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teacher dashboard</h1>
        <Button asChild>
          <Link href="/teacher/courses/new">Create course</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        )}
        {!isLoading && courses.length === 0 && (
          <div className="col-span-2">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No courses yet</EmptyTitle>
                <EmptyDescription>
                  Create your first course to get started with teaching.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
        {!isLoading && courses.map((c) => (
          <Link key={c.id} href={`/teacher/courses/${c.id}`}>
            <Card className="hover:shadow-md transition-shadow h-full cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  <Badge variant={c.state === 'active' ? 'default' : 'secondary'}>
                    {c.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  {c.subject && <div>Subject: {c.subject}</div>}
                  {c.grade_level && <div>Grade: {c.grade_level}</div>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs">Join code:</span>
                    <Badge variant="outline" className="font-mono">
                      {c.join_code}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}


