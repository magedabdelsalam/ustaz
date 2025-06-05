import { useState, useCallback, useRef, useEffect } from 'react';
import { TutorContext, TutorToolName } from '@/lib/ai-tutor-service';
import { Subject, LessonPlan, LearningProgress, ComponentType, InteractiveContent } from '@/types';
import { errorHandler } from '@/lib/errorHandler';

// Default instructions for interactive content generation
const DEFAULT_INTERACTIVE_CONTENT_GUIDELINES = `
  When explaining educational concepts, prefer creating rich interactive components with detailed content instead of just responding in chat.
  For educational responses:
  1. Create interactive components with comprehensive content appropriate to the learning objective
  2. Include all key concepts, formulas, and explanations in the component content
  3. Transfer the detailed educational content from your response into the interactive component
  4. Keep your chat response concise and focused on guiding the student to use the interactive component
  
  COMPONENT FORMATTING INSTRUCTIONS:
  
  1. EXPLAINER COMPONENT
  Structure 'explainer' components as follows:
  {
    "title": "Main topic title",
    "overview": "Brief summary of the topic",
    "sections": [
      {
        "heading": "Section 1 title",
        "paragraphs": ["First paragraph text", "Second paragraph text"]
      },
      {
        "heading": "Section 2 title",
        "paragraphs": ["Paragraph explaining this section"]
      }
    ],
    "conclusion": "Summary of the key points",
    "difficulty": "beginner"
  }
  
  2. MULTIPLE CHOICE COMPONENT
  Structure 'multiple-choice' components as follows:
  {
    "title": "Question topic",
    "description": "Brief context for the question",
    "question": "The actual question text?",
    "choices": [
      {
        "id": "a",
        "text": "First option text",
        "isCorrect": false,
        "explanation": "Why this option is incorrect"
      },
      {
        "id": "b",
        "text": "Second option text",
        "isCorrect": true,
        "explanation": "Why this option is correct"
      },
      {
        "id": "c",
        "text": "Third option text",
        "isCorrect": false,
        "explanation": "Why this option is incorrect"
      }
    ],
    "explanation": "Overall explanation of the correct answer and key concepts"
  }
  
  3. FILL IN THE BLANK COMPONENT
  Structure 'fill-blank' components as follows:
  {
    "title": "Fill in the blanks exercise",
    "description": "Instructions for the exercise",
    "template": "This is a sentence with a ___ where the student needs to fill in a word.",
    "answers": ["word"],
    "blanks": [
      {
        "id": "blank_1",
        "answer": "word",
        "placeholder": "missing term",
        "hint": "Clue to help find the answer"
      }
    ],
    "explanation": "Explanation of the concept being tested",
    "difficulty": "beginner"
  }
  
  4. DRAG AND DROP COMPONENT
  Structure 'drag-drop' components as follows:
  {
    "title": "Matching exercise title",
    "description": "Instructions for the matching exercise",
    "items": [
      {
        "id": "item1",
        "text": "First draggable item",
        "correctTargetId": "target1",
        "hint": "Hint about where this item belongs"
      },
      {
        "id": "item2",
        "text": "Second draggable item",
        "correctTargetId": "target2",
        "hint": "Hint about where this item belongs"
      }
    ],
    "targets": [
      {
        "id": "target1",
        "label": "First drop target",
        "description": "Description of this category"
      },
      {
        "id": "target2",
        "label": "Second drop target",
        "description": "Description of this category"
      }
    ],
    "explanation": "Explanation of the relationships between items and targets"
  }
  
  5. STEP BY STEP SOLVER COMPONENT
  Structure 'step-solver' components as follows:
  {
    "title": "Problem solving exercise",
    "description": "Context for the problem",
    "problem": "The full problem statement or question",
    "steps": [
      {
        "title": "Step 1: Identify the key information",
        "content": "Detailed explanation of this step",
        "hint": "Hint to help with this step"
      },
      {
        "title": "Step 2: Apply the formula",
        "content": "Detailed explanation of this step",
        "hint": "Hint to help with this step"
      },
      {
        "title": "Step 3: Calculate the result",
        "content": "Detailed explanation of this step",
        "hint": "Hint to help with this step"
      }
    ],
    "solution": "The final answer or solution to the problem"
  }
  
  6. CONCEPT CARD COMPONENT
  Structure 'concept-card' components as follows:
  {
    "title": "Concept name",
    "summary": "One-sentence summary of the concept",
    "details": "Longer paragraph explaining the concept in detail",
    "keyPoints": [
      "First key point about the concept",
      "Second key point about the concept",
      "Third key point about the concept"
    ],
    "examples": [
      "First example illustrating the concept",
      "Second example illustrating the concept"
    ],
    "difficulty": "beginner"
  }
  
  7. INTERACTIVE EXAMPLE COMPONENT
  Structure 'interactive-example' components as follows:
  {
    "title": "Interactive demonstration title",
    "description": "What this interactive example demonstrates",
    "controls": [
      {
        "id": "slider1",
        "type": "slider",
        "label": "Adjust this parameter",
        "min": 0,
        "max": 100,
        "step": 1,
        "defaultValue": 50
      },
      {
        "id": "toggle1",
        "type": "toggle",
        "label": "Enable feature",
        "defaultValue": true
      }
    ],
    "display": [
      {
        "id": "display1",
        "type": "text",
        "content": "This text changes based on controls"
      },
      {
        "id": "display2",
        "type": "graph",
        "content": "graph data representation"
      }
    ],
    "explanation": "Explanation of what the interactive example demonstrates"
  }
  
  8. PROGRESS QUIZ COMPONENT
  Structure 'progress-quiz' components as follows:
  {
    "title": "Knowledge assessment quiz",
    "description": "Test your understanding of the topic",
    "questions": [
      {
        "id": "q1",
        "text": "First question text?",
        "options": [
          {
            "id": "q1a",
            "text": "Option A",
            "isCorrect": false
          },
          {
            "id": "q1b",
            "text": "Option B",
            "isCorrect": true
          }
        ],
        "explanation": "Explanation for the first question",
        "difficulty": "easy"
      },
      {
        "id": "q2",
        "text": "Second question text?",
        "options": [
          {
            "id": "q2a",
            "text": "Option A",
            "isCorrect": true
          },
          {
            "id": "q2b",
            "text": "Option B",
            "isCorrect": false
          }
        ],
        "explanation": "Explanation for the second question",
        "difficulty": "medium"
      }
    ],
    "passingScore": 70,
    "explanation": "Overall summary of the quiz content"
  }
  
  9. GRAPH VISUALIZER COMPONENT
  Structure 'graph-visualizer' components as follows:
  {
    "title": "Graph visualization title",
    "description": "What this graph demonstrates",
    "type": "line",
    "data": [
      {"x": 0, "y": 0, "label": "Point 1"},
      {"x": 1, "y": 2, "label": "Point 2"},
      {"x": 2, "y": 4, "label": "Point 3"}
    ],
    "xAxis": {
      "label": "X-axis label",
      "min": 0,
      "max": 10,
      "step": 1
    },
    "yAxis": {
      "label": "Y-axis label",
      "min": 0,
      "max": 10,
      "step": 1
    },
    "explanation": "Explanation of what the graph shows"
  }
  
  10. FORMULA EXPLORER COMPONENT
  Structure 'formula-explorer' components as follows:
  {
    "title": "Formula exploration title",
    "description": "Description of this formula and its importance",
    "formula": "y = mx + b",
    "variables": [
      {
        "id": "m",
        "name": "Slope",
        "symbol": "m",
        "description": "Rate of change",
        "min": -10,
        "max": 10,
        "step": 0.1,
        "defaultValue": 1,
        "unit": ""
      },
      {
        "id": "b",
        "name": "Y-intercept",
        "symbol": "b",
        "description": "Where line crosses y-axis",
        "min": -10,
        "max": 10,
        "step": 0.1,
        "defaultValue": 0,
        "unit": ""
      }
    ],
    "steps": [
      {
        "id": "step1",
        "description": "Understanding the slope",
        "expression": "m represents how steep the line is",
        "explanation": "Detailed explanation of the slope"
      },
      {
        "id": "step2",
        "description": "Understanding the y-intercept",
        "expression": "b is where the line crosses the y-axis",
        "explanation": "Detailed explanation of the y-intercept"
      }
    ]
  }
  
  11. TEXT HIGHLIGHTER COMPONENT
  Structure 'text-highlighter' components as follows:
  {
    "title": "Text analysis exercise",
    "description": "Instructions for the highlighting exercise",
    "text": "The full text passage that will be analyzed by highlighting",
    "categories": [
      {
        "id": "cat1",
        "name": "Category 1",
        "color": "blue",
        "description": "Description of this category"
      },
      {
        "id": "cat2",
        "name": "Category 2",
        "color": "green",
        "description": "Description of this category"
      }
    ],
    "explanation": "Explanation of the highlighting categories and text analysis"
  }
  
  Do NOT include text like "Here's an explainer:" in your chat response. The content should be directly created as structured JSON in the tool call, not parsed from your text response.
`;

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

// Helper: Get storage key for context persistence
function getContextStorageKey(subjectId?: string) {
  return subjectId ? `ustaz_tutor_context_${subjectId}` : 'ustaz_tutor_context_default'
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

  // On mount, try to load context from localStorage
  useEffect(() => {
    const subjectId = options.subject?.id
    const key = getContextStorageKey(subjectId)
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (stored) {
      try {
        setTutorContext(JSON.parse(stored))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [options.subject?.id])

  // Persist context to localStorage after every update
  useEffect(() => {
    const subjectId = options.subject?.id
    const key = getContextStorageKey(subjectId)
    if (tutorContext && typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(tutorContext))
    }
  }, [tutorContext, options.subject?.id])

  // Load context from the server on mount
  useEffect(() => {
    const loadContext = async () => {
      const userId = options.userId;
      const subjectId = options.subject?.id;
      if (userId && subjectId) {
        try {
          const response = await fetch(`/api/tutor-context?userId=${userId}&subjectId=${subjectId}`);
          if (response.ok) {
            const { context } = await response.json();
            if (context) {
              setTutorContext(context);
            }
          } else {
            console.error('Failed to load context from server:', response.statusText);
            // Fallback to localStorage if server load fails
            const localContext = localStorage.getItem(`tutor-context-${userId}-${subjectId}`);
            if (localContext) {
              setTutorContext(JSON.parse(localContext));
            }
          }
        } catch (error) {
          console.error('Error loading context:', error);
          // Fallback to localStorage if server load fails
          const localContext = localStorage.getItem(`tutor-context-${userId}-${subjectId}`);
          if (localContext) {
            setTutorContext(JSON.parse(localContext));
          }
        }
      }
    };
    loadContext();
  }, [options.userId, options.subject?.id]);

  // Save context to the server after updates
  const saveContext = async (updatedContext: TutorContext) => {
    const userId = options.userId;
    const subjectId = options.subject?.id;
    if (userId && subjectId) {
      try {
        const response = await fetch('/api/tutor-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, subjectId, context: updatedContext })
        });
        if (!response.ok) {
          console.error('Failed to save context to server:', response.statusText);
          // Fallback to localStorage if server save fails
          localStorage.setItem(`tutor-context-${userId}-${subjectId}`, JSON.stringify(updatedContext));
        }
      } catch (error) {
        console.error('Error saving context:', error);
        // Fallback to localStorage if server save fails
        localStorage.setItem(`tutor-context-${userId}-${subjectId}`, JSON.stringify(updatedContext));
      }
    }
  };

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
              interactiveContentGuidelines: DEFAULT_INTERACTIVE_CONTENT_GUIDELINES
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

      await saveContext(data.context);

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
      
      // Ensure subject is included in the context
      const currentSubject = optionsRef.current.subject;
      let contextWithSubject = { ...tutorContext };
      
      // Add subject to context explicitly to avoid "No subject context available" errors
      if (currentSubject && (!contextWithSubject || !contextWithSubject.subject)) {
        console.log('📝 Adding subject to context explicitly:', currentSubject.name);
        contextWithSubject = {
          ...contextWithSubject,
          subject: currentSubject
        };
      }
      
      // Call our API endpoint
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: {
            ...contextWithSubject,
            // Use instructionOverrides from options or set defaults for interactive content
            instructionOverrides: optionsRef.current.instructionOverrides || {
              preferInteractiveContent: true,
              interactiveContentGuidelines: DEFAULT_INTERACTIVE_CONTENT_GUIDELINES
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

      // Enhanced logging for debugging
      console.log('🔄 AI Response received:', {
        responsePreview: data.response.substring(0, 200) + '...',
        toolCallsCount: data.toolCalls.length,
        toolCallTypes: data.toolCalls.map(tc => tc.name),
        hasInteractiveComponent: data.toolCalls.some(tc => tc.name === 'interactive_component'),
        newSubjectCreated: data.newSubjectCreated || false
      });
      
      if (data.toolCalls.length === 0) {
        console.warn('⚠️ No tool calls made by AI - interactive content cannot be generated without tool calls!');
      } else {
        console.log('🔧 Tool calls made:', data.toolCalls.map(tc => ({
          name: tc.name,
          paramsPreview: JSON.stringify(tc.parameters).substring(0, 100) + '...'
        })));
      }

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

      await saveContext(data.context);

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

    console.log(`🔧 Processing tool call: ${name}`, { 
      parameters: JSON.stringify(parameters).substring(0, 200) + '...',
      resultPreview: JSON.stringify(result).substring(0, 200) + '...'
    });

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
    setTutorContext(prev => {
      const newContext = prev ? { ...prev, ...updates } : { conversationHistory: [], ...updates }
      // If userGoals or userLevel are set and no lesson plan, trigger lesson plan generation
      if ((updates.userGoals || updates.userLevel) && !newContext.lessonPlan && newContext.subject) {
        // Fire and forget: ask AI to generate a lesson plan
        sendMessageWithMetadata('Generate a lesson plan for this subject.')
      }
      // Persist to localStorage
      const subjectId = newContext.subject?.id
      const key = getContextStorageKey(subjectId)
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(newContext))
      }
      return newContext
    })
  }, [sendMessageWithMetadata])

  return {
    sendMessage,
    sendMessageWithMetadata,
    updateContext,
    isLoading,
    error,
    context: tutorContext
  };
}

// Add a helper to detect and parse user goals/level
function parseGoalsAndLevel(message: string): { userGoals?: string; userLevel?: string } {
  // Simple heuristic: look for level keywords and treat the rest as goals
  const levelMatch = message.match(/\b(beginner|intermediate|advanced)\b/i)
  const userLevel = levelMatch && levelMatch[1] ? levelMatch[1].toLowerCase() : undefined
  let userGoals = message
  if (userLevel && levelMatch && levelMatch[0]) {
    userGoals = message.replace(levelMatch[0], '').replace(/\s+/g, ' ').trim()
  }
  return { userGoals: userGoals || undefined, userLevel }
} 