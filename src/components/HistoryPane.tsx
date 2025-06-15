'use client'

/**
 * HistoryPane
 * ----------------
 * TODO: Add description and exports for HistoryPane.
 */


import { useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList } from '@/components/ui/tabs'
import { Subject } from '@/types'
import { GraduationCap, LogOut, BookOpen } from 'lucide-react'
import { SubjectItem } from './history/SubjectItem'
import { DeleteConfirmationDialog } from './history/DeleteConfirmationDialog'
import { getUserInitials } from '@/lib/userUtils'

interface HistoryPaneProps {
  subjects: Subject[]
  selectedSubject: Subject | null
  user: User | null
  onSubjectSelect?: (subject: Subject) => void
  onSubjectDelete?: (subjectId: string) => Promise<boolean>
  showCloseButton?: boolean
  onClose?: () => void
}

export function HistoryPane({ subjects, selectedSubject, user, onSubjectSelect, onSubjectDelete, showCloseButton, onClose }: HistoryPaneProps) {
  const { signOut } = useAuth()
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null)
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<Subject | null>(null)

  const handleDeleteClick = useCallback((subject: Subject) => {
    setConfirmDeleteSubject(subject)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteSubject || !onSubjectDelete) return
    
    setDeletingSubject(confirmDeleteSubject.id)
    const success = await onSubjectDelete(confirmDeleteSubject.id)
    
    if (success) {
      setConfirmDeleteSubject(null)
    }
    setDeletingSubject(null)
  }, [confirmDeleteSubject, onSubjectDelete])

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteSubject(null)
  }, [])

  const handleTabChange = useCallback((subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId)
    if (subject && onSubjectSelect) {
      onSubjectSelect(subject)
    }
  }, [subjects, onSubjectSelect])

  return (
    <div className="flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* App Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Ustaz</span>
          </div>

          {/* User Profile and Close Button */}
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                {user?.email ? getUserInitials(user.email) : 'U'}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
              title="Sign out"
            >
              <LogOut className="h-3 w-3" />
            </Button>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0 ml-1"
                title="Close"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Subject Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {subjects.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects yet</h3>
              <p className="text-gray-600">
                Start chatting to create your first subject and begin your learning journey.
              </p>
            </div>
          </div>
        ) : (
          <Tabs
            value={selectedSubject?.id || subjects[0]?.id}
            onValueChange={handleTabChange}
            orientation="vertical"
            className="flex-1 flex overflow-hidden"
          >
            <TabsList className="flex-col h-full bg-white w-full justify-start p-4 space-y-2 overflow-y-auto">
              {subjects.map((subject) => (
                <SubjectItem
                  key={subject.id}
                  subject={subject}
                  isDeleting={deletingSubject === subject.id}
                  onSelect={handleTabChange}
                  onDelete={onSubjectDelete ? handleDeleteClick : undefined}
                />
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <DeleteConfirmationDialog
        open={!!confirmDeleteSubject}
        subjectName={confirmDeleteSubject?.name || ''}
        isDeleting={confirmDeleteSubject ? deletingSubject === confirmDeleteSubject.id : false}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
