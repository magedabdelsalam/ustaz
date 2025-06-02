'use client'

import { useState, useCallback, useTransition, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { persistenceService } from '@/lib/persistenceService'
import { logger } from '@/lib/logger'
import { Subject } from '@/types'

// Simple color array for visual distinction
const subjectColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
  'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500']

// AI-first subject management - only responds to AI tool calls
export function useSubjects() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Load subjects from database (AI may have created them)
  const loadSubjects = useCallback(async () => {
    if (!user || isLoading) return

    setIsLoading(true)
    try {
      const persistedSubjects = await persistenceService.getSubjectsByUser(user.id)
      
      console.log('📚 Loading AI-managed subjects:', persistedSubjects.length)
      
      const loadedSubjects: Subject[] = persistedSubjects.map(ps => ({
        id: ps.id,
        name: ps.name,
        progress: 5, // AI manages actual progress
        color: subjectColors[Math.abs(ps.name.charCodeAt(0)) % subjectColors.length],
        isActive: true,
        startedAt: new Date(ps.created_at || ps.last_active),
        topicKeywords: ps.keywords || [],
        messageCount: 1,
        lastActive: new Date(ps.last_active)
      }))
      
      startTransition(() => {
        setSubjects(loadedSubjects)
        
        // Set most recent as current
        if (loadedSubjects.length > 0) {
          const mostRecent = [...loadedSubjects].sort((a, b) => 
            b.lastActive.getTime() - a.lastActive.getTime()
          )[0]
          setCurrentSubject(mostRecent)
        }
      })
    } catch (error) {
      console.error('Failed to load subjects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, isLoading])

  // Create subject (called by AI tool)
  const createSubject = useCallback(async (subjectName: string): Promise<Subject> => {
    if (!user) throw new Error('No user available')

    const colorIndex = Math.abs(subjectName.charCodeAt(0)) % subjectColors.length

    const newSubject: Subject = {
      id: Date.now().toString(),
      name: subjectName,
      progress: 5,
      color: subjectColors[colorIndex],
      isActive: true,
      startedAt: new Date(),
      topicKeywords: subjectName.toLowerCase().split(' ').filter(word => word.length > 2),
      messageCount: 1,
      lastActive: new Date()
    }

    // Immediate UI update
    startTransition(() => {
      setSubjects(prev => [...prev, newSubject])
      setCurrentSubject(newSubject)
    })

    // Save to database (simplified structure)
    try {
      await persistenceService.saveSubject({
        id: newSubject.id,
        user_id: user.id,
        name: newSubject.name,
        keywords: newSubject.topicKeywords,
        lesson_plan: null, // AI manages lesson plans
        learning_progress: null, // AI manages progress
        last_active: newSubject.lastActive.toISOString()
      })
    } catch (error) {
      console.error('Failed to save subject:', error)
      // Revert on failure
      startTransition(() => {
        setSubjects(prev => prev.filter(s => s.id !== newSubject.id))
        setCurrentSubject(null)
      })
      throw error
    }

    return newSubject
  }, [user])

  // Select subject (updates last active)
  const selectSubject = useCallback((subject: Subject) => {
    startTransition(() => {
      const updatedSubject = { ...subject, lastActive: new Date() }
      setCurrentSubject(updatedSubject)
      setSubjects(prev => prev.map(s => 
        s.id === subject.id ? updatedSubject : s
      ))
    })

    // Background update
    if (user) {
      persistenceService.saveSubject({
        id: subject.id,
        user_id: user.id,
        name: subject.name,
        keywords: subject.topicKeywords,
        lesson_plan: null,
        learning_progress: null,
        last_active: new Date().toISOString()
      }).catch(console.error)
    }
  }, [user])

  // Delete subject
  const deleteSubject = useCallback(async (subjectId: string): Promise<boolean> => {
    if (!user) return false

    try {
      logger.debug('🗑️ Deleting subject:', subjectId)
      
      await persistenceService.deleteSubject(user.id, subjectId)
      
      startTransition(() => {
        setSubjects(prev => prev.filter(subject => subject.id !== subjectId))
        
        if (currentSubject?.id === subjectId) {
          setCurrentSubject(null)
        }
      })
      
      logger.debug('✅ Subject deleted successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to delete subject:', error)
      return false
    }
  }, [user, currentSubject?.id])

  // Auto-load subjects when user becomes available
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (user?.id && !hasLoadedRef.current && !isLoading) {
      hasLoadedRef.current = true
      logger.debug('🔄 Loading AI-managed subjects for user:', user.id)
      loadSubjects()
    }
  }, [user?.id, loadSubjects, isLoading])

  useEffect(() => {
    if (!user?.id) {
      hasLoadedRef.current = false
    }
  }, [user?.id])

  return {
    subjects,
    currentSubject,
    isLoading: isLoading || isPending,
    loadSubjects,
    createSubject,
    selectSubject,
    deleteSubject,
    setCurrentSubject: useCallback((subject: Subject | null) => {
      startTransition(() => setCurrentSubject(subject))
    }, [])
  }
} 
