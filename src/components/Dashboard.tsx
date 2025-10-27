'use client'

/**
 * Dashboard
 * ----------------
 * TODO: Add description and exports for Dashboard.
 */

import { useRef, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import StreamPane from '@/components/StreamPane'
import { TopBar } from '@/components/TopBar'
import { LessonOutlineSidebar } from '@/components/LessonOutlineSidebar'
import { TopicsIndexSidebar } from '@/components/TopicsIndexSidebar'
import { NewSubjectDialog } from '@/components/NewSubjectDialog'
import { persistenceService } from '@/lib/persistenceService'
import { supabase } from '@/lib/supabase'

export function Dashboard() {
  const { user } = useAuth()
  const { 
    subjects, 
    currentSubject, 
    selectSubject,
    createSubject,
    upsertSubjectFromAI
  } = useSubjects()
  const lastUserMessageRef = useRef<{ id: string; content: string; previousSubjectId: string | null } | null>(null)
  const [isNewSubjectDialogOpen, setIsNewSubjectDialogOpen] = useState(false)
  const [isCreatingSubject, setIsCreatingSubject] = useState(false)

  // Test connection on mount
  useEffect(() => {
    persistenceService.testConnection().then(success => {
      if (success) {
        console.log('✅ Database connection successful')
      } else {
        console.error('❌ Database connection failed')
      }
    })
  }, [])

  // Listen for user messages from ChatPane (for tracking purposes)
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

    const handleNewSubjectCreated = (event: CustomEvent) => {
      const { subject, initialMessage, initialResponse, fromDialog } = event.detail

      console.log('🎯 Dashboard received new subject created event:', subject.name, fromDialog ? '(from dialog)' : '(from chat)')

      // Check if subject already exists by ID
      const subjectExists = subjects.some(s => s.id === subject.id)
      
      if (!subjectExists) {
        // If not, upsert the AI-provided subject (preserves id for session/thread)
        upsertSubjectFromAI(subject)
          .then(newSubject => {
            console.log('✅ Created new subject:', newSubject.name)

            // Only save messages if NOT from dialog (dialog flow doesn't have initial messages to save)
            if (!fromDialog && initialMessage && typeof initialMessage === 'object' && initialMessage.content) {
              // Log the initial messages for context
              const messageContent = typeof initialMessage === 'string' 
                ? initialMessage 
                : (initialMessage.content || initialMessage.toString());
              console.log('📝 Initial message carried over:', messageContent.substring(0, 30) + '...')
              
              if (initialResponse) {
                console.log('🤖 Initial response carried over:', initialResponse.content.substring(0, 30) + '...')
              }
              
              // Wait for the subject to be fully saved to the database before saving messages
              // This prevents foreign key constraint errors
              setTimeout(async () => {
                try {
                  // Save the actual messages
                  const userMessageSaved = await persistenceService.saveMessage({
                    id: initialMessage.id || `user-${Date.now()}`,
                    user_id: user?.id || '',
                    subject_id: newSubject.id,
                    role: 'user',
                    content: initialMessage.content,
                    timestamp: initialMessage.timestamp?.toISOString() || new Date().toISOString(),
                    has_generated_content: false
                  });
                  
                  if (userMessageSaved) {
                    console.log('✅ Saved initial user message for new subject');
                  }
                  
                  if (initialResponse) {
                    const aiMessageSaved = await persistenceService.saveMessage({
                      id: initialResponse.id || `ai-${Date.now()}`,
                      user_id: user?.id || '',
                      subject_id: newSubject.id,
                      role: 'assistant',
                      content: initialResponse.content,
                      timestamp: initialResponse.timestamp?.toISOString() || new Date().toISOString(),
                      has_generated_content: initialResponse.hasGeneratedContent || false
                    });
                    
                    if (aiMessageSaved) {
                      console.log('✅ Saved initial AI response for new subject');
                    }
                  }
                } catch (error) {
                  console.error('❌ Failed to save initial messages:', error);
                }
              }, 300); // small delay for DB upsert
            }

            // Select the subject so UI loads it immediately
            selectSubject(newSubject)
          })
          .catch(err => {
            console.error('❌ Failed to create subject:', err)
          })
      } else {
        // If it exists, just select it
        const existingSubject = subjects.find(s => s.id === subject.id)
        if (existingSubject) {
          selectSubject(existingSubject)
          
          // Log the initial messages for context (only for chat flow)
          if (!fromDialog && initialMessage) {
            const messageContent = typeof initialMessage === 'string' 
              ? initialMessage 
              : (initialMessage.content || initialMessage.toString());
            console.log('📝 Initial message carried over to existing subject:', messageContent.substring(0, 30) + '...')
          }
          if (!fromDialog && initialResponse) {
            console.log('🤖 Initial response carried over to existing subject:', initialResponse.content.substring(0, 30) + '...')
          }
        }
      }
    }

    window.addEventListener('userMessageSent', handleUserMessage as EventListener)
    window.addEventListener('newSubjectCreated', handleNewSubjectCreated as EventListener)
    
    return () => {
      window.removeEventListener('userMessageSent', handleUserMessage as EventListener)
      window.removeEventListener('newSubjectCreated', handleNewSubjectCreated as EventListener)
    }
  }, [currentSubject, subjects, createSubject, selectSubject, user, upsertSubjectFromAI])

  const handleNewSubject = () => {
    setIsNewSubjectDialogOpen(true)
  }

  const handleCreateSubject = async (data: {
    name: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    learningGoals: string[]
    estimatedDuration: string
  }) => {
    if (!user) {
      console.log('❌ No user found, cannot create subject')
      return
    }
    
    console.log('🎯 Starting subject creation for:', data.name)
    setIsCreatingSubject(true)
    
    try {
      // Call the AI API to create subject and lesson plan
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: `I want to learn ${data.name}. ${data.description}`,
          context: {
            userId: user.id,
            instructionOverrides: {
              preferInteractiveContent: false,
              interactiveContentGuidelines: 'Focus on creating a comprehensive lesson plan first.'
            }
          },
          userId: user.id,
          createSubjectRequest: {
            name: data.name,
            description: data.description,
            difficulty: data.difficulty,
            learningGoals: data.learningGoals,
            estimatedDuration: data.estimatedDuration
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create subject')
      }

      const result = await response.json()
      console.log('📦 Received API response:', { newSubjectCreated: result.newSubjectCreated, hasSubjectData: !!result.newSubjectData })
      
      // The API should return the created subject and lesson plan
      if (result.newSubjectCreated && result.newSubjectData) {
        console.log('✅ Subject created via dialog with lesson plan:', result.newSubjectData.name)
        
        // Since subject was created via dialog (not chat), we don't have initial messages to save
        // Just upsert the subject and select it directly without the event system
        const newSubject = await upsertSubjectFromAI(result.newSubjectData)
        selectSubject(newSubject)
        
        console.log('✅ Subject loaded and selected:', newSubject.name)
      }

      // Close the dialog - do this regardless of whether subject was created
      console.log('🚪 Closing dialog')
      setIsNewSubjectDialogOpen(false)
      
    } catch (error) {
      console.error('❌ Failed to create subject:', error)
      // Keep dialog open on error so user can retry
      // TODO: Show error toast to user
    } finally {
      setIsCreatingSubject(false)
      console.log('✨ Subject creation process complete')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Main Dashboard Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Lesson Outline */}
        <LessonOutlineSidebar 
          currentSubject={currentSubject}
          lessonPlan={null}
          onUpdatePlan={() => {
            console.log('Update lesson plan clicked')
            // TODO: Implement lesson plan update
          }}
        />
        
        {/* Center Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Top Bar */}
          <div className="p-4 flex-shrink-0">
            <TopBar 
              user={user}
              subjects={subjects}
              currentSubject={currentSubject}
              onSubjectSelect={selectSubject}
              onNewSubject={handleNewSubject}
            />
          </div>
          
          {/* Main Stream Area */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <StreamPane selectedSubject={currentSubject} />
          </div>
        </div>

        {/* Right Sidebar - Topics Index */}
        <TopicsIndexSidebar currentSubjectId={currentSubject?.id} />
      </div>

      {/* New Subject Dialog */}
      <NewSubjectDialog
        isOpen={isNewSubjectDialogOpen}
        onClose={() => setIsNewSubjectDialogOpen(false)}
        onSubmit={handleCreateSubject}
        isLoading={isCreatingSubject}
      />
    </div>
  )
} 