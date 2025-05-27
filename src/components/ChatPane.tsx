'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Send, Bot, User, MessageCircle, Sparkles } from 'lucide-react'
import { Subject } from '@/hooks/useSubjects'
import { useAuth } from '@/hooks/useAuth'
import { persistenceService } from '@/lib/persistenceService'
import { aiTutor, LessonPlan, LearningProgress } from '@/lib/aiService'

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
  handleContentInteraction: (action: string, data: any) => void
}

export const ChatPane = forwardRef<ChatPaneRef, ChatPaneProps>(({ selectedSubject, onNewMessage }, ref) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [currentLessonPlan, setCurrentLessonPlan] = useState<LessonPlan | null>(null)
  const [currentProgress, setCurrentProgress] = useState<LearningProgress | null>(null)
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]) // Messages waiting for subject
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lessonPlanCreationAttempted = useRef<string | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Message persistence functions
  const saveMessageToPersistence = async (message: Message) => {
    if (!user || !selectedSubject) {
      console.log('❌ Cannot save message: missing user or subject', { user: !!user, selectedSubject: !!selectedSubject })
      return
    }
    
    console.log('💾 Saving message to persistence:', message.content.substring(0, 50) + '...')
    console.log('🆔 User object for saving:', { id: user.id, email: user.email })
    console.log('🎯 Subject for saving:', { id: selectedSubject.id, name: selectedSubject.name })
    
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
    } catch (error: any) {
      // Handle foreign key constraint violations (subject doesn't exist yet)
      if (error?.code === '23503' || error?.message?.includes('violates foreign key constraint')) {
        console.log('⏳ Subject not ready yet, adding message to pending queue')
        setPendingMessages(prev => [...prev, message])
      } else {
        console.error('❌ Failed to save message:', error)
      }
    }
  }

  const loadMessagesFromPersistence = async () => {
    if (!user || !selectedSubject) {
      console.log('❌ Cannot load messages: missing user or subject', { user: !!user, selectedSubject: !!selectedSubject })
      return
    }

    console.log('📥 Loading messages from persistence for subject:', selectedSubject.name)
    console.log('🆔 User object for loading:', { id: user.id, email: user.email })
    console.log('🎯 Subject for loading:', { id: selectedSubject.id, name: selectedSubject.name })
    
    setIsLoadingMessages(true)
    try {
      const persistedMessages = await persistenceService.getMessagesBySubject(user.id, selectedSubject.id)
      console.log('📥 Loaded messages from DB:', persistedMessages.length)
      console.log('📋 Raw persisted messages:', persistedMessages)
      
      const loadedMessages: Message[] = persistedMessages.map(pm => ({
        id: pm.id,
        role: pm.role,
        content: pm.content,
        timestamp: new Date(pm.timestamp),
        hasGeneratedContent: pm.has_generated_content
      }))
      
      console.log('📋 Converted messages for UI:', loadedMessages)
      
      // Set loaded messages directly to prevent duplicates
      setMessages(loadedMessages)
      
      // Debug: Check if messages state was actually updated
      setTimeout(() => {
        console.log('🔍 Messages in state after loading:', messages.length)
      }, 100)
      
      // If we have messages, show a welcome back message
      if (loadedMessages.length > 0) {
        console.log(`💬 Loaded ${loadedMessages.length} messages for ${selectedSubject.name}`)
      } else {
        console.log('💬 No existing messages found for this subject')
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Retry pending messages periodically
  useEffect(() => {
    if (pendingMessages.length > 0 && selectedSubject && user) {
      console.log(`🔄 Setting up retry for ${pendingMessages.length} pending messages`)
      
      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      
      // Set up a retry after 3 seconds
      retryTimeoutRef.current = setTimeout(async () => {
        console.log('🔄 Retrying pending messages...')
        const messagesToRetry = [...pendingMessages]
        const savedMessages: Message[] = []
        
        for (const message of messagesToRetry) {
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
            savedMessages.push(message)
            console.log('✅ Retried message saved successfully:', message.id)
          } catch (error: any) {
            console.log('❌ Retry failed for message:', message.id, error)
            // Keep failed messages in pending queue
          }
        }
        
        // Remove successfully saved messages from pending queue
        if (savedMessages.length > 0) {
          setPendingMessages(prev => prev.filter(msg => !savedMessages.some(saved => saved.id === msg.id)))
          console.log(`✅ Successfully saved ${savedMessages.length} pending messages`)
        }
      }, 3000)
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [pendingMessages.length, selectedSubject?.id, user?.id])

  // Handle subject changes and lesson plan management
  useEffect(() => {
    console.log('🔄 ChatPane useEffect: subject/user changed')
    console.log('🎯 selectedSubject:', selectedSubject?.name || 'null')
    console.log('👤 user:', user?.id || 'null')
    console.log('📊 Current messages count before effect:', messages.length)
    
    if (selectedSubject && user) {
      console.log('✅ ChatPane: Both user and subject available, loading messages')
      
      // Debug: Show all cached subjects before switching
      const cachedSubjects = aiTutor.getCachedSubjects()
      console.log('🗂️ Currently cached subjects:', cachedSubjects)
      
      // Load messages from persistence first
      loadMessagesFromPersistence()
      
      // Save any pending messages now that we have a subject - but wait to ensure subject exists in DB
      if (pendingMessages.length > 0) {
        console.log(`💾 Saving ${pendingMessages.length} pending messages for ${selectedSubject.name}`)
        // Wait a bit longer to ensure subject is fully saved to database
        setTimeout(async () => {
          console.log('🔄 Attempting to save pending messages after delay...')
          for (const message of pendingMessages) {
            try {
              await saveMessageToPersistence(message)
            } catch (error) {
              console.error('❌ Failed to save pending message, will retry:', error)
              // If it fails, we'll keep it in pending and try again later
              return
            }
          }
          setPendingMessages([]) // Clear pending messages only if all succeeded
          console.log('✅ All pending messages saved successfully')
        }, 2000) // Wait 2 seconds to ensure subject is in database
      }
      
      // Check if we already have a lesson plan for this subject
      const existingPlan = aiTutor.getLessonPlan(selectedSubject.name)
      const existingProgress = aiTutor.getProgress(selectedSubject.name)
      
      console.log('📋 Existing lesson plan found:', !!existingPlan)
      console.log('📊 Existing progress found:', !!existingProgress)
      
      // Debug: Check what data is available in the selected subject
      console.log('🔍 DEBUG: selectedSubject data:', {
        id: selectedSubject?.id,
        name: selectedSubject?.name,
        hasLessonPlan: !!selectedSubject?.lessonPlan,
        hasLearningProgress: !!selectedSubject?.learningProgress,
        lessonPlanType: typeof selectedSubject?.lessonPlan,
        learningProgressType: typeof selectedSubject?.learningProgress,
        lessonPlanKeys: selectedSubject?.lessonPlan ? Object.keys(selectedSubject.lessonPlan) : 'none',
        learningProgressKeys: selectedSubject?.learningProgress ? Object.keys(selectedSubject.learningProgress) : 'none'
      })
      
      if (existingPlan) {
        console.log('📚 Using existing lesson plan for:', selectedSubject.name, '- Lessons:', existingPlan.lessons.length)
        setCurrentLessonPlan(existingPlan)
        setCurrentProgress(existingProgress)
      } else {
        console.log('🆕 No existing lesson plan for:', selectedSubject.name)
        
        // Check if the subject has persisted lesson plan data before creating new one
        if (selectedSubject.lessonPlan && selectedSubject.learningProgress) {
          console.log('📚 Found persisted lesson plan data, restoring from database...')
          
          // Restore lesson plan and progress from database
          const restoredPlan = {
            ...selectedSubject.lessonPlan,
            currentLessonIndex: selectedSubject.learningProgress.currentLessonIndex || 0
          }
          const restoredProgress = {
            correctAnswers: selectedSubject.learningProgress.correctAnswers || 0,
            totalAttempts: selectedSubject.learningProgress.totalAttempts || 0,
            needsReview: selectedSubject.learningProgress.needsReview || false,
            readyForNext: selectedSubject.learningProgress.readyForNext || false
          }
          
          console.log('✅ Restored lesson plan:', restoredPlan.lessons?.length, 'lessons, current lesson:', restoredPlan.currentLessonIndex + 1)
          console.log('✅ Restored progress:', restoredProgress.correctAnswers, '/', restoredProgress.totalAttempts, 'correct')
          
          // Load into AI service cache
          aiTutor.loadLessonPlan(selectedSubject.name, restoredPlan)
          aiTutor.loadProgress(selectedSubject.name, restoredProgress)
          
          setCurrentLessonPlan(restoredPlan)
          setCurrentProgress(restoredProgress)
          
          // Show welcome back message
          const welcomeBackMessage: Message = {
            id: `welcome-back-${Date.now()}`,
            role: 'assistant',
            content: `Welcome back to ${selectedSubject.name}! You're currently on lesson ${restoredPlan.currentLessonIndex + 1}: "${restoredPlan.lessons[restoredPlan.currentLessonIndex]?.title}". Your progress: ${restoredProgress.correctAnswers}/${restoredProgress.totalAttempts} correct answers. Let's continue!`,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, welcomeBackMessage])
          
          // Save message asynchronously without blocking
          setTimeout(async () => {
            await saveMessageToPersistence(welcomeBackMessage)
          }, 0)
        } else {
          console.log('🆕 No persisted data found, will create new lesson plan when user messages')
          console.log('🔍 DEBUG: Why no persisted data?', {
            hasLessonPlan: !!selectedSubject?.lessonPlan,
            hasLearningProgress: !!selectedSubject?.learningProgress,
            lessonPlanValue: selectedSubject?.lessonPlan,
            learningProgressValue: selectedSubject?.learningProgress
          })
          setCurrentLessonPlan(null)
          setCurrentProgress(null)
          lessonPlanCreationAttempted.current = null
        }
      }
    } else {
      console.log('❌ ChatPane: Missing user or subject, clearing state')
      console.log('   - selectedSubject:', selectedSubject?.name || 'MISSING')
      console.log('   - user:', user?.id || 'MISSING')
      // Clear state when no subject is selected
      setMessages([])
      setCurrentLessonPlan(null)
      setCurrentProgress(null)
      lessonPlanCreationAttempted.current = null
    }
  }, [selectedSubject?.id, user?.id])

  // Trigger lesson plan creation when a new subject is created
  useEffect(() => {
    const createLessonPlanForNewSubject = async () => {
      // Only create lesson plan for truly new subjects (not when loading existing ones)
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
          
          // Create lesson plan for the subject
          await createLessonPlan(selectedSubject.name)
        } else {
          console.log('📜 Subject has old messages, skipping lesson plan creation')
        }
      }
    }

    // Only run this after a small delay to ensure messages are loaded first
    const timer = setTimeout(createLessonPlanForNewSubject, 500)
    return () => clearTimeout(timer)
  }, [selectedSubject?.name, currentLessonPlan])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    console.log('📝 User sent message:', inputValue.substring(0, 50) + '...')
    console.log('🎯 Current selectedSubject:', selectedSubject?.name || 'NULL')
    console.log('👤 Current user:', user?.id || 'NULL')

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsTyping(true)

    // Save user message to persistence - or add to pending if no subject yet
    if (selectedSubject) {
      console.log('💾 Saving message immediately (subject exists)')
      // The saveMessageToPersistence function will handle foreign key constraint violations
      // and automatically add to pending queue if needed
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
          await createLessonPlan(selectedSubject.name)
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
  }

  const createLessonPlan = async (subjectName: string) => {
    try {
      console.log('📚 Creating lesson plan for subject:', subjectName)
      const lessonPlan = await aiTutor.createLearningPlan(subjectName)
      console.log('📋 Generated lesson plan:', lessonPlan)
      setCurrentLessonPlan(lessonPlan)
      
      const progress = aiTutor.getProgress(subjectName)
      setCurrentProgress(progress)

      // Save lesson plan and progress to database for persistence
      if (selectedSubject && user) {
        console.log('💾 Saving lesson plan and progress to database...')
        try {
          const updatedSubject = {
            ...selectedSubject,
            lessonPlan: lessonPlan,
            learningProgress: {
              ...progress,
              currentLessonIndex: lessonPlan.currentLessonIndex,
              totalLessons: lessonPlan.lessons.length
            },
            lastActive: new Date()
          }
          
          await persistenceService.saveSubject({
            id: selectedSubject.id,
            user_id: user.id,
            name: selectedSubject.name,
            keywords: selectedSubject.topicKeywords || [],
            lesson_plan: updatedSubject.lessonPlan,
            learning_progress: updatedSubject.learningProgress,
            last_active: updatedSubject.lastActive.toISOString()
          })
          
          console.log('✅ Lesson plan and progress saved to database')
        } catch (error) {
          console.error('❌ Failed to save lesson plan to database:', error)
        }
      }

      const planMessage = `Great! I've created a learning plan for ${subjectName}:\n\n` +
        lessonPlan.lessons.map((lesson, i) => `${i + 1}. ${lesson.title}`).join('\n') +
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
      if (selectedSubject) {
        await saveMessageToPersistence(aiResponse)
      } else {
        console.log('⏳ Adding AI response to pending queue')
        setPendingMessages(prev => [...prev, aiResponse])
      }

      // Generate content for first lesson - pass the lesson plan directly to avoid state timing issues
      await generateLessonContent(lessonPlan, progress, subjectName)
    } catch (error) {
      console.error('Error creating lesson plan:', error)
      setIsTyping(false)
    }
  }

  const generateLessonContent = async (lessonPlan: LessonPlan, progress: LearningProgress | null, subjectName: string, userAction?: string) => {
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

      // Send the interactive content to ContentPane via custom event
      const contentData = {
        id: `lesson-${currentLesson.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: lessonContent.type,
        data: lessonContent.data,
        title: currentLesson.title
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

    await generateLessonContent(currentLessonPlan, currentProgress, selectedSubject.name, userAction)
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
        if (selectedSubject && user) {
          setTimeout(async () => {
            try {
              await persistenceService.saveSubject({
                id: selectedSubject.id,
                user_id: user.id,
                name: selectedSubject.name,
                keywords: selectedSubject.topicKeywords || [],
                lesson_plan: newPlan,
                learning_progress: {
                  ...newProgress,
                  currentLessonIndex: newPlan?.currentLessonIndex || 0,
                  totalLessons: newPlan?.lessons.length || 0
                },
                last_active: new Date().toISOString()
              })
              console.log('💾 Lesson advancement saved to database - now on lesson:', (newPlan?.currentLessonIndex || 0) + 1)
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

  const handleContentInteraction = async (action: string, data: any) => {
    console.log('🚨 =========================')
    console.log('🚨 HANDLE CONTENT INTERACTION CALLED!')
    console.log('🚨 Action:', action)
    console.log('🚨 Data:', data)
    console.log('🚨 =========================')
    
    console.log('🎯 ChatPane handleContentInteraction called:', action, data)
    console.log('📊 ChatPane state check:', {
      selectedSubject: !!selectedSubject,
      currentLessonPlan: !!currentLessonPlan,
      currentProgress: !!currentProgress,
      selectedSubjectName: selectedSubject?.name,
      progressDetails: currentProgress ? {
        correctAnswers: currentProgress.correctAnswers,
        totalAttempts: currentProgress.totalAttempts,
        readyForNext: currentProgress.readyForNext,
        needsReview: currentProgress.needsReview
      } : null
    })
    
    if (!selectedSubject) {
      console.log('❌ ChatPane: No selected subject, returning early')
      return
    }

    // If we don't have a lesson plan, create one before processing the interaction
    let lessonPlan = currentLessonPlan
    let progress = currentProgress
    
    if (!lessonPlan || !progress) {
      console.log('🔧 ChatPane: Missing lesson plan/progress, creating one first...')
      await createLessonPlan(selectedSubject.name)
      // Get the fresh lesson plan and progress from the service
      lessonPlan = aiTutor.getLessonPlan(selectedSubject.name)
      progress = aiTutor.getProgress(selectedSubject.name)
      
      if (!lessonPlan || !progress) {
        console.log('❌ ChatPane: Failed to create lesson plan, cannot process interaction')
        return
      }
      console.log('✅ ChatPane: Created lesson plan, proceeding with interaction')
    }

    try {
      const currentLesson = lessonPlan.lessons[lessonPlan.currentLessonIndex]
      
      // Handle answer submissions with progress tracking
      if (action === 'answer_submitted') {
        const updatedProgress = aiTutor.updateProgress(selectedSubject.name, data.correct, currentLesson.id)
        setCurrentProgress(updatedProgress)

        // Dispatch progress update event to Dashboard
        const progressEvent = new CustomEvent('progressUpdated', {
          detail: {
            subjectId: selectedSubject.id,
            learningProgress: {
              ...updatedProgress,
              currentLessonIndex: currentLessonPlan?.currentLessonIndex || 0,
              totalLessons: currentLessonPlan?.lessons.length || 0
            }
          }
        })
        window.dispatchEvent(progressEvent)
        console.log('📡 Dispatched progress update event for answer submission')

        // Save updated progress to database
        if (selectedSubject && user) {
          setTimeout(async () => {
            try {
              await persistenceService.saveSubject({
                id: selectedSubject.id,
                user_id: user.id,
                name: selectedSubject.name,
                keywords: selectedSubject.topicKeywords || [],
                lesson_plan: currentLessonPlan,
                learning_progress: {
                  ...updatedProgress,
                  currentLessonIndex: currentLessonPlan?.currentLessonIndex || 0,
                  totalLessons: currentLessonPlan?.lessons.length || 0
                },
                last_active: new Date().toISOString()
              })
              console.log('💾 Progress saved to database:', updatedProgress.correctAnswers, '/', updatedProgress.totalAttempts)
            } catch (error) {
              console.error('❌ Failed to save progress to database:', error)
            }
          }, 0)
        }

        // Generate AI response for the answer
        const response = await aiTutor.generateTutorResponse(
          selectedSubject.name,
          'answer_submitted',
          data,
          { lesson: currentLesson, progress: updatedProgress }
        )

        const interactionResponse: Message = {
          id: `interaction-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, interactionResponse])
        await saveMessageToPersistence(interactionResponse)

        // Show progress status but don't auto-advance - let user control progression with buttons
        setTimeout(async () => {
          let statusMessage = ''
          
          if (updatedProgress.readyForNext) {
            statusMessage = `🎉 Excellent! You've mastered this lesson with ${updatedProgress.correctAnswers}/${updatedProgress.totalAttempts} correct (${Math.round((updatedProgress.correctAnswers/updatedProgress.totalAttempts)*100)}% accuracy). Click "Next Problem/Question/Exercise" to advance to the next lesson!`
          } else if (updatedProgress.needsReview) {
            const accuracy = Math.round((updatedProgress.correctAnswers/updatedProgress.totalAttempts)*100)
            statusMessage = `Keep practicing! You need 5+ correct answers with 75%+ accuracy to advance. Current: ${updatedProgress.correctAnswers}/${updatedProgress.totalAttempts} correct (${accuracy}%). You're making progress!`
          } else {
            const accuracy = Math.round((updatedProgress.correctAnswers/updatedProgress.totalAttempts)*100)
            const needed = Math.max(0, 5 - updatedProgress.correctAnswers)
            statusMessage = `Good progress! You need ${needed} more correct answers and 75%+ accuracy to advance. Current: ${updatedProgress.correctAnswers}/${updatedProgress.totalAttempts} correct (${accuracy}%).`
          }
          
          const statusMessageObj: Message = {
            id: `status-${Date.now()}`,
            role: 'assistant',
            content: statusMessage,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, statusMessageObj])
          await saveMessageToPersistence(statusMessageObj)
        }, 1500)
      } else if (action === 'concept_expanded' || action === 'examples_requested' || action === 'help_requested') {
        // For concept interactions, provide deeper explanation and generate new content
        console.log('🎯 Handling concept interaction:', action, data)
        
        let responseMessage = ''
        let contentAction = ''
        
        if (action === 'concept_expanded') {
          responseMessage = `Let me provide a deeper explanation of "${data.concept || currentLesson.title}".`
          contentAction = 'concept_expanded'
        } else if (action === 'examples_requested') {
          responseMessage = `Here are more examples for "${data.concept || currentLesson.title}".`
          contentAction = 'examples_requested'
        } else {
          responseMessage = `Let me help you understand "${data.concept || currentLesson.title}" better.`
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
          content: `Great! Let's practice "${currentLesson.title}" with some hands-on exercises:`,
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
          hasLessonPlan: !!lessonPlan,
          hasProgress: !!progress,
          progressDetails: progress ? {
            correctAnswers: progress.correctAnswers,
            totalAttempts: progress.totalAttempts,
            readyForNext: progress.readyForNext,
            needsReview: progress.needsReview
          } : null
        })
        
        // Track this as a new learning attempt when user requests more content
        // This ensures their engagement is counted towards advancement
        console.log('📊 Tracking new content request as learning engagement...')
        const currentLesson = lessonPlan.lessons[lessonPlan.currentLessonIndex]
        const updatedProgress = aiTutor.updateProgress(selectedSubject.name, true, currentLesson.id) // Count as engagement/correct attempt
        setCurrentProgress(updatedProgress)
        console.log('✅ Progress updated for new content request:', updatedProgress)

        // Dispatch progress update event to Dashboard
        const progressEvent = new CustomEvent('progressUpdated', {
          detail: {
            subjectId: selectedSubject.id,
            learningProgress: {
              ...updatedProgress,
              currentLessonIndex: currentLessonPlan?.currentLessonIndex || 0,
              totalLessons: currentLessonPlan?.lessons.length || 0
            }
          }
        })
        window.dispatchEvent(progressEvent)
        console.log('📡 Dispatched progress update event for content request')
        
        await handleNextInteractiveContent(action, lessonPlan, updatedProgress)
      } else {
        // Handle other interactions with brief response but focus on action
        console.log('🤔 Unknown action received:', action, '- Not handled as advancement trigger')
        console.log('📝 Full interaction data:', data)
        
        const response = await aiTutor.generateTutorResponse(
          selectedSubject.name,
          action,
          data,
          { lesson: currentLesson, progress: progress }
        )

        const interactionResponse: Message = {
          id: `interaction-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, interactionResponse])
      }
    } catch (error) {
      console.error('Error handling content interaction:', error)
      
      // Fallback response
      const fallbackResponse: Message = {
        id: `fallback-${Date.now()}`,
        role: 'assistant',
        content: data.correct ? "Nice job! Keep going." : "Good try! Let's keep practicing.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, fallbackResponse])
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

  if (!selectedSubject) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">AI Tutor</h2>
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI Tutor Ready</h3>
            <p className="text-gray-600 mb-4">
              Start learning with your personal AI tutor. I'll create interactive content based on what you want to learn.
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
              placeholder="What would you like to learn? (e.g., 'Explain photosynthesis', 'Quiz me on Shakespeare', 'Teach me Spanish')"
              disabled={isTyping}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Try: "Explain concepts", "Give me a quiz", "Help me understand", "Teach me step-by-step"
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">AI Tutor</h2>
          <div className="flex items-center space-x-2">
            {currentLessonPlan && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                Lesson {currentLessonPlan.currentLessonIndex + 1}/{currentLessonPlan.lessons.length}
              </Badge>
            )}
            {currentProgress && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                {currentProgress.correctAnswers}/{currentProgress.totalAttempts} correct
              </Badge>
            )}
            {pendingMessages.length > 0 && (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                💾 Saving {pendingMessages.length}...
              </Badge>
            )}
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              <Bot className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </div>
        {currentLessonPlan && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              📚 Current: {currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]?.title}
            </p>
            {currentProgress?.readyForNext && (
              <p className="text-xs text-green-600 font-medium">
                🎉 Ready to advance! Click "Next" on any activity to continue.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
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
                  <Bot className="h-4 w-4" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-gray-500">Creating content...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Continue learning ${selectedSubject.name}...`}
            disabled={isTyping}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Try: "More examples", "Quiz me", "Deeper explanation", "Practice problems"
        </p>
      </div>
    </div>
  )
})

ChatPane.displayName = 'ChatPane' 