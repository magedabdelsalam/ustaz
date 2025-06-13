'use client'

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { HistoryPane } from '@/components/HistoryPane'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { persistenceService } from '@/lib/persistenceService'
import { 
  Message, 
  LessonPlan, 
  CurrentLesson,
  AppError,
  StreamItem,
  StreamMessage
} from '@/types'
import { StreamPane } from './StreamPane'
import { useAITutor } from '@/hooks/useAITutor'
import { useSubjectSession } from '@/hooks/useSubjectSession'
import { toast } from 'sonner'
import { ErrorAlert } from '@/components/ui/error-alert'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

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
  const [error, setError] = useState<AppError | null>(null)

  // State for lesson plan
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | undefined>()
  const [currentLesson, setCurrentLesson] = useState<CurrentLesson | undefined>()

  // Initialize AI Tutor with handlers
  const { 
    sendMessage, 
    handleInteraction,
    getLessonPlan,
    getCurrentLesson,
    onLessonChange
  } = useAITutor({
    onError: (err) => {
      setError(err)
      setIsLoading(false)
    },
    onLoadingChange: (loading) => setIsLoading(loading)
  })

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
  const { loadSubjectSession } = useSubjectSession({
    user,
    selectedSubject: currentSubject,
    onMessagesLoaded,
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

  // Note: handleNewMessage removed as it was unused

  // Handle user sending a message
  const handleSendMessage = async (message: string) => {
    try {
      setIsLoading(true)
      setError(null)
      await sendMessage(message)
    } catch (err) {
      setError(err as AppError)
    } finally {
      setIsLoading(false)
    }
  }

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
      currentSubject.userLevel = level as 'beginner' | 'intermediate' | 'advanced' | undefined
    }
    // Update TutorContext in useAITutor so backend receives the info
    if (onLessonChange) {
      onLessonChange(0)
    }
  }

  // Handler for practice/assessment completion (currently unused but kept for future use)
  const _handlePracticeComplete = async ({ lessonId, score, total, difficulty }: { lessonId: string, score: number, total: number, difficulty?: string }) => {
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

  // Handle lesson completion
  const handleLessonComplete = useCallback(async () => {
    if (!lessonPlan || !currentLesson) return;

    try {
      // Update lesson plan to mark current lesson as completed
      const updatedLessons = [...lessonPlan.lessons];
      updatedLessons[lessonPlan.currentLessonIndex] = {
        ...updatedLessons[lessonPlan.currentLessonIndex],
        completed: true
      };

      const updatedPlan = {
        ...lessonPlan,
        lessons: updatedLessons
      };

      setLessonPlan(updatedPlan);

      // Save progress to persistence
      if (user?.id && currentSubject?.id) {
        // Convert stream items to messages
        const messages: Message[] = stream
          .filter(item => item.streamType === 'message')
          .map(item => ({
            id: item.id,
            role: (item as StreamMessage).role,
            content: (item as StreamMessage).content,
            timestamp: item.timestamp,
            hasGeneratedContent: false // Default value for ai-tutor-service compatibility
          }));

        const context = {
          subject: currentSubject,
          lessonPlan: updatedPlan,
          conversationHistory: messages
        };
        await persistenceService.saveTutorContext(user.id, currentSubject.id, context as any);
      }

      // Show success message
      toast.success('Lesson completed successfully!');
    } catch (error) {
      console.error('Failed to complete lesson:', error);
      toast.error('Failed to complete lesson. Please try again.');
    }
  }, [lessonPlan, currentLesson, user, currentSubject, stream]);

  // Handle next lesson (currently unused but kept for future use)
  const _handleNextLesson = useCallback((targetIndex?: number) => {
    if (!lessonPlan) return;

    const nextIndex = targetIndex ?? lessonPlan.currentLessonIndex + 1;
    if (nextIndex >= lessonPlan.lessons.length) return;

    const nextLesson = lessonPlan.lessons[nextIndex];
    setCurrentLesson({
      id: nextLesson.id,
      title: nextLesson.title,
      description: nextLesson.description,
      progress: 0,
      objectives: nextLesson.objectives || [],
      completedObjectives: []
    });

    setLessonPlan(prev => prev ? {
      ...prev,
      currentLessonIndex: nextIndex
    } : undefined);

    // Notify AI tutor about lesson change
    if (onLessonChange) {
      onLessonChange(nextIndex);
    }
  }, [lessonPlan, onLessonChange])

  // Get current lesson info (currently unused but kept for future use)
  const _currentLessonInfo = useMemo(() => {
    if (!lessonPlan || lessonPlan.currentLessonIndex < 0) return null;
    
    const lesson = lessonPlan.lessons[lessonPlan.currentLessonIndex];
    return {
      title: lesson.title,
      description: lesson.description,
      progress: lesson.completed ? 100 : 0, // You might want to calculate this based on actual progress
      achievement: lesson.achievement
    };
  }, [lessonPlan]);

  const handleRetry = useCallback(() => {
    setError(null)
  }, [])

  // Simple approach: try to get lesson data when available, with error handling
  useEffect(() => {
    let isMounted = true
    
    const tryGetLessonData = async () => {
      if (!currentSubject?.id) {
        setLessonPlan(undefined)
        setCurrentLesson(undefined)
        return
      }

      try {
        const [plan, lesson] = await Promise.all([
          getLessonPlan().catch(() => null),
          getCurrentLesson().catch(() => null)
        ])
        
        if (isMounted) {
          if (plan) setLessonPlan(plan)
          if (lesson) setCurrentLesson(lesson)
        }
      } catch (err) {
        console.log('Lesson data not yet available:', err)
        // Don't set error state for missing lesson data
      }
    }

    tryGetLessonData()
    
    return () => {
      isMounted = false
    }
  }, [currentSubject?.id]) // Only depend on subject ID

  if (isLoading && !stream.length) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" message="Loading dashboard..." />
      </div>
    )
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
            <Card className="p-4 border-t border-t-border">
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
            </Card>
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
              lessonPlan={lessonPlan}
              currentLesson={currentLesson}
              onLessonComplete={handleLessonComplete}
              error={error}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 