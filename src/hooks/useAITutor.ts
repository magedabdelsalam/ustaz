/**
 * useAITutor Hook
 * ----------------
 * React hook that wraps the `AITutorService` class to provide an easy API for
 * components.  It exposes methods for sending messages and processes tool call
 * results to update consumer components.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { TutorContext, TutorToolName } from '@/lib/ai-tutor-service';
import { supabase } from '@/lib/supabase'
import { Subject, LessonPlan, LearningProgress, ComponentType, InteractiveContent } from '@/types';
import { errorHandler } from '@/lib/errorHandler';

interface ToolCallResult {
  name: TutorToolName;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface AITutorResponse {
  response: string;
  toolCalls: ToolCallResult[];
  context: TutorContext;
  simulated?: boolean;
  message?: string;
}

interface UseAITutorOptions {
  subject?: Subject | null;
  onSubjectCreated?: (subject: Subject) => void;
  onLessonPlanCreated?: (lessonPlan: LessonPlan) => void;
  onProgressUpdated?: (progress: LearningProgress) => void;
  onInteractiveContent?: (content: InteractiveContent) => void;
  onClarifyingQuestion?: (question: string, context: string, options?: string[]) => void;
  instructionOverrides?: {
    preferInteractiveContent: boolean;
    interactiveContentGuidelines?: string;
  };
  userId?: string;
}

export function useAITutor(options: UseAITutorOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutorContext, setTutorContext] = useState<TutorContext | null>(null);
  const optionsRef = useRef(options);
  const generateId = useCallback((prefix: string) => {
    try {
      const anyGlobal = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
      if (anyGlobal.crypto?.randomUUID) {
        return `${prefix}-${anyGlobal.crypto.randomUUID()}`;
      }
    } catch {
      // ignore
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  }, []);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const sendMessage = useCallback(async (message: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      // Enhance the message with instructions for interactive content
      const enhancedMessage = message.trim();
      const sessionId = optionsRef.current.subject?.id;
      
      // Call our API endpoint
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: enhancedMessage,
          context: {
            ...tutorContext,
            userId: optionsRef.current.userId,
            // Only include subject if we have one to avoid clearing server state
            ...(optionsRef.current.subject || tutorContext?.subject
              ? { subject: (optionsRef.current.subject || tutorContext?.subject) }
              : {}),
            // Use instructionOverrides from options or set defaults for interactive content
            instructionOverrides: optionsRef.current.instructionOverrides || {
              preferInteractiveContent: true,
              interactiveContentGuidelines: `
                CRITICAL: When creating interactive components, keep your chat response BRIEF (1-2 sentences max). 
                Put ALL detailed educational content inside the interactive component, NOT in the chat response.
                
                Example:
                ❌ BAD: Long explanation in chat + same content repeated in component
                ✅ GOOD: "I've created an interactive lesson below. Explore each section to learn the concepts!" + rich component content
                
                Always fill interactive components with complete, accurate content using the proper schema.
              `
            }
          },
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const data: AITutorResponse = await response.json();

      // Update our local context
      setTutorContext(data.context);

      // Process any tool calls that were made
      await processToolCalls(data.toolCalls);

      // If it's a simulated response, show the simulation message
      if (data.simulated && data.message) {
        console.log('🔧 Simulated response:', data.message);
      }

      return data.response;

    } catch (err) {
      const appError = errorHandler.handleError(err, 'send_message');
      setError(appError.userMessage);
      console.error('AI Tutor Error:', err);
      return `Error: ${appError.userMessage}`;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorContext]); // processToolCalls intentionally excluded to avoid circular dependency

  const sendMessageWithMetadata = useCallback(async (message: string): Promise<{
    response: string;
    hasGeneratedInteractiveContent: boolean;
    newSubjectCreated?: boolean;
    newSubjectData?: Subject;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get the current user ID for subject creation
      const userIdForSubjectCreation = optionsRef.current.userId;
      
      // Call our API endpoint
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message,
          context: {
            ...tutorContext,
            userId: optionsRef.current.userId,
            // Only include subject if present
            ...(optionsRef.current.subject || tutorContext?.subject
              ? { subject: (optionsRef.current.subject || tutorContext?.subject) }
              : {}),
            // Use instructionOverrides from options or set defaults for interactive content
            instructionOverrides: optionsRef.current.instructionOverrides || {
              preferInteractiveContent: true,
              interactiveContentGuidelines: `
                CRITICAL: When creating interactive components, keep your chat response BRIEF (1-2 sentences max). 
                Put ALL detailed educational content inside the interactive component, NOT in the chat response.
                
                Example:
                ❌ BAD: Long explanation in chat + same content repeated in component
                ✅ GOOD: "I've created an interactive lesson below. Explore each section to learn the concepts!" + rich component content
                
                Always fill interactive components with complete, accurate content using the proper schema.
              `
            }
          },
          sessionId: optionsRef.current.subject?.id,
          userId: userIdForSubjectCreation // Include userId for subject creation
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const data: AITutorResponse & {
        newSubjectCreated?: boolean;
        newSubjectData?: Subject;
      } = await response.json();

      // Update our local context
      setTutorContext(data.context);

      // Check if interactive content was generated
      const hasGeneratedInteractiveContent = data.toolCalls.some(
        toolCall => toolCall.name === 'interactive_component'
      );

      // Process any tool calls that were made
      await processToolCalls(data.toolCalls);

      // If it's a simulated response, show the simulation message
      if (data.simulated && data.message) {
        console.log('🔧 Simulated response:', data.message);
      }

      // If a new subject was created by the AI route, immediately announce it to the app with initial context
      if (data.newSubjectCreated && data.newSubjectData) {
        const announceEvent = new CustomEvent('newSubjectCreated', {
          detail: {
            subject: data.newSubjectData,
            initialMessage: { id: `user-${Date.now()}`, content: message, timestamp: new Date() },
            initialResponse: { id: `ai-${Date.now()}`, content: data.response, timestamp: new Date(), hasGeneratedContent: data.toolCalls.some(t => t.name === 'interactive_component') }
          }
        });
        window.dispatchEvent(announceEvent);

        if (optionsRef.current.onSubjectCreated) {
          optionsRef.current.onSubjectCreated(data.newSubjectData);
        }
      }

      return {
        response: data.response,
        hasGeneratedInteractiveContent,
        newSubjectCreated: data.newSubjectCreated,
        newSubjectData: data.newSubjectData
      };

    } catch (err) {
      const appError = errorHandler.handleError(err, 'send_message_with_metadata');
      setError(appError.userMessage);
      console.error('AI Tutor Error:', err);
      return {
        response: `Error: ${appError.userMessage}`,
        hasGeneratedInteractiveContent: false
      };
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorContext]); // processToolCalls intentionally excluded to avoid circular dependency

  const sendMessageStream = useCallback(async (
    message: string,
    onEvent: (event: { event: string; data?: unknown }) => void
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message,
          context: {
            ...tutorContext,
            userId: optionsRef.current.userId,
            ...(optionsRef.current.subject || tutorContext?.subject
              ? { subject: (optionsRef.current.subject || tutorContext?.subject) }
              : {}),
            instructionOverrides: optionsRef.current.instructionOverrides || {
              preferInteractiveContent: true,
              interactiveContentGuidelines: `
                CRITICAL: When creating interactive components, keep your chat response BRIEF (1-2 sentences max). 
                Put ALL detailed educational content inside the interactive component, NOT in the chat response.
              `
            }
          },
          sessionId: optionsRef.current.subject?.id,
          userId: optionsRef.current.userId,
          stream: true
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const evt = JSON.parse(line) as { event: string; data?: unknown };
            onEvent(evt);
            // If final payload includes updated context, persist locally
            if (evt.event === 'final' && evt.data && (evt.data as { updatedContext?: unknown }).updatedContext) {
              setTutorContext((evt.data as { updatedContext: TutorContext }).updatedContext);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      const appError = errorHandler.handleError(err, 'send_message_stream');
      setError(appError.userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tutorContext]);

  const handleToolCall = useCallback(async (toolCall: ToolCallResult) => {
    const { name, parameters, result } = toolCall;
    const currentOptions = optionsRef.current;

    console.log(`🔧 Processing tool call: ${name}`, { parameters, result });

    switch (name) {
      case 'new_subject':
        if (result.success && result.subject && currentOptions.onSubjectCreated) {
          currentOptions.onSubjectCreated(result.subject as Subject);
        }
        break;

      case 'new_lesson_plan':
        if (result.success && result.lessonPlan && currentOptions.onLessonPlanCreated) {
          currentOptions.onLessonPlanCreated(result.lessonPlan as LessonPlan);
        }
        break;

      case 'lesson_complete':
      case 'next_lesson':
        if (result.success && currentOptions.onProgressUpdated) {
          // Create a progress object based on the results
          const progress: LearningProgress = {
            correctAnswers: result.correctAnswers as number || 0,
            totalAttempts: result.totalAttempts as number || 0,
            currentLessonIndex: result.lessonNumber as number || 0,
            readyForNext: result.success as boolean || false
          };
          currentOptions.onProgressUpdated(progress);
        }
        break;

      case 'interactive_component':
        if (result.type === 'interactive_component' && currentOptions.onInteractiveContent) {
          const content: InteractiveContent = {
            id: generateId('interactive'),
            type: result.componentType as ComponentType,
            data: result.content,
            onInteraction: async (action: string, data: unknown) => {
              // Handle interactions with the component - create meaningful messages based on action
              const dataObj = data as Record<string, unknown>;
              let message = '';
              
              switch (action) {
                case 'next_question':
                  if (dataObj.requestType === 'new_quiz') {
                    message = `Give me a new quiz on ${dataObj.category || 'this topic'}${dataObj.difficulty ? ` at ${dataObj.difficulty} difficulty level` : ''}.`;
                  } else {
                    message = `Give me another ${dataObj.category || 'question'} question${dataObj.difficulty ? ` at ${dataObj.difficulty} difficulty level` : ''}.`;
                  }
                  break;
                  
                case 'next_exercise':
                  if (dataObj.requestType === 'new_drag_drop') {
                    message = `Create a new drag-and-drop exercise on ${dataObj.category || 'this topic'}.`;
                  } else if (dataObj.requestType === 'new_highlighting') {
                    message = `Give me a new text highlighting exercise on ${dataObj.category || 'this topic'}.`;
                  } else {
                    message = `Create another ${dataObj.category || 'fill-in-the-blank'} exercise${dataObj.difficulty ? ` at ${dataObj.difficulty} difficulty level` : ''}.`;
                  }
                  break;
                  
                case 'next_problem':
                  message = `Give me another ${dataObj.category || 'problem'} to solve${dataObj.difficulty ? ` at ${dataObj.difficulty} difficulty level` : ''}.`;
                  break;
                  
                case 'explain_more':
                  if (dataObj.topic) {
                    message = `Can you explain more about ${dataObj.topic}${dataObj.question ? ` (specifically about: "${dataObj.question}")` : ''}?`;
                  } else if (dataObj.problem) {
                    message = `Can you explain this problem in more detail: ${dataObj.problem}`;
                  } else {
                    message = `Can you explain this concept in more detail?`;
                  }
                  break;
                  
                case 'show_hint':
                  message = `I need a hint for this question${dataObj.question ? `: ${dataObj.question}` : ''}.`;
                  break;
                  
                case 'request_explanation':
                  message = `Can you explain why the answer is ${dataObj.correctAnswer || 'correct'}?`;
                  break;
                  
                case 'question_requested':
                  message = `I have a question about ${dataObj.topic || 'this topic'}. Can you help me understand it better?`;
                  break;
                  
                case 'detail_expanded':
                  message = `Can you provide more details about ${dataObj.topic || 'this concept'}?`;
                  break;
                  
                case 'next_topic_requested':
                  message = `I'm ready to move on to the next topic after ${dataObj.currentTopic || 'this one'}.`;
                  break;
                  
                case 'examples_requested':
                  message = `Can you provide more examples about ${dataObj.concept || 'this concept'}?`;
                  break;
                  
                case 'ready_for_next':
                  message = `I understand ${dataObj.concept || 'this concept'}. What's next?`;
                  break;
                  
                case 'retry_content':
                  message = `Can you try generating ${dataObj.retryType || 'this content'} again?`;
                  break;
                  
                // Logging-only actions that don't need AI responses
                case 'answer_submitted':
                case 'fill_blank_submitted':
                case 'drag_drop_submitted':
                case 'highlights_checked':
                case 'quiz_submitted':
                case 'quiz_started':
                case 'reset_question':
                case 'fill_blank_reset':
                case 'drag_drop_reset':
                case 'quiz_reset':
                case 'solver_reset':
                case 'graph_reset':
                case 'graph_control_changed':
                case 'concept_expanded':
                  // These are just logging actions, don't send a message
                  console.log(`📊 Interactive component action: ${action}`, dataObj);
                  return;
                  
                default:
                  // For unknown actions, create a more descriptive message
                  console.warn(`⚠️ Unknown interaction action: ${action}`, dataObj);
                  message = `User performed action: ${action}`;
              }
              
              if (message) {
                console.log(`📤 Sending interaction message: ${message}`);
                await sendMessage(message);
              }
            }
          };
          
          // Call the callback
          currentOptions.onInteractiveContent(content);
          
          // Also dispatch the contentGenerated event that ContentPane expects
          const contentData = {
            id: content.id,
            type: content.type,
            data: content.data,
            title: result.learningObjective || `${result.componentType} Activity`.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            subjectId: currentOptions.subject?.id
          };
          
          console.log('📤 Dispatching contentGenerated event:', contentData);
          const event = new CustomEvent('contentGenerated', { detail: contentData });
          window.dispatchEvent(event);
        }
        break;

      case 'clarifying_question':
        if (result.type === 'clarifying_question' && currentOptions.onClarifyingQuestion) {
          currentOptions.onClarifyingQuestion(
            result.question as string,
            result.context as string,
            result.options as string[]
          );
        }
        break;

      case 'subject_complete':
        console.log('🎉 Subject completed!', result);
        break;

      case 'review_request':
        console.log('📚 Review session started:', result);
        break;

      case 'summary_request':
        console.log('📝 Summary generated:', result);
        break;

      case 'rephrase_request':
        console.log('🔄 Content rephrased:', result);
        break;

      case 'feedback_log':
        console.log('📊 Feedback logged:', result);
        break;

      case 'update_lesson_plan':
        console.log('📋 Lesson plan updated:', result);
        break;

      default:
        console.log(`⚠️ Unknown tool call: ${name}`, result);
    }
  }, [sendMessage, generateId]);

  const processToolCalls = useCallback(async (toolCalls: ToolCallResult[]) => {
    for (const toolCall of toolCalls) {
      try {
        await handleToolCall(toolCall);
      } catch (error) {
        console.error(`Error processing tool call ${toolCall.name}:`, error);
      }
    }
  }, [handleToolCall]);

  // Method to update context (for when external state changes)
  const updateContext = useCallback((updates: Partial<TutorContext>) => {
    setTutorContext(prev => prev ? { ...prev, ...updates } : { conversationHistory: [], ...updates });
  }, []);

  return {
    sendMessage,
    sendMessageStream,
    sendMessageWithMetadata,
    updateContext,
    isLoading,
    error,
    context: tutorContext
  };
} 