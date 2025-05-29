'use client'

import { useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { HistoryPane } from '@/components/HistoryPane'
import { ContentPane } from '@/components/ContentPane'
import { ChatPane, ChatPaneRef } from '@/components/ChatPane'
import { Button } from '@/components/ui/button'
import { useError } from '@/components/ErrorProvider'
import { useSupabaseOperations } from '@/hooks/useSupabaseOperations'

export function Dashboard() {
  const { user } = useAuth()
  const { showSuccess } = useError()
  const { testConnection } = useSupabaseOperations()
  const { 
    subjects, 
    currentSubject, 
    analyzeMessage,
    selectSubject,
    createSubject,
    deleteSubject,
    updateSubjectProgress
  } = useSubjects()
  const chatRef = useRef<ChatPaneRef>(null)
  const lastUserMessageRef = useRef<{ id: string; content: string; previousSubjectId: string | null } | null>(null)

  // Test connection on mount
  useEffect(() => {
    testConnection()
  }, [testConnection])

  // Listen for progress updates from ChatPane
  useEffect(() => {
    const handleProgressUpdate = (event: CustomEvent) => {
      const { subjectId, learningProgress } = event.detail
      console.log('📊 Dashboard received progress update:', { subjectId, learningProgress })
      
      if (updateSubjectProgress && subjectId) {
        updateSubjectProgress(subjectId, learningProgress)
        console.log('✅ Subject progress updated in Dashboard')
      }
    }

    window.addEventListener('progressUpdated', handleProgressUpdate as EventListener)
    return () => {
      window.removeEventListener('progressUpdated', handleProgressUpdate as EventListener)
    }
  }, [updateSubjectProgress])

  // Listen for user messages from ChatPane
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
  }, [currentSubject])

  // Optimized message handler - no useEffect needed
  const handleNewMessage = async (message: string, isUserMessage: boolean = true) => {
    try {
      console.log('🎯 Dashboard handling new message:', { message: message.substring(0, 50) + '...', isUserMessage })
      
      // Only process user messages for subject detection
      if (!isUserMessage) {
        console.log('⏸️ Skipping non-user message')
        return
      }

      // Analyze message for subject and component suggestions
      const analysis = await analyzeMessage(message)
      console.log('📊 Message analysis:', analysis)

      // Handle subject detection based on analysis result structure
      if (analysis.isNewSubject && analysis.subjectName) {
        // Check if subject already exists
        const existingSubject = subjects.find(s => 
          s.name.toLowerCase() === analysis.subjectName.toLowerCase()
        )

        if (existingSubject) {
          console.log('📖 Switching to existing subject:', existingSubject.name)
          selectSubject(existingSubject)
          
          // Emit subject selected event
          const subjectEvent = new CustomEvent('subjectSelected', {
            detail: { subject: existingSubject }
          })
          window.dispatchEvent(subjectEvent)
        } else {
          console.log('📚 Creating new subject:', analysis.subjectName)
          try {
            const newSubject = await createSubject(analysis.subjectName)
            console.log('✅ New subject created successfully:', newSubject.name)
            
            // Show success message
            showSuccess(`Created new subject: ${newSubject.name}`)
            
            // Notify ChatPane about the new subject for lesson plan creation
            const newSubjectEvent = new CustomEvent('newSubjectCreated', {
              detail: {
                subject: newSubject,
                triggeringMessage: message
              }
            })
            window.dispatchEvent(newSubjectEvent)
          } catch (error) {
            console.error('❌ Failed to create subject:', error)
          }
        }
        
      } else if (currentSubject) {
        // Continue with current subject - generate appropriate interactive component
        console.log('📝 Continuing with current subject:', currentSubject.name)
        console.log('🎯 Suggested component:', analysis.suggestedComponent)
        console.log('💭 Analysis reasoning:', analysis.reasoning)
        
        // Dispatch event to ChatPane to generate context-specific interactive content
        const contextualContentEvent = new CustomEvent('generateContextualContent', {
          detail: {
            subject: currentSubject,
            userMessage: message,
            suggestedComponent: analysis.suggestedComponent,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning
          }
        })
        window.dispatchEvent(contextualContentEvent)
      }
    } catch (error) {
      console.error('Error handling message:', error)
    }
  }

  const handleContentInteraction = async (action: string, data: unknown) => {
    console.log('🎯 Content interaction:', action, data)
    
    if (!chatRef.current) {
      console.error('❌ Chat reference not available')
      return
    }

    try {
      // Handle all the different interaction types from interactive components
      switch (action) {
        // ConceptCard actions
        case 'ready_for_next':
          const interactionData = data as { concept?: string; action?: string; componentId?: string }
          if (interactionData.action === 'practice' && interactionData.concept) {
            console.log('🎯 Practice request for concept:', interactionData.concept)
            await chatRef.current.handleContentInteraction('ready_for_next', {
              concept: interactionData.concept,
              action: 'practice',
              componentId: interactionData.componentId
            })
          } else {
            console.log('🔄 General ready_for_next request')
            await chatRef.current.handleContentInteraction(action, data)
          }
          break

        case 'concept_expanded':
        case 'examples_requested':
          console.log('🧠 Concept expansion/examples request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Answer submission actions from all components
        case 'answer_submitted':
        case 'fill_blank_submitted':
        case 'drag_drop_submitted':
          console.log('✅ Answer submitted from interactive component')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Next content requests
        case 'next_question':
        case 'next_exercise':
        case 'next_problem':
          console.log('➡️ Next content request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Reset actions
        case 'reset_question':
        case 'fill_blank_reset':
        case 'drag_drop_reset':
        case 'solver_reset':
          console.log('🔄 Component reset request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Explanation requests
        case 'explain_more':
          console.log('📚 Explanation request')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Special interactive actions
        case 'item_dropped':
        case 'auto_play_started':
          console.log('🎮 Interactive action')
          await chatRef.current.handleContentInteraction(action, data)
          break

        // Fallback for any unhandled actions
        default:
          console.log('🤔 Unhandled interaction type:', action, 'forwarding to ChatPane')
          await chatRef.current.handleContentInteraction(action, data)
          break
      }
    } catch (error) {
      console.error('❌ Failed to handle content interaction:', error)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Main Dashboard Content */}
      <div className="flex-1 flex bg-gray-50">
        {/* History Pane - Responsive width */}
        <div className="w-full md:w-80 lg:w-72 xl:w-80 2xl:w-96 bg-white border-r border-gray-200 flex-shrink-0 
                        md:block hidden">
          <HistoryPane 
            subjects={subjects}
            selectedSubject={currentSubject}
            user={user}
            onSubjectSelect={selectSubject}
            onSubjectDelete={deleteSubject}
          />
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
              />
            </div>
          </div>
        </div>
        
        {/* Main Content Area - Responsive layout */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0">
          {/* Content Pane - Responsive sizing */}
          <div className="flex-1 lg:flex-[2] xl:flex-[3] 2xl:flex-[4] flex flex-col min-w-0">
            <ContentPane 
              selectedSubject={currentSubject}
              onContentInteraction={handleContentInteraction}
            />
          </div>
          
          {/* Chat Pane - Responsive sizing */}
          <div className="w-full lg:w-80 xl:w-96 2xl:w-[480px] lg:flex-[1] xl:flex-[1] 2xl:flex-[1]
                          bg-white border-l border-gray-200 lg:border-t-0 border-t flex-shrink-0">
            <ChatPane 
              ref={chatRef}
              selectedSubject={currentSubject}
              onNewMessage={handleNewMessage}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 