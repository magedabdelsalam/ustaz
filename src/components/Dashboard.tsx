'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { HistoryPane } from '@/components/HistoryPane'
import { Button } from '@/components/ui/button'
import { persistenceService } from '@/lib/persistenceService'
import { InteractiveContent, Message, LessonPlan } from '@/types'
import { StreamPane, StreamItem, StreamMessage, StreamInteractiveContent } from './StreamPane'
import { useAITutor } from '@/hooks/useAITutor'
import { Subject } from '@/types'
import { useSubjectSession } from '@/hooks/useSubjectSession'
import { toast } from 'sonner'

export function Dashboard() {
  const { user } = useAuth()
  const { 
    subjects, 
    currentSubject, 
    selectSubject,
    createSubject,
    deleteSubject
  } = useSubjects()
  const lastUserMessageRef = useRef<{ id: string; content: string; previousSubjectId: string | null } | null>(null)

  // Unified stream state
  const [stream, setStream] = useState<StreamItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // State for lesson plan
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null)

  // Memoized callback to avoid infinite loop
  const onMessagesLoaded = useCallback((messages: Message[]) => {
    const mapped = messages.map((msg: Message) => ({
      ...msg,
      streamType: 'message' as const,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
    }))
    setStream(mapped)
  }, [])

  // Load previous messages for the selected subject
  const { loadSubjectSession, isLoadingMessages } = useSubjectSession({
    user,
    selectedSubject: currentSubject,
    onMessagesLoaded,
  })

  // AI Tutor logic
  const aiTutor = useAITutor({
    subject: currentSubject,
    userId: user?.id,
    onInteractiveContent: (content) => {
      // Add interactive content to the stream
      const interactive: StreamInteractiveContent = {
        ...content,
        streamType: 'interactive',
        timestamp: new Date(),
      }
      setStream(prev => [...prev, interactive])
    },
    onLessonPlanCreated: (plan) => {
      setLessonPlan(plan)
    },
  })

  // Test connection on mount
  useEffect(() => {
    persistenceService.testConnection().then(success => {
      if (success) {
        console.log('✅ Database connection successful')
      } else {
        console.error('❌ Database connection failed')
      }
    })
  }, [])

  // Listen for user messages from ChatPane (for tracking purposes)
  useEffect(() => {
    const handleUserMessage = (event: CustomEvent) => {
      const { messageId, content } = event.detail
      console.log('📝 Dashboard received user message tracking:', { messageId, content })
      
      // Track this message in case it triggers subject creation
      lastUserMessageRef.current = {
        id: messageId,
        content: content,
        previousSubjectId: currentSubject?.id || null
      }
    }

    window.addEventListener('userMessageSent', handleUserMessage as EventListener)
    
    return () => {
      window.removeEventListener('userMessageSent', handleUserMessage as EventListener)
    }
  }, [currentSubject, user])

  // AI-first message handler - let AI decide everything
  const handleNewMessage = useCallback(async (message: string, isUserMessage = false) => {
    console.log('📩 Message received:', { 
      message: message.substring(0, 50) + '...', 
      isUserMessage
    })

    // Just pass through to AI - no hardcoded logic
    // AI will decide whether to create subjects, switch contexts, etc.
  }, [])

  // Handle user sending a message
  const handleSendMessage = useCallback(async (message: string) => {
    if (!user || !currentSubject) return
    setIsLoading(true)
    // Add user message to stream
    const userMsg: StreamMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      streamType: 'message',
    }
    setStream(prev => [...prev, userMsg])
    // Save to persistence (optional)
    await persistenceService.saveMessage({
      id: userMsg.id,
      user_id: user.id,
      subject_id: currentSubject.id,
      role: 'user',
      content: message,
      timestamp: userMsg.timestamp.toISOString(),
      has_generated_content: false,
    })
    // Get AI response
    try {
      const aiResult = await aiTutor.sendMessageWithMetadata(message)
      // Add AI message to stream
      const aiMsg: StreamMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResult.response,
        timestamp: new Date(),
        streamType: 'message',
      }
      setStream(prev => [...prev, aiMsg])
      // Save AI message
      await persistenceService.saveMessage({
        id: aiMsg.id,
        user_id: user.id,
        subject_id: currentSubject.id,
        role: 'assistant',
        content: aiResult.response,
        timestamp: aiMsg.timestamp.toISOString(),
        has_generated_content: aiResult.hasGeneratedInteractiveContent || false,
      })
      // If AI generated interactive content, it will be added via onInteractiveContent
    } finally {
      setIsLoading(false)
    }
  }, [user, currentSubject, aiTutor])

  // Handle interaction from interactive components
  const handleInteraction = useCallback(async (action: string, data: unknown) => {
    if (!user || !currentSubject) return
    setIsLoading(true)
    try {
      // Let AI handle the interaction and respond
      const aiResult = await aiTutor.sendMessageWithMetadata(`User interacted: ${action} - ${JSON.stringify(data)}`)
      const aiMsg: StreamMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResult.response,
        timestamp: new Date(),
        streamType: 'message',
      }
      setStream(prev => [...prev, aiMsg])
      await persistenceService.saveMessage({
        id: aiMsg.id,
        user_id: user.id,
        subject_id: currentSubject.id,
        role: 'assistant',
        content: aiResult.response,
        timestamp: aiMsg.timestamp.toISOString(),
        has_generated_content: aiResult.hasGeneratedInteractiveContent || false,
      })
      // If AI generates new interactive content, it will be added via onInteractiveContent
    } finally {
      setIsLoading(false)
    }
  }, [user, currentSubject, aiTutor])

  // Load previous stream for the selected subject
  useEffect(() => {
    if (currentSubject && user) {
      loadSubjectSession()
    } else {
      setStream([])
    }
  }, [currentSubject?.id, user?.id, loadSubjectSession])

  // Handler for when goals/level are set in HistoryPane
  const handleGoalsAndLevelSet = (subjectId: string, goals: string, level: string) => {
    // Update the subject in local state (if needed)
    if (currentSubject && currentSubject.id === subjectId) {
      currentSubject.userGoals = goals
      currentSubject.userLevel = level
    }
    // Update TutorContext in useAITutor so backend receives the info
    if (aiTutor && typeof aiTutor.updateContext === 'function') {
      aiTutor.updateContext({ userGoals: goals, userLevel: level })
    }
  }

  // Handler for practice/assessment completion
  const handlePracticeComplete = async ({ lessonId, score, total, difficulty }: { lessonId: string, score: number, total: number, difficulty?: string }) => {
    // Call the new API route for adaptive mastery
    const res = await fetch('/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, score, total, difficulty })
    })
    const result = await res.json()
    setLessonPlan(prev => {
      if (!prev) return prev
      const lessons = prev.lessons.map(lesson =>
        lesson.id === lessonId ? { ...lesson, completed: result.success } : lesson
      )
      return { ...prev, lessons }
    })
    // Show feedback to the user
    if (result.success) {
      toast.success(result.message || 'Lesson mastered! You can advance to the next lesson.')
      // If a lesson or subject summary is present, add it to the stream
      if (result.summary && result.summary.content) {
        setStream(prev => [...prev, {
          id: `summary-${lessonId}-${Date.now()}`,
          streamType: 'message',
          role: 'assistant',
          content: typeof result.summary.content === 'string' ? result.summary.content : JSON.stringify(result.summary.content),
          timestamp: new Date()
        }])
      }
      if (result.subjectSummary && result.subjectSummary.content) {
        setStream(prev => [...prev, {
          id: `subject-summary-${Date.now()}`,
          streamType: 'message',
          role: 'assistant',
          content: typeof result.subjectSummary.content === 'string' ? result.subjectSummary.content : JSON.stringify(result.subjectSummary.content),
          timestamp: new Date()
        }])
      }
    } else {
      toast.error(result.message || 'Keep practicing to master this lesson.')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Main Dashboard Content */}
      <div className="flex-1 flex flex-col lg:flex-row bg-gray-50 overflow-hidden">
        {/* History Pane - Responsive width */}
        <div className="w-full md:w-80 lg:w-72 xl:w-80 2xl:w-96 bg-white border-r border-gray-200 flex-shrink-0 
                        md:block hidden overflow-y-auto">
          <HistoryPane 
            subjects={subjects}
            selectedSubject={currentSubject}
            user={user}
            onSubjectSelect={selectSubject}
            onSubjectDelete={deleteSubject}
            onSubjectCreate={async (name) => {
              try {
                const newSubject = await createSubject(name)
                selectSubject(newSubject)
              } catch (e) {
                // Optionally handle error (already handled in HistoryPane UI)
              }
            }}
            showCloseButton={false}
            onGoalsAndLevelSet={handleGoalsAndLevelSet}
          />
          {/* Lesson Plan Sidebar Section */}
          {lessonPlan && (
            <div className="p-4 border-t border-gray-200 bg-white">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Lesson Plan</h3>
              <ol className="space-y-2">
                {lessonPlan.lessons.map((lesson, idx) => (
                  <li
                    key={lesson.id}
                    className={`flex items-center space-x-2 px-2 py-1 rounded transition-colors ${
                      lessonPlan.currentLessonIndex === idx
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : lesson.completed
                        ? 'text-green-700 line-through'
                        : 'text-gray-700'
                    }`}
                  >
                    {lessonPlan.currentLessonIndex === idx ? (
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-2" />
                    ) : lesson.completed ? (
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2" />
                    ) : (
                      <span className="inline-block w-2 h-2 bg-gray-300 rounded-full mr-2" />
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        
        {/* Mobile History Toggle - Show on mobile */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="sm"
            className="bg-white shadow-lg"
            onClick={() => {
              const historyPane = document.getElementById('mobile-history-pane')
              if (historyPane) {
                historyPane.classList.toggle('hidden')
              }
            }}
          >
            📚 <span className="ml-1">Subjects</span>
          </Button>
        </div>

        {/* Mobile History Pane - Overlay */}
        <div 
          id="mobile-history-pane"
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50 hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.currentTarget.classList.add('hidden')
            }
          }}
        >
          <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl">
            <div className="h-full overflow-hidden">
              <HistoryPane 
                subjects={subjects}
                selectedSubject={currentSubject}
                user={user}
                showCloseButton={true}
                onClose={() => {
                  const historyPane = document.getElementById('mobile-history-pane')
                  if (historyPane) {
                    historyPane.classList.add('hidden')
                  }
                }}
                onSubjectSelect={(subject) => {
                  selectSubject(subject)
                  // Close mobile menu after selection
                  const historyPane = document.getElementById('mobile-history-pane')
                  if (historyPane) {
                    historyPane.classList.add('hidden')
                  }
                }}
                onSubjectDelete={deleteSubject}
                onGoalsAndLevelSet={handleGoalsAndLevelSet}
              />
            </div>
          </div>
        </div>
        
        {/* Main Content Area - Responsive layout */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 overflow-hidden">
          {/* Unified StreamPane replaces ContentPane and ChatPane */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <StreamPane
              stream={stream}
              onInteraction={handleInteraction}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 