import React from 'react'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { StreamItem, StreamMessage, StreamInteractiveContent, LessonPlan, CurrentLesson } from '@/types'
import { MessageCircle, BookOpen, Target, Award, Loader2, AlertTriangle, Send, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useVirtualizer } from '@tanstack/react-virtual'
import { renderInteractiveComponent } from '@/lib/interactive-components'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorAlert } from '@/components/ui/error-alert'
import { AppError } from '@/types'
import { AnalyticsService } from '@/lib/analyticsService'
import { useToast } from '@/components/ui/use-toast'
import { FeedbackTrigger } from '@/components/feedback/FeedbackTrigger'

interface StreamPaneProps {
  stream: StreamItem[]
  onInteraction: (type: string, data: any) => void
  onSendMessage: (message: string) => void
  lessonPlan?: LessonPlan
  currentLesson?: CurrentLesson
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
  onLessonComplete?: () => void
  onLessonProgress?: (progress: number) => void
}

export function StreamPane({ 
  stream, 
  onInteraction, 
  onSendMessage, 
  lessonPlan, 
  currentLesson,
  isLoading = false,
  error = null,
  onRetry,
  onLessonComplete,
  onLessonProgress
}: StreamPaneProps) {
  const [message, setMessage] = useState('')
  const [isClarifying, setIsClarifying] = useState(false)
  const [clarificationMessage, setClarificationMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const analyticsService = AnalyticsService.getInstance()
  const interactionStartTimes = useRef<Map<string, number>>(new Map())

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: stream.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated height of each message
    overscan: 5, // Number of items to render outside of the visible area
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isClarifying) {
        handleClarificationSubmit()
      } else {
        handleSendMessage()
      }
    }
  }

  const handleClarificationSubmit = async () => {
    if (clarificationMessage.trim() && !sending) {
      setSending(true)
      try {
        await onSendMessage(clarificationMessage)
        setClarificationMessage('')
        setIsClarifying(false)
      } finally {
        setSending(false)
      }
    }
  }

  const handleSendMessage = async () => {
    if (message.trim() && !sending) {
      setSending(true)
      try {
        await onSendMessage(message)
        setMessage('')
      } finally {
        setSending(false)
      }
    }
  }

  // Add focus management
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [stream])

  // Add keyboard focus trap for interactive components
  const handleInteractiveKeyDown = (e: React.KeyboardEvent, componentId: string) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  const handleInteraction = (action: string, data: unknown) => {
    const componentId = (data as Record<string, unknown>).componentId as string
    const startTime = interactionStartTimes.current.get(componentId)
    const engagementTime = startTime ? (Date.now() - startTime) / 1000 : 0

    // Track component usage
    if ((data as Record<string, unknown>).success !== undefined) {
      analyticsService.trackInteractiveComponentUsage(
        'current-user', // TODO: Get actual user ID
        componentId,
        action,
        (data as Record<string, unknown>).success as boolean,
        engagementTime
      )
    }

    // Clear the start time
    interactionStartTimes.current.delete(componentId)

    // Call the original interaction handler
    onInteraction(action, data)
  }

  const renderStreamItem = (item: StreamItem) => {
    if (item.streamType === 'message') {
      const message = item as StreamMessage
      return (
        <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
          <div className={`max-w-[80%] rounded-lg p-3 ${
            message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
          }`}>
            {message.content}
          </div>
        </div>
      )
    } else {
      const interactiveContent = item as StreamInteractiveContent
      // Record start time for this interaction
      interactionStartTimes.current.set(interactiveContent.id, Date.now())
      
      return (
        <div className="mb-4">
          {renderInteractiveComponent(interactiveContent, handleInteraction)}
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Chat conversation">
      {/* Error Alert */}
      {error && (
        <div className="p-4 border-b">
          <ErrorAlert
            error={error}
            onRetry={onRetry}
            onDismiss={() => {}}
            className="mb-4"
          />
        </div>
      )}

      {/* Lesson Progress Section */}
      {currentLesson && (
        <div className="p-4 border-b" role="region" aria-label="Current lesson progress">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{currentLesson.title}</h3>
            <Badge variant="default" className="ml-2">
              {Math.round(currentLesson.progress * 100)}% Complete
            </Badge>
            <FeedbackTrigger
              lessonId={currentLesson.id}
              subjectId={lessonPlan?.subject}
              triggerAfter={600000} // Show feedback after 10 minutes
              onFeedbackSubmitted={() => {
                // Update lesson progress after feedback
                if (onLessonProgress) {
                  onLessonProgress(currentLesson.progress || 0)
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Learning Objectives:</span>
              <span>{currentLesson.completedObjectives?.length || 0} of {currentLesson.objectives?.length || 0} completed</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentLesson.objectives?.map((objective, index) => (
                <Badge
                  key={index}
                  variant={currentLesson.completedObjectives?.includes(objective) ? "default" : "outline"}
                  className="text-xs"
                  aria-label={`Objective ${index + 1}: ${objective} - ${currentLesson.completedObjectives?.includes(objective) ? 'Completed' : 'Not completed'}`}
                >
                  {objective}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Section with Virtualization */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-y-auto p-4"
        role="log"
        aria-label="Chat messages"
      >
        {isLoading && stream.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" message="Loading conversation..." />
          </div>
        ) : stream.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="h-12 w-12 mb-2" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation to see messages here.</p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = stream[virtualRow.index]
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
                  role="listitem"
                >
                  {renderStreamItem(item)}
                </div>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="p-4 border-t" role="region" aria-label="Message input">
        {isClarifying ? (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={clarificationMessage}
              onChange={(e) => setClarificationMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your clarification..."
              className="flex-1"
              aria-label="Clarification input"
              disabled={sending || isLoading}
            />
            <Button
              onClick={handleClarificationSubmit}
              disabled={!clarificationMessage.trim() || sending || isLoading}
              aria-label="Submit clarification"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Submit
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1"
              aria-label="Message input"
              disabled={sending || isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sending || isLoading}
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Send
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 