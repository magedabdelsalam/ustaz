'use client'

/**
 * ContentPane
 * ----------------
 * TODO: Add description and exports for ContentPane.
 */


import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner, SpinnerIcon } from '@/components/ui/loading-spinner'
import { BookOpen, Sparkles, Trash2, RefreshCw, ChevronUp, ChevronDown, History } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { persistenceService } from '@/lib/persistenceService'
import { ContentHistorySidebar } from './history/ContentHistorySidebar'
import { Subject } from '@/types'
import { 
  MultipleChoice, 
  ConceptCard, 
  StepByStepSolver,
  FillInTheBlank,
  DragAndDrop,
  ComponentType,
  InteractiveExample,
  ProgressQuiz,
  GraphVisualizer,
  FormulaExplorer,
  TextHighlighter,
  Explainer,
  Placeholder
} from '@/components/interactive'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

export interface InteractiveContent {
  id: string
  type: ComponentType
  data: unknown
  title: string
  timestamp: Date
}

interface ContentPaneProps {
  selectedSubject: Subject | null
  onContentInteraction?: (action: string, data: unknown) => void
}

export function ContentPane({ 
  selectedSubject, 
  onContentInteraction
}: ContentPaneProps) {
  const { user } = useAuth()
  const [contentFeed, setContentFeed] = useState<InteractiveContent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedContentIndex, setSelectedContentIndex] = useState<number>(-1) // -1 means show latest
  const [navigationDirection, setNavigationDirection] = useState<'next' | 'previous' | 'direct'>('direct')
  const savingContentIdsRef = useRef<Set<string>>(new Set())
  const currentSubjectRef = useRef<string | null>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const contentContainerRef = useRef<HTMLDivElement>(null)
  
  // Get the current content for center display
  const currentContent = selectedContentIndex >= 0 
    ? contentFeed[selectedContentIndex] 
    : contentFeed[contentFeed.length - 1]
  
  // Navigation helpers
  const getCurrentIndex = useCallback(() => selectedContentIndex >= 0 ? selectedContentIndex : contentFeed.length - 1, [selectedContentIndex, contentFeed.length])
  
  const goToNextActivity = useCallback(() => {
    const currentIndex = getCurrentIndex()
    const nextIndex = Math.min(currentIndex + 1, contentFeed.length - 1)
    console.log('🔍 goToNextActivity:', { currentIndex, nextIndex, canMove: nextIndex !== currentIndex })
    
    if (nextIndex !== currentIndex) {
      // Set direction first
      setNavigationDirection('next')
      // Then set content index in next tick to ensure direction is applied
      setTimeout(() => {
        setSelectedContentIndex(nextIndex === contentFeed.length - 1 ? -1 : nextIndex)
      }, 0)
    }
  }, [getCurrentIndex, contentFeed.length])
  
  const goToPreviousActivity = useCallback(() => {
    const currentIndex = getCurrentIndex()
    const prevIndex = Math.max(currentIndex - 1, 0)
    console.log('🔍 goToPreviousActivity:', { currentIndex, prevIndex, canMove: prevIndex !== currentIndex })
    
    if (prevIndex !== currentIndex) {
      // Set direction first
      setNavigationDirection('previous')
      // Then set content index in next tick to ensure direction is applied
      setTimeout(() => {
        setSelectedContentIndex(prevIndex)
      }, 0)
    }
  }, [getCurrentIndex])

  // Handle wheel scrolling for navigation (legitimate useEffect for event listener)
  // This handles wheel events ONLY within the content area to navigate between activities.
  // The event listener is scoped to the contentContainerRef to prevent interference 
  // with chat scrolling or other scroll areas in the application.
  useEffect(() => {
    const handleWheel = (e: Event) => {
      if (contentFeed.length <= 1 || showHistory) return
      
      const wheelEvent = e as WheelEvent
      
      // Prevent event bubbling to ensure it doesn't affect other scroll areas
      wheelEvent.preventDefault()
      wheelEvent.stopPropagation()
      
      // Debounce wheel events
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (Math.abs(wheelEvent.deltaY) > 50) { // Threshold for intentional scroll
          if (wheelEvent.deltaY > 0) {
            // Scroll down - go to next
            goToNextActivity()
          } else {
            // Scroll up - go to previous
            goToPreviousActivity()
          }
        }
      }, 100)
    }

    // Get the content pane container element instead of listening globally
    const contentContainer = contentContainerRef.current
    
    if (contentContainer) {
      contentContainer.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        contentContainer.removeEventListener('wheel', handleWheel)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    } else {
      // Fallback cleanup in case container isn't found
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    }
  }, [contentFeed.length, showHistory, selectedContentIndex, goToNextActivity, goToPreviousActivity])

  // Handle keyboard navigation for arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation if we have multiple activities and history is not open
      if (contentFeed.length <= 1 || showHistory) return
      
      // Only handle arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Check if the focus is on an input element or textarea - if so, don't interfere
        const activeElement = document.activeElement
        if (activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          (activeElement as HTMLElement).contentEditable === 'true' ||
          activeElement.closest('[role="textbox"]') ||
          activeElement.closest('[contenteditable]')
        )) {
          return // Let normal input behavior work
        }
        
        e.preventDefault()
        
        if (e.key === 'ArrowUp') {
          goToPreviousActivity()
        } else if (e.key === 'ArrowDown') {
          goToNextActivity()
        }
      }
    }

    // Add keyboard listener to document when ContentPane is mounted and has content
    if (contentFeed.length > 1) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [contentFeed.length, showHistory, goToNextActivity, goToPreviousActivity])

  const loadContentFeed = useCallback(async () => {
    if (!selectedSubject || !user) {
      setContentFeed([])
      return
    }
    
    setIsLoading(true)
    try {
      const persistedItems = await persistenceService.getContentFeedBySubject(user.id, selectedSubject.id)
      const loadedFeed: InteractiveContent[] = persistedItems.map(item => ({
        id: item.id,
        type: item.type,
        data: item.data,
        title: item.title,
        timestamp: new Date(item.timestamp)
      }))
      setContentFeed(loadedFeed)
    } catch (error) {
      console.error('Failed to load content feed:', error)
      setContentFeed([]) // Clear on error
    } finally {
      setIsLoading(false)
    }
  }, [selectedSubject, user])

  // Load content feed when subject changes - direct effect without intermediate function
  useEffect(() => {
    const newSubjectId = selectedSubject?.id || null
    const previousSubjectId = currentSubjectRef.current
    
    if (newSubjectId !== previousSubjectId) {
      currentSubjectRef.current = newSubjectId
      
      if (selectedSubject && user) {
        console.log('📥 Loading content feed for new subject:', selectedSubject.name)
        loadContentFeed()
      } else {
        console.log('📥 Clearing content feed - no subject selected')
        setContentFeed([])
      }
      
      // Reset to show latest content when subject changes
      setSelectedContentIndex(-1)
    }
  }, [selectedSubject, user, loadContentFeed])

  // Auto-select latest content when new content is added
  useEffect(() => {
    if (contentFeed.length === 0) return
    
    // Only auto-switch to latest if user was already viewing latest (selectedContentIndex was -1)
    // Don't auto-switch if user manually selected an older item
    if (selectedContentIndex === -1) {
      // User is viewing latest, keep it that way
      // Only set direction to 'direct' for truly new content, not for navigation
      return
    }
    
    // If new content was added and user was viewing something specific, don't auto-switch
    // Let them stay on their selected content
  }, [contentFeed.length, selectedContentIndex])

  const handleInteraction = (action: string, data: unknown) => {
    console.log('🟢 ==========================================')
    console.log('🟢 CONTENTPANE HANDLE INTERACTION CALLED!')
    console.log('🟢 Action:', action)
    console.log('🟢 Data:', data)
    console.log('🟢 onContentInteraction exists:', !!onContentInteraction)
    console.log('🟢 onContentInteraction type:', typeof onContentInteraction)
    console.log('🟢 Call stack at ContentPane:', new Error().stack?.split('\n').slice(0, 5).join('\n'))
    console.log('🟢 ==========================================')
    
    console.log('🎯 ContentPane handleInteraction called:', action, data)
    if (onContentInteraction) {
      console.log('✅ ContentPane calling onContentInteraction')
      try {
        console.log('🟢 CALLING onContentInteraction NOW...')
        onContentInteraction(action, data)
        console.log('🟢 onContentInteraction call completed successfully!')
      } catch (error) {
        console.error('🟢 ERROR calling onContentInteraction:', error)
      }
    } else {
      console.log('❌ ContentPane: onContentInteraction is null/undefined')
    }
    console.log('🟢 ContentPane handleInteraction completed!')
  }

  const clearContentFeed = async () => {
    if (!selectedSubject || !user) return
    
    try {
      await persistenceService.deleteContentFeedBySubject(user.id, selectedSubject.id)
      setContentFeed([])
    } catch (error) {
      console.error('Failed to clear content feed:', error)
    }
  }

  const refreshContentFeed = () => {
    loadContentFeed()
  }

  // Listen for content generation events from ChatPane (legitimate useEffect for event listener)
  useEffect(() => {
    const handleContentGenerated = (event: CustomEvent) => {
      const contentData = event.detail
      console.log('📥 ContentPane received content event:', contentData)
      console.log('🔍 Current subject:', selectedSubject?.id, selectedSubject?.name)
      console.log('🔍 Content subject:', contentData.subjectId)
      
      // Validate that content is for the currently selected subject
      if (!selectedSubject || contentData.subjectId !== selectedSubject.id) {
        console.log('⚠️ Content subject mismatch - ignoring content for wrong subject')
        console.log('📝 Expected:', selectedSubject?.id, 'Received:', contentData.subjectId)
        return
      }
      
      console.log('🔍 Current saving set size:', savingContentIdsRef.current.size)
      
      // Check if content already exists to prevent duplicates
      setContentFeed(currentFeed => {
        const exists = currentFeed.find(item => item.id === contentData.id)
        if (exists) {
          console.log('⚠️ Content already exists in feed, skipping duplicate:', contentData.id)
          return currentFeed
        }
        
        const newContent: InteractiveContent = {
          id: contentData.id,
          type: contentData.type,
          data: contentData.data,
          title: contentData.title,
          timestamp: new Date()
        }
        
        // Add to local state
        const updatedFeed = [...currentFeed, newContent]
        
        // Set direction to 'direct' for new content appearing
        setNavigationDirection('direct')
        
        // Persist to backend (use setTimeout to avoid blocking)
        setTimeout(async () => {
          if (user && selectedSubject) {
            // Double-check subject hasn't changed during async operation
            if (contentData.subjectId !== selectedSubject.id) {
              console.log('⚠️ Subject changed during persist operation, skipping save')
              return
            }
            
            // Check if we're already saving this content ID
            if (savingContentIdsRef.current.has(newContent.id)) {
              console.log('⚠️ Content save already in progress, skipping:', newContent.id)
              return
            }
            
            // Mark as being saved
            savingContentIdsRef.current.add(newContent.id)
            
            try {
              await persistenceService.saveContentItem({
                id: newContent.id,
                user_id: user.id,
                subject_id: selectedSubject.id,
                type: newContent.type,
                data: newContent.data as Record<string, unknown>,
                title: newContent.title,
                order_index: updatedFeed.length - 1,
                timestamp: newContent.timestamp.toISOString()
              })
              console.log('✅ Content persisted:', newContent.id)
            } catch (error: unknown) {
              let errorCode: string | null = null
              
              if (error && typeof error === 'object' && 'code' in error) {
                errorCode = typeof (error as { code: unknown }).code === 'string' ? (error as { code: string }).code : null
              }
              
              if (errorCode === '23505') {
                console.log('⚠️ Content already exists in database (duplicate key), skipping:', newContent.id)
              } else {
                console.error('❌ Failed to persist content item:', error)
              }
            } finally {
              // Remove from saving set
              savingContentIdsRef.current.delete(newContent.id)
            }
          }
        }, 0)
        
        return updatedFeed
      })
    }

    window.addEventListener('contentGenerated', handleContentGenerated as EventListener)
    return () => {
      window.removeEventListener('contentGenerated', handleContentGenerated as EventListener)
    }
  }, [user, selectedSubject])

  const renderInteractiveComponent = (content: InteractiveContent) => {
    const props: InteractiveComponentProps = {
      onInteraction: handleInteraction,
      content: content.data,
      id: content.id
    }

    switch (content.type) {
      case 'multiple-choice':
        return <MultipleChoice {...props} />
      case 'concept-card':
        return <ConceptCard {...props} />
      case 'step-solver':
        return <StepByStepSolver {...props} />
      case 'fill-blank':
        return <FillInTheBlank {...props} />
      case 'drag-drop':
        return <DragAndDrop {...props} />
      case 'interactive-example':
        return <InteractiveExample {...props} />
      case 'progress-quiz':
        return <ProgressQuiz {...props} />
      case 'graph-visualizer':
        return <GraphVisualizer {...props} />
      case 'formula-explorer':
        return <FormulaExplorer {...props} />
      case 'text-highlighter':
        return <TextHighlighter {...props} />
      case 'explainer':
        return <Explainer {...props} />
      case 'placeholder':
        return <Placeholder {...props} />
      default:
        return (
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-600">Component type &quot;{content.type}&quot; not yet implemented</p>
            </CardContent>
          </Card>
        )
    }
  }

  if (!selectedSubject) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Learn</h3>
            <p className="text-gray-600">
              Start chatting with your AI tutor to begin interactive learning. 
              Your tutor will provide personalized content and exercises.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 relative overflow-hidden" data-scroll-navigation="true" ref={contentContainerRef}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Loading content..." />
          </div>
        ) : currentContent ? (
          <>
            {/* Animated Content Display */}
            <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`content-${currentContent.id}-${selectedContentIndex}`}
                  initial={
                    navigationDirection === 'next'
                      ? { y: '100%', opacity: 0 } // Next: Start from bottom, slide up
                      : navigationDirection === 'previous'
                      ? { y: '-100%', opacity: 0 } // Previous: Start from top, slide down
                      : { scale: 0.95, opacity: 0 } // Direct: Gentle scale in
                  }
                  animate={{ y: 0, scale: 1, opacity: 1 }}
                  exit={
                    navigationDirection === 'next'
                      ? { y: '-100%', opacity: 0 } // Next: Exit upward
                      : navigationDirection === 'previous'
                      ? { y: '100%', opacity: 0 } // Previous: Exit downward
                      : { scale: 1.05, opacity: 0 } // Direct: Gentle scale out
                  }
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 25,
                    mass: 0.8
                  }}
                  className="w-full max-w-4xl mx-auto my-4"
                >
                  <div className="relative">
                    {/* Activity info */}
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <Badge className="bg-purple-100 text-purple-800 text-xs">
                        {currentContent.type.replace('-', ' ')}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {currentContent.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    
                    {/* Interactive Component */}
                    {renderInteractiveComponent(currentContent)}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation Indicators - show when there are multiple activities */}
            {contentFeed.length > 1 && !showHistory && (
              <>
                {/* Previous Activity Indicator */}
                {getCurrentIndex() > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 
                               bg-gray-400 text-white px-3 py-1 rounded-full 
                               text-xs flex items-center space-x-1 pointer-events-none"
                  >
                    <ChevronUp className="h-3 w-3" />
                    <span>Scroll or key up for previous</span>
                  </motion.div>
                )}
                
                {/* Next Activity Indicator */}
                {getCurrentIndex() < contentFeed.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 
                               bg-gray-400 text-white px-3 py-1 rounded-full 
                               text-xs flex items-center space-x-1 pointer-events-none"
                  >
                    <span>Scroll or key down for next</span>
                    <ChevronDown className="h-3 w-3" />
                  </motion.div>
                )}
              </>
            )}

            <ContentHistorySidebar
              open={showHistory}
              contentFeed={contentFeed}
              selectedIndex={selectedContentIndex}
              onSelect={(index) => {
                setNavigationDirection('direct')
                setSelectedContentIndex(index)
              }}
              onClose={() => setShowHistory(false)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI Tutor Ready</h3>
              <p className="text-gray-600 mb-4">
                Chat with your AI tutor about {selectedSubject?.name} to get personalized 
                interactive content and exercises in your learning feed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Header with controls - now at bottom */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3 min-w-0 truncate">
            {currentContent && (
              <>
                <Badge variant="secondary" className="text-xs font-medium flex-shrink-0">
                  Activity {selectedContentIndex >= 0 ? selectedContentIndex + 1 : contentFeed.length}
                </Badge>
                <h3 className="text-lg font-semibold text-gray-900 truncate">{currentContent.title}</h3>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {contentFeed.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="h-8"
              >
                <History className="h-4 w-4 mr-1" />
                History ({contentFeed.length - 1})
              </Button>
            )}
            {selectedContentIndex >= 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNavigationDirection('direct')
                  setSelectedContentIndex(-1)
                }}
                className="h-8 text-blue-600 hover:text-blue-700"
              >
                Latest
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshContentFeed}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              title="Refresh content"
            >
              {isLoading ? (
                <SpinnerIcon size="sm" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {contentFeed.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearContentFeed}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                title="Clear all content"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 