'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Subject } from '@/hooks/useSubjects'
import { Trash2, AlertTriangle } from 'lucide-react'

interface HistoryPaneProps {
  subjects: Subject[]
  selectedSubject: Subject | null
  onSubjectSelect?: (subject: Subject) => void
  onSubjectDelete?: (subjectId: string) => Promise<boolean>
}

export function HistoryPane({ subjects, selectedSubject, onSubjectSelect, onSubjectDelete }: HistoryPaneProps) {
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null)
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<Subject | null>(null)

  const handleDeleteClick = (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation() // Prevent subject selection
    setConfirmDeleteSubject(subject)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteSubject || !onSubjectDelete) return
    
    setDeletingSubject(confirmDeleteSubject.id)
    const success = await onSubjectDelete(confirmDeleteSubject.id)
    
    if (success) {
      setConfirmDeleteSubject(null)
    }
    setDeletingSubject(null)
  }

  const handleCancelDelete = () => {
    setConfirmDeleteSubject(null)
  }
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Learning History</h2>
        <p className="text-xs text-gray-500 mt-1">Auto-generated from your conversations</p>
      </div>

      {/* Subject List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {subjects.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-1">No subjects yet</p>
              <p className="text-xs text-gray-400">Start chatting to create your first subject</p>
            </div>
          ) : (
            subjects.map((subject) => (
            <div
              key={subject.id}
              className={cn(
                "group relative mb-2 rounded-lg transition-colors",
                selectedSubject?.id === subject.id 
                  ? "bg-blue-50 border border-blue-200" 
                  : "bg-white border border-gray-100 hover:bg-gray-50"
              )}
            >
              <button
                onClick={() => onSubjectSelect?.(subject)}
                disabled={deletingSubject === subject.id}
                className="w-full p-3 text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Color indicator with active state */}
                    <div className={cn(
                      "w-3 h-3 rounded-full flex-shrink-0", 
                      subject.color,
                      subject.isActive && "ring-2 ring-blue-500 ring-offset-1"
                    )} />
                    
                    {/* Subject name with completion indicator */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {subject.name}
                        </span>
                        {subject.messageCount > 0 && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Has conversation history" />
                        )}
                      </div>
                      {subject.completedAt ? (
                        <span className="text-xs text-gray-500">
                          Completed {subject.completedAt.toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Last active: {subject.lastActive.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress badge */}
                  <Badge 
                    variant={subject.progress === 100 ? "default" : "secondary"}
                    className={cn(
                      "ml-2 text-xs font-medium",
                      subject.progress === 100 
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {subject.progress}%
                  </Badge>
                </div>
              </button>

              {/* Delete button - shows on hover */}
              {onSubjectDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleDeleteClick(e, subject)}
                  disabled={deletingSubject === subject.id}
                  className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Subject</h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete "{confirmDeleteSubject.name}"?
                </p>
              </div>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-orange-800">
                <strong>This action cannot be undone.</strong> All chat messages, interactive content, and progress will be permanently deleted.
              </p>
            </div>

            <div className="flex space-x-3 justify-end">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={deletingSubject === confirmDeleteSubject.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deletingSubject === confirmDeleteSubject.id}
              >
                {deletingSubject === confirmDeleteSubject.id ? 'Deleting...' : 'Delete Subject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 