import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AppError } from '@/lib/errorHandler'
import { AnalyticsService } from '@/lib/analyticsService'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ErrorAlert } from '@/components/ui/error-alert'
import { renderInteractiveComponent } from '@/lib/interactive-components'
import type { StreamItem, StreamMessage, StreamInteractiveContent } from '@/types'

interface StreamPaneProps {
  currentLesson: {
    id: string
    title: string
    description: string
    progress: number
    objectives: string[]
    completedObjectives: string[]
    achievement?: {
      id: string
      title: string
      description: string
      icon: string
    }
  } | null
  stream: StreamItem[]
  onSendMessage: (message: string) => Promise<void>
  isLoading: boolean
  error: AppError | null
}

export function StreamPane({
  currentLesson,
  stream,
  onSendMessage,
  isLoading,
  error
}: StreamPaneProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const analyticsService = AnalyticsService.getInstance()

  const virtualizer = useVirtualizer({
    count: stream.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  })

  const handleSend = async () => {
    if (!input.trim() || isSending) return

    setIsSending(true)
    try {
      await onSendMessage(input)
      setInput('')
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInteraction = useCallback((type: string, data: any) => {
    const startTime = Date.now()
    const engagementTime = startTime - (data.startTime || startTime)
    analyticsService.trackInteractiveComponentUsage(
      'current-user', // TODO: Get actual user ID
      data.id,
      type,
      data.success || false,
      engagementTime
    )
  }, [analyticsService])

  const renderStreamItem = useCallback((virtualRow: { index: number; start: number; size: number }) => {
    const item = stream[virtualRow.index]

    if (item.streamType === 'message') {
      const message = item as StreamMessage
      return (
        <div
          key={message.id}
          className={cn(
            "flex gap-4 p-4",
            message.role === 'user' ? "bg-muted/50" : "bg-background"
          )}
          style={{
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`
          }}
        >
          <div className="flex-shrink-0">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{message.role === 'user' ? 'You' : 'Assistant'}</span>
              <span className="text-sm text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="prose prose-sm max-w-none">
              {message.content}
            </div>
          </div>
        </div>
      )
    }

    const interactiveContent = item as StreamInteractiveContent
    return (
      <div
        key={interactiveContent.id}
        className="p-4 bg-muted/30"
        style={{
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`
        }}
      >
        {renderInteractiveComponent(interactiveContent, handleInteraction)}
      </div>
    )
  }, [stream, handleInteraction])

  return (
    <div className="flex flex-col h-full">
      {/* Lesson Progress */}
      {currentLesson ? (
        <Card className="rounded-none border-x-0 border-t-0">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{currentLesson.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {currentLesson.completedObjectives.length}/{currentLesson.objectives.length} Objectives
                </Badge>
                {currentLesson.achievement && (
                  <Badge variant="secondary" className="text-xs">
                    {currentLesson.achievement.title}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Progress value={currentLesson.progress} className="h-2" />
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-none border-x-0 border-t-0">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Loading lesson...</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Progress value={0} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map(renderStreamItem)}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4">
          <ErrorAlert error={error} />
        </div>
      )}

      {/* Input */}
      <Card className="rounded-none border-x-0 border-b-0">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading || isSending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isSending}
              className="flex items-center gap-2"
            >
              {isSending ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>Send</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 