'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Send, Bot, User, MessageCircle, Sparkles, RefreshCw } from 'lucide-react'
import { Subject } from '@/hooks/useSubjects'
import { useAuth } from '@/hooks/useAuth'
import { usePendingMessages } from '@/hooks/usePendingMessages'
import { useSubjectSession } from '@/hooks/useSubjectSession'
import { persistenceService } from '@/lib/persistenceService'
import { aiTutor, LessonPlan, LearningProgress, Lesson } from '@/lib/aiService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  hasGeneratedContent?: boolean
}

interface ChatPaneProps {
  selectedSubject: Subject | null
  onNewMessage?: (message: string, isUserMessage?: boolean) => void
}

export interface ChatPaneRef {
  handleContentInteraction: (action: string, data: unknown) => void
}

export const ChatPane = forwardRef<ChatPaneRef, ChatPaneProps>(({ selectedSubject, onNewMessage }, ref) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentLessonPlan, setCurrentLessonPlan] = useState<LessonPlan | null>(null)
  const [currentProgress, setCurrentProgress] = useState<LearningProgress | null>(null)
  const [pendingMessages, setPendingMessages] = useState<Message[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lessonPlanCreationAttempted = useRef<string | null>(null)

  // Custom hooks for better separation of concerns
  const { scheduleRetry, clearRetry } = usePendingMessages({
    user,
    selectedSubject,
    onRetrySuccess: (savedMessages) => {
      setPendingMessages(prev => prev.filter(msg => !savedMessages.some(saved => saved.id === msg.id)))
    }
  })

  const { loadSubjectSession, isLoadingMessages } = useSubjectSession({
    user,
    selectedSubject,
    onMessagesLoaded: (loadedMessages) => {
      setMessages(loadedMessages)
    },
    onLessonPlanLoaded: (plan, progress) => {
      setCurrentLessonPlan(plan)
      setCurrentProgress(progress)
    }
  })

  // Load subject session when subject or user changes
  useEffect(() => {
    if (selectedSubject && user) {
      loadSubjectSession()
      
      // Handle pending messages if any
      if (pendingMessages.length > 0) {
        console.log(`💾 Scheduling retry for ${pendingMessages.length} pending messages`)
      setTimeout(() => {
          scheduleRetry(pendingMessages)
        }, 2000) // Wait 2 seconds to ensure subject is in database
      }
      } else {
      // Clear state when no subject is selected
      setMessages([])
      setCurrentLessonPlan(null)
      setCurrentProgress(null)
      lessonPlanCreationAttempted.current = null
      clearRetry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject?.id, user?.id])

  // Schedule retry when pending messages change
  useEffect(() => {
    if (pendingMessages.length > 0 && selectedSubject && user) {
      scheduleRetry(pendingMessages)
    }
    return clearRetry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessages.length, selectedSubject?.id, user?.id])

  // Auto-scroll to bottom when new messages arrive (legitimate useEffect)
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Message persistence functions
  const saveMessageToPersistence = useCallback(async (message: Message) => {
    if (!user || !selectedSubject) {
      console.log('❌ Cannot save message: missing user or subject', { user: !!user, selectedSubject: !!selectedSubject })
      return
    }
    
    console.log('💾 Saving message to persistence:', message.content.substring(0, 50) + '...')
    
          try {
            await persistenceService.saveMessage({
              id: message.id,
              user_id: user.id,
              subject_id: selectedSubject.id,
              role: message.role,
              content: message.content,
              timestamp: message.timestamp.toISOString(),
              has_generated_content: message.hasGeneratedContent || false
            })
      console.log('✅ Message saved successfully')
    } catch (error: unknown) {
      // Handle foreign key constraint violations (subject doesn't exist yet)
      let errorCode: string | null = null
      let errorMessage: string | null = null
      
      if (error && typeof error === 'object' && 'code' in error) {
        errorCode = typeof (error as { code: unknown }).code === 'string' ? (error as { code: string }).code : null
      }
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = typeof (error as { message: unknown }).message === 'string' ? (error as { message: string }).message : null
      }
      
      if (errorCode === '23503' || errorMessage?.includes('violates foreign key constraint')) {
        console.log('⏳ Subject not ready yet, adding message to pending queue')
        setPendingMessages(prev => [...prev, message])
      } else {
        console.error('❌ Failed to save message:', error)
      }
    }
  }, [user, selectedSubject])

  const createLessonPlan = useCallback(async (subjectName: string, targetSubject?: Subject) => {
    setIsTyping(true)
    try {
      console.log('📋 Creating lesson plan for:', subjectName)
      
      // Use the provided subject or fall back to selectedSubject
      const subjectForPlan = targetSubject || selectedSubject
      console.log('🎯 Subject for lesson plan:', { provided: targetSubject?.name, selected: selectedSubject?.name, final: subjectForPlan?.name })
      
      const lessonPlan = await aiTutor.createLearningPlan(subjectName)
      const progress = aiTutor.getProgress(subjectName)

      setCurrentLessonPlan(lessonPlan)
      setCurrentProgress(progress)

      // Also save to database (if user and subject are available)
      if (user && subjectForPlan && progress) {
        try {
          const updatedSubject: Subject = {
            ...subjectForPlan,
            lessonPlan,
            learningProgress: {
              correctAnswers: progress.correctAnswers,
              totalAttempts: progress.totalAttempts,
              needsReview: progress.needsReview || false,
              readyForNext: progress.readyForNext || false
            },
            lastActive: new Date()
          }

          await persistenceService.saveSubject({
            id: subjectForPlan.id,
            user_id: user.id,
            name: subjectForPlan.name,
            keywords: subjectForPlan.topicKeywords || [],
            lesson_plan: {
              subject: subjectName,
              lessons: lessonPlan.lessons.map((lesson: Lesson) => ({
                ...lesson,
                completed: false
              })),
              currentLessonIndex: lessonPlan.currentLessonIndex
            },
            learning_progress: {
              correctAnswers: progress.correctAnswers,
              totalAttempts: progress.totalAttempts,
              needsReview: progress.needsReview || false,
              readyForNext: progress.readyForNext || false
            },
            last_active: updatedSubject.lastActive.toISOString()
          })
          
          console.log('✅ Lesson plan and progress saved to database')
        } catch (error) {
          console.error('❌ Failed to save lesson plan to database:', error)
        }
      }

      const planMessage = `Great! I've created a learning plan for ${subjectName}:\n\n` +
        lessonPlan.lessons.map((lesson: Lesson, i: number) => `${i + 1}. ${lesson.title}`).join('\n') +
        `\n\nLet's start with lesson 1: "${lessonPlan.lessons[0].title}"`

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
              role: 'assistant',
        content: planMessage,
        timestamp: new Date(),
        hasGeneratedContent: true
      }
      setMessages(prev => [...prev, aiResponse])
      
      // Save AI response (should have subject by now, but handle pending just in case)
      if (subjectForPlan) {
        await saveMessageToPersistence(aiResponse)
          } else {
        console.log('⏳ Adding AI response to pending queue')
        setPendingMessages(prev => [...prev, aiResponse])
      }

      // Generate content for first lesson - pass the correct subject ID
      await generateLessonContent(lessonPlan, progress, subjectName, subjectForPlan?.id)
    } catch (error) {
      console.error('Error creating lesson plan:', error)
      setIsTyping(false)
    }
  }, [selectedSubject, user, saveMessageToPersistence]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if lesson plan creation should be triggered (moved from useEffect to direct logic)
  const checkAndCreateLessonPlan = useCallback(async () => {
      if (selectedSubject && !currentLessonPlan && 
          lessonPlanCreationAttempted.current !== selectedSubject.name) {
        
        // Check if we have recent user messages (not just loaded from persistence)
        const recentUserMessages = messages.filter(m => 
          m.role === 'user' && 
          Date.now() - m.timestamp.getTime() < 60000 // Within last minute
        )
        
        if (recentUserMessages.length > 0) {
          console.log('🆕 Creating lesson plan for new subject:', selectedSubject.name)
          lessonPlanCreationAttempted.current = selectedSubject.name
          await createLessonPlan(selectedSubject.name, selectedSubject)
      }
    }
  }, [selectedSubject, currentLessonPlan, createLessonPlan, messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    console.log('📝 User sent message:', inputValue.substring(0, 50) + '...')

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsTyping(true)

    // Emit event for Dashboard to track this message
    const userMessageEvent = new CustomEvent('userMessageSent', {
      detail: {
        messageId: userMessage.id,
        content: currentInput
      }
    })
    window.dispatchEvent(userMessageEvent)

    // Save user message to persistence - or add to pending if no subject yet
    if (selectedSubject) {
      await saveMessageToPersistence(userMessage)
    } else {
      console.log('⏳ Adding message to pending queue (no subject yet)')
      setPendingMessages(prev => [...prev, userMessage])
    }

    // Notify about new user message for subject detection
    if (onNewMessage) {
      console.log('🔄 Calling onNewMessage for subject detection')
      await onNewMessage(currentInput, true)
    }

    try {
      if (selectedSubject) {
        // Check if we need to create a lesson plan
        if (!currentLessonPlan) {
          await createLessonPlan(selectedSubject.name, selectedSubject)
        } else {
          // We have a lesson plan, generate content for current lesson
          await generateCurrentLessonContent()
        }
      } else {
        // No subject selected yet - show temporary message while subject is being created
        setTimeout(() => {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Perfect! Let me create a learning plan for you.`,
            timestamp: new Date(),
            hasGeneratedContent: false
          }
          setMessages(prev => [...prev, aiResponse])
          setIsTyping(false)
        }, 1000)
      }
    } catch (error) {
      console.error('Error handling message:', error)
      setIsTyping(false)
    }

    // Check if lesson plan creation is needed after message handling
    setTimeout(() => {
      checkAndCreateLessonPlan()
    }, 500)
  }

  const generateLessonContent = async (lessonPlan: LessonPlan, progress: LearningProgress | null, subjectName: string, subjectId?: string, userAction?: string) => {
    try {
      const currentLesson = lessonPlan.lessons[lessonPlan.currentLessonIndex]
      console.log('📖 Generating content for lesson:', currentLesson.title)
      
      // Show content variety stats for debugging
      const varietyStats = aiTutor.getContentVarietyStats(subjectName, currentLesson.id)
      console.log('📊 Content variety for this lesson:', varietyStats)
      
      // Determine content type based on user action and progress
      let contentType: 'quiz' | 'explanation' | 'practice' | 'fill-blank' = 'explanation'
      
      if (userAction === 'practice') {
        // User specifically wants to practice - prioritize interactive components
        const practiceTypes = ['quiz', 'fill-blank', 'practice'] as const
        contentType = practiceTypes[Math.floor(Math.random() * practiceTypes.length)]
        console.log('🎯 User wants practice, selected:', contentType)
      } else if (userAction === 'next_question') {
        // User wants another multiple choice question
        contentType = 'quiz'
        console.log('🎯 User wants next question, selected:', contentType)
      } else if (userAction === 'next_exercise') {
        // User wants another fill-in-the-blank exercise
        contentType = 'fill-blank'
        console.log('🎯 User wants next exercise, selected:', contentType)
      } else if (userAction === 'next_problem') {
        // User wants another step-by-step problem
        contentType = 'practice'
        console.log('🎯 User wants next problem, selected:', contentType)
      } else if (userAction === 'examples_requested') {
        // User wants more examples - give them explanations with examples
        contentType = 'explanation'
        console.log('🎯 User wants examples, selected:', contentType)
      } else if (userAction === 'concept_expanded') {
        // User wants deeper explanation - give them explanations
        contentType = 'explanation'
        console.log('🎯 User wants deeper explanation, selected:', contentType)
      } else {
        // Default behavior based on progress
        if (progress && progress.totalAttempts === 0) {
          contentType = 'explanation' // Start with explanation
        } else if (progress && progress.totalAttempts >= 1) {
          // Mix of practice and explanation after first attempt
          const contentTypes = ['quiz', 'fill-blank', 'practice', 'explanation'] as const
          contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)]
        }
        console.log('🎯 Default behavior, selected:', contentType)
      }

      const lessonContent = await aiTutor.generateLessonContent(
        subjectName,
        currentLesson,
        contentType
      )
      
      console.log('✅ Generated lesson content:', lessonContent)

      // Use the provided subjectId or fall back to selectedSubject
      const targetSubjectId = subjectId || selectedSubject?.id
      console.log('🎯 Using subject ID for content:', { provided: subjectId, selected: selectedSubject?.id, final: targetSubjectId })

      // Send the interactive content to ContentPane via custom event
      const contentData = {
        id: `lesson-${currentLesson.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: lessonContent.type,
        data: lessonContent.data,
        title: currentLesson.title,
        subjectId: targetSubjectId
      }
      console.log('📤 Dispatching content event:', contentData)
      
      // Dispatch custom event for ContentPane to listen to
      const event = new CustomEvent('contentGenerated', { detail: contentData })
      window.dispatchEvent(event)

      setIsTyping(false)
    } catch (error) {
      console.error('❌ Error generating lesson content:', error)
      setIsTyping(false)
    }
  }

  const generateCurrentLessonContent = async (userAction?: string) => {
    if (!currentLessonPlan || !selectedSubject) {
      console.log('❌ Cannot generate content: missing lesson plan or subject')
      return
    }

    await generateLessonContent(currentLessonPlan, currentProgress, selectedSubject.name, selectedSubject.id, userAction)
  }

  const handleNextInteractiveContent = async (action: string, lessonPlan: LessonPlan, progress: LearningProgress | null) => {
    console.log('🎯 Handling next content with lesson progression:', { action, progress })
    console.log('📚 Current lesson plan state:', {
      currentLessonIndex: lessonPlan.currentLessonIndex,
      totalLessons: lessonPlan.lessons.length,
      currentLessonTitle: lessonPlan.lessons[lessonPlan.currentLessonIndex]?.title
    })
    
    // Check if student has mastered current lesson
    const isReadyToAdvance = progress && progress.readyForNext
    const needsMorePractice = progress && progress.needsReview
    
    console.log('🎯 Progression check:', { 
      isReadyToAdvance, 
      needsMorePractice, 
      progress: {
        correctAnswers: progress?.correctAnswers,
        totalAttempts: progress?.totalAttempts,
        accuracy: progress ? Math.round((progress.correctAnswers / progress.totalAttempts) * 100) : 0,
        readyForNext: progress?.readyForNext,
        needsReview: progress?.needsReview
      }
    })
    
    // Double-check by getting fresh progress from service
    const freshProgress = aiTutor.getProgress(selectedSubject!.name)
    console.log('🔄 Fresh progress from service:', freshProgress)
    console.log('📊 Progress comparison:', {
      uiProgress: progress,
      serviceProgress: freshProgress,
      areSame: JSON.stringify(progress) === JSON.stringify(freshProgress)
    })
    
    if (isReadyToAdvance) {
      console.log('🚀 Student is ready to advance! Attempting to move to next lesson...')
      
      // Try to advance to next lesson
      const advanced = aiTutor.advanceToNextLesson(selectedSubject!.name)
      console.log('📈 Advancement result:', advanced)
      
      if (advanced) {
        // Successfully moved to next lesson
        console.log('✅ Successfully advanced to next lesson!')
        const newPlan = aiTutor.getLessonPlan(selectedSubject!.name)
        const newProgress = aiTutor.getProgress(selectedSubject!.name)
        
        console.log('📚 New lesson plan state:', {
          currentLessonIndex: newPlan?.currentLessonIndex,
          totalLessons: newPlan?.lessons.length,
          currentLessonTitle: newPlan?.lessons[newPlan?.currentLessonIndex || 0]?.title
        })
        
        setCurrentLessonPlan(newPlan)
        setCurrentProgress(newProgress)
        
        // Save lesson advancement to database
        if (selectedSubject && user && newPlan && newProgress) {
          setTimeout(async () => {
            try {
              await persistenceService.saveSubject({
                id: selectedSubject.id,
                user_id: user.id,
                name: selectedSubject.name,
                keywords: selectedSubject.topicKeywords || [],
                lesson_plan: newPlan,
                learning_progress: {
                  correctAnswers: newProgress.correctAnswers,
                  totalAttempts: newProgress.totalAttempts,
                  needsReview: newProgress.needsReview,
                  readyForNext: newProgress.readyForNext,
                  currentLessonIndex: newPlan.currentLessonIndex,
                  totalLessons: newPlan.lessons.length
                },
                last_active: new Date().toISOString()
              })
              console.log('💾 Lesson advancement saved to database - now on lesson:', newPlan.currentLessonIndex + 1)
            } catch (error) {
              console.error('❌ Failed to save lesson advancement to database:', error)
            }
          }, 0)
        }
        
        const nextLesson = newPlan!.lessons[newPlan!.currentLessonIndex]
        const nextLessonMessage: Message = {
          id: `next-lesson-${Date.now()}`,
          role: 'assistant',
          content: `🎉 Excellent progress! You've mastered the previous lesson. Let's move on to lesson ${newPlan!.currentLessonIndex + 1}: "${nextLesson.title}"`,
          timestamp: new Date(),
          hasGeneratedContent: true
        }
        setMessages(prev => [...prev, nextLessonMessage])
        await saveMessageToPersistence(nextLessonMessage)
        
        // Generate content for the new lesson
        console.log('🎨 Generating content for new lesson...')
        await generateCurrentLessonContent()
      } else {
        // Course completed
        console.log('🏁 Course completed!')
        const completionMessage: Message = {
          id: `completion-${Date.now()}`,
          role: 'assistant',
          content: `🎉 Congratulations! You've completed the entire ${selectedSubject!.name} course! You've mastered all the lessons. What would you like to learn next?`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, completionMessage])
        await saveMessageToPersistence(completionMessage)
      }
    } else if (needsMorePractice) {
      console.log('📚 Student needs more practice in current lesson')
      // Student needs more practice in current lesson
      const practiceMessage: Message = {
        id: `practice-${Date.now()}`,
        role: 'assistant',
        content: `Let's get some more practice with this concept to strengthen your understanding:`,
        timestamp: new Date(),
        hasGeneratedContent: true
      }
      setMessages(prev => [...prev, practiceMessage])
      await saveMessageToPersistence(practiceMessage)
      
      // Generate more content for current lesson
      const contentType = action === 'next_question' ? 'next_question' : 
                         action === 'next_exercise' ? 'next_exercise' : 'next_problem'
      await generateCurrentLessonContent(contentType)
    } else {
      console.log('📈 Student is making progress but not ready to advance yet')
      // Student is making progress but not ready to advance yet
      const encouragementMessage: Message = {
        id: `encourage-${Date.now()}`,
        role: 'assistant',
        content: `Great work! Let's continue practicing to build your confidence:`,
        timestamp: new Date(),
        hasGeneratedContent: true
      }
      setMessages(prev => [...prev, encouragementMessage])
      await saveMessageToPersistence(encouragementMessage)
      
      // Generate more content for current lesson
      const contentType = action === 'next_question' ? 'next_question' : 
                         action === 'next_exercise' ? 'next_exercise' : 'next_problem'
      await generateCurrentLessonContent(contentType)
    }
  }

  const handleContentInteraction = async (action: string, data: unknown) => {
    console.log('🚨 =========================')
    console.log('🚨 HANDLE CONTENT INTERACTION CALLED!')
    console.log('🚨 Action:', action)
    console.log('🚨 Data:', data)
    console.log('🚨 =========================')
    
    // Type guard for interaction data with proper typing
    interface InteractionData {
      quiz?: unknown
      concept?: string
      componentId?: string
      category?: string
      difficulty?: string
      problemType?: string
    }
    
    const interactionData = data as InteractionData | null
    
    // Check if we need to create a lesson plan first
    if (!currentLessonPlan && selectedSubject) {
      console.log('🆕 No lesson plan exists for content interaction, creating one first...')
      lessonPlanCreationAttempted.current = selectedSubject.name
      await createLessonPlan(selectedSubject.name, selectedSubject)
      // The createLessonPlan function will also generate initial content
      return
    }
    
    if (action === 'show_quiz' && interactionData?.quiz) {
      // Handle quiz interaction
      console.log('🎯 Handling quiz interaction:', interactionData.quiz)
      // Implementation of handling quiz interaction
      } else if (action === 'concept_expanded' || action === 'examples_requested' || action === 'help_requested') {
        // For concept interactions, provide deeper explanation and generate new content
        console.log('🎯 Handling concept interaction:', action, data)
      
      // Type guard for data with concept property
      const conceptData = data as { concept?: string } | null
      const conceptName = conceptData?.concept || currentLessonPlan?.lessons[currentLessonPlan?.currentLessonIndex]?.title || 'this topic'
        
        let responseMessage = ''
        let contentAction = ''
        
        if (action === 'concept_expanded') {
        responseMessage = `Let me provide a deeper explanation of "${conceptName}".`
          contentAction = 'concept_expanded'
        } else if (action === 'examples_requested') {
        responseMessage = `Here are more examples for "${conceptName}".`
          contentAction = 'examples_requested'
        } else {
        responseMessage = `Let me help you understand "${conceptName}" better.`
          contentAction = 'concept_expanded'
        }
        
        const explanationMessage: Message = {
          id: `explanation-${Date.now()}`,
          role: 'assistant',
          content: responseMessage,
          timestamp: new Date(),
          hasGeneratedContent: true
        }
        setMessages(prev => [...prev, explanationMessage])
        await saveMessageToPersistence(explanationMessage)
        
        // Generate new interactive content based on the specific action
        await generateCurrentLessonContent(contentAction)
      } else if (action === 'ready_for_next') {
        // Student indicates they're ready to move forward (Practice This button)
        const readyMessage: Message = {
          id: `ready-${Date.now()}`,
          role: 'assistant',
        content: `Great! Let's practice "${currentLessonPlan?.lessons[currentLessonPlan?.currentLessonIndex]?.title}" with some hands-on exercises:`,
          timestamp: new Date(),
          hasGeneratedContent: true
        }
        setMessages(prev => [...prev, readyMessage])
        await saveMessageToPersistence(readyMessage)
        
        // Generate practice content specifically
        await generateCurrentLessonContent('practice')
      } else if (action === 'next_exercise' || action === 'next_question' || action === 'next_problem') {
        // Handle all "Next" button interactions with proper lesson progression
        console.log('🎯 Next button clicked - calling handleNextInteractiveContent with:', {
          action,
        hasLessonPlan: !!currentLessonPlan,
        hasProgress: !!currentProgress,
        progressDetails: currentProgress ? {
          correctAnswers: currentProgress.correctAnswers,
          totalAttempts: currentProgress.totalAttempts,
          readyForNext: currentProgress.readyForNext,
          needsReview: currentProgress.needsReview
          } : null
        })
        
        // Track this as a new learning attempt when user requests more content
        // This ensures their engagement is counted towards advancement
        console.log('📊 Tracking new content request as learning engagement...')
      const currentLesson = currentLessonPlan?.lessons[currentLessonPlan?.currentLessonIndex]
      const updatedProgress = aiTutor.updateProgress(selectedSubject!.name, true, currentLesson?.id) // Count as engagement/correct attempt
        setCurrentProgress(updatedProgress)
        console.log('✅ Progress updated for new content request:', updatedProgress)

        // Dispatch progress update event to Dashboard
        const progressEvent = new CustomEvent('progressUpdated', {
          detail: {
          subjectId: selectedSubject?.id,
            learningProgress: {
              ...updatedProgress,
              currentLessonIndex: currentLessonPlan?.currentLessonIndex || 0,
              totalLessons: currentLessonPlan?.lessons.length || 0
            }
          }
        })
        window.dispatchEvent(progressEvent)
        console.log('📡 Dispatched progress update event for content request')
        
      await handleNextInteractiveContent(action, currentLessonPlan!, updatedProgress)
      } else {
        // Handle other interactions with brief response but focus on action
        console.log('🤔 Unknown action received:', action, '- Not handled as advancement trigger')
        console.log('📝 Full interaction data:', data)
        
      // Only call generateTutorResponse if we have valid lesson and progress data
      if (currentLessonPlan && currentProgress) {
        const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
        if (currentLesson) {
        const response = await aiTutor.generateTutorResponse(
            selectedSubject!.name,
          action,
          data,
            { lesson: currentLesson, progress: currentProgress }
        )

        const interactionResponse: Message = {
          id: `interaction-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, interactionResponse])
      }
      } else {
        // Fallback response when lesson plan or progress is not available
      const fallbackResponse: Message = {
        id: `fallback-${Date.now()}`,
        role: 'assistant',
          content: "I'm still setting up your learning plan. Please try again in a moment!",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, fallbackResponse])
      }
    }
  }

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleContentInteraction
  }))

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Listen for new subject creation events from Dashboard
  useEffect(() => {
    const handleNewSubject = (event: Event) => {
      const customEvent = event as CustomEvent
      const { subject } = customEvent.detail
      console.log('🆕 ChatPane received new subject event:', subject.name)
      
      // Create lesson plan immediately with the new subject context
      if (!currentLessonPlan || currentLessonPlan.subject !== subject.name) {
        console.log('📚 Creating lesson plan for newly created subject:', subject.name)
        createLessonPlan(subject.name, subject)
      }
    }

    window.addEventListener('newSubjectCreated', handleNewSubject)
    return () => {
      window.removeEventListener('newSubjectCreated', handleNewSubject)
    }
  }, [createLessonPlan, currentLessonPlan])

  if (!selectedSubject) {
    return (
      <div className="flex flex-col h-full">
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI Tutor Ready</h3>
            <p className="text-gray-600 mb-4">
              Start learning with your personal AI tutor. I&apos;ll create interactive content based on what you want to learn.
            </p>
          </div>
        </div>

        {/* Input - Always show so users can start conversations */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="What would you like to learn? (e.g., &apos;Explain photosynthesis&apos;, &apos;Quiz me on Shakespeare&apos;, &apos;Teach me Spanish&apos;)"
              disabled={isTyping}
              className="flex-1 text-sm"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isTyping ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">
            Try: &quot;Explain concepts&quot;, &quot;Give me a quiz&quot;, &quot;Help me understand&quot;, &quot;Teach me step-by-step&quot;
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-6 overflow-y-auto" ref={scrollAreaRef}>
        <div className="space-y-4">
          {isLoadingMessages && (
            <div className="flex justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading conversation...</p>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                } rounded-lg p-3`}
              >
                <div className="flex items-start space-x-2">
                  {message.role === 'assistant' && (
                    <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.hasGeneratedContent && (
                      <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-opacity-20">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-xs opacity-75">Interactive content created</span>
                      </div>
                    )}
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 flex-shrink-0" />
                  <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                  <span className="text-xs text-gray-500">Generating response...</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Progress indicators in chat area */}
          {currentLessonPlan && currentProgress && messages.length > 0 && (
            <div className="sticky bottom-0 bg-gradient-to-t from-white to-transparent p-2">
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  Lesson {currentLessonPlan.currentLessonIndex + 1}/{currentLessonPlan.lessons.length}
                </Badge>
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                  {currentProgress.correctAnswers}/{currentProgress.totalAttempts} correct
                </Badge>
                {currentProgress.readyForNext && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                    🎉 Ready to advance!
                  </Badge>
                )}
                {pendingMessages.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                    💾 {pendingMessages.length}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-6 pt-0">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Continue learning ${selectedSubject.name}...`}
            disabled={isTyping}
            className="flex-1 p-6 px-4 text-lg"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            size="lg"
            className="p-6 bg-blue-600 hover:bg-blue-700"
          >
            {isTyping ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
})

ChatPane.displayName = 'ChatPane' 