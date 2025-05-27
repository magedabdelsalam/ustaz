'use client'

import { useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { DashboardHeader } from '@/components/DashboardHeader'
import { HistoryPane } from '@/components/HistoryPane'
import { ContentPane } from '@/components/ContentPane'
import { ChatPane, ChatPaneRef } from '@/components/ChatPane'

export function Dashboard() {
  const { user } = useAuth()
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

  // Optimized message handler - no useEffect needed
  const handleNewMessage = async (message: string, isUserMessage: boolean = true) => {
    if (!isUserMessage || !user) return

    try {
      const analysis = await analyzeMessage(message)
      console.log('📊 Message analysis result:', analysis)

      if (analysis.isNewSubject) {
        // Check if subject already exists
        const existingSubject = subjects.find(s => 
          s.name.toLowerCase() === analysis.subjectName.toLowerCase()
        )

        if (existingSubject) {
          console.log('📖 Switching to existing subject:', existingSubject.name)
          selectSubject(existingSubject)
        } else {
          console.log('📚 Creating new subject:', analysis.subjectName)
          try {
            const newSubject = await createSubject(analysis.subjectName)
            console.log('✅ New subject created successfully:', newSubject.name)
          } catch (error) {
            console.error('❌ Failed to create subject:', error)
          }
        }
      } else if (currentSubject) {
        // Continue with current subject - no additional action needed
        console.log('📝 Continuing with current subject:', currentSubject.name)
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
      <DashboardHeader user={user} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* History Pane */}
        <div className="w-80 bg-white border-r border-gray-200 flex-shrink-0">
          <HistoryPane 
            subjects={subjects}
            selectedSubject={currentSubject}
            onSubjectSelect={selectSubject}
            onSubjectDelete={deleteSubject}
          />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Content Pane */}
          <div className="flex-1 flex flex-col">
            <ContentPane 
              selectedSubject={currentSubject}
              onContentInteraction={handleContentInteraction}
            />
          </div>
          
          {/* Chat Pane */}
          <div className="w-160 bg-white border-l border-gray-200 flex-shrink-0">
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