'use client'

import React from 'react'
import { useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Subject } from '@/types'
import { GraduationCap, LogOut, BookOpen, Loader2, PlusCircle, Settings, HelpCircle } from 'lucide-react'
import { DeleteConfirmationDialog } from './history/DeleteConfirmationDialog'
import { getUserInitials } from '@/lib/userUtils'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { SubjectContextMenu } from './history/SubjectContextMenu'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface HistoryPaneProps {
  subjects: Subject[]
  selectedSubject: Subject | null
  onSelectSubject: (subject: Subject) => void
  onDeleteSubject: (subject: Subject) => Promise<void>
  onClose?: () => void
  showCloseButton?: boolean
  user?: {
    email?: string
    name?: string
  }
}

export function HistoryPane({ subjects, selectedSubject, onSelectSubject, onDeleteSubject, onClose, showCloseButton, user }: HistoryPaneProps) {
  const { signOut } = useAuth()
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null)
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<Subject | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [currentSubjectForModal, setCurrentSubjectForModal] = useState<Subject | null>(null)
  const [goals, setGoals] = useState('')
  const [level, setLevel] = useState<string>('')
  const [goalsError, setGoalsError] = useState<string | null>(null)
  const [savingGoals, setSavingGoals] = useState(false)

  const _handleDeleteClick = useCallback((subject: Subject) => {
    setConfirmDeleteSubject(subject)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteSubject || !onDeleteSubject) return
    
    setDeletingSubject(confirmDeleteSubject.id)
    try {
      await onDeleteSubject(confirmDeleteSubject)
      
      setConfirmDeleteSubject(null)
    } catch (error) {
      console.error('Failed to delete subject:', error)
      toast.error('An unexpected error occurred while deleting the subject.')
      setDeletingSubject(null)
    }
  }, [confirmDeleteSubject, onDeleteSubject])

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteSubject(null)
    setDeletingSubject(null)
  }, [])

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const newSubject: Subject = {
        id: Date.now().toString(),
        name: newSubjectName.trim(),
        progress: 0,
        color: 'bg-blue-500',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: [],
        messageCount: 0,
        lastActive: new Date()
      }
      onSelectSubject(newSubject)
      setNewSubjectName('')
      setShowGoalsModal(true)
      setCurrentSubjectForModal(newSubject)
    } catch (err) {
      console.error('Failed to create subject:', err)
      setError('Failed to create subject. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreateSubject()
    }
  }

  const handleSaveGoals = async () => {
    if (!goals.trim() || !level || !currentSubjectForModal) return

    setSavingGoals(true)
    setGoalsError(null)

    try {
      // Update the subject with goals and level
      const updatedSubject = {
        ...currentSubjectForModal,
        userGoals: goals.trim(),
        userLevel: level as 'beginner' | 'intermediate' | 'advanced'
      }
      onSelectSubject(updatedSubject)
      setShowGoalsModal(false)
      setGoals('')
      setLevel('')
      setCurrentSubjectForModal(null)
    } catch (err) {
      console.error('Failed to save goals:', err)
      setGoalsError('Failed to save goals. Please try again.')
    } finally {
      setSavingGoals(false)
    }
  }

  return (
    <div className="flex flex-col bg-muted/50 h-full overflow-hidden" role="navigation" aria-label="Subject history sidebar">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Ustaz</span>
            </div>
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {user?.name?.[0] || user?.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-6 w-6 p-0">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-6 w-6 p-0 ml-1">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Subject Creation */}
      <Card className="rounded-none border-x-0">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Create a new subject..."
              className="flex-1"
            />
            <Button
              onClick={handleCreateSubject}
              disabled={!newSubjectName.trim() || creating}
              className="flex items-center gap-2"
            >
              {creating ? <Loader2 className="animate-spin h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
              <span>Create</span>
            </Button>
          </div>
          {error && <div className="text-destructive text-sm mt-2" role="alert">{error}</div>}
        </CardContent>
      </Card>

      {/* Subject List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {subjects.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No subjects yet</h3>
              <p className="text-muted-foreground">
                Create your first subject to start learning!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2">
            <AnimatePresence initial={false}>
              {subjects.map(subject => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                >
                  <SubjectContextMenu
                    subject={subject}
                    onDelete={_handleDeleteClick}
                  >
                    <Card
                      className={cn(
                        "w-full mb-2 transition-colors cursor-pointer",
                        "hover:bg-accent hover:text-accent-foreground",
                        selectedSubject?.id === subject.id 
                          ? "bg-accent text-accent-foreground font-semibold" 
                          : "bg-background text-foreground"
                      )}
                      onClick={() => onSelectSubject(subject)}
                      aria-current={selectedSubject?.id === subject.id ? 'page' : undefined}
                      title={subject.userGoals ? `Goals: ${subject.userGoals}\nLevel: ${subject.userLevel}` : undefined}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col items-start justify-between">
                          <span className="truncate w-full">{subject.name}</span>
                          {subject.userGoals && (
                            <span className="text-xs text-muted-foreground mt-1 w-full truncate">🎯 {subject.userGoals}</span>
                          )}
                          {subject.userLevel && (
                            <span className="text-xs text-muted-foreground mt-0.5 w-full truncate">Level: {subject.userLevel}</span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">{subject.messageCount} msgs</span>
                        </div>
                      </CardContent>
                    </Card>
                  </SubjectContextMenu>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <DeleteConfirmationDialog
        open={!!confirmDeleteSubject}
        subjectName={confirmDeleteSubject?.name || ''}
        isDeleting={confirmDeleteSubject ? deletingSubject === confirmDeleteSubject.id : false}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {/* Subject Goals Modal */}
      <Dialog open={showGoalsModal} onOpenChange={setShowGoalsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Your Learning Goals</DialogTitle>
            <DialogDescription>
              Tell us about your learning goals and current level to help us personalize your experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="goals" className="text-sm font-medium">
                What are your learning goals?
              </label>
              <Textarea
                id="goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g., I want to master basic conversation skills..."
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="level" className="text-sm font-medium">
                What is your current level?
              </label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {goalsError && (
              <div className="text-destructive text-sm" role="alert">
                {goalsError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGoalsModal(false)
                setGoals('')
                setLevel('')
                setCurrentSubjectForModal(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGoals}
              disabled={!goals.trim() || !level || savingGoals}
            >
              {savingGoals ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Goals'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
