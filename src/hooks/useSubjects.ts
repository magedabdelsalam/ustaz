'use client'

import { useState, useCallback, useMemo, useTransition, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { persistenceService, PersistedSubject } from '@/lib/persistenceService'
import { chatCompletion } from '@/lib/openaiClient'
import { logger } from '@/lib/logger'

// Global cache for AI analysis - persists across hook calls
const messageAnalysisCache = new Map<string, {
  subjectName: string
  isNewSubject: boolean
  confidence: number
}>()

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
  lessonPlan?: {
    lessons: Array<{ id: string; title: string; description: string }>
    currentLessonIndex: number
  }
  learningProgress?: {
    correctAnswers: number
    totalAttempts: number
    currentLessonIndex?: number
    totalLessons?: number
    needsReview?: boolean
    readyForNext?: boolean
  }
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
    }
    
    // Default fallback based on time
    const daysSinceCreation = persistedSubject.created_at 
      ? Math.floor((Date.now() - new Date(persistedSubject.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    
    return Math.min(5 + Math.floor(daysSinceCreation / 7) * 5, 25)
  }, [])

  // Function to update subject progress in real-time
  const updateSubjectProgress = useCallback((subjectId: string, learningProgress: {
    correctAnswers: number
    totalAttempts: number
    currentLessonIndex?: number
    totalLessons?: number
    needsReview?: boolean
    readyForNext?: boolean
  }) => {
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
      
      // Debug logging to see what's in the database
      console.log('🔍 DEBUG: Raw persisted subjects from DB:', persistedSubjects.length)
      persistedSubjects.forEach((ps, index) => {
        console.log(`🔍 Subject ${index}: ${ps.name}`)
        console.log(`🔍 Has lesson_plan:`, !!ps.lesson_plan)
        console.log(`🔍 Has learning_progress:`, !!ps.learning_progress)
        if (ps.lesson_plan) {
          console.log(`🔍 Lesson plan lessons:`, ps.lesson_plan.lessons?.length || 'undefined')
          console.log(`🔍 Current lesson index:`, ps.lesson_plan.currentLessonIndex)
        }
        if (ps.learning_progress) {
          console.log(`🔍 Progress: ${ps.learning_progress.correctAnswers}/${ps.learning_progress.totalAttempts}`)
        }
      })
      
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
      
      // Debug logging for mapped subjects
      console.log('🔍 DEBUG: Mapped subjects:', loadedSubjects.length)
      loadedSubjects.forEach((subject, index) => {
        console.log(`🔍 Mapped Subject ${index}: ${subject.name}`)
        console.log(`🔍 Mapped has lessonPlan:`, !!subject.lessonPlan)
        console.log(`🔍 Mapped has learningProgress:`, !!subject.learningProgress)
      })
      
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
  }, [user, subjectColors, isLoading, calculateProgressFromData])

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
      // Only save if we have complete data to avoid type errors
      if (newSubject.lessonPlan) {
        const lessonPlanData = {
          subject: newSubject.name,
          lessons: newSubject.lessonPlan.lessons.map(lesson => ({
            ...lesson,
            completed: false
          })),
          currentLessonIndex: newSubject.lessonPlan.currentLessonIndex
        }
        
        await persistenceService.saveSubject({
          id: newSubject.id,
          user_id: user.id,
          name: newSubject.name,
          keywords: newSubject.topicKeywords,
          lesson_plan: lessonPlanData,
          learning_progress: {
            correctAnswers: newSubject.learningProgress?.correctAnswers || 0,
            totalAttempts: newSubject.learningProgress?.totalAttempts || 0,
            needsReview: newSubject.learningProgress?.needsReview || false,
            readyForNext: newSubject.learningProgress?.readyForNext || false,
            currentLessonIndex: newSubject.learningProgress?.currentLessonIndex,
            totalLessons: newSubject.learningProgress?.totalLessons
          },
          last_active: newSubject.lastActive.toISOString()
        })
      } else {
        await persistenceService.saveSubject({
          id: newSubject.id,
          user_id: user.id,
          name: newSubject.name,
          keywords: newSubject.topicKeywords,
          last_active: newSubject.lastActive.toISOString()
        })
      }
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
      logger.debug('🎯 Cache hit for message analysis')
      return messageAnalysisCache.get(cacheKey)
    }

    try {
      logger.debug('🤖 Making AI analysis call (cache miss)')
      const response = await chatCompletion({
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
        temperature: 0.1,
        max_tokens: 100
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
      
      // Enhanced fallback logic with better subject extraction
      // Extract potential subject from common patterns
      let extractedSubject = 'General Study'
      
      // Pattern: "learn [subject]", "study [subject]", "teach me [subject]"
      const learnPattern = /(?:learn|study|teach me|help me learn|explain|about)\s+([a-zA-Z\s&]+?)(?:\s|$|\.|\?|!)/i
      const learnMatch = message.match(learnPattern)
      if (learnMatch && learnMatch[1]) {
        extractedSubject = learnMatch[1].trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
      
      // Pattern: "[subject] help", "[subject] course", "[subject] tutorial"  
      const subjectPattern = /^([a-zA-Z\s&]+?)\s+(help|course|tutorial|training|class|lesson)/i
      const subjectMatch = message.match(subjectPattern)
      if (subjectMatch && subjectMatch[1]) {
        extractedSubject = subjectMatch[1].trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
      
      // Specific subject detection patterns
      const subjectPatterns = [
        { pattern: /social media|social networking|instagram|facebook|twitter|linkedin|tiktok|marketing/i, subject: 'Social Media Management' },
        { pattern: /advertising|ads|google ads|facebook ads|ppc|sem|marketing campaigns/i, subject: 'Digital Advertising' },
        { pattern: /math|mathematics|algebra|calculus|geometry|statistics/i, subject: 'Mathematics' },
        { pattern: /science|physics|chemistry|biology/i, subject: 'Science' },
        { pattern: /history|historical/i, subject: 'History' },
        { pattern: /english|literature|writing|grammar/i, subject: 'English' },
        { pattern: /programming|coding|javascript|python|web development/i, subject: 'Programming' },
        { pattern: /business|entrepreneurship|management|leadership/i, subject: 'Business' },
        { pattern: /spanish|french|german|language/i, subject: 'Language Learning' },
        { pattern: /art|design|drawing|painting/i, subject: 'Art & Design' },
        { pattern: /music|piano|guitar|singing/i, subject: 'Music' },
        { pattern: /cooking|recipe|culinary/i, subject: 'Cooking' },
        { pattern: /fitness|exercise|workout|health/i, subject: 'Health & Fitness' }
      ]
      
      for (const { pattern, subject } of subjectPatterns) {
        if (pattern.test(message)) {
          extractedSubject = subject
          break
        }
      }
      
      // If we extracted a meaningful subject, it's likely a new subject request
      const isLearningMessage = /\b(learn|study|teach me|explain|help me|about|course|tutorial|training)\b/i.test(message)
      const hasSpecificSubject = extractedSubject !== 'General Study'
      
      const fallbackResult = {
        subjectName: extractedSubject,
        isNewSubject: !currentSubject || isLearningMessage || hasSpecificSubject,
        confidence: hasSpecificSubject ? 0.8 : 0.5
      }
      
      console.log('🎯 Fallback subject analysis:', {
        message: message.substring(0, 50) + '...',
        extractedSubject,
        isNewSubject: fallbackResult.isNewSubject,
        confidence: fallbackResult.confidence
      })
      
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
    if (subject.lessonPlan) {
      const lessonPlanData = {
        subject: subject.name,
        lessons: subject.lessonPlan.lessons.map(lesson => ({
          ...lesson,
          completed: false
        })),
        currentLessonIndex: subject.lessonPlan.currentLessonIndex
      }
      
      persistenceService.saveSubject({
        id: subject.id,
        user_id: user?.id || '',
        name: subject.name,
        keywords: subject.topicKeywords,
        lesson_plan: lessonPlanData,
        learning_progress: {
          correctAnswers: subject.learningProgress?.correctAnswers || 0,
          totalAttempts: subject.learningProgress?.totalAttempts || 0,
          needsReview: subject.learningProgress?.needsReview || false,
          readyForNext: subject.learningProgress?.readyForNext || false,
          currentLessonIndex: subject.learningProgress?.currentLessonIndex,
          totalLessons: subject.learningProgress?.totalLessons
        },
        last_active: new Date().toISOString()
      }).catch(console.error)
    } else {
      persistenceService.saveSubject({
        id: subject.id,
        user_id: user?.id || '',
        name: subject.name,
        keywords: subject.topicKeywords,
        last_active: new Date().toISOString()
      }).catch(console.error)
    }
  }, [user?.id])

  // Delete subject functionality
  const deleteSubject = useCallback(async (subjectId: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot delete subject: no user logged in')
      return false
    }

    try {
      logger.debug('🗑️ Deleting subject:', subjectId)
      
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
      
      logger.debug('✅ Subject deleted successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to delete subject:', error)
      return false
    }
  }, [user, currentSubject?.id])

  // Auto-load subjects when user becomes available - moved to useEffect to prevent infinite loops
  useEffect(() => {
    if (user && subjects.length === 0 && !isLoading) {
      logger.debug('🔄 Auto-loading subjects for user:', user.id)
      loadSubjects()
    }
  }, [user, subjects.length, isLoading, loadSubjects])

  // Separate effect to handle initial load - only when user first becomes available  
  const hasTriedLoadingRef = useRef(false)
  useEffect(() => {
    if (user && !hasTriedLoadingRef.current) {
      hasTriedLoadingRef.current = true
      logger.debug('🚀 Initial subject load for user:', user.id)
      loadSubjects()
    }
  }, [user, loadSubjects])

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
