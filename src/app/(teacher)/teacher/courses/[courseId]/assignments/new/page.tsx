'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CreateAssignmentPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const courseId = params?.courseId as string

  const [title, setTitle] = useState('')
  const [type, setType] = useState<'worksheet' | 'quiz' | 'test'>('worksheet')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const userId = user?.id ?? null

  async function handleCreate() {
    if (!userId || !courseId || !title.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('assignments')
        .insert({
          course_id: courseId,
          title: title.trim(),
          type,
          due_at: dueDate ? new Date(dueDate).toISOString() : null,
        })
      if (error) throw error
      router.push(`/teacher/courses/${courseId}`)
    } catch (e) {
      console.error('Create assignment failed', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Please sign in to create an assignment.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Create assignment</h1>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Homework 5"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={type}
              onChange={e => setType(e.target.value as 'worksheet' | 'quiz' | 'test')}
            >
              <option value="worksheet">Worksheet</option>
              <option value="quiz">Quiz</option>
              <option value="test">Test</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Due date (optional)</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push(`/teacher/courses/${courseId}`)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !title.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

