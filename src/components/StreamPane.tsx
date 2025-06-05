import React from 'react'
import { useState } from 'react'
import { Message, InteractiveContent } from '@/types'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Interactive from '@/components/interactive'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

// TODO: Move these types to src/types/index.ts
export type StreamItemType = 'message' | 'interactive'
export interface StreamMessage extends Message { streamType: 'message'; timestamp: Date }
export interface StreamInteractiveContent extends InteractiveContent { streamType: 'interactive'; timestamp: Date }
export type StreamItem = StreamMessage | StreamInteractiveContent

function getTimestamp(item: StreamItem): number {
  // Accept both Date and string for robustness
  if (item.timestamp instanceof Date) return item.timestamp.getTime()
  if (typeof item.timestamp === 'string') return new Date(item.timestamp).getTime()
  return 0
}

// Map ComponentType to Interactive export
const componentTypeMap: Record<string, React.ComponentType<any>> = {
  'multiple-choice': Interactive.MultipleChoice,
  'fill-blank': Interactive.FillInTheBlank,
  'drag-drop': Interactive.DragAndDrop,
  'step-solver': Interactive.StepByStepSolver,
  'concept-card': Interactive.ConceptCard,
  'interactive-example': Interactive.InteractiveExample,
  'progress-quiz': Interactive.ProgressQuiz,
  'graph-visualizer': Interactive.GraphVisualizer,
  'formula-explorer': Interactive.FormulaExplorer,
  'text-highlighter': Interactive.TextHighlighter,
  'explainer': Interactive.Explainer,
  'placeholder': Interactive.Placeholder,
}

interface StreamPaneProps {
  stream: StreamItem[]
  onInteraction: (action: string, data: unknown) => void
  onSendMessage: (message: string) => void
  isLoading?: boolean
  lessonPlan?: import('@/types').LessonPlan | null
}

// Helper: Detect if a message is a clarifying question
const isClarifyingQuestion = (content: string) => {
  return /can you clarify|clarify|unclear|ambiguous|what do you mean|please specify/i.test(content)
}

export const StreamPane: React.FC<StreamPaneProps> = ({ stream, onInteraction, onSendMessage, isLoading, lessonPlan }) => {
  // Sort stream by timestamp ascending
  const sortedStream = [...stream].sort((a, b) => getTimestamp(a) - getTimestamp(b))

  // Input state
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)

  // Scroll to bottom when stream changes
  const bottomRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sortedStream.length])

  // Helper to determine if an interactive is the first explainer for the current lesson
  const isFirstLessonExplainer = (item: StreamItem, idx: number) => {
    if (!lessonPlan || item.streamType !== 'interactive' || item.type !== 'explainer') return false
    // Find the first explainer for the current lesson in the stream
    const currentLesson = lessonPlan.lessons[lessonPlan.currentLessonIndex]
    let found = false
    for (let i = 0; i <= idx; i++) {
      const s = sortedStream[i]
      if (s.streamType === 'interactive' && s.type === 'explainer') {
        // Type guard: check if s.data is an object and has a title property
        const data = s.data as { title?: string } | undefined
        if (!found && data && typeof data.title === 'string' && currentLesson && data.title === currentLesson.title) {
          found = true
          if (i === idx) return true
        }
      }
    }
    return false
  }

  // Render a chat message (user or assistant)
  const renderMessage = (item: StreamMessage) => (
    <div
      key={item.id}
      role="article"
      aria-label={item.role === 'user' ? 'Your message' : 'AI message'}
      tabIndex={0}
      className={`my-2 flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`rounded-lg px-4 py-2 max-w-[70%] text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors duration-100 ${
          item.role === 'user'
            ? 'bg-blue-700 text-white self-end'
            : 'bg-gray-100 text-gray-900 self-start'
        }`}
        tabIndex={-1}
      >
        {item.content}
      </div>
    </div>
  )

  // Render an interactive component
  const renderInteractive = (item: StreamInteractiveContent, idx: number) => {
    const { type, data, id } = item
    const Component = componentTypeMap[type]
    if (!Component) {
      return (
        <div key={id} className="my-4 p-4 bg-yellow-100 text-yellow-800 rounded">
          Unknown interactive type: {type}
        </div>
      )
    }
    const firstExplainer = isFirstLessonExplainer(item, idx)
    return (
      <div key={id} className={`my-4 ${firstExplainer ? 'border-2 border-blue-400 rounded-lg shadow-lg bg-blue-50' : ''}`}> 
        {firstExplainer && (
          <div className="mb-2 flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-semibold">Lesson Start</span>
            <span className="text-xs text-blue-700 font-medium">First Explainer for this Lesson</span>
          </div>
        )}
        <Component onInteraction={onInteraction} content={data} id={id} />
      </div>
    )
  }

  // Handle send
  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      await onSendMessage(trimmed)
      setInputValue('')
    } finally {
      setSending(false)
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white" role="feed" aria-live="polite" aria-busy={isLoading} tabIndex={0}>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
          </div>
        )}
        {sortedStream.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageCircle className="h-12 w-12 mb-2" />
            <div className="text-lg font-medium">No messages yet</div>
            <div className="text-sm">Start a conversation or lesson to see content here.</div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {sortedStream.map((item, idx) => {
            if (item.streamType === 'message') {
              // Render clarifying question as an interactive prompt
              if (item.role === 'assistant' && isClarifyingQuestion(item.content)) {
                return (
                  <motion.div
                    key={item.id}
                    role="form"
                    aria-label="Clarifying question"
                    tabIndex={0}
                    className="my-4 flex flex-col items-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="mb-2 px-4 py-2 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-900 rounded">
                      <span className="font-semibold">AI needs clarification:</span> {item.content}
                    </div>
                    <form
                      className="flex gap-2 w-full"
                      onSubmit={e => {
                        e.preventDefault()
                        const form = e.target as HTMLFormElement
                        const input = form.elements.namedItem('clarification') as HTMLInputElement
                        if (input && input.value.trim()) {
                          onSendMessage(input.value.trim())
                          input.value = ''
                        }
                      }}
                    >
                      <Input
                        name="clarification"
                        placeholder="Type your clarification..."
                        className="flex-1"
                        aria-label="Clarification input"
                        autoFocus
                      />
                      <Button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white">Send</Button>
                    </form>
                  </motion.div>
                )
              }
              return renderMessage(item as StreamMessage)
            } else if (item.streamType === 'interactive') {
              return (
                <motion.div
                  key={item.id}
                  role="article"
                  aria-label="Interactive lesson"
                  tabIndex={0}
                  className="my-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderInteractive(item as StreamInteractiveContent, idx)}
                </motion.div>
              )
            }
            return null
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
      {/* User input pinned at bottom */}
      <div className="shrink-0 p-4 border-t bg-white" role="form" aria-label="Send a message">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
            disabled={sending || isLoading}
            aria-label="Message input"
            autoFocus
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending || isLoading}
            aria-label="Send message"
            className="transition-all duration-150 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-800 active:scale-95"
          >
            {sending ? <Loader2 className="animate-spin h-5 w-5" /> : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
} 