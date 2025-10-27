'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SpinnerIcon } from '@/components/ui/loading-spinner'
import { Subject, StreamItem, StreamInteractiveItem, ComponentType, Message, StreamMessageItem, LessonInfo, ProgressInfo, LessonPlan } from '@/types'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useAITutor } from '@/hooks/useAITutor'
import { useSubjectSession } from '@/hooks/useSubjectSession'
import { persistenceService } from '@/lib/persistenceService'
import dynamic from 'next/dynamic'

// Loading component for interactive components
const InteractiveLoading = () => (
  <div className="w-full p-8 bg-gray-50 rounded-lg animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
    <div className="space-y-3">
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
    </div>
  </div>
)

// Dynamically import interactive components to ensure they only render on client
// This fixes hydration issues and drag-and-drop not working in Next.js 16
const MultipleChoice = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.MultipleChoice })), { ssr: false, loading: () => <InteractiveLoading /> })
const ConceptCard = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.ConceptCard })), { ssr: false, loading: () => <InteractiveLoading /> })
const StepByStepSolver = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.StepByStepSolver })), { ssr: false, loading: () => <InteractiveLoading /> })
const FillInTheBlank = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.FillInTheBlank })), { ssr: false, loading: () => <InteractiveLoading /> })
const DragAndDrop = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.DragAndDrop })), { ssr: false, loading: () => <InteractiveLoading /> })
const InteractiveExample = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.InteractiveExample })), { ssr: false, loading: () => <InteractiveLoading /> })
const ProgressQuiz = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.ProgressQuiz })), { ssr: false, loading: () => <InteractiveLoading /> })
const GraphVisualizer = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.GraphVisualizer })), { ssr: false, loading: () => <InteractiveLoading /> })
const FormulaExplorer = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.FormulaExplorer })), { ssr: false, loading: () => <InteractiveLoading /> })
const TextHighlighter = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.TextHighlighter })), { ssr: false, loading: () => <InteractiveLoading /> })
const Explainer = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.Explainer })), { ssr: false, loading: () => <InteractiveLoading /> })
const Placeholder = dynamic(() => import('@/components/interactive').then(mod => ({ default: mod.Placeholder })), { ssr: false, loading: () => <InteractiveLoading /> })

interface StreamPaneProps {
  selectedSubject: Subject | null
}

export default function StreamPane({ selectedSubject }: StreamPaneProps) {
  const { user } = useAuth()
  const [stream, setStream] = useState<StreamItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [lessonInfo, setLessonInfo] = useState<LessonInfo | null>(null)
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  const initialHashHandledRef = useRef(false)
  const idCounterRef = useRef(0)
  
  // Text streaming state
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const aiTutor = useAITutor({
    subject: selectedSubject,
    userId: user?.id,
    instructionOverrides: { preferInteractiveContent: true },
    onInteractiveContent: async (content) => {
      const newItem: StreamInteractiveItem = {
        id: content.id,
        kind: 'interactive',
        type: content.type as ComponentType,
        data: content.data,
        timestamp: new Date(),
        title: undefined,
      }
      setStream(prev => [...prev, newItem])

      // Persist interactive item (best-effort)
      try {
        if (user && selectedSubject) {
          const interactiveCount = stream.filter(i => i.kind === 'interactive').length
          await persistenceService.saveContentItem({
            id: newItem.id,
            user_id: user.id,
            subject_id: selectedSubject.id,
            type: newItem.type,
            data: newItem.data as Record<string, unknown>,
            title: newItem.title || newItem.type,
            order_index: interactiveCount,
            timestamp: newItem.timestamp.toISOString(),
          })
        }
      } catch {
        // no-op
      }

      // Announce to index consumers
      window.dispatchEvent(new CustomEvent('streamInteractiveAdded', { detail: newItem }))
    },
    onLessonPlanCreated: (plan: LessonPlan) => {
      setLessonInfo({ current: (plan.currentLessonIndex ?? 0) + 1, total: plan.lessons.length })
    },
    onProgressUpdated: (p) => {
      setProgressInfo({ correct: p.correctAnswers, total: p.totalAttempts, ready: !!p.readyForNext })
      if (typeof p.currentLessonIndex === 'number' && lessonInfo) {
        setLessonInfo({ current: p.currentLessonIndex + 1, total: lessonInfo.total })
      }
    },
  })

  const generateUniqueId = useCallback((prefix: string) => {
    idCounterRef.current += 1
    try {
      const maybeCrypto = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
      if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
        return `${prefix}-${maybeCrypto.randomUUID()}`
      }
    } catch {
      // ignore
    }
    const rand = Math.random().toString(36).slice(2, 8)
    return `${prefix}-${Date.now()}-${idCounterRef.current}-${rand}`
  }, [])

  const { loadSubjectSession, isLoadingMessages } = useSubjectSession({
    user,
    selectedSubject,
    onMessagesLoaded: async (loadedMessages) => {
      // Interleave messages with any existing content feed from persistence
      const messageItems: StreamMessageItem[] = loadedMessages.map(m => ({
        id: m.id,
        kind: 'message',
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }))

      let contentItems: StreamInteractiveItem[] = []
      try {
        if (user && selectedSubject) {
          const persisted = await persistenceService.getContentFeedBySubject(user.id, selectedSubject.id)
          contentItems = (persisted || []).map(item => ({
            id: item.id,
            kind: 'interactive',
            type: item.type,
            data: item.data,
            title: item.title,
            timestamp: new Date(item.timestamp),
          }))
        }
      } catch {
        contentItems = []
      }

      const unified: StreamItem[] = [...messageItems, ...contentItems].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      setStream(unified)

      // CRITICAL: Update AI tutor context with loaded conversation history
      // This ensures the AI remembers previous conversations when user returns
      if (loadedMessages.length > 0) {
        const conversationHistory = loadedMessages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        }))
        
        console.log('🧠 Restoring conversation history to AI context:', conversationHistory.length, 'messages')
        aiTutor.updateContext({
          conversationHistory,
          subject: selectedSubject || undefined,
          userId: user?.id
        })
      } else {
        // Clear context for new conversations
        aiTutor.updateContext({
          conversationHistory: [],
          subject: selectedSubject || undefined,
          userId: user?.id
        })
      }
    }
  })

  useEffect(() => {
    if (selectedSubject && user) {
      loadSubjectSession()
    } else {
      setStream([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject?.id, user?.id])

  const getViewportEl = useCallback((): HTMLElement | null => {
    if (!scrollAreaRef.current) return null
    const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
    return viewport || null
  }, [])

  const scrollToBottom = useCallback(() => {
    const viewport = getViewportEl()
    if (!viewport) return
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
    })
  }, [getViewportEl])

  const scrollToHash = useCallback(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  useEffect(() => {
    // Only auto-scroll if the user is near the bottom
    if (autoScrollEnabled) {
      scrollToBottom()
    }
    // Only auto-handle hash once after initial load
    if (!initialHashHandledRef.current) {
      initialHashHandledRef.current = true
      scrollToHash()
    }
  }, [stream, scrollToBottom, scrollToHash, autoScrollEnabled])

  // Track whether user is near bottom to gate autoscroll
  useEffect(() => {
    const viewport = getViewportEl()
    if (!viewport) return
    const handler = () => {
      const threshold = 64 // px
      const distanceFromBottom = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight)
      setAutoScrollEnabled(distanceFromBottom <= threshold)
    }
    viewport.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => viewport.removeEventListener('scroll', handler as EventListener)
  }, [getViewportEl])

  useEffect(() => {
    const onHashChange = () => scrollToHash()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [scrollToHash])

  const saveMessage = useCallback(async (message: Message) => {
    if (!user || !selectedSubject) return
    // Skip persisting empty messages
    if (!message.content || message.content.trim().length === 0) return
    await persistenceService.saveMessage({
      id: message.id,
      user_id: user.id,
      subject_id: selectedSubject.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      has_generated_content: message.hasGeneratedContent || false,
    })
  }, [selectedSubject, user])

  const appendAssistantResponse = useCallback(async (response: string, hasInteractive: boolean) => {
    const trimmedResponse = (response ?? '').trim()
    if (trimmedResponse.length === 0) {
      // Do not append or persist empty assistant messages
      return
    }
    const aiMsg: Message = {
      id: generateUniqueId('ai'),
      role: 'assistant',
      content: trimmedResponse,
      timestamp: new Date(),
      hasGeneratedContent: hasInteractive,
    }
    const streamItem: StreamMessageItem = { id: aiMsg.id, kind: 'message', role: 'assistant', content: aiMsg.content, timestamp: aiMsg.timestamp }
    
    // Add message to stream
    setStream(prev => [...prev, streamItem])
    
    // Start streaming animation for this message
    streamText(aiMsg.id, trimmedResponse)
    
    void saveMessage(aiMsg)
  }, [saveMessage, generateUniqueId])
  
  // Stream text with typing animation
  const streamText = useCallback((messageId: string, fullText: string) => {
    // Clear any existing streaming
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current)
    }
    
    setStreamingMessageId(messageId)
    setStreamingText('')
    
    let currentIndex = 0
    const charsPerStep = 2 // Show 2 characters at a time for smoother animation
    const delayMs = 15 // 15ms between updates for fast but smooth streaming
    
    const streamNextChunk = () => {
      if (currentIndex >= fullText.length) {
        setStreamingMessageId(null)
        return
      }
      
      currentIndex += charsPerStep
      setStreamingText(fullText.slice(0, Math.min(currentIndex, fullText.length)))
      
      streamingTimeoutRef.current = setTimeout(streamNextChunk, delayMs)
    }
    
    streamNextChunk()
  }, [])

  const appendInteractiveFromTool = useCallback(async (result: unknown) => {
    const data = result as { type?: string; componentType?: ComponentType; content?: unknown; learningObjective?: string }
    if (data?.type === 'interactive_component' && data.componentType) {
      const newItem: StreamInteractiveItem = {
        id: generateUniqueId('interactive'),
        kind: 'interactive',
        type: data.componentType,
        data: data.content,
        timestamp: new Date(),
        title: data.learningObjective || data.componentType
      }
      setStream(prev => [...prev, newItem])
      try {
        if (user && selectedSubject) {
          const interactiveCount = stream.filter(i => i.kind === 'interactive').length
          await persistenceService.saveContentItem({
            id: newItem.id,
            user_id: user.id,
            subject_id: selectedSubject.id,
            type: newItem.type,
            data: (newItem.data || {}) as Record<string, unknown>,
            title: newItem.title || newItem.type,
            order_index: interactiveCount,
            timestamp: newItem.timestamp.toISOString(),
          })
        }
      } catch {
        // no-op
      }
      window.dispatchEvent(new CustomEvent('streamInteractiveAdded', { detail: newItem }))
    }
  }, [selectedSubject, stream, user, generateUniqueId])

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || isTyping) return
    setInputValue('')
    setIsTyping(true)

    const userMsg: Message = { id: generateUniqueId('user'), role: 'user', content: trimmed, timestamp: new Date() }
    const userItem: StreamMessageItem = { id: userMsg.id, kind: 'message', role: 'user', content: trimmed, timestamp: userMsg.timestamp }
    setStream(prev => [...prev, userItem])
    void saveMessage(userMsg)

    try {
      // Prefer streaming to improve UX
      let assistantMessageAppended = false
      const appendedAssistantContents = new Set<string>()
      const normalizeText = (t: string) => t.trim().replace(/\s+/g, ' ')
      await aiTutor.sendMessageStream(trimmed, async (evt) => {
        if (evt.event === 'assistant_message' && typeof evt.data === 'object' && evt.data) {
          const content = (evt.data as { content?: string }).content
          if (typeof content === 'string' && content.trim().length > 0) {
            const normalized = normalizeText(content)
            if (!appendedAssistantContents.has(normalized)) {
              appendedAssistantContents.add(normalized)
              await appendAssistantResponse(content, false)
            }
            assistantMessageAppended = true
          }
        }
        if (evt.event === 'tool_call') {
          // no-op: could display tool activity indicator
        }
        if (evt.event === 'tool_result') {
          const data = (evt.data || {}) as { name?: string; result?: unknown }
          switch (data.name) {
            case 'new_subject': {
              const r = (data.result || {}) as { success?: boolean; subject?: { id: string; name: string } }
              if (r?.success && r.subject) {
                // Announce new subject to app so Dashboard/store can switch context
                const announceEvent = new CustomEvent('newSubjectCreated', {
                  detail: {
                    subject: r.subject,
                    initialMessage: { id: userMsg.id, content: userMsg.content, timestamp: userMsg.timestamp },
                    initialResponse: null
                  }
                })
                window.dispatchEvent(announceEvent)
              }
              break
            }
            case 'interactive_component':
              await appendInteractiveFromTool(data.result)
              break
            case 'new_lesson_plan': {
              const res = (data.result || {}) as { lessonPlan?: LessonPlan }
              if (res.lessonPlan) {
                setLessonInfo({ current: (res.lessonPlan.currentLessonIndex ?? 0) + 1, total: res.lessonPlan.lessons.length })
              }
              break
            }
            case 'lesson_complete':
            case 'next_lesson': {
              const r = (data.result || {}) as { correctAnswers?: number; totalAttempts?: number; lessonNumber?: number; success?: boolean; totalLessons?: number }
              if (typeof r.lessonNumber === 'number') {
                const total = (r.totalLessons ?? (lessonInfo?.total ?? r.lessonNumber)) as number
                setLessonInfo({ current: r.lessonNumber, total })
              }
              setProgressInfo(prev => ({
                correct: typeof r.correctAnswers === 'number' ? r.correctAnswers : (prev?.correct || 0),
                total: typeof r.totalAttempts === 'number' ? r.totalAttempts : (prev?.total || 0),
                ready: !!r.success
              }))
              break
            }
            default:
              break
          }
        }
        if (evt.event === 'final') {
          const toolCalls = (evt.data as { toolCalls?: Array<{ name: string }> } | undefined)?.toolCalls || []
          const hasInteractive = toolCalls.some(t => t.name === 'interactive_component')
          // final response may be empty if interactive
          const response = (evt.data as { response?: string } | undefined)?.response || ''
          if (response && !assistantMessageAppended) {
            const normalized = normalizeText(response)
            if (!appendedAssistantContents.has(normalized)) {
              appendedAssistantContents.add(normalized)
              await appendAssistantResponse(response, hasInteractive)
            }
          }
        }
      })
    } finally {
      setIsTyping(false)
    }
  }, [aiTutor, appendAssistantResponse, inputValue, isTyping, saveMessage, generateUniqueId, appendInteractiveFromTool, lessonInfo])

  const handleInteraction = useCallback(async (action: string, data: unknown) => {
    const result = await aiTutor.sendMessageWithMetadata(`User interacted: ${action} - ${JSON.stringify(data)}`)
    await appendAssistantResponse(result.response, result.hasGeneratedInteractiveContent)
  }, [aiTutor, appendAssistantResponse])

  const renderInteractive = (item: StreamInteractiveItem) => {
    const props = { onInteraction: handleInteraction, content: item.data, id: item.id }
    switch (item.type) {
      case 'multiple-choice': return <MultipleChoice {...props} />
      case 'concept-card': return <ConceptCard {...props} />
      case 'step-solver': return <StepByStepSolver {...props} />
      case 'fill-blank': return <FillInTheBlank {...props} />
      case 'drag-drop': return <DragAndDrop {...props} />
      case 'interactive-example': return <InteractiveExample {...props} />
      case 'progress-quiz': return <ProgressQuiz {...props} />
      case 'graph-visualizer': return <GraphVisualizer {...props} />
      case 'formula-explorer': return <FormulaExplorer {...props} />
      case 'text-highlighter': return <TextHighlighter {...props} />
      case 'explainer': return <Explainer {...props} />
      case 'placeholder': return <Placeholder {...props} />
      default: return null
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Main stream */}
      <div className="flex-1 overflow-hidden" ref={scrollAreaRef}>
        <ScrollArea className="w-full h-full">
          <div className="max-w-[960px] mx-auto px-8 py-8 space-y-8">
            {isLoadingMessages && <div className="text-sm text-gray-500">Loading…</div>}
            {stream.map(item => (
              <div key={item.id} id={`item-${item.id}`} className="w-full">
                {item.kind === 'message' ? (
                  <div className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {item.role === 'assistant' ? (
                      <div className="px-4 py-2 rounded-lg">
                        <p className="text-lg leading-7 text-black whitespace-pre-wrap">
                          {streamingMessageId === item.id ? streamingText : item.content}
                          {streamingMessageId === item.id && (
                            <span className="inline-block w-1 h-5 ml-0.5 bg-black animate-pulse align-middle" />
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-black/5 px-4 py-2 rounded-[99px] inline-flex items-center justify-end">
                        <p className="text-lg leading-7 text-black text-right">
                          {item.content}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full">{renderInteractive(item)}</div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="text-gray-500 text-sm">Thinking…</div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Progress status bar */}
      {(lessonInfo || progressInfo) && (
        <div className="px-4 py-2 border-t bg-white/70 backdrop-blur">
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-600 flex-wrap gap-2">
            {lessonInfo && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                Lesson {lessonInfo.current}/{lessonInfo.total}
              </Badge>
            )}
            {progressInfo && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                {progressInfo.correct}/{progressInfo.total} correct
              </Badge>
            )}
            {progressInfo?.ready && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">🎉 Ready to advance!</Badge>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="p-4 flex-shrink-0 bg-white">
        <div className="max-w-[960px] mx-auto">
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask anything"
              disabled={isTyping}
              className="w-full bg-black/5 border-0 rounded-[32px] px-6 py-4 text-lg placeholder:text-black/50 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {inputValue.trim() && !isTyping && (
              <Button 
                onClick={() => void handleSend()} 
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            {isTyping && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <SpinnerIcon size="sm" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
