'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Sparkles, Trash2, RefreshCw } from 'lucide-react'
import { Subject } from '@/hooks/useSubjects'
import { useAuth } from '@/hooks/useAuth'
import { persistenceService, PersistedContentItem } from '@/lib/persistenceService'
import { 
  MultipleChoice, 
  ConceptCard, 
  StepByStepSolver,
  FillInTheBlank,
  DragAndDrop,
  ComponentType,
  InteractiveComponentProps 
} from '@/components/interactive'

interface InteractiveContent {
  id: string
  type: ComponentType
  data: any
  title: string
  timestamp: Date
}

interface ContentPaneProps {
  selectedSubject: Subject | null
  onContentInteraction?: (action: string, data: any) => void
}

export function ContentPane({ 
  selectedSubject, 
  onContentInteraction
}: ContentPaneProps) {
  const { user } = useAuth()
  const [contentFeed, setContentFeed] = useState<InteractiveContent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const savingContentIdsRef = useRef<Set<string>>(new Set())
  
  // Load content feed when subject changes
  useEffect(() => {
    if (selectedSubject && user) {
      loadContentFeed()
    } else {
      // Clear content feed when no subject is selected
      setContentFeed([])
    }
  }, [selectedSubject?.id, user?.id])

  const loadContentFeed = async () => {
    if (!selectedSubject || !user) return
    
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
  }

  const handleInteraction = (action: string, data: any) => {
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



  // Listen for content generation events from ChatPane
  useEffect(() => {
    const handleContentGenerated = (event: CustomEvent) => {
      const contentData = event.detail
      console.log('📥 ContentPane received content event:', contentData)
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
        
        // Persist to backend (use setTimeout to avoid blocking)
        setTimeout(async () => {
          if (user && selectedSubject) {
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
                data: newContent.data,
                title: newContent.title,
                order_index: updatedFeed.length - 1,
                timestamp: newContent.timestamp.toISOString()
              })
              console.log('✅ Content persisted:', newContent.id)
            } catch (error: any) {
              if (error?.code === '23505') {
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
  }, [user?.id, selectedSubject?.id]) // Only depend on user and subject, not contentFeed

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
      default:
        return (
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-600">Component type "{content.type}" not yet implemented</p>
            </CardContent>
          </Card>
        )
    }
  }

  if (!selectedSubject) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Interactive Learning</h2>
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center">
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Learning Feed</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {selectedSubject.name}
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              {contentFeed.length} items
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshContentFeed}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {contentFeed.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearContentFeed}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Content Feed */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
              <p className="text-gray-600">Loading your learning content...</p>
            </div>
          </div>
        ) : contentFeed.length > 0 ? (
          <div className="space-y-6">
            {contentFeed.map((content, index) => {
              // Group content by lesson title to show lesson headers cleanly
              const isNewLesson = index === 0 || contentFeed[index - 1].title !== content.title
              const isLastInLesson = index === contentFeed.length - 1 || contentFeed[index + 1].title !== content.title
              
              return (
                <div key={content.id} className="relative">
                  {/* Lesson Header - only show when starting a new lesson */}
                  {isNewLesson && (
                    <div className="mb-4 pb-3 border-b-2 border-blue-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant="secondary" className="text-xs font-medium">
                            Lesson {Math.floor(index / 2) + 1}
                          </Badge>
                          <h3 className="text-xl font-bold text-gray-900">{content.title}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {contentFeed.filter(c => c.title === content.title).length} activities
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Activity marker for content within a lesson */}
                  {!isNewLesson && (
                    <div className="flex items-center space-x-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        Activity #{index + 1}
                      </Badge>
                      <Badge className="bg-purple-100 text-purple-800 text-xs">
                        {content.type.replace('-', ' ')}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {content.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  )}
                  
                  {/* Interactive Component */}
                  <div className="relative">
                    {renderInteractiveComponent(content)}
                  </div>
                  
                  {/* Lesson completion indicator */}
                  {isLastInLesson && index < contentFeed.length - 1 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
                          ✅ Lesson Complete
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  {/* Separator between different lessons */}
                  {isLastInLesson && index < contentFeed.length - 1 && (
                    <div className="mt-6 mb-6 border-b-2 border-gray-100"></div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI Tutor Ready</h3>
              <p className="text-gray-600 mb-4">
                Chat with your AI tutor about {selectedSubject.name} to get personalized 
                interactive content and exercises in your learning feed.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700 font-medium mb-2">Try saying:</p>
                <div className="space-y-1 text-sm text-blue-600">
                  <p>• "Explain quadratic equations"</p>
                  <p>• "Give me practice problems"</p>
                  <p>• "I need help with calculus derivatives"</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 