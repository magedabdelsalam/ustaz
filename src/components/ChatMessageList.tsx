'use client'

/**
 * ChatMessageList
 * ----------------
 * TODO: Add description and exports for ChatMessageList.
 */


import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner, SpinnerIcon } from '@/components/ui/loading-spinner'
import { Bot, User, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react'
import { Message, LessonInfo, ProgressInfo } from '@/types'

interface ChatRetryMessageProps {
  retryPrompt: {
    type: string
    message: string
    action: string
    originalAction: string
    originalData: unknown
  }
  onRetry: (originalAction: string, originalData: unknown) => void
}

function ChatRetryMessage({ retryPrompt, onRetry }: ChatRetryMessageProps) {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    setRetrying(true)
    await onRetry(retryPrompt.originalAction, retryPrompt.originalData)
    setRetrying(false)
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-[85%]">
      <div className="flex items-start space-x-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
        <div className="flex-1">
          <p className="text-sm text-gray-900 mb-3">{retryPrompt.message}</p>
          <Button 
            onClick={handleRetry} 
            disabled={retrying}
            size="sm"
            variant="outline"
            className="flex items-center space-x-1"
          >
            {retrying ? (
              <SpinnerIcon size="sm" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            <span>Retry</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ChatMessageListProps {
  messages: Message[]
  isTyping: boolean
  isLoading: boolean
  pendingCount: number
  scrollRef: React.RefObject<HTMLDivElement | null>
  lessonInfo?: LessonInfo
  progressInfo?: ProgressInfo
  onRetryMessage?: (originalAction: string, originalData: unknown) => void
}

export function ChatMessageList({
  messages,
  isTyping,
  isLoading,
  pendingCount,
  scrollRef,
  lessonInfo,
  progressInfo,
  onRetryMessage
}: ChatMessageListProps) {
  // Helper function to detect if message content is a retry prompt
  const parseRetryPrompt = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      if (parsed.type === 'retry_prompt' && parsed.action === 'retry') {
        return parsed
      }
    } catch {
      // Not a JSON retry prompt
    }
    return null
  }

  return (
    <ScrollArea className="h-full p-4 overflow-y-auto" ref={scrollRef}>
      <div className="space-y-4 min-h-full flex flex-col">
        {isLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" text="Loading conversation..." />
          </div>
        )}
        {messages.map((message) => {
          const retryPrompt = message.role === 'assistant' ? parseRetryPrompt(message.content) : null
          
          return (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {retryPrompt && onRetryMessage ? (
                <ChatRetryMessage 
                  retryPrompt={retryPrompt}
                  onRetry={onRetryMessage}
                />
              ) : (
                <div
                  className={`max-w-[85%] ${
                    message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                  } rounded-lg p-3`}
                >
                  <div className="flex items-start space-x-2">
                    {message.role === 'assistant' && <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 overflow-hidden">
                      {message.role === 'assistant' ? (
                        <div className="text-sm prose prose-sm max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // Customize styling for markdown elements
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-sm">{children}</li>,
                              code: ({ children }) => <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                              pre: ({ children }) => <pre className="bg-gray-200 p-2 rounded text-xs font-mono overflow-x-auto">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic">{children}</blockquote>,
                              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap overflow-hidden">{message.content}</p>
                      )}
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
              )}
            </div>
          )
        })}

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

        {/* Auto-expanding space to push status badges to bottom when there are few messages */}
        <div className="flex-grow"></div>

        {lessonInfo && progressInfo && messages.length > 0 && (
          <div className="sticky bottom-0 bg-gradient-to-t from-white to-transparent pt-4 pb-2">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 flex-wrap gap-2">
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
