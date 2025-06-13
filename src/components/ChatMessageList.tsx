'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner, SpinnerIcon } from '@/components/ui/loading-spinner'
import { Bot, User, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react'
import { Message, LessonInfo, ProgressInfo } from '@/types'
import { MessageContextMenu } from '@/components/chat/MessageContextMenu'
import { cn } from '@/lib/utils'

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
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-w-[85%]">
      <div className="flex items-start space-x-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm text-foreground mb-3">{retryPrompt.message}</p>
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
  scrollRef: React.RefObject<HTMLDivElement>
  messagesEndRef?: React.RefObject<HTMLDivElement>
  lessonInfo?: LessonInfo
  progressInfo?: ProgressInfo
  onRetryMessage?: (originalAction: string, originalData: unknown) => void
  onDelete?: (messageId: string) => void
}

export function ChatMessageList({
  messages,
  isTyping,
  isLoading,
  pendingCount,
  scrollRef,
  messagesEndRef,
  lessonInfo,
  progressInfo,
  onRetryMessage,
  onDelete
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

  // Wrapper for onRetry to match MessageContextMenu signature
  const handleRetry = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId)
    if (!message || !onRetryMessage) return
    const retryPrompt = parseRetryPrompt(message.content)
    if (retryPrompt) {
      onRetryMessage(retryPrompt.originalAction, retryPrompt.originalData)
    }
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4">
      <div className="space-y-4 min-h-full flex flex-col">
        {isLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" text="Loading conversation..." />
          </div>
        )}
        {messages
          .filter(message => !message.isLocalOnly)
          .map((message) => {
            const retryPrompt = message.role === 'assistant' ? parseRetryPrompt(message.content) : null
            
            return (
              <div key={message.id} className={cn(
                "flex",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
                {retryPrompt && onRetryMessage ? (
                  <ChatRetryMessage 
                    retryPrompt={retryPrompt}
                    onRetry={onRetryMessage}
                  />
                ) : (
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg p-3",
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <MessageContextMenu
                      message={message}
                      onDelete={onDelete}
                      onRetry={message.role === 'assistant' ? handleRetry : undefined}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 overflow-hidden">
                          {message.role === 'assistant' ? (
                            <div className="text-sm prose prose-sm max-w-none">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-sm">{children}</li>,
                                  code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                                  pre: ({ children }) => <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">{children}</pre>,
                                  blockquote: ({ children }) => <blockquote className="border-l-4 border-muted pl-4 italic">{children}</blockquote>,
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
                            <div className="flex items-center space-x-1 mt-2 pt-2 border-t border-border/20">
                              <Sparkles className="h-3 w-3" />
                              <span className="text-xs text-muted-foreground">Interactive content created</span>
                            </div>
                          )}
                          <p className={cn(
                            "text-xs mt-1",
                            message.role === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {message.role === 'user' && <User className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      </div>
                    </MessageContextMenu>
                  </div>
                )}
              </div>
            )
          })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground rounded-lg p-3 max-w-[80%]">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 flex-shrink-0" />
                <SpinnerIcon size="sm" />
                <span className="text-xs text-muted-foreground">Generating response...</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-grow"></div>

        {lessonInfo && progressInfo && messages.length > 0 && (
          <div className="sticky bottom-0 bg-gradient-to-t from-background to-transparent pt-4 pb-2">
            <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground flex-wrap gap-2">
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                Lesson {lessonInfo.current}/{lessonInfo.total}
              </Badge>
              <Badge variant="outline" className="text-xs bg-secondary/10 text-secondary">
                {progressInfo.correct}/{progressInfo.total} correct
              </Badge>
              {progressInfo.ready && (
                <Badge variant="outline" className="text-xs bg-success/10 text-success">🎉 Ready to advance!</Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-xs bg-warning/10 text-warning">💾 {pendingCount}</Badge>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} style={{ height: 1 }}></div>
      </div>
    </div>
  )
}
