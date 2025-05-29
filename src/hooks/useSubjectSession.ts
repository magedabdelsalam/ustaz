import { useState, useCallback } from 'react'
import { Subject } from './useSubjects'
import { persistenceService } from '@/lib/persistenceService'
import { aiTutor, LessonPlan, LearningProgress } from '@/lib/aiService'
import { Message } from '@/types/chat'

interface UseSubjectSessionProps {
  user?: { id: string } | null
  selectedSubject: Subject | null
  onMessagesLoaded?: (messages: Message[]) => void
  onLessonPlanLoaded?: (plan: LessonPlan | null, progress: LearningProgress | null) => void
}

export function useSubjectSession({ 
  user, 
  selectedSubject,
  onMessagesLoaded,
  onLessonPlanLoaded
}: UseSubjectSessionProps) {
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const loadSubjectSession = useCallback(async () => {
    if (!selectedSubject || !user) {
      // Clear session when no subject
      if (onMessagesLoaded) onMessagesLoaded([])
      if (onLessonPlanLoaded) onLessonPlanLoaded(null, null)
      return
    }

    console.log('🔄 Loading subject session:', selectedSubject.name)
    console.log('🆔 User:', { id: user.id })
    console.log('🎯 Subject:', { id: selectedSubject.id, name: selectedSubject.name })

    try {
      // Load messages from persistence
      setIsLoadingMessages(true)
      const persistedMessages = await persistenceService.getMessagesBySubject(user.id, selectedSubject.id)
      console.log('📥 Loaded messages from DB:', persistedMessages.length)
      
      const loadedMessages: Message[] = persistedMessages.map(pm => ({
        id: pm.id,
        role: pm.role,
        content: pm.content,
        timestamp: new Date(pm.timestamp),
        hasGeneratedContent: pm.has_generated_content
      }))
      
      if (onMessagesLoaded) {
        onMessagesLoaded(loadedMessages)
      }

      // Handle lesson plan and progress
      const existingPlan = aiTutor.getLessonPlan(selectedSubject.name)
      const existingProgress = aiTutor.getProgress(selectedSubject.name)
      
      console.log('📋 Existing lesson plan found:', !!existingPlan)
      console.log('📊 Existing progress found:', !!existingProgress)
      
      if (existingPlan) {
        console.log('📚 Using existing lesson plan for:', selectedSubject.name)
        if (onLessonPlanLoaded) {
          onLessonPlanLoaded(existingPlan, existingProgress)
        }
      } else if (selectedSubject.lessonPlan && selectedSubject.learningProgress) {
        console.log('📚 Found persisted lesson plan data, restoring from database...')
        
        // Restore lesson plan and progress from database
        const restoredPlan: LessonPlan = {
          subject: selectedSubject.name,
          currentLessonIndex: selectedSubject.lessonPlan.currentLessonIndex || 0,
          lessons: (selectedSubject.lessonPlan.lessons || []).map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            completed: false,
            content: { type: 'concept-card', data: {} }
          }))
        }
        const restoredProgress = {
          correctAnswers: selectedSubject.learningProgress.correctAnswers || 0,
          totalAttempts: selectedSubject.learningProgress.totalAttempts || 0,
          needsReview: selectedSubject.learningProgress.needsReview || false,
          readyForNext: selectedSubject.learningProgress.readyForNext || false
        }
        
        console.log('✅ Restored lesson plan:', restoredPlan.lessons?.length, 'lessons')
        console.log('✅ Restored progress:', restoredProgress.correctAnswers, '/', restoredProgress.totalAttempts, 'correct')
        
        // Load into AI service cache
        aiTutor.loadLessonPlan(selectedSubject.name, restoredPlan)
        aiTutor.loadProgress(selectedSubject.name, restoredProgress)
        
        if (onLessonPlanLoaded) {
          onLessonPlanLoaded(restoredPlan, restoredProgress)
        }
        
        // Check if we already have a welcome message for this session
        const hasWelcomeMessage = loadedMessages.some(msg => 
          msg.role === 'assistant' && 
          (msg.content.toLowerCase().includes('welcome back') ||
           msg.content.toLowerCase().includes('welcome to') ||
           msg.id.startsWith('welcome-back-') ||
           msg.id.startsWith('fallback-welcome-'))
        )
        
        // Show welcome back message only if we don't already have one
        if (!hasWelcomeMessage) {
          try {
            // Generate intelligent welcome message using AI
            const aiWelcomeContent = await aiTutor.generateWelcomeMessage(
              selectedSubject.name,
              {
                title: restoredPlan.lessons[restoredPlan.currentLessonIndex]?.title || 'Current Lesson',
                index: restoredPlan.currentLessonIndex
              },
              {
                correctAnswers: restoredProgress.correctAnswers,
                totalAttempts: restoredProgress.totalAttempts
              },
              true // isReturningUser
            )
            
            const welcomeBackMessage: Message = {
              id: `welcome-back-${Date.now()}`,
              role: 'assistant',
              content: aiWelcomeContent,
              timestamp: new Date()
            }
            
            // Add to loaded messages
            const messagesWithWelcome = [...loadedMessages, welcomeBackMessage]
            if (onMessagesLoaded) {
              onMessagesLoaded(messagesWithWelcome)
            }
            
            // Save welcome message asynchronously
            setTimeout(async () => {
              try {
                await persistenceService.saveMessage({
                  id: welcomeBackMessage.id,
                  user_id: user.id,
                  subject_id: selectedSubject.id,
                  role: welcomeBackMessage.role,
                  content: welcomeBackMessage.content,
                  timestamp: welcomeBackMessage.timestamp.toISOString(),
                  has_generated_content: true // Mark as AI-generated content
                })
              } catch (error) {
                console.error('Failed to save AI welcome message:', error)
              }
            }, 0)
          } catch (error) {
            console.error('Failed to generate AI welcome message:', error)
            // Fallback to simple message if AI generation fails
            const fallbackMessage: Message = {
              id: `fallback-welcome-${Date.now()}`,
              role: 'assistant',
              content: `Welcome back to ${selectedSubject.name}! Ready to continue learning? 🌟`,
              timestamp: new Date()
            }
            
            const messagesWithFallback = [...loadedMessages, fallbackMessage]
            if (onMessagesLoaded) {
              onMessagesLoaded(messagesWithFallback)
            }
          }
        }
      } else {
        console.log('🆕 No existing lesson plan or persisted data')
        if (onLessonPlanLoaded) {
          onLessonPlanLoaded(null, null)
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to load subject session:', error)
      if (onMessagesLoaded) onMessagesLoaded([])
      if (onLessonPlanLoaded) onLessonPlanLoaded(null, null)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [user, selectedSubject, onMessagesLoaded, onLessonPlanLoaded])

  return {
    loadSubjectSession,
    isLoadingMessages
  }
} 