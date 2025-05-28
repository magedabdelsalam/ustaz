'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Subject } from '@/hooks/useSubjects'
import { Trash2, AlertTriangle, GraduationCap, LogOut, BookOpen } from 'lucide-react'

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

  const getUserInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase()
  }

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

  const handleTabChange = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId)
    if (subject && onSubjectSelect) {
      onSubjectSelect(subject)
    }
  }

  const isRecentlyActive = (lastActive: Date) => {
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    return lastActive > twentyFourHoursAgo
  }
  
  return (
    <div className="flex flex-col bg-gray-50 h-full">
      {/* App Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
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
      <div className="flex-1 flex flex-col">
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
            className="flex-1 flex"
          >
            <TabsList className="flex-col h-full bg-white w-full justify-start p-4 space-y-2">
              {subjects.map((subject) => (
                <div key={subject.id} className="relative w-full group">
                  <TabsTrigger
                    value={subject.id}
                    disabled={deletingSubject === subject.id}
                    className={cn(
                      "w-full justify-start px-4 py-3 h-auto data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/50",
                      "hover:bg-gray-100 transition-colors border-2 border-transparent",
                      deletingSubject === subject.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-center space-x-3 w-full">
                      {/* Color indicator with active state */}
                      <div className={cn(
                        "w-3 h-3 rounded-full flex-shrink-0", 
                        subject.color,
                        subject.isActive && "ring-2 ring-blue-500 ring-offset-1"
                      )} />
                      
                      {/* Subject info */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="text-sm font-medium truncate">
                              {subject.name}
                            </span>
                            {isRecentlyActive(subject.lastActive) && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Recently active (last 24 hours)" />
                            )}
                          </div>
                          
                          {/* Progress badge */}
                          <Badge 
                            variant={subject.progress === 100 ? "default" : "secondary"}
                            className={cn(
                              "text-xs font-medium ml-2 flex-shrink-0",
                              subject.progress === 100 
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                            )}
                          >
                            {subject.progress}%
                          </Badge>
                        </div>
                        {subject.completedAt && (
                          <span className="text-xs text-gray-500">
                            Completed {subject.completedAt.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </TabsTrigger>

                  {/* Delete button - shows on hover */}
                  {onSubjectDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteClick(e, subject)}
                      disabled={deletingSubject === subject.id}
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50 z-10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

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
                  Are you sure you want to delete &quot;{confirmDeleteSubject.name}&quot;?
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