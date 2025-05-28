'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner, SpinnerIcon } from '@/components/ui/loading-spinner'
import { Bot, User, Sparkles } from 'lucide-react'
import { Message } from '@/types/chat'

interface LessonInfo {
  current: number
  total: number
}

interface ProgressInfo {
  correct: number
  total: number
  ready: boolean
}

interface ChatMessageListProps {
  messages: Message[]
  isTyping: boolean
  isLoading: boolean
  pendingCount: number
  scrollRef: React.RefObject<HTMLDivElement | null>
  lessonInfo?: LessonInfo
  progressInfo?: ProgressInfo
}

export function ChatMessageList({
  messages,
  isTyping,
  isLoading,
  pendingCount,
  scrollRef,
  lessonInfo,
  progressInfo
}: ChatMessageListProps) {
  return (
    <ScrollArea className="flex-1 p-6 overflow-y-auto" ref={scrollRef}>
      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" text="Loading conversation..." />
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] ${
                message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
              } rounded-lg p-3`}
            >
              <div className="flex items-start space-x-2">
                {message.role === 'assistant' && <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.hasGeneratedContent && (
                    <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-opacity-20">
                      <Sparkles className="h-3 w-3" />
                      <span className="text-xs opacity-75">Interactive content created</span>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.role === 'user' && <User className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 rounded-lg p-3 max-w-[80%]">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 flex-shrink-0" />
                <SpinnerIcon size="sm" />
                <span className="text-xs text-gray-500">Generating response...</span>
              </div>
            </div>
          </div>
        )}

        {lessonInfo && progressInfo && messages.length > 0 && (
          <div className="sticky bottom-0 bg-gradient-to-t from-white to-transparent p-2">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                Lesson {lessonInfo.current}/{lessonInfo.total}
              </Badge>
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                {progressInfo.correct}/{progressInfo.total} correct
              </Badge>
              {progressInfo.ready && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">🎉 Ready to advance!</Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">💾 {pendingCount}</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
