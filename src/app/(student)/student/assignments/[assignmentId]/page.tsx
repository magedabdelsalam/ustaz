'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AssignmentRow {
  id: string
  course_id: string
  title: string
  type: string
  due_at: string | null
}

interface SubmissionRow {
  id: string
  answers_json: unknown
  grade: number | null
  feedback: string | null
  submitted_at: string | null
}

export default function StudentAssignmentPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const assignmentId = params?.assignmentId as string

  const [assignment, setAssignment] = useState<AssignmentRow | null>(null)
  const [submission, setSubmission] = useState<SubmissionRow | null>(null)
  const [answers, setAnswers] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const userId = user?.id ?? null

  const loadAssignment = useMemo(() => async () => {
    if (!userId || !assignmentId) return
    setIsLoading(true)
    try {
      const { data: assignmentData, error: aErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()
      if (aErr) throw aErr
      setAssignment(assignmentData)

      const { data: submissionData, error: sErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_user_id', userId)
        .maybeSingle()
      if (sErr && sErr.code !== 'PGRST116') throw sErr
      setSubmission(submissionData)
      if (submissionData) {
        const answersObj = submissionData.answers_json as Record<string, unknown> | null
        setAnswers(JSON.stringify(answersObj ?? {}, null, 2))
      }
    } catch (e) {
      console.error('Failed to load assignment', e)
    } finally {
      setIsLoading(false)
    }
  }, [userId, assignmentId])

  useEffect(() => {
    if (!loading) loadAssignment()
  }, [loading, loadAssignment])

  async function handleSubmit() {
    if (!userId || !assignmentId) return
    setSaving(true)
    try {
      let parsedAnswers = {}
      try {
        parsedAnswers = JSON.parse(answers || '{}')
      } catch {
        alert('Invalid JSON in answers field.')
        setSaving(false)
        return
      }

      if (submission) {
        // Update existing submission
        const { error } = await supabase
          .from('submissions')
          .update({
            answers_json: parsedAnswers,
            submitted_at: new Date().toISOString()
          })
          .eq('id', submission.id)
        if (error) throw error
      } else {
        // Create new submission
        const { error } = await supabase
          .from('submissions')
          .insert({
            assignment_id: assignmentId,
            student_user_id: userId,
            answers_json: parsedAnswers,
            submitted_at: new Date().toISOString()
          })
        if (error) throw error
      }
      await loadAssignment()
      alert('Submission saved!')
    } catch (e) {
      console.error('Submit failed', e)
      alert('Submission failed. Check console.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }

  if (!user || !assignment) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Assignment not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Unable to load assignment or you do not have access.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{assignment.title}</h1>
          <div className="text-sm text-gray-600 mt-1">
            Type: {assignment.type}
            {assignment.due_at && ` • Due: ${new Date(assignment.due_at).toLocaleDateString()}`}
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push('/student')}>
          Back
        </Button>
      </div>

      {submission && submission.grade !== null && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-base">Graded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div>Grade: <span className="font-semibold">{submission.grade}</span></div>
              {submission.feedback && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <div className="font-medium text-xs text-gray-500 uppercase mb-1">Feedback</div>
                  <div>{submission.feedback}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your answers (JSON format)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full h-64 border rounded px-3 py-2 text-sm font-mono"
            value={answers}
            onChange={e => setAnswers(e.target.value)}
            placeholder='{ "question1": "answer", "question2": "answer" }'
            disabled={submission?.grade !== null}
          />
          {submission?.grade === null && (
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : submission ? 'Update submission' : 'Submit'}
              </Button>
            </div>
          )}
          {submission?.grade !== null && (
            <p className="text-sm text-gray-600 italic">This assignment has been graded and cannot be edited.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

