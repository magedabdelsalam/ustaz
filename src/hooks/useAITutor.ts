import { useState, useCallback, useEffect } from 'react';
import { TutorContext, TutorToolName } from '@/lib/ai-tutor-service';
import { Subject, LessonPlan, UseAITutorOptions, CurrentLesson, AppError } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { persistenceService } from '@/lib/persistenceService';

// Default instructions for interactive content generation (currently unused)
const _DEFAULT_INTERACTIVE_CONTENT_GUIDELINES = `
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

interface _ToolCallResult {
  name: TutorToolName;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface _AITutorResponse {
  response: string;
  toolCalls: _ToolCallResult[];
  context: TutorContext;
  simulated?: boolean;
  message?: string;
}

// Helper: Get storage key for context persistence (currently unused)
function _getContextStorageKey(subjectId?: string) {
  return subjectId ? `ustaz_tutor_context_${subjectId}` : 'ustaz_tutor_context_default'
}

export function useAITutor(options: UseAITutorOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);
  const [currentContext, setCurrentContext] = useState<TutorContext>({ conversationHistory: [] });
  const { user } = useAuth();

  // Load context when subject changes
  useEffect(() => {
    if (currentSubject) {
      loadContextForSubject(currentSubject.id);
    }
  }, [currentSubject?.id]);

  // Auto-save context periodically
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (currentSubject) {
        saveCurrentContext();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(autoSaveInterval);
  }, [currentSubject]);

  const handleError = useCallback((error: Error) => {
    const appError: AppError = {
      message: error.message,
      userMessage: 'An error occurred in the AI Tutor.',
      canRetry: false,
      timestamp: new Date(),
      severity: 'error',
      type: 'unknown',
    };
    options.onError?.(appError);
  }, [options]);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    options.onLoadingChange?.(loading);
  }, [options]);

  const loadContextForSubject = useCallback(async (subjectId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load context from persistence directly since we don't have service on client
      if (user?.id) {
        const loadedContext = await persistenceService.loadTutorContext(user.id, subjectId);
        if (loadedContext) {
          setCurrentContext(loadedContext);
          // Notify parent component
          if (options.onContextLoaded) {
            options.onContextLoaded(loadedContext);
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load context');
      setError(error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, options, handleError, setLoading]);

  const saveCurrentContext = useCallback(async () => {
    if (!currentSubject || !user?.id) return;

    try {
      await persistenceService.saveTutorContext(
        user.id,
        currentSubject.id,
        currentContext
      );
    } catch (err) {
      console.error('Failed to save context:', err);
      // Don't set error state for auto-save failures
    }
  }, [currentContext, currentSubject, user?.id]);

  const setSubject = useCallback((subject: Subject | null) => {
    setCurrentSubject(subject);
  }, []);

  // Generate response via API call instead of direct service call
  const generateResponse = useCallback(async (message: string, subject?: Subject) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: currentContext,
          userId: user?.id,
          sessionId: `session-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update context with new information
      if (result.context) {
        setCurrentContext(result.context);
        
        // Check for lesson progress updates
        if (result.context.lessonPlan) {
          const currentLesson = result.context.lessonPlan.lessons[result.context.lessonPlan.currentLessonIndex];
          if (currentLesson && options.onLessonProgress) {
            options.onLessonProgress(currentLesson.progress || 0);
          }
        }
      }
      
      return {
        response: result.response,
        toolCalls: result.toolCalls || [],
        updatedContext: result.context,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate response');
      setError(error);
      handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentContext, user?.id, options, handleError, setLoading]);

  // Handle lesson change
  const onLessonChange = useCallback((lessonIndex: number) => {
    if (currentContext.lessonPlan) {
      const updatedPlan = {
        ...currentContext.lessonPlan,
        currentLessonIndex: lessonIndex
      };
      setCurrentContext({
        ...currentContext,
        lessonPlan: updatedPlan
      });
    }
  }, [currentContext]);

  const sendMessage = useCallback(async (message: string) => {
    try {
      setLoading(true);
      const result = await generateResponse(message);
      return result;
    } catch (error) {
      handleError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [generateResponse, handleError, setLoading]);

  const handleInteraction = useCallback(async (type: string, data: unknown) => {
    try {
      setLoading(true);
      const result = await generateResponse(`User interacted: ${type} - ${JSON.stringify(data)}`);
      return result;
    } catch (error) {
      handleError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [generateResponse, handleError, setLoading]);

  const getLessonPlan = useCallback(async (): Promise<LessonPlan> => {
    try {
      const lessonPlan = currentContext.lessonPlan;
      if (!lessonPlan) {
        throw new Error('No lesson plan available');
      }
      return lessonPlan;
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  }, [handleError]); // Remove currentContext dependency to prevent infinite loops

  const getCurrentLesson = useCallback(async (): Promise<CurrentLesson> => {
    try {
      const lessonPlan = currentContext.lessonPlan;
      if (!lessonPlan) {
        throw new Error('No lesson plan available');
      }
      
      const currentLesson = lessonPlan.lessons[lessonPlan.currentLessonIndex];
      if (!currentLesson) {
        throw new Error('No current lesson found');
      }
      
      return {
        id: currentLesson.id,
        title: currentLesson.title,
        description: currentLesson.description,
        progress: currentLesson.progress || 0,
        objectives: currentLesson.objectives || [],
        completedObjectives: [], // This could be calculated based on progress
        achievement: currentLesson.achievement
      };
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  }, [handleError]); // Remove currentContext dependency to prevent infinite loops

  return {
    generateResponse,
    setSubject,
    currentSubject,
    isLoading,
    error,
    onLessonChange,
    sendMessage,
    handleInteraction,
    getLessonPlan,
    getCurrentLesson
  };
}

// Add a helper to detect and parse user goals/level (currently unused)
function _parseGoalsAndLevel(message: string): { userGoals?: string; userLevel?: string } {
  // Simple heuristic: look for level keywords and treat the rest as goals
  const levelMatch = message.match(/\b(beginner|intermediate|advanced)\b/i)
  const userLevel = levelMatch && levelMatch[1] ? levelMatch[1].toLowerCase() : undefined
  let userGoals = message
  if (userLevel && levelMatch && levelMatch[0]) {
    userGoals = message.replace(levelMatch[0], '').replace(/\s+/g, ' ').trim()
  }
  return { userGoals: userGoals || undefined, userLevel }
} 