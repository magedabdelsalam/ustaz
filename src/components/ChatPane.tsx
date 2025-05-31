'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SpinnerIcon } from '@/components/ui/loading-spinner'
import { Send, MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePendingMessages } from '@/hooks/usePendingMessages'
import { useSubjectSession } from '@/hooks/useSubjectSession'
import { persistenceService } from '@/lib/persistenceService'
import { buildPersistedSubject } from '@/lib/subjectUtils'
import { aiTutor } from '@/lib/aiService'
import { Message, Lesson, LessonPlan, LearningProgress, LessonContent, Subject } from '@/types'
import { ChatMessageList } from './ChatMessageList'

interface ChatPaneProps {
  selectedSubject: Subject | null
  onNewMessage?: (message: string, isUserMessage?: boolean) => void
}

// Add this interface for the exposed ref methods
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
  const lessonPlanCreationInProgress = useRef(false)
  const contentGenerationInProgress = useRef(false)
  const [recentContentTypes, setRecentContentTypes] = useState<string[]>([])
  const MAX_RECENT_TYPES = 3 // Track last 3 content types

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

  // Load messages and lesson plan when subject changes
  useEffect(() => {
    if (selectedSubject && user) {
      // Reset lesson plan creation tracking when subject changes
      lessonPlanCreationAttempted.current = null
      lessonPlanCreationInProgress.current = false
      
      loadSubjectSession()
      
      // Handle pending messages if any
      if (pendingMessages.length > 0) {
        console.log(`💾 Scheduling retry for ${pendingMessages.length} pending messages`)
        setTimeout(() => {
          scheduleRetry(pendingMessages)
        }, 2000) // Wait 2 seconds to ensure subject is in database
      }
    } else {
      // Clear lesson plan and progress when no subject is selected
      setCurrentLessonPlan(null)
      setCurrentProgress(null)
      setMessages([])
      lessonPlanCreationAttempted.current = null
      clearRetry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject?.id, user?.id])

  // Auto-scroll to bottom function with reliable timing
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      // Use requestAnimationFrame for better timing with DOM updates
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          // Find the actual scrollable viewport (Radix UI ScrollArea uses a viewport element)
          const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
          const scrollTarget = viewport || scrollAreaRef.current
          
          if (scrollTarget && scrollTarget.scrollHeight > scrollTarget.clientHeight) {
            // Force a layout recalculation to get accurate scroll height
            void scrollTarget.offsetHeight
            scrollTarget.scrollTop = scrollTarget.scrollHeight
          }
        }
      })
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Additional auto-scroll for initial loading - ensures scroll happens after DOM is ready
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0) {
      // Multiple attempts with increasing delays to ensure DOM is fully rendered
      const scrollAttempts = [100, 250, 500]
      scrollAttempts.forEach(delay => {
        setTimeout(() => {
          scrollToBottom()
        }, delay)
      })
    }
  }, [isLoadingMessages, messages.length, scrollToBottom])

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
    // Check if creation is already in progress for this subject
    if (lessonPlanCreationInProgress.current || lessonPlanCreationAttempted.current === subjectName) {
      console.log('⏸️ Lesson plan creation already in progress or attempted for:', subjectName)
      return
    }

    // Mark creation as in progress
    lessonPlanCreationInProgress.current = true
    lessonPlanCreationAttempted.current = subjectName
    
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

          await persistenceService.saveSubject(
            buildPersistedSubject(user.id, updatedSubject, {
              lessonPlan: {
                subject: subjectName,
                lessons: lessonPlan.lessons.map((lesson: Lesson) => ({
                  ...lesson,
                  completed: false,
                })),
                currentLessonIndex: lessonPlan.currentLessonIndex,
              },
              progress,
              lastActive: updatedSubject.lastActive,
            })
          )
          
          console.log('✅ Lesson plan and progress saved to database')
        } catch (error) {
          console.error('❌ Failed to save lesson plan to database:', error)
        }
      }

      // Generate intelligent welcome message for new learners
      try {
        const aiWelcomeContent = await aiTutor.generateWelcomeMessage(
          subjectName,
          {
            title: lessonPlan.lessons[0]?.title || 'Getting Started',
            index: 0
          },
          {
            correctAnswers: progress?.correctAnswers || 0,
            totalAttempts: progress?.totalAttempts || 0
          },
          false // isReturningUser = false for new lesson plans
        )

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiWelcomeContent,
          timestamp: new Date(),
          hasGeneratedContent: true
        }
        setMessages(prev => [...prev, aiResponse])
        
        // Save AI response
        if (subjectForPlan) {
          await saveMessageToPersistence(aiResponse)
        } else {
          console.log('⏳ Adding AI response to pending queue')
          setPendingMessages(prev => [...prev, aiResponse])
        }
      } catch (error) {
        console.error('Failed to generate AI welcome message for new plan:', error)
        // Use retry prompt instead of template fallback
        const retryResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: JSON.stringify({
            type: 'retry_prompt',
            message: `Failed to generate welcome message for ${subjectName}. Would you like to try again?`,
            action: 'retry',
            originalAction: 'generate_welcome_message',
            originalData: {
              subjectName,
              currentLesson: {
                title: lessonPlan.lessons[0]?.title || 'Getting Started',
                index: 0
              },
              progress: {
                correctAnswers: progress?.correctAnswers || 0,
                totalAttempts: progress?.totalAttempts || 0
              },
              isReturningUser: false
            }
          }),
          timestamp: new Date(),
          hasGeneratedContent: false
        }
        setMessages(prev => [...prev, retryResponse])
        
        // Save retry response
        if (subjectForPlan) {
          await saveMessageToPersistence(retryResponse)
        } else {
          console.log('⏳ Adding retry response to pending queue')
          setPendingMessages(prev => [...prev, retryResponse])
        }
      }

      // REMOVED: Automatic content generation on lesson plan creation
      // Only generate content when user explicitly requests it via chat or interactions
      // await generateLessonContent(lessonPlan, progress, subjectName, subjectForPlan?.id)
    } catch (error) {
      console.error('Error creating lesson plan:', error)
      setIsTyping(false)
    } finally {
      // Reset progress tracking
      lessonPlanCreationInProgress.current = false
    }
  }, [selectedSubject, user, saveMessageToPersistence])

  // Check if lesson plan creation should be triggered (moved from useEffect to direct logic)
  const checkAndCreateLessonPlan = useCallback(async () => {
    if (selectedSubject && !currentLessonPlan && 
        lessonPlanCreationAttempted.current !== selectedSubject.name &&
        !lessonPlanCreationInProgress.current) {
      
      // Check if we have recent user messages (not just loaded from persistence)
      const recentUserMessages = messages.filter(m => 
        m.role === 'user' && 
        Date.now() - m.timestamp.getTime() < 60000 // Within last minute
      )
      
      if (recentUserMessages.length > 0) {
        console.log('🆕 Creating lesson plan for new subject:', selectedSubject.name)
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

    // Check if user wants to continue with current lesson
    const continueKeywords = ['continue', 'continue with', 'alright let\'s continue', 'let\'s continue', 'next', 'keep going', 'go on']
    const isRequestingContinue = continueKeywords.some(keyword => 
      currentInput.toLowerCase().includes(keyword.toLowerCase())
    )

    // Check if this is a direct educational question
    const directQuestionPatterns = [
      /what concepts? (?:do i need|should i (?:know|learn|understand))/i,
      /what (?:do i need to (?:know|learn|understand)|concepts? (?:are )?(?:needed|required))/i,
      /how do i (?:get good at|master|learn)/i,
      /what (?:are the )?(?:fundamentals?|basics?|foundations?) of/i,
      /explain (?:what|how|why)/i,
      /(?:what is|define|tell me about)/i,
      /how (?:does|do) .+ work/i,
      /why (?:is|are|does|do)/i,
      /list the .+ (?:concepts?|topics?|skills?)/i
    ]
    
    const isDirectEducationalQuestion = directQuestionPatterns.some(pattern => 
      pattern.test(currentInput)
    )

    // If user wants to continue and we have a current lesson plan, generate content directly
    if (isRequestingContinue && currentLessonPlan && selectedSubject) {
      console.log('🎯 User wants to continue lesson - generating content directly')
      
      // Save user message to persistence
      if (selectedSubject) {
        await saveMessageToPersistence(userMessage)
      } else {
        console.log('⏳ Adding message to pending queue (no subject yet)')
        setPendingMessages(prev => [...prev, userMessage])
      }
      
      // Generate content immediately without template response
      await generateCurrentLessonContent()
      setIsTyping(false)
      return
    }

    // Handle direct educational questions with specific AI responses
    if (isDirectEducationalQuestion && selectedSubject) {
      console.log('🎓 Detected direct educational question - generating explainer component')
      
      // Save user message to persistence
      await saveMessageToPersistence(userMessage)
      
      try {
        // Generate brief acknowledgment response instead of long educational content
        const briefResponse = `I'll create an interactive explanation to help you understand the key ${selectedSubject.name} concepts you need to master.`

        const aiResponse: Message = {
          id: `educational-${Date.now()}`,
          role: 'assistant',
          content: briefResponse,
          timestamp: new Date(),
          hasGeneratedContent: true // Mark as generating content
        }
        
        setMessages(prev => [...prev, aiResponse])
        await saveMessageToPersistence(aiResponse)
        
        // Generate explainer component with the educational content
        if (currentLessonPlan) {
          console.log('📚 Generating explainer component for educational question')
          await generateCurrentLessonContent('explainer')
        }
        
        setIsTyping(false)
        return
      } catch (error) {
        console.error('❌ Error generating educational response:', error)
        // Fall through to normal handling
      }
    }

    // Original message handling for other cases
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
        if (!currentLessonPlan && !lessonPlanCreationInProgress.current) {
          await createLessonPlan(selectedSubject.name, selectedSubject)
        } else if (currentLessonPlan) {
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

    // Only check for lesson plan creation if we don't already have one and no creation is in progress
    if (!currentLessonPlan && !lessonPlanCreationInProgress.current) {
      setTimeout(() => {
        checkAndCreateLessonPlan()
      }, 500)
    }
  }

  const generateLessonContent = useCallback(async (lessonPlan: LessonPlan, progress: LearningProgress | null, subjectName: string, subjectId?: string, userAction?: string) => {
    // Helper function to get diverse content type (moved inside to avoid dependency issues)
    const getDiverseContentType = (requestedAction: string, recentTypes: string[]): 'quiz' | 'practice' | 'fill-blank' | 'explainer' | 'concept-card' | 'step-solver' | 'interactive-example' | 'text-highlighter' | 'drag-drop' | 'graph-visualizer' | 'formula-explorer' | 'multiple-choice' => {
      // Define available content types based on the action
      let availableTypes: ('quiz' | 'practice' | 'fill-blank' | 'explainer' | 'concept-card' | 'step-solver' | 'interactive-example' | 'text-highlighter' | 'drag-drop' | 'graph-visualizer' | 'formula-explorer' | 'multiple-choice')[] = []
      
      if (requestedAction === 'next_question') {
        // For question requests, prioritize quiz-like content but allow variety
        availableTypes = ['multiple-choice', 'quiz', 'fill-blank', 'concept-card', 'explainer']
      } else if (requestedAction === 'next_exercise') {
        // For exercise requests, prioritize interactive practice content with strong variety
        availableTypes = ['step-solver', 'drag-drop', 'text-highlighter', 'quiz', 'multiple-choice', 'concept-card', 'fill-blank']
      } else if (requestedAction === 'next_problem') {
        // For problem requests, provide varied problem-solving content
        availableTypes = ['step-solver', 'quiz', 'multiple-choice', 'fill-blank', 'concept-card', 'explainer']
      } else {
        // Default variety for other requests
        availableTypes = ['quiz', 'multiple-choice', 'step-solver', 'concept-card', 'explainer', 'fill-blank']
      }
      
      // Filter out recently used types to ensure variety (be more strict)
      const diverseTypes = availableTypes.filter(type => !recentTypes.includes(type))
      
      // If we've used all types recently, pick from the least recently used
      let typesToChooseFrom: typeof availableTypes
      if (diverseTypes.length > 0) {
        typesToChooseFrom = diverseTypes
      } else {
        // Reset but avoid the most recent type if possible
        const mostRecentType = recentTypes[0]
        typesToChooseFrom = availableTypes.filter(type => type !== mostRecentType)
        if (typesToChooseFrom.length === 0) {
          typesToChooseFrom = availableTypes
        }
      }
      
      // Select a random type from available diverse options
      const selectedType = typesToChooseFrom[Math.floor(Math.random() * typesToChooseFrom.length)]
      
      console.log('🎯 Content diversity logic:', {
        requestedAction,
        recentTypes,
        availableTypes,
        diverseTypes,
        typesToChooseFrom,
        selectedType,
        diversityScore: `${diverseTypes.length}/${availableTypes.length} types available`
      })
      
      return selectedType
    }

    try {
      const currentLesson = lessonPlan.lessons[lessonPlan.currentLessonIndex]
      console.log('📖 Generating content for lesson:', currentLesson.title)
      
      // Show content variety stats for debugging
      const varietyStats = aiTutor.getContentVarietyStats(subjectName, currentLesson.id)
      console.log('📊 Content variety for this lesson:', varietyStats)
      
      // Determine content type based on user action and progress
      let contentType: 'quiz' | 'practice' | 'fill-blank' | 'explainer' | 'concept-card' | 'step-solver' | 'interactive-example' | 'text-highlighter' | 'drag-drop' | 'graph-visualizer' | 'formula-explorer' | 'multiple-choice' = 'explainer'
      
      if (userAction === 'practice') {
        // User specifically wants to practice - prioritize interactive components
        const practiceTypes = ['quiz', 'fill-blank', 'practice'] as const
        contentType = practiceTypes[Math.floor(Math.random() * practiceTypes.length)]
        console.log('🎯 User wants practice, selected:', contentType)
      } else if (userAction === 'next_question') {
        // User wants another question - use diversity system
        contentType = getDiverseContentType('next_question', recentContentTypes)
        console.log('🎯 User wants next question, selected with diversity:', contentType)
      } else if (userAction === 'next_exercise') {
        // User wants another exercise - use diversity system
        contentType = getDiverseContentType('next_exercise', recentContentTypes)
        console.log('🎯 User wants next exercise, selected with diversity:', contentType)
      } else if (userAction === 'next_problem') {
        // User wants another problem - use diversity system
        contentType = getDiverseContentType('next_problem', recentContentTypes)
        console.log('🎯 User wants next problem, selected with diversity:', contentType)
      } else if (userAction === 'examples_requested') {
        // User wants more examples - give them explanations with examples
        contentType = 'explainer'
        console.log('🎯 User wants examples, selected:', contentType)
      } else if (userAction === 'concept_expanded') {
        // User wants deeper explanation - give them explanations
        contentType = 'explainer'
        console.log('🎯 User wants deeper explanation, selected:', contentType)
      } else if (userAction === 'explainer' || userAction === 'concept-card' || userAction === 'step-solver' || 
                 userAction === 'interactive-example' || userAction === 'text-highlighter' || 
                 userAction === 'drag-drop' || userAction === 'graph-visualizer' || 
                 userAction === 'formula-explorer' || userAction === 'multiple-choice') {
        // Direct content type mapping from suggested components
        contentType = userAction
        console.log('🎯 Direct component type requested:', contentType)
      } else {
        // Default behavior based on progress
        if (progress && progress.totalAttempts === 0) {
          contentType = 'explainer' // Start with explanation
        } else if (progress && progress.totalAttempts >= 1) {
          // Mix of practice and explanation after first attempt
          const contentTypes = ['quiz', 'fill-blank', 'practice', 'explainer'] as const
          contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)]
        }
        console.log('🎯 Default behavior, selected:', contentType)
      }

      const lessonContent = await aiTutor.generateLessonContent(
        subjectName,
        currentLesson,
        contentType
      )
      
      console.log('✅ Generated lesson content:', { 
        requestedType: contentType, 
        actualType: lessonContent.type, 
        typeMatch: contentType === lessonContent.type 
      })

      // Update recent content types tracker for diversity using the actual generated type
      const actualContentType = lessonContent.type || contentType
      setRecentContentTypes(prev => {
        const updated = [actualContentType, ...prev].slice(0, MAX_RECENT_TYPES)
        console.log('📊 Updated recent content types:', {
          added: actualContentType,
          previous: prev,
          updated: updated,
          diversityLevel: `${updated.length}/${MAX_RECENT_TYPES} slots filled`
        })
        return updated
      })
      console.log('📊 Tracked content type for diversity:', actualContentType)

      // Use the provided subjectId or fall back to selectedSubject
      const targetSubjectId = subjectId || selectedSubject?.id
      console.log('🎯 Using subject ID for content:', { provided: subjectId, selected: selectedSubject?.id, final: targetSubjectId })

      // Extract concept-specific title from the generated content
      const getConceptTitle = (content: LessonContent, currentLesson: Lesson): string => {
        // Type guard for content data with specific properties
        const hasTitle = (data: unknown): data is { title: string } => {
          return typeof data === 'object' && data !== null && 'title' in data && typeof (data as { title: unknown }).title === 'string'
        }
        
        const hasCategory = (data: unknown): data is { category: string } => {
          return typeof data === 'object' && data !== null && 'category' in data && typeof (data as { category: unknown }).category === 'string'
        }
        
        const hasProblemType = (data: unknown): data is { problemType: string } => {
          return typeof data === 'object' && data !== null && 'problemType' in data && typeof (data as { problemType: unknown }).problemType === 'string'
        }
        
        const hasQuestion = (data: unknown): data is { question: string } => {
          return typeof data === 'object' && data !== null && 'question' in data && typeof (data as { question: unknown }).question === 'string'
        }
        
        const hasTemplate = (data: unknown): data is { template: string } => {
          return typeof data === 'object' && data !== null && 'template' in data && typeof (data as { template: unknown }).template === 'string'
        }
        
        const hasProblem = (data: unknown): data is { problem: string } => {
          return typeof data === 'object' && data !== null && 'problem' in data && typeof (data as { problem: unknown }).problem === 'string'
        }
        
        // Priority 1: Use the current concept from the lesson structure
        if (currentLesson.concepts && currentLesson.concepts.length > 0) {
          const currentConceptIndex = currentLesson.currentConceptIndex || 0
          const currentConcept = currentLesson.concepts[currentConceptIndex]
          if (currentConcept) {
            console.log('🎯 Using predefined concept:', currentConcept.name)
            return currentConcept.name
          }
        }
        
        // Priority 2: Check if the content data has a specific title field
        if (hasTitle(content.data) && content.data.title !== currentLesson.title) {
          return content.data.title
        }
        
        // Priority 3: Check if the content data has a specific category that's different from lesson title
        if (hasCategory(content.data) && content.data.category !== currentLesson.title) {
          return content.data.category
        }
        
        // Priority 4: Check if the content data has a problemType that's different from lesson title
        if (hasProblemType(content.data) && content.data.problemType !== currentLesson.title) {
          return content.data.problemType
        }
        
        // Priority 5: For quiz content, use the question context to create a concept title
        if (content.type === 'multiple-choice' && hasQuestion(content.data)) {
          const question = content.data.question.toLowerCase()
          if (question.includes('user research')) return 'User Research Quiz'
          if (question.includes('persona') || question.includes('user persona')) return 'User Persona Quiz'
          if (question.includes('wireframe') || question.includes('wireframing')) return 'Wireframing Quiz'
          if (question.includes('prototype') || question.includes('prototyping')) return 'Prototyping Quiz'
          if (question.includes('usability test')) return 'Usability Testing Quiz'
          if (question.includes('information architecture')) return 'Information Architecture Quiz'
          if (question.includes('design system')) return 'Design Systems Quiz'
          if (question.includes('accessibility')) return 'Accessibility Quiz'
        }
        
        // Priority 6: For fill-blank content, extract from template or answers
        if (content.type === 'fill-blank' && hasTemplate(content.data)) {
          const template = content.data.template.toLowerCase()
          if (template.includes('user journey')) return 'User Journey Exercise'
          if (template.includes('persona')) return 'User Persona Exercise'
          if (template.includes('wireframe')) return 'Wireframing Exercise'
          if (template.includes('prototype')) return 'Prototyping Exercise'
          if (template.includes('research')) return 'User Research Exercise'
        }
        
        // Priority 7: For step-solver, use problem context
        if (content.type === 'step-solver' && hasProblem(content.data)) {
          const problem = content.data.problem.toLowerCase()
          if (problem.includes('user interview')) return 'User Interview Problem'
          if (problem.includes('persona')) return 'User Persona Problem'
          if (problem.includes('wireframe')) return 'Wireframe Problem'
          if (problem.includes('prototype')) return 'Prototyping Problem'
          if (problem.includes('usability')) return 'Usability Testing Problem'
        }
        
        // Fallback: Use content type with a generic concept indicator
        const typeNames = {
          'multiple-choice': 'Concept Quiz',
          'fill-blank': 'Concept Exercise', 
          'concept-card': 'Concept Overview',
          'step-solver': 'Concept Problem',
          'explainer': 'Concept Guide',
          'interactive-example': 'Concept Example',
          'text-highlighter': 'Concept Highlighter',
          'drag-drop': 'Concept Matching',
          'graph-visualizer': 'Concept Visualization',
          'formula-explorer': 'Concept Formula'
        }
        return typeNames[content.type as keyof typeof typeNames] || 'Learning Activity'
      }
      
      const conceptTitle = getConceptTitle(lessonContent, currentLesson)
      console.log('🎯 Generated concept title:', conceptTitle, 'from content type:', lessonContent.type)

      // Send the interactive content to ContentPane via custom event
      const contentData = {
        id: `lesson-${currentLesson.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: lessonContent.type,
        data: lessonContent.data,
        title: conceptTitle, // Use concept-specific title instead of lesson title
        subjectId: targetSubjectId
      }
      console.log('📤 Dispatching content event with concept title:', contentData)
      
      // Dispatch custom event for ContentPane to listen to
      const event = new CustomEvent('contentGenerated', { detail: contentData })
      window.dispatchEvent(event)

      setIsTyping(false)
    } catch (error) {
      console.error('❌ Error generating lesson content:', error)
      setIsTyping(false)
    }
  }, [selectedSubject, setIsTyping, recentContentTypes])

  const generateCurrentLessonContent = useCallback(async (userAction?: string) => {
    if (!currentLessonPlan || !selectedSubject) {
      console.log('❌ Cannot generate content - missing lesson plan or subject')
      return
    }

    // Prevent duplicate content generation
    if (contentGenerationInProgress.current) {
      console.log('⏸️ Content generation already in progress - skipping')
      return
    }

    contentGenerationInProgress.current = true
    console.log('🎬 Starting content generation with action:', userAction)

    try {
      await generateLessonContent(
        currentLessonPlan,
        currentProgress,
        selectedSubject.name,
        selectedSubject.id,
        userAction
      )
    } catch (error) {
      console.error('❌ Error in generateCurrentLessonContent:', error)
    } finally {
      contentGenerationInProgress.current = false
      console.log('🏁 Content generation completed')
    }
  }, [currentLessonPlan, selectedSubject, currentProgress, generateLessonContent])

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
              // Create extended progress object with proper structure
              const extendedProgress = {
                correctAnswers: newProgress.correctAnswers,
                totalAttempts: newProgress.totalAttempts,
                needsReview: newProgress.needsReview,
                readyForNext: newProgress.readyForNext,
                currentLessonIndex: newPlan.currentLessonIndex,
                totalLessons: newPlan.lessons.length,
              }
              
              await persistenceService.saveSubject(
                buildPersistedSubject(user.id, selectedSubject, {
                  lessonPlan: newPlan,
                  progress: extendedProgress,
                  lastActive: new Date(),
                })
              )
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
      // Student needs more practice in current lesson - generate AI response instead of template
      if (currentLessonPlan && currentProgress) {
        const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
        if (currentLesson) {
          const aiResponse = await aiTutor.generateTutorResponse(
            selectedSubject!.name,
            'needs_more_practice',
            { lesson: currentLesson.title, progress: currentProgress },
            { lesson: currentLesson, progress: currentProgress }
          )

          const practiceMessage: Message = {
            id: `practice-${Date.now()}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, practiceMessage])
          await saveMessageToPersistence(practiceMessage)
        }
      }
      
      // Generate more content for current lesson
      const contentType = action === 'next_question' ? 'next_question' : 
                         action === 'next_exercise' ? 'next_exercise' : 'next_problem'
      await generateCurrentLessonContent(contentType)
    } else {
      console.log('📈 Student is making progress but not ready to advance yet')
      // Student is making progress but not ready to advance yet - generate AI response instead of template
      if (currentLessonPlan && currentProgress) {
        const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
        if (currentLesson) {
          const aiResponse = await aiTutor.generateTutorResponse(
            selectedSubject!.name,
            'continue_practicing',
            { 
              lesson: currentLesson.title, 
              progress: currentProgress,
              action: action,
              encouragementNeeded: true
            },
            { lesson: currentLesson, progress: currentProgress }
          )

          const encouragementMessage: Message = {
            id: `encourage-${Date.now()}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, encouragementMessage])
          await saveMessageToPersistence(encouragementMessage)
        }
      }
      
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
        
      // Generate AI response instead of template
      if (currentLessonPlan && currentProgress) {
        const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
        if (currentLesson) {
          const aiResponse = await aiTutor.generateTutorResponse(
            selectedSubject!.name,
            action,
            { 
              concept: conceptName,
              requestType: action,
              lesson: currentLesson.title
            },
            { lesson: currentLesson, progress: currentProgress }
          )

          const explanationMessage: Message = {
            id: `explanation-${Date.now()}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, explanationMessage])
          await saveMessageToPersistence(explanationMessage)
        }
      }
      
      // Generate new interactive content based on the specific action
      let contentAction = ''
      if (action === 'concept_expanded') {
        contentAction = 'concept_expanded'
      } else if (action === 'examples_requested') {
        contentAction = 'examples_requested'
      } else {
        contentAction = 'concept_expanded'
      }
      await generateCurrentLessonContent(contentAction)
    } else if (action === 'ready_for_next') {
      // Student indicates they're ready to move forward (Practice This button)
      if (currentLessonPlan && currentProgress) {
        const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
        if (currentLesson) {
          const aiResponse = await aiTutor.generateTutorResponse(
            selectedSubject!.name,
            'ready_for_practice',
            { 
              lesson: currentLesson.title,
              readyForPractice: true
            },
            { lesson: currentLesson, progress: currentProgress }
          )

          const readyMessage: Message = {
            id: `ready-${Date.now()}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, readyMessage])
          await saveMessageToPersistence(readyMessage)
        }
      }
      
      // Generate practice content specifically
      await generateCurrentLessonContent('practice')
    } else if (action === 'retry_content') {
      const retryData = data as { retryType?: string } | null
      await generateCurrentLessonContent(retryData?.retryType)
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
    } else if (action === 'answer_submitted' || action === 'fill_blank_submitted' || action === 'drag_drop_submitted' || action === 'quiz_submitted') {
      // Handle final submission actions - these are the "final" buttons that should trigger AI feedback
      console.log('✅ Final submission action received:', action, data)
      
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
          await saveMessageToPersistence(interactionResponse)
        }
      }
    } else {
      // For any other actions (like explain_more, practice_this), provide appropriate responses
      console.log('🔍 Other action received:', action, data)
      
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
          await saveMessageToPersistence(interactionResponse)
        }
      } else {
        // Use retry prompt when lesson plan or progress is not available
        const retryResponse: Message = {
          id: `retry-${Date.now()}`,
          role: 'assistant',
          content: JSON.stringify({
            type: 'retry_prompt',
            message: 'Learning plan not ready yet. Please try again in a moment.',
            action: 'retry',
            originalAction: action,
            originalData: data
          }),
          timestamp: new Date()
        }
        setMessages(prev => [...prev, retryResponse])
        await saveMessageToPersistence(retryResponse)
      }
    }
  }

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleContentInteraction
  }))

  // Handle retry for chat messages
  const handleChatRetry = useCallback(async (originalAction: string, originalData: unknown) => {
    console.log('🔄 Retrying chat action:', originalAction, originalData)
    
    if (!selectedSubject) {
      console.error('❌ Cannot retry: no subject selected')
      return
    }

    setIsTyping(true)
    
    try {
      switch (originalAction) {
        case 'generate_welcome_message': {
          const data = originalData as { subjectName: string; currentLesson: { title: string; index: number }; progress: { correctAnswers: number; totalAttempts: number }; isReturningUser: boolean }
          const response = await aiTutor.generateWelcomeMessage(
            data.subjectName,
            data.currentLesson,
            data.progress,
            data.isReturningUser
          )
          
          const retryMessage: Message = {
            id: `welcome-retry-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, retryMessage])
          await saveMessageToPersistence(retryMessage)
          break
        }
        
        case 'generate_educational_response': {
          const data = originalData as { question: string; subjectName?: string; context?: { currentLesson?: string; difficulty?: string } }
          const response = await aiTutor.generateDirectEducationalResponse(
            data.question,
            data.subjectName,
            data.context
          )
          
          const retryMessage: Message = {
            id: `educational-retry-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, retryMessage])
          await saveMessageToPersistence(retryMessage)
          break
        }
        
        case 'create_learning_plan': {
          const data = originalData as { subject: string }
          await createLessonPlan(data.subject, selectedSubject)
          break
        }
        
        default: {
          // Try to regenerate tutor response for other actions
          if (currentLessonPlan && currentProgress) {
            const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
            if (currentLesson) {
              const response = await aiTutor.generateTutorResponse(
                selectedSubject.name,
                originalAction,
                originalData,
                { lesson: currentLesson, progress: currentProgress }
              )

              const retryMessage: Message = {
                id: `tutor-retry-${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: new Date()
              }
              setMessages(prev => [...prev, retryMessage])
              await saveMessageToPersistence(retryMessage)
            }
          }
          break
        }
      }
    } catch (error) {
      console.error('❌ Retry failed:', error)
      // Use retry prompt for retry failures too
      const errorMessage: Message = {
        id: `retry-error-${Date.now()}`,
        role: 'assistant',
        content: JSON.stringify({
          type: 'retry_prompt',
          message: 'Retry failed. Please try again.',
          action: 'retry',
          originalAction: originalAction,
          originalData: originalData
        }),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      await saveMessageToPersistence(errorMessage)
    } finally {
      setIsTyping(false)
    }
  }, [selectedSubject, currentLessonPlan, currentProgress, createLessonPlan, saveMessageToPersistence])

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
      if ((!currentLessonPlan || currentLessonPlan.subject !== subject.name) && 
          !lessonPlanCreationInProgress.current) {
        console.log('📚 Creating lesson plan for newly created subject:', subject.name)
        createLessonPlan(subject.name, subject)
      }
    }

    window.addEventListener('newSubjectCreated', handleNewSubject)
    return () => {
      window.removeEventListener('newSubjectCreated', handleNewSubject)
    }
  }, [createLessonPlan, currentLessonPlan])

  // Listen for contextual content generation events from Dashboard
  useEffect(() => {
    const handleContextualContent = async (event: Event) => {
      const customEvent = event as CustomEvent
      const { subject, userMessage, suggestedComponent, confidence, reasoning } = customEvent.detail
      
      console.log('🎯 ChatPane received contextual content request:', {
        subject: subject.name,
        message: userMessage.substring(0, 50) + '...',
        suggestedComponent,
        confidence,
        reasoning
      })

      // Generate AI response that directly answers the user's question
      if (currentLessonPlan && currentProgress) {
        const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
        if (currentLesson) {
          const aiResponse = await aiTutor.generateTutorResponse(
            selectedSubject!.name,
            'direct_question_answer',
            { 
              userMessage: userMessage,
              suggestedComponent: suggestedComponent,
              confidence: confidence,
              reasoning: reasoning,
              lesson: currentLesson.title
            },
            { lesson: currentLesson, progress: currentProgress }
          )

          const responseMessage: Message = {
            id: `contextual-${Date.now()}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
            hasGeneratedContent: true
          }
          setMessages(prev => [...prev, responseMessage])
          await saveMessageToPersistence(responseMessage)
        }
      } else {
        // Use retry prompt when lesson plan or progress is not available
        const retryResponse: Message = {
          id: `contextual-retry-${Date.now()}`,
          role: 'assistant',
          content: JSON.stringify({
            type: 'retry_prompt',
            message: 'Learning plan not ready yet. Please try again in a moment.',
            action: 'retry',
            originalAction: 'contextual_content_request',
            originalData: { subject, userMessage, suggestedComponent, confidence, reasoning }
          }),
          timestamp: new Date(),
          hasGeneratedContent: false
        }
        setMessages(prev => [...prev, retryResponse])
        await saveMessageToPersistence(retryResponse)
      }

      // Only generate ONE interactive content component - but NOT if lesson plan creation is in progress
      if (currentLessonPlan && currentProgress && !lessonPlanCreationInProgress.current) {
        console.log('📚 Generating single contextual content with suggested component:', suggestedComponent)
        
        // Map suggested component to content action for generateLessonContent
        let contentAction: 'explainer' | 'concept-card' | 'multiple-choice' | 'fill-blank' | 'step-solver' | 'interactive-example' | 'text-highlighter' | 'drag-drop' | 'graph-visualizer' | 'formula-explorer' = 'explainer'
        switch (suggestedComponent) {
          case 'explainer':
            contentAction = 'explainer'
            break
          case 'multiple-choice':
            contentAction = 'multiple-choice'
            break
          case 'fill-blank':
            contentAction = 'fill-blank'
            break
          case 'concept-card':
            contentAction = 'concept-card'
            break
          case 'step-solver':
            contentAction = 'step-solver'
            break
          case 'interactive-example':
            contentAction = 'interactive-example'
            break
          case 'text-highlighter':
            contentAction = 'text-highlighter'
            break
          case 'drag-drop':
            contentAction = 'drag-drop'
            break
          case 'graph-visualizer':
            contentAction = 'graph-visualizer'
            break
          case 'formula-explorer':
            contentAction = 'formula-explorer'
            break
          default:
            contentAction = 'explainer'
        }
        
        // Generate exactly ONE piece of content
        await generateCurrentLessonContent(contentAction)
      } else if (selectedSubject && !lessonPlanCreationInProgress.current) {
        // If no lesson plan exists, create one first
        console.log('📋 No lesson plan exists, creating one first for contextual content')
        await createLessonPlan(selectedSubject.name, selectedSubject)
      } else if (lessonPlanCreationInProgress.current) {
        console.log('⏸️ Lesson plan creation in progress, skipping content generation to avoid duplicates')
      }
    }

    window.addEventListener('generateContextualContent', handleContextualContent)
    return () => {
      window.removeEventListener('generateContextualContent', handleContextualContent)
    }
  }, [currentLessonPlan, currentProgress, selectedSubject, saveMessageToPersistence, generateCurrentLessonContent, createLessonPlan])

  // Generate dynamic placeholder text based on context
  const getPlaceholderText = (): string => {
    if (!selectedSubject) {
      return "What would you like to learn today?"
    }

    // If we have lesson plan and progress
    if (currentLessonPlan && currentProgress) {
      const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
      
      // If lesson is completed
      if (currentProgress.readyForNext) {
        return `Great progress! Ask me anything about ${selectedSubject.name} or request the next lesson`
      }
      
      // If in middle of lesson
      if (currentLesson) {
        return `Continue exploring ${currentLesson.title}...`
      }
    }
    
    // If we have lesson plan but no progress yet
    if (currentLessonPlan) {
      const currentLesson = currentLessonPlan.lessons[currentLessonPlan.currentLessonIndex]
      if (currentLesson) {
        return `Ready to start "${currentLesson.title}"?`
      }
    }
    
    // Default case with subject
    return `Continue learning ${selectedSubject.name}...`
  }

  if (!selectedSubject) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
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
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={getPlaceholderText()}
              disabled={isTyping}
              className="flex-1 p-6 px-4 text-lg"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="lg"
              className="p-6 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
            >
              {isTyping ? (
                <SpinnerIcon size="sm" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ChatMessageList
          messages={messages}
          isTyping={isTyping}
          isLoading={isLoadingMessages}
          pendingCount={pendingMessages.length}
          scrollRef={scrollAreaRef}
          onRetryMessage={handleChatRetry}
          lessonInfo={
            currentLessonPlan
              ? {
                  current: currentLessonPlan.currentLessonIndex + 1,
                  total: currentLessonPlan.lessons.length
                }
              : undefined
          }
          progressInfo={
            currentProgress
              ? {
                  correct: currentProgress.correctAnswers,
                  total: currentProgress.totalAttempts,
                  ready: currentProgress.readyForNext || false
                }
              : undefined
          }
        />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholderText()}
            disabled={isTyping}
            className="flex-1 p-6 px-4 text-lg"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            size="lg"
            className="p-6 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
          >
            {isTyping ? (
              <SpinnerIcon size="sm" />
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