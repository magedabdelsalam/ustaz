'use client'

import React from 'react'
import { useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList } from '@/components/ui/tabs'
import { Subject } from '@/types'
import { GraduationCap, LogOut, BookOpen, Loader2, PlusCircle } from 'lucide-react'
import { SubjectItem } from './history/SubjectItem'
import { DeleteConfirmationDialog } from './history/DeleteConfirmationDialog'
import { getUserInitials } from '@/lib/userUtils'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface HistoryPaneProps {
  subjects: Subject[]
  selectedSubject: Subject | null
  user: User | null
  onSubjectSelect?: (subject: Subject) => void
  onSubjectDelete?: (subjectId: string) => Promise<boolean>
  onSubjectCreate?: (name: string) => Promise<void>
  showCloseButton?: boolean
  onClose?: () => void
  onGoalsAndLevelSet?: (subjectId: string, goals: string, level: string) => void
}

export function HistoryPane({ subjects, selectedSubject, user, onSubjectSelect, onSubjectDelete, onSubjectCreate, showCloseButton, onClose, onGoalsAndLevelSet }: HistoryPaneProps) {
  const { signOut } = useAuth()
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null)
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<Subject | null>(null)
  const [newSubject, setNewSubject] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [pendingSubjectId, setPendingSubjectId] = useState<string | null>(null)
  const [goalsInput, setGoalsInput] = useState('')
  const [levelInput, setLevelInput] = useState('beginner')
  const [savingGoals, setSavingGoals] = useState(false)
  const [goalsError, setGoalsError] = useState<string | null>(null)

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

  const handleCreateSubject = async () => {
    const trimmed = newSubject.trim()
    if (!trimmed) {
      setError('Subject name cannot be empty')
      setNewSubject('')
      toast.error('Subject name cannot be empty')
      return
    }
    if (subjects.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Subject name must be unique')
      setNewSubject('')
      toast.error('Subject name must be unique')
      return
    }
    setCreating(true)
    setError(null)
    try {
      if (onSubjectCreate) {
        await onSubjectCreate(trimmed)
        setNewSubject('')
        toast.success('Subject created!')
        setTimeout(() => {
          const newSubj = subjects.find(s => s.name.toLowerCase() === trimmed.toLowerCase())
          if (newSubj) {
            setPendingSubjectId(newSubj.id)
            setShowGoalsModal(true)
          }
        }, 100)
      }
    } catch (e) {
      setError('Failed to create subject')
      toast.error('Failed to create subject')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveGoals = async () => {
    setGoalsError(null)
    if (!goalsInput.trim() || goalsInput.trim().length < 10) {
      setGoalsError('Please enter at least 10 characters for your goals.')
      return
    }
    setSavingGoals(true)
    if (pendingSubjectId) {
      const subjIdx = subjects.findIndex(s => s.id === pendingSubjectId)
      if (subjIdx !== -1) {
        subjects[subjIdx].userGoals = goalsInput
        subjects[subjIdx].userLevel = levelInput
      }
      if (typeof onGoalsAndLevelSet === 'function') {
        onGoalsAndLevelSet(pendingSubjectId, goalsInput, levelInput)
      }
    }
    setShowGoalsModal(false)
    setGoalsInput('')
    setLevelInput('beginner')
    setPendingSubjectId(null)
    setSavingGoals(false)
    toast.success('Learning goals saved!')
  }

  const currentSubjectForModal = subjects.find(s => s.id === pendingSubjectId)

  return (
    <div className="flex flex-col bg-gray-50 h-full overflow-hidden" role="navigation" aria-label="Subject history sidebar">
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
              aria-label="Sign out"
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
                aria-label="Close sidebar"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* Subject Creation Input */}
      <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Input
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateSubject()}
            placeholder="Create new subject..."
            className="flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
            disabled={creating}
            aria-label="New subject name"
            autoFocus
          />
          <Button
            onClick={handleCreateSubject}
            disabled={!newSubject.trim() || creating}
            aria-label="Add subject"
            className="transition-all duration-150 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-800 active:scale-95"
          >
            {creating ? <Loader2 className="animate-spin h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
          </Button>
        </div>
        {error && (
          <div className="text-red-600 text-sm mt-2" role="alert">
            {error}
          </div>
        )}
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
                  <button
                    className={`w-full flex flex-col items-start justify-between px-4 py-2 rounded-lg mb-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 hover:bg-blue-50 active:scale-95 ${selectedSubject?.id === subject.id ? 'bg-blue-100 text-blue-900 font-semibold' : 'bg-white text-gray-900'}`}
                    onClick={() => onSubjectSelect && onSubjectSelect(subject)}
                    aria-current={selectedSubject?.id === subject.id ? 'page' : undefined}
                    title={subject.userGoals ? `Goals: ${subject.userGoals}\nLevel: ${subject.userLevel}` : undefined}
                  >
                    <span className="truncate w-full">{subject.name}</span>
                    {subject.userGoals && (
                      <span className="text-xs text-gray-500 mt-1 w-full truncate">🎯 {subject.userGoals}</span>
                    )}
                    {subject.userLevel && (
                      <span className="text-xs text-gray-400 mt-0.5 w-full truncate">Level: {subject.userLevel}</span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">{subject.messageCount} msgs</span>
                  </button>
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
      {/* Modal for learning goals and level */}
      <Dialog open={showGoalsModal} onOpenChange={setShowGoalsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Your Learning Goals</DialogTitle>
            {currentSubjectForModal && (
              <div className="text-sm text-gray-500 mt-1">Subject: <span className="font-semibold">{currentSubjectForModal.name}</span></div>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="goals-input" className="block text-sm font-medium text-gray-700 mb-1">What are your main goals for this subject?</label>
              <Input
                id="goals-input"
                value={goalsInput}
                onChange={e => setGoalsInput(e.target.value)}
                placeholder="e.g. Master algebra basics, prepare for an exam..."
                autoFocus
              />
              {goalsError && <div className="text-red-600 text-xs mt-1">{goalsError}</div>}
            </div>
            <div>
              <label htmlFor="level-input" className="block text-sm font-medium text-gray-700 mb-1">How would you rate your current level?</label>
              <select
                id="level-input"
                className="w-full border rounded p-2 mt-1"
                value={levelInput}
                onChange={e => setLevelInput(e.target.value)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveGoals} disabled={savingGoals || !goalsInput.trim()}>
              {savingGoals ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
