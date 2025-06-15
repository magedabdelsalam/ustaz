/**
 * useAITutor Hook
 * ----------------
 * React hook that wraps the `AITutorService` class to provide an easy API for
 * components.  It exposes methods for sending messages and processes tool call
 * results to update consumer components.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { TutorContext, TutorToolName } from '@/lib/ai-tutor-service';
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
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: enhancedMessage,
          context: {
            ...tutorContext,
            // Use instructionOverrides from options or set defaults for interactive content
            instructionOverrides: optionsRef.current.instructionOverrides || {
              preferInteractiveContent: true,
              interactiveContentGuidelines: `
                When explaining educational concepts, prefer creating rich interactive components with detailed content instead of just responding in chat.
                For educational responses:
                1. Create explainer components with comprehensive sections
                2. Include all key concepts, formulas, and explanations in the component content
                3. Transfer the detailed educational content from your response into the interactive component
                4. Keep your chat response concise and focused on guiding the student to use the interactive component
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
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: {
            ...tutorContext,
            // Use instructionOverrides from options or set defaults for interactive content
            instructionOverrides: optionsRef.current.instructionOverrides || {
              preferInteractiveContent: true,
              interactiveContentGuidelines: `
                When explaining educational concepts, prefer creating rich interactive components with detailed content instead of just responding in chat.
                For educational responses:
                1. Create explainer components with comprehensive sections
                2. Include all key concepts, formulas, and explanations in the component content
                3. Transfer the detailed educational content from your response into the interactive component
                4. Keep your chat response concise and focused on guiding the student to use the interactive component
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

      // Check if a new subject was created
      if (data.newSubjectCreated && data.newSubjectData) {
        console.log('🎯 New subject created in useAITutor:', data.newSubjectData.name);
        
        // If there's a subject creation handler, call it directly
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
            id: `interactive_${Date.now()}`,
            type: result.componentType as ComponentType,
            data: result.content,
            onInteraction: async (action: string, data: unknown) => {
              // Handle interactions with the component
              await sendMessage(`User interacted with ${result.componentType}: ${action} - ${JSON.stringify(data)}`);
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
  }, [sendMessage]);

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
    sendMessageWithMetadata,
    updateContext,
    isLoading,
    error,
    context: tutorContext
  };
} 