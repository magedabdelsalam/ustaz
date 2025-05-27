'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import { useAuth } from './useAuth'
import { persistenceService, PersistedSubject } from '@/lib/persistenceService'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'demo-key-for-development',
  dangerouslyAllowBrowser: true // Only for demo - in production, use server-side API routes
})

// Global cache for AI analysis - persists across hook calls
const messageAnalysisCache = new Map<string, any>()

export interface Subject {
  id: string
  name: string
  progress: number
  color: string
  isActive: boolean
  startedAt: Date
  completedAt?: Date
  topicKeywords: string[]
  messageCount: number
  lessonPlan?: any
  learningProgress?: any
  lastActive: Date
}

// Optimized hook with minimal re-renders
export function useSubjects() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const subjectColors = useMemo(() => [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
  ], [])

  // Helper functions first (so they can be used in other callbacks)
  const calculateProgressFromData = useCallback((persistedSubject: PersistedSubject): number => {
    if (persistedSubject.learning_progress) {
      const progress = persistedSubject.learning_progress
      
      // Handle the correct LearningProgress structure
      if (progress.correctAnswers !== undefined && progress.totalAttempts !== undefined) {
        // Calculate based on answer accuracy and lesson progression
        const accuracy = progress.totalAttempts > 0 ? progress.correctAnswers / progress.totalAttempts : 0
        const baseProgress = Math.round(accuracy * 70) // 70% weight on accuracy
        
        // Add lesson progression bonus
        const currentLessonIndex = progress.currentLessonIndex || 0
        const totalLessons = progress.totalLessons || 1
        const lessonProgress = Math.round((currentLessonIndex / totalLessons) * 30) // 30% weight on lessons
        
        return Math.min(baseProgress + lessonProgress, 100)
      }
      
      // Fallback to old structure if it exists
      if (progress.completedLessons !== undefined && progress.totalLessons !== undefined) {
        return Math.round((progress.completedLessons / (progress.totalLessons || 1)) * 100)
      }
    }
    
    // Default fallback based on time
    const daysSinceCreation = persistedSubject.created_at 
      ? Math.floor((Date.now() - new Date(persistedSubject.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    
    return Math.min(5 + Math.floor(daysSinceCreation / 7) * 5, 25)
  }, [])

  // Function to update subject progress in real-time
  const updateSubjectProgress = useCallback((subjectId: string, learningProgress: any) => {
    setSubjects(prev => prev.map(subject => {
      if (subject.id === subjectId) {
        const updatedSubject = {
          ...subject,
          learningProgress,
          progress: calculateProgressFromData({
            id: subject.id,
            name: subject.name,
            learning_progress: learningProgress,
            created_at: subject.startedAt.toISOString(),
            last_active: new Date().toISOString()
          } as PersistedSubject)
        }
        return updatedSubject
      }
      return subject
    }))
  }, [calculateProgressFromData])

  const extractBasicKeywords = useCallback((subjectName: string): string[] => {
    return subjectName.toLowerCase().split(' ').filter(word => word.length > 2)
  }, [])

  // Optimized data loading - only when explicitly called
  const loadSubjects = useCallback(async () => {
    if (!user || isLoading) return

    setIsLoading(true)
    try {
      const persistedSubjects = await persistenceService.getSubjectsByUser(user.id)
      
      const loadedSubjects: Subject[] = persistedSubjects.map(ps => ({
        id: ps.id,
        name: ps.name,
        progress: calculateProgressFromData(ps),
        color: subjectColors[Math.abs(ps.name.charCodeAt(0)) % subjectColors.length],
        isActive: true,
        startedAt: new Date(ps.created_at || ps.last_active),
        topicKeywords: ps.keywords || [],
        messageCount: 1,
        lessonPlan: ps.lesson_plan,
        learningProgress: ps.learning_progress,
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
  }, [user?.id, subjectColors, isLoading, calculateProgressFromData])

  // Optimized subject creation with minimal AI calls
  const createSubject = useCallback(async (subjectName: string): Promise<Subject> => {
    if (!user) throw new Error('No user available')

    const newSubject: Subject = {
      id: Date.now().toString(),
      name: subjectName,
      progress: 5,
      color: subjectColors[subjects.length % subjectColors.length],
      isActive: true,
      startedAt: new Date(),
      topicKeywords: extractBasicKeywords(subjectName),
      messageCount: 1,
      lastActive: new Date()
    }

    // Immediate UI update
    startTransition(() => {
      setSubjects(prev => [...prev, newSubject])
      setCurrentSubject(newSubject)
    })

    // Background persistence
    try {
      await persistenceService.saveSubject({
        id: newSubject.id,
        user_id: user.id,
        name: newSubject.name,
        keywords: newSubject.topicKeywords,
        lesson_plan: newSubject.lessonPlan,
        learning_progress: newSubject.learningProgress,
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
  }, [user, subjects.length, subjectColors, extractBasicKeywords])

  // Optimized subject analysis - cached and efficient
  const analyzeMessage = useCallback(async (message: string) => {
    // Create cache key from message content (first 50 chars + length)
    const cacheKey = `${message.toLowerCase().slice(0, 50)}_${message.length}`
    
    // Check cache first
    if (messageAnalysisCache.has(cacheKey)) {
      console.log('🎯 Cache hit for message analysis')
      return messageAnalysisCache.get(cacheKey)
    }

    try {
      console.log('🤖 Making AI analysis call (cache miss)')
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Cheaper model for analysis
        messages: [
          {
            role: "system",
            content: "Analyze if this message indicates a new subject. Return JSON: {\"subjectName\": string, \"isNewSubject\": boolean, \"confidence\": number}"
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.1, // Lower temperature for consistent results
        max_tokens: 100 // Limit tokens
      })

      const content = response.choices[0].message.content
      if (!content) throw new Error('No analysis content')

      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim())
      
      // Cache the result
      messageAnalysisCache.set(cacheKey, analysis)
      
      // Prevent cache from growing too large (keep last 100 entries)
      if (messageAnalysisCache.size > 100) {
        const firstKey = messageAnalysisCache.keys().next().value
        if (firstKey) {
          messageAnalysisCache.delete(firstKey)
        }
      }
      
      return analysis
    } catch (error) {
      console.error('AI analysis failed:', error)
      // Fallback logic
      const isLearningMessage = /\b(learn|study|teach me|explain)\b/i.test(message)
      const fallbackResult = {
        subjectName: isLearningMessage ? 'General Study' : currentSubject?.name || 'General Study',
        isNewSubject: !currentSubject || isLearningMessage,
        confidence: 0.5
      }
      
      // Cache fallback results too (to avoid repeated API failures)
      messageAnalysisCache.set(cacheKey, fallbackResult)
      return fallbackResult
    }
  }, [currentSubject])

  // Optimized subject selection
  const selectSubject = useCallback((subject: Subject) => {
    startTransition(() => {
      const updatedSubject = { ...subject, lastActive: new Date() }
      setCurrentSubject(updatedSubject)
      setSubjects(prev => prev.map(s => 
        s.id === subject.id ? updatedSubject : s
      ))
    })

    // Background persistence
    persistenceService.saveSubject({
      id: subject.id,
      user_id: user?.id || '',
      name: subject.name,
      keywords: subject.topicKeywords,
      lesson_plan: subject.lessonPlan,
      learning_progress: subject.learningProgress,
      last_active: new Date().toISOString()
    }).catch(console.error)
  }, [user?.id])

  // Delete subject functionality
  const deleteSubject = useCallback(async (subjectId: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot delete subject: no user logged in')
      return false
    }

    try {
      console.log('🗑️ Deleting subject:', subjectId)
      
      // Delete from backend (this also deletes messages and content)
      await persistenceService.deleteSubject(user.id, subjectId)
      
      // Remove from local state
      startTransition(() => {
        setSubjects(prev => prev.filter(subject => subject.id !== subjectId))
        
        // If this was the current subject, clear it
        if (currentSubject?.id === subjectId) {
          setCurrentSubject(null)
        }
      })
      
      console.log('✅ Subject deleted successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to delete subject:', error)
      return false
    }
  }, [user, currentSubject?.id])

  // Auto-load subjects when user becomes available
  if (user && subjects.length === 0 && !isLoading) {
    loadSubjects()
  }

  return {
    subjects,
    currentSubject,
    isLoading: isLoading || isPending,
    loadSubjects,
    createSubject,
    analyzeMessage,
    selectSubject,
    deleteSubject,
    setCurrentSubject: useCallback((subject: Subject | null) => {
      startTransition(() => setCurrentSubject(subject))
    }, []),
    updateSubjectProgress
  }
} 