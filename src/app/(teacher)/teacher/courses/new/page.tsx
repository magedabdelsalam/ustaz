'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SchoolRow { id: string; name: string }

function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export default function CreateCoursePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [saving, setSaving] = useState(false)

  const userId = user?.id ?? null

  const loadTeacherSchools = useMemo(() => async () => {
    if (!userId) return
    const { data: members, error: memErr } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', userId)
      .eq('role', 'teacher')
    if (memErr) return
    const ids = (members ?? []).map(m => m.school_id)
    if (ids.length === 0) {
      setSchools([])
      return
    }
    const { data: rows, error } = await supabase
      .from('schools')
      .select('id, name')
      .in('id', ids)
    if (!error) setSchools(rows ?? [])
  }, [userId])

  useEffect(() => {
    if (!loading) loadTeacherSchools()
  }, [loading, loadTeacherSchools])

  async function handleCreate() {
    if (!userId || !schoolId || !title.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('courses')
        .insert({
          school_id: schoolId,
          title: title.trim(),
          subject: subject.trim() || null,
          grade_level: grade.trim() || null,
          description: null,
          join_code: generateJoinCode(),
          state: 'draft',
          created_by: userId,
        })
      if (error) throw error
      router.push('/teacher')
    } catch (e) {
      console.error('Create course failed', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>
  if (!user)
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Please sign in to create a course.</p>
          </CardContent>
        </Card>
      </div>
    )

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Create course</h1>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">School</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={schoolId}
              onChange={e => setSchoolId(e.target.value)}
            >
              <option value="">Select school…</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Course title</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Algebra I"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Math"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Grade level</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={grade}
                onChange={e => setGrade(e.target.value)}
                placeholder="9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push('/teacher')}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !schoolId || !title.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


