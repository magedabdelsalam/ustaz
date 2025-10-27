/**
 * AI Tutor Service
 * -----------------
 * Central class responsible for orchestrating all OpenAI Assistant calls and
 * handling tool-call responses.  The service maintains conversation context,
 * creates per subject assistants and exposes a `generateResponse` method used
 * throughout the application.
 *
 * Exports:
 *   - `AITutorService` main class used via the `useAITutor` hook.
 *   - Various TypeScript interfaces describing tool call parameters.
 */
import OpenAI from 'openai';
import { OPENAI_API_KEY, OPENAI_MODEL } from '@/lib/config';
import { ComponentType, LessonPlan, LearningProgress, Subject, Lesson } from '@/types';
import { persistenceService } from '@/lib/persistenceService';

// Tool call function types as specified by the user
export type TutorToolName = 
  | 'new_subject'
  | 'new_lesson_plan'
  | 'update_lesson_plan'
  | 'clarifying_question'
  | 'lesson_complete'
  | 'next_lesson'
  | 'interactive_component'
  | 'subject_complete'
  | 'review_request'
  | 'summary_request'
  | 'rephrase_request'
  | 'feedback_log';

// Tool call parameters interfaces
export interface NewSubjectParams {
  name: string;
  description?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
}

export interface NewLessonPlanParams {
  subject: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  learning_goals: string[];
  estimated_duration?: string;
}

export interface UpdateLessonPlanParams {
  reason: string;
  adjustments: string[];
  new_lessons?: string[];
  remove_lessons?: string[];
}

export interface ClarifyingQuestionParams {
  question: string;
  context: string;
  options?: string[];
}

export interface LessonCompleteParams {
  lesson_id: string;
  completed: boolean;
  performance_score?: number;
  feedback?: string;
}

export interface NextLessonParams {
  current_lesson_id: string;
  readiness_check?: boolean;
}

export interface InteractiveComponentParams {
  type: ComponentType;
  content: Record<string, unknown>;
  learning_objective: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface SubjectCompleteParams {
  subject_id: string;
  final_score?: number;
  next_level?: string;
}

export interface ReviewRequestParams {
  topics: string[];
  focus_areas?: string[];
  review_type?: 'quick' | 'comprehensive';
}

export interface SummaryRequestParams {
  content_type: 'lesson' | 'concept' | 'progress';
  scope?: string;
}

export interface RephraseRequestParams {
  original_content: string;
  style: 'simpler' | 'more_detailed' | 'visual' | 'practical';
  target_level?: 'beginner' | 'intermediate' | 'advanced';
}

export interface FeedbackLogParams {
  interaction_type: string;
  user_response: string;
  success_rate?: number;
  engagement_level?: 'low' | 'medium' | 'high';
  notes?: string;
  [key: string]: unknown;
}

// Assistant context for maintaining conversation state
export interface TutorContext {
  userId?: string;
  subject?: Subject;
  lessonPlan?: LessonPlan;
  learningProgress?: LearningProgress;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    tool_calls?: Array<{
      name: TutorToolName;
      parameters: Record<string, unknown>;
      result: Record<string, unknown>;
    }>;
  }>;
  userProfile?: {
    learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
    preferredPace?: 'slow' | 'medium' | 'fast';
    previousSubjects?: string[];
    strengths?: string[];
    challenges?: string[];
  };
  instructionOverrides?: {
    preferInteractiveContent: boolean;
    interactiveContentGuidelines?: string;
  };
}

// Tool definitions for OpenAI Assistant API
const TUTOR_TOOLS: OpenAI.Beta.AssistantTool[] = [
  {
    type: 'function',
    function: {
      name: 'new_subject',
      description: 'Start learning a new subject. Creates a new learning track with initial assessment.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the subject to learn (e.g., "Algebra", "Biology", "Python Programming")'
          },
          description: {
            type: 'string',
            description: 'Brief description of what the student wants to learn in this subject'
          },
          difficulty_level: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            description: 'The starting difficulty level based on student background'
          }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'new_lesson_plan',
      description: 'Create a structured lesson sequence for the current subject. Lessons should be organized into 3 phases: beginning/foundation (How it started), middle/development (How it went), and conclusion/outcome (How it ended). Each lesson should have a descriptive title that tells what the student will learn.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'The subject name for which to create the lesson plan'
          },
          difficulty_level: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            description: 'Target difficulty level for the lesson plan'
          },
          learning_goals: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific learning objectives the student wants to achieve'
          },
          estimated_duration: {
            type: 'string',
            description: 'How long the student expects to spend on this subject (e.g., "2 weeks", "1 month")'
          }
        },
        required: ['subject', 'difficulty_level', 'learning_goals']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_lesson_plan',
      description: 'Modify the current lesson plan based on student progress or feedback.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why the lesson plan needs to be updated'
          },
          adjustments: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific changes to make to the lesson plan'
          },
          new_lessons: {
            type: 'array',
            items: { type: 'string' },
            description: 'New lessons to add to the plan'
          },
          remove_lessons: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lessons to remove from the plan'
          }
        },
        required: ['reason', 'adjustments']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clarifying_question',
      description: 'Ask the student to clarify something unclear about their request or understanding.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The clarifying question to ask the student'
          },
          context: {
            type: 'string',
            description: 'Context explaining why this clarification is needed'
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional multiple choice options for the student'
          }
        },
        required: ['question', 'context']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lesson_complete',
      description: 'Mark a lesson as complete or incomplete based on student performance.',
      parameters: {
        type: 'object',
        properties: {
          lesson_id: {
            type: 'string',
            description: 'ID of the lesson being evaluated'
          },
          completed: {
            type: 'boolean',
            description: 'Whether the lesson is successfully completed'
          },
          performance_score: {
            type: 'number',
            description: 'Student performance score (0-100)',
            minimum: 0,
            maximum: 100
          },
          feedback: {
            type: 'string',
            description: 'Feedback on student performance and areas for improvement'
          }
        },
        required: ['lesson_id', 'completed']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'next_lesson',
      description: 'Move to the next lesson in the current lesson plan.',
      parameters: {
        type: 'object',
        properties: {
          current_lesson_id: {
            type: 'string',
            description: 'ID of the current lesson'
          },
          readiness_check: {
            type: 'boolean',
            description: 'Whether to perform a readiness assessment before advancing'
          }
        },
        required: ['current_lesson_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'interactive_component',
      description: 'Create an interactive learning component to teach or test understanding. CRITICAL: You MUST provide ALL required parameters: type, learning_objective, and content. Never use undefined values or empty objects. Ensure all JSON is properly structured with arrays and objects correctly closed.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'explainer', 'interactive-example', 'multiple-choice', 'fill-blank',
              'drag-drop', 'formula-explorer', 'step-solver', 'concept-card',
              'progress-quiz', 'graph-visualizer', 'text-highlighter', 'placeholder'
            ],
            description: 'Type of interactive component to create'
          },
          content: {
            type: 'object',
            description: 'REQUIRED: Complete content data specific to the component type. Never provide empty objects. Must include all required fields for the chosen component type with actual educational content. CRITICAL: When using arrays (e.g., questions, items, options), ensure they are properly closed with ] before adding sibling properties at the same level.'
          },
          learning_objective: {
            type: 'string',
            description: 'What the student should learn from this interaction'
          },
          difficulty: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            description: 'Difficulty level of the interaction'
          }
        },
        required: ['type', 'content', 'learning_objective']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'subject_complete',
      description: 'Mark the entire subject as complete and suggest next steps.',
      parameters: {
        type: 'object',
        properties: {
          subject_id: {
            type: 'string',
            description: 'ID of the completed subject'
          },
          final_score: {
            type: 'number',
            description: 'Final assessment score (0-100)',
            minimum: 0,
            maximum: 100
          },
          next_level: {
            type: 'string',
            description: 'Recommended next subject or advanced level'
          }
        },
        required: ['subject_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'review_request',
      description: 'Initiate a review session for previously learned material.',
      parameters: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific topics to review'
          },
          focus_areas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Areas where the student struggled previously'
          },
          review_type: {
            type: 'string',
            enum: ['quick', 'comprehensive'],
            description: 'Type of review session'
          }
        },
        required: ['topics']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'summary_request',
      description: 'Provide a summary of lessons, concepts, or progress.',
      parameters: {
        type: 'object',
        properties: {
          content_type: {
            type: 'string',
            enum: ['lesson', 'concept', 'progress'],
            description: 'What type of content to summarize'
          },
          scope: {
            type: 'string',
            description: 'Specific scope of the summary (e.g., "current lesson", "last week")'
          }
        },
        required: ['content_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rephrase_request',
      description: 'Explain the same concept in a different way or at a different level.',
      parameters: {
        type: 'object',
        properties: {
          original_content: {
            type: 'string',
            description: 'The original content that needs to be rephrased'
          },
          style: {
            type: 'string',
            enum: ['simpler', 'more_detailed', 'visual', 'practical'],
            description: 'How to rephrase the content'
          },
          target_level: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            description: 'Target difficulty level for the rephrased content'
          }
        },
        required: ['original_content', 'style']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'feedback_log',
      description: 'Log student interaction feedback for adaptive learning.',
      parameters: {
        type: 'object',
        properties: {
          interaction_type: {
            type: 'string',
            description: 'Type of interaction being logged'
          },
          user_response: {
            type: 'string',
            description: 'How the student responded to the interaction'
          },
          success_rate: {
            type: 'number',
            description: 'Success rate percentage (0-100)',
            minimum: 0,
            maximum: 100
          },
          engagement_level: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Student engagement level during interaction'
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the interaction'
          }
        },
        required: ['interaction_type', 'user_response']
      }
    }
  }
];

// Main AI Tutor Service Class
export class AITutorService {
  private openai: OpenAI | null = null;
  private assistants: Map<string, OpenAI.Beta.Assistant> = new Map(); // Map subject ID to assistant                                                                                              
  private context: TutorContext;
  private subjectThreads: Map<string, string> = new Map(); // Map subject ID to thread ID
  private initializationPromises: Map<string, Promise<void>> = new Map(); // Map subject ID to initialization promise
    private currentThreadId: string | null = null; // Track the thread being used for the current run

  constructor() {
    console.log('🤖 Initializing AI Tutor Service...');
    
    // Initialize empty context
    this.context = {
      conversationHistory: [],
      instructionOverrides: {
        preferInteractiveContent: true,
        interactiveContentGuidelines: `
          CRITICAL INTERACTIVE CONTENT RULE:
          When responding to educational queries, ALWAYS create rich interactive components instead of detailed text responses in chat.
          
          ESSENTIAL: Keep your chat response BRIEF (1-2 sentences max) when creating interactive components.
          Put ALL detailed educational content inside the interactive component, NOT in the chat response.
          
          Example:
          ❌ BAD: Long explanation in chat + same content repeated in component  
          ✅ GOOD: "I've created an interactive lesson below. Use it to explore the concepts!" + rich component content
          
          For educational topics:
          1. Use the interactive_component tool for each new concept or explanation
          2. Put ALL comprehensive explanations, formulas, and examples INTO the interactive component
          3. Make the chat response brief, mainly directing the user to use the interactive component
          4. Ensure the interactive component contains ALL the important educational content
          5. Use the most appropriate component type for the content:
             - explainer: For detailed explanations with multiple sections
             - interactive-example: For hands-on exploration of concepts
             - formula-explorer: For mathematical formulas and equations
             - step-solver: For step-by-step problem solving
             - graph-visualizer: For visual representations of functions and data
        `
      }
    };
    
    // Initialize OpenAI client if API key is available
    if (OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      console.log('✅ OpenAI client initialized successfully');
    } else {
      console.log('⚠️ No OPENAI_API_KEY found - AI features will be limited');
    }
  }

  private async getOrCreateAssistantForSubject(subjectId: string, subjectName: string): Promise<OpenAI.Beta.Assistant | null> {
    if (!this.openai) {
      console.log('❌ Cannot get assistant: OpenAI client not available');
      return null;
    }

    // Return cached assistant if available
    if (this.assistants.has(subjectId)) {
      return this.assistants.get(subjectId)!;
    }

    // If already initializing this subject's assistant, wait for it
    if (this.initializationPromises.has(subjectId)) {
      await this.initializationPromises.get(subjectId);
      return this.assistants.get(subjectId) || null;
    }

    // Start initialization for this subject
    const initPromise = this.initializeAssistantForSubject(subjectId, subjectName);
    this.initializationPromises.set(subjectId, initPromise);
    
    await initPromise;
    this.initializationPromises.delete(subjectId);
    
    return this.assistants.get(subjectId) || null;
  }

  private async initializeAssistantForSubject(subjectId: string, subjectName: string): Promise<void> {
    if (!this.openai) {
      console.log('❌ Cannot initialize assistant: OpenAI client not available');
      return;
    }

    try {
      // First, try to get existing assistant for this subject from database
      console.log(`🔄 Checking for existing assistant for subject: ${subjectName} (${subjectId})`);
      const existingSettings = await persistenceService.getAssistantBySubject(subjectId);
      
      if (existingSettings) {
        try {
          console.log(`🔄 Retrieving existing assistant: ${existingSettings.assistant_id} for ${subjectName}`);
          const assistant = await this.openai.beta.assistants.retrieve(existingSettings.assistant_id);
          this.assistants.set(subjectId, assistant);
          console.log(`✅ Successfully loaded existing assistant for ${subjectName}:`, assistant.id);
          return;
        } catch (retrieveError) {
          console.log(`⚠️ Failed to retrieve existing assistant for ${subjectName}, creating new one:`, retrieveError);
          // Continue to create new assistant below
        }
      } else {
        console.log(`📝 No existing assistant found for subject: ${subjectName}`);
      }

      // Create new assistant for this subject
      console.log(`🔄 Creating new OpenAI Assistant for subject: ${subjectName}...`);
       const assistant = await this.openai.beta.assistants.create({
        name: `Ustaz AI Tutor - ${subjectName}`,
                instructions: `You are Ustaz, an intelligent and adaptive AI tutor specialized in teaching ${subjectName}. Your core responsibilities:

TEACHING PHILOSOPHY:
- Focus specifically on ${subjectName} concepts and skills
- Always start with understanding the student's current level and goals in ${subjectName}
- Break down complex ${subjectName} concepts into digestible pieces
- Use teaching methods appropriate for ${subjectName}
- Provide immediate feedback and encouragement
- Adapt your approach based on student performance and engagement

SUBJECT-SPECIFIC FOCUS:
- You are dedicated exclusively to teaching ${subjectName}
- All examples, exercises, and explanations should relate to ${subjectName}
- Tailor your teaching style to what works best for ${subjectName}
- Use ${subjectName}-specific terminology and concepts appropriately

CRITICAL INTERACTIVE CONTENT RULE:
When you create an interactive component, your chat response must be BRIEF (1-2 sentences max). Put ALL the detailed educational content inside the interactive component. Do NOT repeat the component content in your chat response.

Example:
❌ BAD: "Let me explain photosynthesis. Photosynthesis is the process... [long explanation]" + interactive component with same content
✅ GOOD: "I've created an interactive explainer about photosynthesis below. Use it to explore the key concepts step by step!" + interactive component with rich content

TOOL USAGE STRATEGY:
1. Start with 'explainer' to introduce new ${subjectName} concepts clearly
2. Follow with 'interactive-example' to demonstrate practical application in ${subjectName}
3. Use 'clarifying_question' when student responses are unclear
4. Test understanding with 'multiple-choice', 'fill-blank', or 'step-solver' specific to ${subjectName}
5. Use 'drag-drop' or 'graph-visualizer' for visual learning in ${subjectName}
6. Apply 'progress-quiz' to evaluate retention and readiness in ${subjectName}
7. Use 'rephrase_request' or 'review_request' when students struggle with ${subjectName} concepts
8. Use 'summary_request' for consolidation and wrap-up of ${subjectName} topics
9. Track progress with 'lesson_complete' and 'next_lesson' specific to ${subjectName}
10. Log interactions with 'feedback_log' for continuous improvement in ${subjectName} teaching

CONTENT FORMAT FOR INTERACTIVE COMPONENTS:
When you call the 'interactive_component' tool, you MUST provide complete, high-quality, ready-to-render content. NEVER pass empty objects {}. The content parameter must include all required fields with actual educational material that students can learn from. Use the schema that matches the chosen type (no placeholders):

- explainer:
  {
    "title": string,
    "description": string,
    "sections": [ { "heading": string, "paragraphs": string[] } ],
    "summary": string,
    "keywords": string[],
    "references": [ { "title": string, "url": string } ]
  }
  Rules: 3–6 sections; each with 2–4 concise paragraphs.

- interactive-example:
  {
    "title": string,
    "description": string,
    "controls": [ { "id": string, "type": "slider"|"toggle"|"button", "label": string, "min"?: number, "max"?: number, "step"?: number, "defaultValue"?: number|boolean } ],
    "display": [ { "id": string, "type": "text"|"formula"|"shape"|"color"|"graph"|"visualization", "content": string, "style"?: object } ],
    "explanation": string,
    "initialValues"?: { [id: string]: number | boolean }
  }

- multiple-choice:
  {
    "title": string,
    "description": string,
    "question": string,
    "choices": [ { "id": string, "text": string, "isCorrect": boolean, "explanation"?: string } ],
    "explanation"?: string
  }

- fill-blank:
  {
    "title"?: string,
    "description"?: string,
    "question": string,
    "template": string,
    "answers": string[],
    "blanks"?: [ { "id": string, "answer": string, "placeholder": string, "hint"?: string } ],
    "hints"?: string[],
    "explanation"?: string,
    "difficulty"?: "beginner"|"intermediate"|"advanced"
  }

- step-solver:
  {
    "problem": string,
    "steps": [ {
      "id": string,
      "description": string,
      "formula"?: string,
      "calculation"?: string,
      "result": string,
      "explanation": string
    } ],
    "finalAnswer": string,
    "problemType": string,
    "difficulty"?: "beginner"|"intermediate"|"advanced",
    "category"?: string
  }
  Rules: Each step must have a clear description, result, and explanation. For math problems, include formula and calculation. The problemType should describe the type of problem (e.g., "Linear Equation", "Area Calculation"). Generate at least 3-5 steps for thorough explanation.

- formula-explorer:
  {
    "title": string,
    "description": string,
    "formula": string,
    "variables": [ { "id": string, "name": string, "symbol": string, "min": number, "max": number, "step": number, "defaultValue": number, "unit"?: string } ],
    "steps"?: [ { "id": string, "description": string, "expression": string } ],
    "examples"?: [ { "id": string, "name": string, "values": { [varId: string]: number } } ],
    "explanation"?: string
  }

- drag-drop:
  {
    "question": string,
    "instructions": string,
    "items": [ { "id": string, "content": string, "correctTargetId": string } ],
    "targets": [ { "id": string, "label": string, "placeholder": string } ],
    "explanation"?: string,
    "category"?: string
  }
  Rules: Use "content" not "text" for items. Use "placeholder" not "description" for targets. Provide clear instructions and a helpful explanation after completion.

- progress-quiz:
  {
    "title": string,
    "description": string,
    "questions": [ {
      "id": string,
      "text": string,
      "type"?: "multiple-choice"|"true-false"|"fill-blank"|"text_input",
      "options": [ { "id": string, "text": string, "isCorrect": boolean } ],
      "explanation"?: string
    } ],
    "passingScore"?: number,
    "category"?: string,
    "allowRetry"?: boolean,
    "showExplanations"?: boolean
  }
  Rules: Mark exactly ONE option as isCorrect per question. Include type field. Provide clear explanations. Set passingScore between 60-80. Use showExplanations: true for learning quizzes.
  CRITICAL: The "questions" property must be a properly closed array. Properties like "passingScore", "category", etc. MUST be at the root level, NOT inside the questions array. Correct: {"questions":[...],"passingScore":70}. WRONG: {"questions":[...,"passingScore":70]}.

- graph-visualizer:
  {
    "title": string,
    "description": string,
    "type": "line"|"bar"|"pie"|"scatter"|"function",
    "data": any,
    "xAxis": { "label": string },
    "yAxis": { "label": string },
    "explanation"?: string
  }

- text-highlighter:
  {
    "title": string,
    "description": string,
    "text": string,
    "categories": [ { "id": string, "name": string, "color": string } ],
    "explanation"?: string
  }

ADAPTIVE BEHAVIOR:
- Monitor student responses and adjust difficulty accordingly for ${subjectName}
- If a student struggles, simplify ${subjectName} explanations and provide more examples
- If a student excels, introduce advanced ${subjectName} concepts and challenges
- Use multiple learning modalities (text, visual, interactive) to reinforce ${subjectName} understanding
- Provide encouragement and maintain motivation specifically for ${subjectName} learning

CONVERSATION FLOW:
- Always acknowledge student input positively
- Ask clarifying questions when needed about ${subjectName} concepts
- Provide step-by-step guidance for complex ${subjectName} problems
- Celebrate achievements and learning milestones in ${subjectName}
- Offer help and alternative explanations when students are stuck with ${subjectName}

Remember: You are exclusively focused on teaching ${subjectName}. All your interactions, examples, and guidance should be relevant to this subject. You are building a deep, focused learning experience for this specific subject.`,
        model: OPENAI_MODEL,
        tools: TUTOR_TOOLS
      });
      
      this.assistants.set(subjectId, assistant);
      console.log(`✅ New OpenAI Assistant created for ${subjectName}:`, assistant.id);
      
      // Save the new assistant to database
      console.log(`💾 Saving assistant to database for ${subjectName}...`);
      const userId = this.context.userId;
      if (userId) {
        const savedSettings = await persistenceService.saveAssistantForSubject({
          assistant_id: assistant.id,
          subject_id: subjectId,
          user_id: userId,
          model: OPENAI_MODEL,
          name: `Ustaz AI Tutor - ${subjectName}`
        });
        
        if (savedSettings) {
          console.log(`✅ Assistant saved to database successfully for ${subjectName}`);
        } else {
          console.log(`⚠️ Failed to save assistant to database for ${subjectName}, but continuing...`);
        }
      } else {
        console.log(`⚠️ No user ID available, skipping assistant persistence for ${subjectName}`);
      }
      
      // If a thread already exists in DB for this subject, keep it. Otherwise create and save it.
      try {
        const existingThreadId = await persistenceService.getThreadBySubject(subjectId);
        if (existingThreadId) {
          this.subjectThreads.set(subjectId, existingThreadId);
          console.log('🔗 Loaded persisted thread for subject:', subjectId, 'threadId:', existingThreadId);
        }
      } catch (e) {
        console.log('⚠️ Could not check for existing thread:', e);
      }

    } catch (error) {
      console.error(`❌ Failed to initialize AI Assistant for ${subjectName}:`, error);
    }
  }

  // Generate tutor response with tool calling
  async generateResponse(
    userMessage: string, 
    context?: Partial<TutorContext>
  ): Promise<{
    response: string;
    toolCalls: Array<{
      name: TutorToolName;
      parameters: Record<string, unknown>;
      result: Record<string, unknown>;
    }>;
    updatedContext: TutorContext;
  }> {
    // Wait for initialization to complete
    if (this.initializationPromises.size > 0) {
      console.log('⏳ Waiting for AI assistants initialization...');
      await Promise.all(this.initializationPromises.values());
    }

    // Update context (ignore undefined values to avoid wiping existing state)
    if (context) {
      const sanitized = Object.fromEntries(
        Object.entries(context as Record<string, unknown>).filter(([, v]) => v !== undefined)
      ) as Partial<TutorContext>;
      this.context = { ...this.context, ...sanitized };
      
      // Extract lesson plan from subject if available
      if (this.context.subject?.lessonPlan && !this.context.lessonPlan) {
        this.context.lessonPlan = {
          subject: this.context.subject.name,
          currentLessonIndex: this.context.subject.lessonPlan.currentLessonIndex,
          lessons: this.context.subject.lessonPlan.lessons.map(l => ({
            id: l.id,
            title: l.title,
            description: l.description,
            completed: false
          }))
        };
        console.log('📚 Extracted lesson plan from subject:', this.context.lessonPlan.lessons.length, 'lessons');
      }
    }

    // Add user message to conversation history
    this.context.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    if (!this.openai) {
      // Fallback for when OpenAI is not available
      console.log('❌ OpenAI not available');
      return this.generateFallbackResponse(userMessage);
    }

    // Determine subject or fall back to a general assistant that can create one
    const effectiveSubjectId = this.context.subject?.id || 'general';

    try {
      // Get or create thread for this subject (prefer persisted thread)
      let threadId: string;
      const subjectId = effectiveSubjectId;
      
      if (subjectId && this.subjectThreads.has(subjectId)) {
        // Use existing thread for this subject
        threadId = this.subjectThreads.get(subjectId)!;
        console.log('🔄 Using existing thread for subject:', subjectId, 'threadId:', threadId);
      } else {
        // Try load persisted thread from DB first
        let loadedThreadId: string | null = null;
        if (subjectId) {
          try {
            loadedThreadId = await persistenceService.getThreadBySubject(subjectId);
          } catch (e) {
            console.log('⚠️ Failed to load persisted thread id:', e);
          }
        }

        if (loadedThreadId) {
          threadId = loadedThreadId;
          this.subjectThreads.set(subjectId, threadId);
          console.log('🔗 Using persisted thread for subject:', subjectId, 'threadId:', threadId);
        } else {
          // Create a new thread for new subject or when no subject context
          const thread = await this.openai.beta.threads.create();
          threadId = thread.id;
          
          if (subjectId) {
            this.subjectThreads.set(subjectId, threadId);
            console.log('🆕 Created new thread for subject:', subjectId, 'threadId:', threadId);
            
            // CRITICAL: Restore conversation history to new thread
            // This ensures context continuity when threads are recreated
            if (this.context.conversationHistory && this.context.conversationHistory.length > 0) {
              console.log('🔄 Restoring', this.context.conversationHistory.length, 'previous messages to new thread');
              try {
                // Add all previous messages to the new thread (excluding the current user message)
                for (const historyMessage of this.context.conversationHistory) {
                  // Skip the current message as it will be added separately
                  if (historyMessage.content !== userMessage || historyMessage.role !== 'user') {
                    await this.openai.beta.threads.messages.create(threadId, {
                      role: historyMessage.role,
                      content: historyMessage.content
                    });
                  }
                }
                console.log('✅ Successfully restored conversation history to new thread');
              } catch (e) {
                console.log('⚠️ Failed to restore conversation history to new thread:', e);
                // Continue anyway - thread will work but without history
              }
            }
            
            // Persist the thread id if possible
            try {
              await persistenceService.saveThreadForSubject(subjectId, threadId);
            } catch (e) {
              console.log('⚠️ Failed to persist thread id (optional):', e);
            }
          } else {
            console.log('🆕 Created temporary thread (no subject context):', threadId);
          }
        }
      }

      // Record the active thread so tool handlers can reuse it (e.g., new_subject)
      this.currentThreadId = threadId;

      // Ensure there is no active run on this thread before adding a new message
      await this.waitForNoActiveRun(threadId);

      // Add the user message to the thread (with a guarded retry in case a run just started)
      try {
        await this.openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: userMessage
        });
      } catch (messageError: unknown) {
        const anyErr = messageError as { error?: { message?: string }, message?: string } | undefined;
        const errorMessage = (anyErr?.error?.message || anyErr?.message || '').toString();
        if (errorMessage.includes("Can't add messages to") && errorMessage.includes('while a run')) {
          console.log('⏳ Detected active run when adding message. Waiting and retrying...');
          await this.waitForNoActiveRun(threadId);
          await this.openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: userMessage
          });
        } else {
          throw messageError;
        }
      }

      // Get or create assistant for this subject (or a general assistant if no subject yet)
      const assistant = this.context.subject?.id
        ? await this.getOrCreateAssistantForSubject(subjectId, this.context.subject.name)
        : await this.getOrCreateGeneralAssistant();
      if (!assistant) {
        console.log('❌ Assistant not available for subject:', this.context.subject?.name || 'General');
        return this.generateFallbackResponse(userMessage);
      }

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: assistant.id,
        additional_instructions: this.buildContextualInstructions()
      });

      // Wait for completion and handle tool calls (loop to allow chained tool calls)
      let completedRun = await this.waitForRunCompletion(threadId, run.id);
      const toolCalls: Array<{
        name: TutorToolName;
        parameters: Record<string, unknown>;
        result: Record<string, unknown>;
      }> = [];

      let safetyCounter = 0;
      let consecutiveValidationErrors = 0;
      let lastValidationError: string | null = null;
      
      while (completedRun.status === 'requires_action' && completedRun.required_action && safetyCounter < 10) {
        safetyCounter++;
        const toolOutputs = [] as Array<{ tool_call_id: string; output: string }>;

        for (const toolCall of completedRun.required_action.submit_tool_outputs.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch (parseError) {
            console.log('⚠️ Failed to parse tool arguments:', parseError);
            console.log('🔍 Arguments length:', toolCall.function.arguments.length);
            console.log('🔍 First 200 chars:', toolCall.function.arguments.substring(0, 200));
            console.log('🔍 Last 200 chars:', toolCall.function.arguments.substring(Math.max(0, toolCall.function.arguments.length - 200)));
            
            // Enhanced JSON repair
            console.log('🔧 Attempting to fix malformed JSON...');
            
            try {
              let fixed = toolCall.function.arguments.trim();
              
              // Try multiple repair strategies
              const strategies = [
                // Strategy 1: Fix progress-quiz specific issue where passingScore is inside questions array
                (s: string) => {
                  // Find the questions array and check if passingScore is misplaced inside it
                  const questionsStart = s.indexOf('"questions":');
                  if (questionsStart === -1) return s;
                  
                  const arrayStart = s.indexOf('[', questionsStart);
                  if (arrayStart === -1) return s;
                  
                  // Find the matching closing bracket for the questions array
                  let depth = 0;
                  let inString = false;
                  let escape = false;
                  let arrayEnd = -1;
                  
                  for (let i = arrayStart; i < s.length; i++) {
                    const char = s[i];
                    
                    if (escape) {
                      escape = false;
                      continue;
                    }
                    
                    if (char === '\\') {
                      escape = true;
                      continue;
                    }
                    
                    if (char === '"' && !escape) {
                      inString = !inString;
                      continue;
                    }
                    
                    if (!inString) {
                      if (char === '[') depth++;
                      if (char === ']') {
                        depth--;
                        if (depth === 0) {
                          arrayEnd = i;
                          break;
                        }
                      }
                    }
                  }
                  
                  // Check if passingScore appears after the last } but before the array closing ]
                  if (arrayEnd === -1) {
                    // Array not closed, look for misplaced property
                    const passingScoreMatch = s.substring(arrayStart).match(/\}\s*,\s*"passingScore":\s*\d+/);
                    if (passingScoreMatch && passingScoreMatch.index) {
                      const insertPos = arrayStart + passingScoreMatch.index + 1; // After the }
                      console.log('🔍 Detected misplaced passingScore inside questions array, fixing...');
                      return s.substring(0, insertPos) + '],' + s.substring(insertPos + 1).replace(/^\s*,\s*/, '');
                    }
                  }
                  
                  return s;
                },
                
                // Strategy 2: Fix extra closing brackets
                (s: string) => s.replace(/(\}\])+$/, '}').replace(/(\]\})+$/, '}'),
                
                // Strategy 3: Remove trailing commas
                (s: string) => s.replace(/,(\s*[}\]])/g, '$1'),
                
                // Strategy 4: Fix common OpenAI streaming issues
                (s: string) => {
                  // If JSON looks complete but has minor issues, try to fix
                  let result = s;
                  // Fix missing closing brackets (count opens vs closes)
                  const openBraces = (result.match(/\{/g) || []).length;
                  const closeBraces = (result.match(/\}/g) || []).length;
                  const openBrackets = (result.match(/\[/g) || []).length;
                  const closeBrackets = (result.match(/\]/g) || []).length;
                  
                  if (openBraces > closeBraces) {
                    result += '}'.repeat(openBraces - closeBraces);
                  }
                  if (openBrackets > closeBrackets) {
                    result += ']'.repeat(openBrackets - closeBrackets);
                  }
                  return result;
                }
              ];
              
              // Try each strategy
              let parsed = false;
              for (const strategy of strategies) {
                try {
                  fixed = strategy(fixed);
                  args = JSON.parse(fixed) as Record<string, unknown>;
                  console.log('✅ Successfully fixed and parsed JSON with repair strategy');
                  parsed = true;
                  break;
                } catch {
                  // Try next strategy
                  continue;
                }
              }
              
              if (!parsed) {
                throw new Error('All repair strategies failed');
              }
            } catch {
              console.log('❌ JSON repair failed, using fallback');
              args = { __parse_error: true, raw: toolCall.function.arguments };
            }
          }
          const result = await this.handleToolCall(toolCall.function.name as TutorToolName, args);
          
          // Check for repeated validation errors that could cause infinite loops
          if (result && typeof result === 'object' && (result as { type?: string }).type === 'validation_error') {
            const currentError = (result as { message?: string }).message || '';
            if (currentError === lastValidationError) {
              consecutiveValidationErrors++;
              console.log(`⚠️ Repeated validation error ${consecutiveValidationErrors}/3: ${currentError}`);
              
              if (consecutiveValidationErrors >= 3) {
                console.log('🛑 Breaking validation error loop - providing fallback response');
                // Use the actual handleInteractiveComponent fallback for the detected type
                if (toolCall.function.name === 'interactive_component') {
                  try {
                    const fallbackParams = args as unknown as InteractiveComponentParams;
                    const objective = fallbackParams?.learning_objective || 'Learning Key Concepts';
                    const componentType = fallbackParams?.type || 'explainer';
                    
                    console.log(`🔧 Providing fallback ${componentType} component for: ${objective}`);
                    
                    // Always provide a complete explainer as fallback since it's the most versatile
                    (result as Record<string, unknown>) = {
                      type: 'interactive_component',
                      componentType: 'explainer',
                      content: {
                        title: objective,
                        description: `Let's explore ${objective.toLowerCase()}.`,
                        sections: [
                          {
                            heading: 'Introduction',
                            paragraphs: [`This lesson covers ${objective.toLowerCase()}.`]
                          },
                          {
                            heading: 'Key Concepts', 
                            paragraphs: ['We will examine the fundamental principles and important ideas.']
                          },
                          {
                            heading: 'Understanding',
                            paragraphs: ['Breaking down the topic into manageable components for better comprehension.']
                          },
                          {
                            heading: 'Application',
                            paragraphs: ['How to apply these concepts in real-world situations.']
                          }
                        ],
                        summary: `This lesson provides a comprehensive overview of ${objective.toLowerCase()}.`,
                        keywords: [objective.split(' ')[0], 'learning', 'concepts']
                      },
                      learningObjective: objective,
                      difficulty: 'beginner'
                    };
                  } catch {
                    (result as { type: string }).type = 'interactive_component';
                    (result as { message: string }).message = 'Validation loop detected - providing simplified response';
                  }
                } else {
                  (result as { type: string }).type = 'interactive_component';
                  (result as { message: string }).message = 'Validation loop detected - providing simplified response';
                }
                consecutiveValidationErrors = 0;
              }
            } else {
              lastValidationError = currentError;
              consecutiveValidationErrors = 1;
            }
          } else {
            // Reset counters on successful calls
            consecutiveValidationErrors = 0;
            lastValidationError = null;
          }
          
          toolCalls.push({
            name: toolCall.function.name as TutorToolName,
            parameters: args,
            result
          });

          toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify(result) });
        }

        // Updated API signature for OpenAI SDK v4+
        await this.openai.beta.threads.runs.submitToolOutputs(
          run.id,
          {
            thread_id: threadId,
            tool_outputs: toolOutputs
          }
        );
        completedRun = await this.waitForRunCompletion(threadId, run.id);
      }

      // Get the assistant's response (after all tool chains)
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      const response = lastMessage && lastMessage.content && lastMessage.content[0]?.type === 'text'
        ? lastMessage.content[0].text.value
        : 'Unable to generate a response. Check server logs for details.';

      // Add assistant response to conversation history
      this.context.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        tool_calls: toolCalls
      });

      return {
        response,
        toolCalls,
        updatedContext: this.context
      };

    } catch (error) {
      console.error('❌ Error generating AI response:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return this.generateFallbackResponse(userMessage);
    }
  }

  // Generate response with streaming events callback
  async generateResponseStreaming(
    userMessage: string,
    context: Partial<TutorContext> | undefined,
    onEvent: (event: { type: string; data?: Record<string, unknown> }) => void | Promise<void>
  ): Promise<{
    response: string;
    toolCalls: Array<{
      name: TutorToolName;
      parameters: Record<string, unknown>;
      result: Record<string, unknown>;
    }>;
    updatedContext: TutorContext;
  }> {
    // Ensure non-blocking errors don't crash the stream
    const safeEmit = async (type: string, data?: Record<string, unknown>) => {
      try { await onEvent({ type, data }); } catch { /* ignore */ }
    };

    // Wait for initialization to complete
    if (this.initializationPromises.size > 0) {
      await Promise.all(this.initializationPromises.values());
    }

    if (context) {
      const sanitized = Object.fromEntries(
        Object.entries(context as Record<string, unknown>).filter(([, v]) => v !== undefined)
      ) as Partial<TutorContext>;
      this.context = { ...this.context, ...sanitized };
      
      // Extract lesson plan from subject if available
      if (this.context.subject?.lessonPlan && !this.context.lessonPlan) {
        this.context.lessonPlan = {
          subject: this.context.subject.name,
          currentLessonIndex: this.context.subject.lessonPlan.currentLessonIndex,
          lessons: this.context.subject.lessonPlan.lessons.map(l => ({
            id: l.id,
            title: l.title,
            description: l.description,
            completed: false
          }))
        };
        console.log('📚 Extracted lesson plan from subject:', this.context.lessonPlan.lessons.length, 'lessons');
      }
    }

    this.context.conversationHistory.push({ role: 'user', content: userMessage, timestamp: new Date() });

    if (!this.openai) {
      const fallback = this.generateFallbackResponse(userMessage);
      await safeEmit('assistant_message', { content: fallback.response as unknown as Record<string, unknown> });
      await safeEmit('final', fallback as unknown as Record<string, unknown>);
      return fallback;
    }

    const effectiveSubjectId = this.context.subject?.id || 'general';
    // Prepare thread
    let threadId: string;
    const subjectId = effectiveSubjectId;
    if (subjectId && this.subjectThreads.has(subjectId)) {
      threadId = this.subjectThreads.get(subjectId)!;
    } else {
      let loadedThreadId: string | null = null;
      if (subjectId) {
        try { loadedThreadId = await persistenceService.getThreadBySubject(subjectId); } catch { /* ignore */ }
      }
      if (loadedThreadId) {
        threadId = loadedThreadId;
        this.subjectThreads.set(subjectId, threadId);
      } else {
        const thread = await this.openai.beta.threads.create();
        threadId = thread.id;
        if (subjectId) {
          this.subjectThreads.set(subjectId, threadId);
          
          // CRITICAL: Restore conversation history to new thread
          if (this.context.conversationHistory && this.context.conversationHistory.length > 0) {
            console.log('🔄 [Streaming] Restoring', this.context.conversationHistory.length, 'previous messages to new thread');
            try {
              for (const historyMessage of this.context.conversationHistory) {
                if (historyMessage.content !== userMessage || historyMessage.role !== 'user') {
                  await this.openai.beta.threads.messages.create(threadId, {
                    role: historyMessage.role,
                    content: historyMessage.content
                  });
                }
              }
              console.log('✅ [Streaming] Successfully restored conversation history to new thread');
            } catch (e) {
              console.log('⚠️ [Streaming] Failed to restore conversation history to new thread:', e);
            }
          }
          
          try { await persistenceService.saveThreadForSubject(subjectId, threadId); } catch { /* ignore */ }
        }
      }
    }

    // Record the active thread so tool handlers can reuse it (e.g., new_subject)
    this.currentThreadId = threadId;

    await this.waitForNoActiveRun(threadId);
    try {
      await this.openai.beta.threads.messages.create(threadId, { role: 'user', content: userMessage });
    } catch (messageError: unknown) {
      const anyErr = messageError as { error?: { message?: string }, message?: string } | undefined;
      const errorMessage = (anyErr?.error?.message || anyErr?.message || '').toString();
      if (errorMessage.includes("Can't add messages to") && errorMessage.includes('while a run')) {
        await this.waitForNoActiveRun(threadId);
        await this.openai.beta.threads.messages.create(threadId, { role: 'user', content: userMessage });
      } else {
        throw messageError;
      }
    }

    const assistant = this.context.subject?.id
      ? await this.getOrCreateAssistantForSubject(subjectId, this.context.subject.name)
      : await this.getOrCreateGeneralAssistant();
    if (!assistant) {
      const fallback = this.generateFallbackResponse(userMessage);
      await safeEmit('assistant_message', { content: fallback.response as unknown as Record<string, unknown> });
      await safeEmit('final', fallback as unknown as Record<string, unknown>);
      return fallback;
    }

    const run = await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: assistant.id,
      additional_instructions: this.buildContextualInstructions()
    });

    await safeEmit('run_status', { status: run.status as unknown as Record<string, unknown> });

    let completedRun = await this.waitForRunCompletion(threadId, run.id);
    await safeEmit('run_status', { status: completedRun.status as unknown as Record<string, unknown> });

    const toolCalls: Array<{ name: TutorToolName; parameters: Record<string, unknown>; result: Record<string, unknown> }>=[];
    let safetyCounter = 0;
    while (completedRun.status === 'requires_action' && completedRun.required_action && safetyCounter < 10) {
      safetyCounter++;
      const toolOutputs: Array<{ tool_call_id: string; output: string }>=[];
      for (const toolCall of completedRun.required_action.submit_tool_outputs.tool_calls) {
        let args: Record<string, unknown> = {};
        try { 
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>; 
        } catch (parseError) {
          console.log('⚠️ Streaming: Failed to parse tool arguments:', parseError);
          console.log('🔍 Streaming: Arguments length:', toolCall.function.arguments.length);
          console.log('🔍 Streaming: Raw arguments (first 200):', toolCall.function.arguments.substring(0, 200));
          console.log('🔍 Streaming: Raw arguments (last 200):', toolCall.function.arguments.substring(Math.max(0, toolCall.function.arguments.length - 200)));
          
          // Enhanced JSON repair
          console.log('🔧 Attempting to fix malformed JSON...');
          
          try {
            let fixed = toolCall.function.arguments.trim();
            
            // Try multiple repair strategies
            const strategies = [
              // Strategy 1: Fix progress-quiz specific issue where passingScore is inside questions array
              (s: string) => {
                // Find the questions array and check if passingScore is misplaced inside it
                const questionsStart = s.indexOf('"questions":');
                if (questionsStart === -1) return s;
                
                const arrayStart = s.indexOf('[', questionsStart);
                if (arrayStart === -1) return s;
                
                // Find the matching closing bracket for the questions array
                let depth = 0;
                let inString = false;
                let escape = false;
                let arrayEnd = -1;
                
                for (let i = arrayStart; i < s.length; i++) {
                  const char = s[i];
                  
                  if (escape) {
                    escape = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escape = true;
                    continue;
                  }
                  
                  if (char === '"' && !escape) {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '[') depth++;
                    if (char === ']') {
                      depth--;
                      if (depth === 0) {
                        arrayEnd = i;
                        break;
                      }
                    }
                  }
                }
                
                // Check if passingScore appears after the last } but before the array closing ]
                if (arrayEnd === -1) {
                  // Array not closed, look for misplaced property
                  const passingScoreMatch = s.substring(arrayStart).match(/\}\s*,\s*"passingScore":\s*\d+/);
                  if (passingScoreMatch && passingScoreMatch.index) {
                    const insertPos = arrayStart + passingScoreMatch.index + 1; // After the }
                    console.log('🔍 Detected misplaced passingScore inside questions array, fixing...');
                    return s.substring(0, insertPos) + '],' + s.substring(insertPos + 1).replace(/^\s*,\s*/, '');
                  }
                }
                
                return s;
              },
              
              // Strategy 2: Fix extra closing brackets
              (s: string) => s.replace(/(\}\])+$/, '}').replace(/(\]\})+$/, '}'),
              
              // Strategy 3: Remove trailing commas
              (s: string) => s.replace(/,(\s*[}\]])/g, '$1'),
              
              // Strategy 4: Fix common OpenAI streaming issues
              (s: string) => {
                // If JSON looks complete but has minor issues, try to fix
                let result = s;
                // Fix missing closing brackets (count opens vs closes)
                const openBraces = (result.match(/\{/g) || []).length;
                const closeBraces = (result.match(/\}/g) || []).length;
                const openBrackets = (result.match(/\[/g) || []).length;
                const closeBrackets = (result.match(/\]/g) || []).length;
                
                if (openBraces > closeBraces) {
                  result += '}'.repeat(openBraces - closeBraces);
                }
                if (openBrackets > closeBrackets) {
                  result += ']'.repeat(openBrackets - closeBrackets);
                }
                return result;
              }
            ];
            
            // Try each strategy
            let parsed = false;
            for (const strategy of strategies) {
              try {
                fixed = strategy(fixed);
                args = JSON.parse(fixed) as Record<string, unknown>;
                console.log('✅ Successfully fixed and parsed JSON with repair strategy');
                parsed = true;
                break;
              } catch {
                // Try next strategy
                continue;
              }
            }
            
            if (!parsed) {
              throw new Error('All repair strategies failed');
            }
          } catch {
            console.log('❌ JSON repair failed, attempting raw parse with content extraction...');
            
            // Last resort: try to extract content from the raw string manually
            try {
              const raw = toolCall.function.arguments;
              
              // Try to find and extract the main JSON object
              // Look for the first { and try to find its matching }
              const firstBrace = raw.indexOf('{');
              if (firstBrace !== -1) {
                let braceCount = 0;
                let inString = false;
                let escape = false;
                let lastBrace = -1;
                
                for (let i = firstBrace; i < raw.length; i++) {
                  const char = raw[i];
                  
                  if (escape) {
                    escape = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escape = true;
                    continue;
                  }
                  
                  if (char === '"' && !escape) {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') braceCount++;
                    if (char === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        lastBrace = i;
                        break;
                      }
                    }
                  }
                }
                
                if (lastBrace !== -1) {
                  const extracted = raw.substring(firstBrace, lastBrace + 1);
                  args = JSON.parse(extracted) as Record<string, unknown>;
                  console.log('✅ Successfully extracted and parsed valid JSON from raw string');
                } else {
                  throw new Error('Could not find matching closing brace');
                }
              } else {
                throw new Error('No opening brace found');
              }
            } catch (extractError) {
              console.log('❌ Content extraction failed:', extractError);
              args = { __parse_error: true, raw: toolCall.function.arguments };
            }
          }
        }
        await safeEmit('tool_call', { name: toolCall.function.name as unknown as Record<string, unknown>, arguments: args as unknown as Record<string, unknown> });
        const result = await this.handleToolCall(toolCall.function.name as TutorToolName, args);
        toolCalls.push({ name: toolCall.function.name as TutorToolName, parameters: args, result });
        await safeEmit('tool_result', { name: toolCall.function.name as unknown as Record<string, unknown>, result: result as unknown as Record<string, unknown> });
        toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify(result) });
      }
      // Updated API signature for OpenAI SDK v4+
      await this.openai.beta.threads.runs.submitToolOutputs(
        run.id,
        {
          thread_id: threadId,
          tool_outputs: toolOutputs
        }
      );
      completedRun = await this.waitForRunCompletion(threadId, run.id);
      await safeEmit('run_status', { status: completedRun.status as unknown as Record<string, unknown> });
    }

    const messages = await this.openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0];
    const response = lastMessage && lastMessage.content && lastMessage.content[0]?.type === 'text'
      ? (lastMessage.content[0].text.value as string)
      : 'Unable to generate a response. Check server logs for details.';

    this.context.conversationHistory.push({ role: 'assistant', content: response, timestamp: new Date(), tool_calls: toolCalls });

    await safeEmit('assistant_message', { content: response as unknown as Record<string, unknown> });

    const finalPayload = { response, toolCalls, updatedContext: this.context };
    await safeEmit('final', finalPayload as unknown as Record<string, unknown>);
    return finalPayload;
  }

  private async getOrCreateGeneralAssistant(): Promise<OpenAI.Beta.Assistant | null> {
    if (!this.openai) return null;
    const generalKey = 'general';
    if (this.assistants.has(generalKey)) {
      return this.assistants.get(generalKey)!;
    }

    try {
      const assistant = await this.openai.beta.assistants.create({
        name: 'Ustaz AI Tutor - General',
        description: 'General assistant that identifies the subject, creates a new subject, plans lessons, and starts with an interactive lesson.',
        model: OPENAI_MODEL,
        instructions: `You are Ustaz, an AI tutor. When there is no active subject:
1) Infer the subject/topic from the user's message.
2) Immediately call the new_subject tool with a clear, concise subject name.
3) Ask ONE brief clarifying question about their experience level and expectations if needed.
4) Once you have enough info, call new_lesson_plan with descriptive lesson titles in learning_goals array (e.g., for "World War 2": ["The Rise of Totalitarian Regimes", "The Outbreak of War: Invasion of Poland", "Pearl Harbor: The U.S. Enters the War", etc.]). NOT generic "Lesson 1", "Lesson 2" titles.
5) Organize lessons into 3 phases: foundation/beginning, development/middle, and conclusion/end. Aim for 6-15 total lessons.
6) Immediately start Lesson 1 by calling interactive_component with the most suitable component type and rich content (no templates).
7) Keep chat responses concise, directing the student to the interactive experience.`,
        tools: TUTOR_TOOLS,
      });
      this.assistants.set(generalKey, assistant);
      return assistant;
    } catch (error) {
      console.error('❌ Failed to initialize General assistant:', error);
      return null;
    }
  }

  private buildContextualInstructions(): string {
    const instructions = [];
    
    if (this.context.subject) {
      instructions.push(`Current subject: ${this.context.subject.name}`);
      instructions.push(`Subject progress: ${this.context.subject.progress}%`);
    }

    if (this.context.lessonPlan) {
      instructions.push(`Current lesson: ${this.context.lessonPlan.currentLessonIndex + 1} of ${this.context.lessonPlan.lessons.length}`);
    }

    if (this.context.learningProgress) {
      const accuracy = this.context.learningProgress.totalAttempts > 0 
        ? (this.context.learningProgress.correctAnswers / this.context.learningProgress.totalAttempts * 100).toFixed(1)
        : 0;
      instructions.push(`Current accuracy: ${accuracy}%`);
    }

    if (this.context.userProfile) {
      if (this.context.userProfile.learningStyle) {
        instructions.push(`Preferred learning style: ${this.context.userProfile.learningStyle}`);
      }
      if (this.context.userProfile.preferredPace) {
        instructions.push(`Preferred pace: ${this.context.userProfile.preferredPace}`);
      }
    }
    
    // Add instructions for interactive content if specified
    if (this.context.instructionOverrides && this.context.instructionOverrides.preferInteractiveContent) {
      instructions.push(this.context.instructionOverrides.interactiveContentGuidelines || '');
    }

    // Guide flow for new subjects without a lesson plan
    if (this.context.subject && !this.context.lessonPlan) {
      instructions.push(`Flow for new subject:
- If no lesson plan exists yet, ask ONE short question about experience level and expectations.
- Then create a lesson plan via the new_lesson_plan tool with descriptive lesson titles in the learning_goals array.
- IMPORTANT: learning_goals should contain specific, descriptive lesson titles (e.g., "The Rise of Totalitarian Regimes", "The Outbreak of War: Invasion of Poland") NOT generic numbered lessons.
- Organize lessons in 3 phases: beginning/foundation topics, middle/development topics, and conclusion/outcome topics.
- Aim for 6-15 lessons total for a complete subject.
- Immediately begin Lesson 1 by creating an interactive component with rich AI-generated content.`);
    }

    const qualityGate = `
When calling interactive_component, you must provide COMPLETE, student-ready content that matches the exact schema for the chosen type. Do NOT call the tool with placeholders or empty fields. If you receive an error indicating validation_error, IMMEDIATELY retry the tool call with a fully populated payload.

Rules:
1) explainer: include at least 3 sections; each section has heading and non-empty paragraphs.
2) multiple-choice: include question and >=2 choices with isCorrect and explanation where helpful.
3) interactive-example: include one or more controls and display entries.
4) fill-blank: include question, template, and non-empty answers array.
5) step-solver: include problem and non-empty steps array.
6) graph-visualizer: include data.
7) formula-explorer: include formula and variables array.
8) text-highlighter: include text and categories array.

Keep chat responses within 1–2 sentences when you produce interactive content.
`;

    const merged = instructions.length > 0 
      ? `Additional context for this conversation:\n${instructions.join('\n')}\n\n${qualityGate}`
      : qualityGate;

    return merged;
  }

  private async waitForRunCompletion(threadId: string, runId: string): Promise<OpenAI.Beta.Threads.Run> {
    if (!this.openai) throw new Error('OpenAI client not initialized');
    
    // Updated API signature for OpenAI SDK v4+
    let run = await this.openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    
    while (run.status === 'queued' || run.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await this.openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    }
    
    return run;
  }

  // Wait until there are no active (queued/in_progress) runs on a thread
  private async waitForNoActiveRun(threadId: string, timeoutMs: number = 30000): Promise<void> {
    if (!this.openai) return;
    const start = Date.now();
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
      try {
        // Limit to the most recent run for quick checks
        // Using any to avoid tight coupling to SDK response typing across versions
        const runs = await this.openai.beta.threads.runs.list(threadId, { limit: 1 });
        const latestRun = (runs as { data?: Array<{ status?: string }> } | undefined)?.data?.[0];
        const status = latestRun?.status as string | undefined;

        if (!status || (status !== 'queued' && status !== 'in_progress')) {
          return; // No active run
        }

        if (Date.now() - start > timeoutMs) {
          console.log('⚠️ Timeout waiting for active run to finish. Proceeding cautiously.');
          return;
        }

        await sleep(800);
      } catch (e) {
        console.log('⚠️ Error checking runs list, proceeding:', e);
        return;
      }
    }
  }

  private async handleToolCall(
    toolName: TutorToolName, 
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      case 'new_subject':
        return this.handleNewSubject(parameters as unknown as NewSubjectParams);
      case 'new_lesson_plan':
        return this.handleNewLessonPlan(parameters as unknown as NewLessonPlanParams);
      case 'update_lesson_plan':
        return this.handleUpdateLessonPlan(parameters as unknown as UpdateLessonPlanParams);
      case 'clarifying_question':
        return this.handleClarifyingQuestion(parameters as unknown as ClarifyingQuestionParams);
      case 'lesson_complete':
        return this.handleLessonComplete(parameters as unknown as LessonCompleteParams);
      case 'next_lesson':
        return this.handleNextLesson();
      case 'interactive_component':
        return this.handleInteractiveComponent(parameters as unknown as InteractiveComponentParams);
      case 'subject_complete':
        return this.handleSubjectComplete(parameters as unknown as SubjectCompleteParams);
      case 'review_request':
        return this.handleReviewRequest(parameters as unknown as ReviewRequestParams);
      case 'summary_request':
        return this.handleSummaryRequest(parameters as unknown as SummaryRequestParams);
      case 'rephrase_request':
        return this.handleRephraseRequest(parameters as unknown as RephraseRequestParams);
      case 'feedback_log':
        return this.handleFeedbackLog(parameters as unknown as FeedbackLogParams);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // Tool call handlers
  private async handleNewSubject(params: NewSubjectParams): Promise<Record<string, unknown>> {
    const newSubject: Subject = {
      id: `subject_${Date.now()}`,
      name: params.name,
      progress: 0,
      color: '#3B82F6', // Default blue
      isActive: true,
      startedAt: new Date(),
      topicKeywords: [params.name.toLowerCase()],
      messageCount: 0,
      lastActive: new Date()
    };

    // Update context with new subject
    this.context.subject = newSubject;

    // Reuse the current active thread for continuity if available; otherwise create one
    if (this.openai) {
      try {
        let threadId = this.currentThreadId;
        if (!threadId) {
          const thread = await this.openai.beta.threads.create();
          threadId = thread.id;
          console.log('🆕 Created new thread because none was active when creating new subject:', threadId);
        } else {
          console.log('🔗 Reusing existing active thread for new subject:', threadId);
        }
        this.subjectThreads.set(newSubject.id, threadId);
        // Persist thread id if possible
        try {
          await persistenceService.saveThreadForSubject(newSubject.id, threadId);
        } catch (e) {
          console.log('⚠️ Failed to persist thread id for new subject (optional):', e);
        }
      } catch (error) {
        console.error('❌ Failed to prepare thread for new subject:', error);
      }
    }

    return {
      success: true,
      subject: newSubject,
      message: `Started learning ${params.name}. Let's begin by understanding your current level and goals.`
    };
  }

  private async handleNewLessonPlan(params: NewLessonPlanParams): Promise<Record<string, unknown>> {
    // Generate lesson plan based on subject and goals
    // Note: AI should provide learning_goals as descriptive lesson titles, not generic numbers
    const lessons: Lesson[] = params.learning_goals.map((goal, index) => ({
      id: `lesson_${index + 1}`,
      title: goal, // Use the goal directly as the title (AI should provide descriptive titles)
      description: `Learn about ${goal} with interactive examples and practice exercises.`,
      completed: false
    }));

    const lessonPlan: LessonPlan = {
      subject: params.subject,
      currentLessonIndex: 0,
      lessons
    };

    this.context.lessonPlan = lessonPlan;
    
    if (this.context.subject) {
      this.context.subject.lessonPlan = {
        lessons: lessons.map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description
        })),
        currentLessonIndex: 0
      };
    }

    // Persist lesson plan if userId available
    try {
      if (this.context.subject && this.context.userId) {
        await persistenceService.saveSubject({
          id: this.context.subject.id,
          user_id: this.context.userId,
          name: this.context.subject.name,
          keywords: this.context.subject.topicKeywords,
          lesson_plan: this.context.subject.lessonPlan || this.context.lessonPlan || null,
          learning_progress: this.context.learningProgress || null,
          last_active: new Date().toISOString()
        });
      }
    } catch (e) {
      console.log('⚠️ Failed to persist lesson plan (non-fatal):', e);
    }

    return {
      success: true,
      lessonPlan,
      message: `Created a ${lessons.length}-lesson plan for ${params.subject}. Ready to start with the first lesson?`
    };
  }

  private async handleUpdateLessonPlan(params: UpdateLessonPlanParams): Promise<Record<string, unknown>> {
    if (!this.context.lessonPlan) {
      return { error: 'No lesson plan to update' };
    }

    // Apply adjustments to lesson plan
    let updatedLessons = [...this.context.lessonPlan.lessons];

    // Add new lessons if specified
    if (params.new_lessons) {
      const newLessons: Lesson[] = params.new_lessons.map((title, index) => ({
        id: `lesson_${updatedLessons.length + index + 1}`,
        title,
        description: `Updated lesson: ${title}`,
        completed: false
      }));
      updatedLessons.push(...newLessons);
    }

    // Remove lessons if specified
    if (params.remove_lessons) {
      updatedLessons = updatedLessons.filter(lesson => 
        !params.remove_lessons!.includes(lesson.title)
      );
    }

    this.context.lessonPlan.lessons = updatedLessons;

    return {
      success: true,
      reason: params.reason,
      updatedLessons: updatedLessons.length,
      message: `Updated lesson plan: ${params.reason}`
    };
  }

  private async handleClarifyingQuestion(params: ClarifyingQuestionParams): Promise<Record<string, unknown>> {
    return {
      type: 'clarifying_question',
      question: params.question,
      context: params.context,
      options: params.options,
      requiresUserResponse: true
    };
  }

  private async handleLessonComplete(params: LessonCompleteParams): Promise<Record<string, unknown>> {
    if (!this.context.lessonPlan) {
      return { error: 'No active lesson plan' };
    }

    const lesson = this.context.lessonPlan.lessons.find(l => l.id === params.lesson_id);
    if (!lesson) {
      return { error: 'Lesson not found' };
    }

    lesson.completed = params.completed;

    // Update learning progress
    if (!this.context.learningProgress) {
      this.context.learningProgress = {
        correctAnswers: 0,
        totalAttempts: 0
      };
    }

    if (params.completed) {
      this.context.learningProgress.correctAnswers++;
    }
    this.context.learningProgress.totalAttempts++;

    // Update subject progress
    if (this.context.subject) {
      const completedLessons = this.context.lessonPlan.lessons.filter(l => l.completed).length;
      this.context.subject.progress = (completedLessons / this.context.lessonPlan.lessons.length) * 100;
    }

    // Persist updated lesson plan and progress if possible
    try {
      if (this.context.subject && this.context.userId) {
        await persistenceService.saveSubject({
          id: this.context.subject.id,
          user_id: this.context.userId,
          name: this.context.subject.name,
          keywords: this.context.subject.topicKeywords,
          lesson_plan: this.context.subject.lessonPlan || this.context.lessonPlan || null,
          learning_progress: this.context.learningProgress || null,
          last_active: new Date().toISOString()
        });
      }
    } catch (e) {
      console.log('⚠️ Failed to persist progress after lesson_complete (non-fatal):', e);
    }

    return {
      success: true,
      lessonCompleted: params.completed,
      performanceScore: params.performance_score,
      feedback: params.feedback,
      overallProgress: this.context.subject?.progress || 0
    };
  }

  private async handleNextLesson(): Promise<Record<string, unknown>> {
    if (!this.context.lessonPlan) {
      return { error: 'No active lesson plan' };
    }

    if (this.context.lessonPlan.currentLessonIndex >= this.context.lessonPlan.lessons.length - 1) {
      return { 
        completed: true, 
        message: 'Congratulations! You have completed all lessons in this subject.' 
      };
    }

    this.context.lessonPlan.currentLessonIndex++;
    const nextLesson = this.context.lessonPlan.lessons[this.context.lessonPlan.currentLessonIndex];

    // Persist updated lesson plan
    try {
      if (this.context.subject && this.context.userId) {
        await persistenceService.saveSubject({
          id: this.context.subject.id,
          user_id: this.context.userId,
          name: this.context.subject.name,
          keywords: this.context.subject.topicKeywords,
          lesson_plan: this.context.subject.lessonPlan || this.context.lessonPlan || null,
          learning_progress: this.context.learningProgress || null,
          last_active: new Date().toISOString()
        });
      }
    } catch (e) {
      console.log('⚠️ Failed to persist progress after next_lesson (non-fatal):', e);
    }

    return {
      success: true,
      nextLesson,
      lessonNumber: this.context.lessonPlan.currentLessonIndex + 1,
      totalLessons: this.context.lessonPlan.lessons.length
    };
  }

  private async handleInteractiveComponent(params: InteractiveComponentParams): Promise<Record<string, unknown>> {
    // Handle parse error case - try to recover the actual parameters
    const paramsWithError = params as InteractiveComponentParams & { __parse_error?: boolean; raw?: string };
    if (paramsWithError && paramsWithError.__parse_error && paramsWithError.raw) {
      console.log('🔧 Detected parse error, attempting to recover from raw JSON...');
      
      // Enhanced recovery with multiple repair strategies
      const rawContent = paramsWithError.raw;
      
      try {
        let fixed = rawContent.trim();
        
        // Try multiple repair strategies
        const strategies = [
          // Strategy 1: Fix progress-quiz specific issue where passingScore is inside questions array
          (s: string) => {
            const questionsStart = s.indexOf('"questions":');
            if (questionsStart === -1) return s;
            
            const arrayStart = s.indexOf('[', questionsStart);
            if (arrayStart === -1) return s;
            
            let depth = 0;
            let inString = false;
            let escape = false;
            let arrayEnd = -1;
            
            for (let i = arrayStart; i < s.length; i++) {
              const char = s[i];
              
              if (escape) {
                escape = false;
                continue;
              }
              
              if (char === '\\') {
                escape = true;
                continue;
              }
              
              if (char === '"' && !escape) {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '[') depth++;
                if (char === ']') {
                  depth--;
                  if (depth === 0) {
                    arrayEnd = i;
                    break;
                  }
                }
              }
            }
            
            if (arrayEnd === -1) {
              const passingScoreMatch = s.substring(arrayStart).match(/\}\s*,\s*"passingScore":\s*\d+/);
              if (passingScoreMatch && passingScoreMatch.index) {
                const insertPos = arrayStart + passingScoreMatch.index + 1;
                console.log('🔍 Recovery: Detected misplaced passingScore, fixing...');
                return s.substring(0, insertPos) + '],' + s.substring(insertPos + 1).replace(/^\s*,\s*/, '');
              }
            }
            
            return s;
          },
          
          // Strategy 2: Fix extra closing brackets
          (s: string) => s.replace(/(\}\])+$/, '}').replace(/(\]\})+$/, '}'),
          
          // Strategy 3: Remove trailing commas
          (s: string) => s.replace(/,(\s*[}\]])/g, '$1'),
          
          // Strategy 4: Fix missing closing brackets
          (s: string) => {
            let result = s;
            const openBraces = (result.match(/\{/g) || []).length;
            const closeBraces = (result.match(/\}/g) || []).length;
            const openBrackets = (result.match(/\[/g) || []).length;
            const closeBrackets = (result.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces) {
              result += '}'.repeat(openBraces - closeBraces);
            }
            if (openBrackets > closeBrackets) {
              result += ']'.repeat(openBrackets - closeBrackets);
            }
            return result;
          }
        ];
        
        // Try each strategy
        let parsed = false;
        for (const strategy of strategies) {
          try {
            fixed = strategy(fixed);
            const parsedParams = JSON.parse(fixed) as InteractiveComponentParams;
            console.log('✅ Successfully recovered parameters with repair strategy');
            params = parsedParams;
            parsed = true;
            break;
          } catch {
            continue;
          }
        }
        
        if (!parsed) {
          throw new Error('All recovery strategies failed');
        }
      } catch (recoveryError) {
        console.log('❌ Failed to recover from raw JSON:', recoveryError instanceof Error ? recoveryError.message : String(recoveryError));
      }
    }
    
    console.log('🎯 Creating interactive component:', params?.type || 'UNDEFINED_TYPE', 'for', params?.learning_objective || 'UNDEFINED_OBJECTIVE');
    
    // Enhanced debugging for undefined parameters
    if (!params) {
      console.log('❌ CRITICAL: params is null/undefined');
      return {
        type: 'validation_error',
        message: 'Tool call parameters are completely missing. You must provide type, learning_objective, and content.'
      };
    }
    
    console.log('🔍 Full params received:', JSON.stringify(params, null, 2));
    
    // WORKAROUND: OpenAI sometimes flattens nested structures
    // If content is missing but we have component-specific fields at top level, auto-nest them
    if (!params.content || Object.keys(params.content).length === 0) {
      console.log('🔧 Content object is empty, checking for flattened structure...');
      
      // Special case: if we have __parse_error, try to recover from the raw JSON
      const paramsAsRecord = params as unknown as Record<string, unknown>;
      if (paramsAsRecord.__parse_error && typeof paramsAsRecord.raw === 'string') {
        console.log('🔧 Detected parse error with raw JSON, attempting to recover...');
        try {
          let fixed = (paramsAsRecord.raw as string).trim();
          let recovered: Record<string, unknown> | null = null;
          
          // Try multiple repair strategies
          const strategies = [
            // Strategy 1: Fix progress-quiz specific issue
            (s: string) => {
              const questionsStart = s.indexOf('"questions":');
              if (questionsStart === -1) return s;
              
              const arrayStart = s.indexOf('[', questionsStart);
              if (arrayStart === -1) return s;
              
              let depth = 0;
              let inString = false;
              let escape = false;
              
              for (let i = arrayStart; i < s.length; i++) {
                const char = s[i];
                
                if (escape) {
                  escape = false;
                  continue;
                }
                
                if (char === '\\') {
                  escape = true;
                  continue;
                }
                
                if (char === '"' && !escape) {
                  inString = !inString;
                  continue;
                }
                
                if (!inString) {
                  if (char === '[') depth++;
                  if (char === ']') {
                    depth--;
                    if (depth === 0) break;
                  }
                }
              }
              
              if (depth > 0) {
                const passingScoreMatch = s.substring(arrayStart).match(/\}\s*,\s*"passingScore":\s*\d+/);
                if (passingScoreMatch && passingScoreMatch.index) {
                  const insertPos = arrayStart + passingScoreMatch.index + 1;
                  console.log('🔍 Content recovery: Detected misplaced passingScore, fixing...');
                  return s.substring(0, insertPos) + '],' + s.substring(insertPos + 1).replace(/^\s*,\s*/, '');
                }
              }
              
              return s;
            },
            
            // Strategy 2: Fix extra brackets
            (s: string) => s.replace(/(\}\])+$/, '}').replace(/(\]\})+$/, '}'),
            
            // Strategy 3: Remove trailing commas
            (s: string) => s.replace(/,(\s*[}\]])/g, '$1')
          ];
          
          // Try each strategy
          for (const strategy of strategies) {
            try {
              fixed = strategy(fixed);
              recovered = JSON.parse(fixed) as Record<string, unknown>;
              break;
            } catch {
              continue;
            }
          }
          
          if (!recovered) {
            throw new Error('All repair strategies failed');
          }
          
          // The recovered object should have all the parameters
          // Extract the standard fields
          if (recovered.type) params.type = recovered.type as ComponentType;
          if (recovered.learning_objective) params.learning_objective = recovered.learning_objective as string;
          if (recovered.difficulty) params.difficulty = recovered.difficulty as 'beginner' | 'intermediate' | 'advanced';
          
          // Everything else goes into content
          const standardFields = ['type', 'learning_objective', 'difficulty'];
          const contentFields = Object.keys(recovered).filter(key => !standardFields.includes(key));
          if (contentFields.length > 0) {
            const autoNested: Record<string, unknown> = {};
            contentFields.forEach(key => {
              autoNested[key] = recovered![key];
            });
            params.content = autoNested;
            console.log('✅ Successfully recovered from raw JSON and auto-nested content');
            console.log('📦 Recovered content:', JSON.stringify(params.content).substring(0, 200) + '...');
          }
        } catch (recoveryError) {
          console.log('❌ Failed to recover from raw JSON:', recoveryError instanceof Error ? recoveryError.message : String(recoveryError));
          // Continue with normal flattened structure detection
        }
      }
      
      // Normal case: Extract all non-standard fields (not type, learning_objective, difficulty, __parse_error, raw)
      if (!params.content || Object.keys(params.content).length === 0) {
        const standardFields = ['type', 'learning_objective', 'difficulty', '__parse_error', 'raw'];
        const contentFields = Object.keys(params).filter(key => !standardFields.includes(key));
        
        if (contentFields.length > 0) {
          console.log('✅ Found flattened fields, auto-nesting into content:', contentFields.join(', '));
          const autoNested: Record<string, unknown> = {};
          contentFields.forEach(key => {
            autoNested[key] = paramsAsRecord[key];
          });
          params.content = autoNested;
          console.log('📦 Auto-nested content:', JSON.stringify(params.content).substring(0, 200) + '...');
        }
      }
    }
    
    try {
      const preview = JSON.stringify(params.content ?? {});
      console.log('📝 Content provided by AI:', (preview || '').slice(0, 200) + '...');
      
      // Check if content is essentially empty
      if (!params.content || Object.keys(params.content).length === 0) {
        console.log('⚠️ AI provided empty content object - this will fail validation');
      }
    } catch {
      console.log('📝 Content provided by AI: [unserializable content]');
    }
    
    // Basic parameter validation
    const allowedTypes: ComponentType[] = [
      'explainer','interactive-example','multiple-choice','fill-blank','drag-drop',
      'formula-explorer','step-solver','concept-card','progress-quiz','graph-visualizer',
      'text-highlighter','placeholder'
    ];
    if (!params || !params.type || !allowedTypes.includes(params.type)) {
      return {
        type: 'validation_error',
        componentType: params?.type,
        message: `CRITICAL: Missing or invalid 'type' parameter. You provided: "${params?.type}". REQUIRED: Must be one of: ${allowedTypes.join(', ')}. Example: "type": "explainer"`
      } as Record<string, unknown>;
    }
    if (!params.learning_objective || typeof params.learning_objective !== 'string' || !params.learning_objective.trim()) {
      return {
        type: 'validation_error',
        componentType: params.type,
        message: `CRITICAL: Missing 'learning_objective' parameter. You provided: "${params.learning_objective}". REQUIRED: Must be a non-empty string describing what students will learn. Example: "learning_objective": "Understand the basic principles of photosynthesis"`
      } as Record<string, unknown>;
    }
    if (!params.content || typeof params.content !== 'object' || Object.keys(params.content).length === 0) {
      const exampleContent = params.type === 'explainer' 
        ? `{"title": "Understanding Photosynthesis", "description": "Learn how plants convert sunlight into energy", "sections": [{"heading": "What is Photosynthesis", "paragraphs": ["Photosynthesis is the process..."]}]}`
        : `{complete content object for ${params.type}}`;
      
      return {
        type: 'validation_error',
        componentType: params.type,
        message: `CRITICAL: Missing or empty 'content' parameter. You provided: ${JSON.stringify(params.content)}. REQUIRED: Must be a complete object with all required fields for type "${params.type}". Example: ${exampleContent}`
      } as Record<string, unknown>;
    }

    // Validate the AI-provided content has the necessary structure for the chosen type.
    // If invalid, return a validation_error so the model can retry with complete content.
    const generatedContent = (params.content || {}) as Record<string, unknown>;

    const failValidation = (message: string, details?: Record<string, unknown>) => {
      console.log('❌ interactive_component validation_error:', message, details || {});
      return {
        type: 'validation_error',
        componentType: params.type,
        message,
        details: {
          required_schema_hint: 'Follow the schema documented in the system instructions for this component type. Populate all required fields with concrete, student-ready content.',
          ...(details || {})
        }
      } as Record<string, unknown>;
    };



    switch (params.type) {
      case 'explainer': {
        const title = (generatedContent as { title?: unknown }).title;
        const description = (generatedContent as { description?: unknown; overview?: unknown }).description
          || (generatedContent as { description?: unknown; overview?: unknown }).overview;
        const sections = (generatedContent as { sections?: unknown }).sections as unknown;
        const hasSections = Array.isArray(sections) && sections.length >= 3;
        const sectionsValid = hasSections
          ? (sections as Array<unknown>).every(s => {
              const obj = s as { heading?: unknown; paragraphs?: unknown };
              return typeof obj?.heading === 'string' && Array.isArray(obj?.paragraphs) && (obj.paragraphs as Array<unknown>).every(p => typeof p === 'string' && (p as string).trim().length > 0);
            })
          : false;

        if (!(typeof title === 'string' && (title as string).trim())) {
          return failValidation('Explainer.content.title is required and must be a non-empty string.');
        }
        if (!(typeof description === 'string' && (description as string).trim())) {
          return failValidation('Explainer.content.description is required and must be a non-empty string.');
        }
        if (!sectionsValid) {
          return failValidation('Explainer.content.sections must include at least 3 sections with heading and non-empty paragraphs.', {
            example: {
              title: 'Photosynthesis basics',
              description: 'Short description...',
              sections: [
                { heading: 'What it is', paragraphs: ['...'] },
                { heading: 'How it works', paragraphs: ['...'] },
                { heading: 'Why it matters', paragraphs: ['...'] }
              ]
            }
          });
        }
        break;
      }
      case 'interactive-example':
        if (!generatedContent.controls) {
          return failValidation('Interactive-example.content.controls is required (one or more controls).');
        }
        if (!generatedContent.display) {
          return failValidation('Interactive-example.content.display is required (one or more display elements).');
        }
        break;
        
      case 'multiple-choice':
        if (!generatedContent.question) {
          return failValidation('Multiple-choice.content.question is required.');
        }
        if (!generatedContent.choices || !Array.isArray((generatedContent as { choices?: unknown[] }).choices) || (generatedContent as { choices: unknown[] }).choices.length < 2) {
          return failValidation('Multiple-choice.content.choices must include at least two options with isCorrect flags.');
        }
        break;
        
      case 'concept-card':
        if (!generatedContent.title || !generatedContent.summary || !generatedContent.details) {
          return failValidation('Concept-card.content must include title, summary, and details.');
        }
        break;
        
      case 'fill-blank':
        if (!generatedContent.question || !generatedContent.template || !Array.isArray((generatedContent as { answers?: unknown[] }).answers) || ((generatedContent as { answers?: unknown[] }).answers?.length || 0) === 0) {
          return failValidation('Fill-blank.content must include question, template, and non-empty answers array.');
        }
        break;
        
      case 'step-solver':
        if (!generatedContent.problem || !Array.isArray((generatedContent as { steps?: unknown[] }).steps) || ((generatedContent as { steps?: unknown[] }).steps?.length || 0) === 0) {
          return failValidation('Step-solver.content must include problem and a non-empty steps array.');
        }
        break;
        
      case 'drag-drop':
        if (!Array.isArray((generatedContent as { items?: unknown[] }).items) || !Array.isArray((generatedContent as { targets?: unknown[] }).targets) || ((generatedContent as { items?: unknown[] }).items?.length || 0) === 0 || ((generatedContent as { targets?: unknown[] }).targets?.length || 0) === 0) {
          return failValidation('Drag-drop.content must include non-empty items and targets arrays.');
        }
        break;
        
      case 'progress-quiz':
        if (!Array.isArray((generatedContent as { questions?: unknown[] }).questions) || ((generatedContent as { questions?: unknown[] }).questions?.length || 0) === 0) {
          return failValidation('Progress-quiz.content must include a non-empty questions array.');
        }
        break;
        
      case 'graph-visualizer':
        if (!generatedContent.data) {
          return failValidation('Graph-visualizer.content.data is required.');
        }
        break;
        
      case 'formula-explorer':
        if (!generatedContent.formula || !Array.isArray((generatedContent as { variables?: unknown[] }).variables)) {
          return failValidation('Formula-explorer.content must include formula and variables array.');
        }
        break;
        
      case 'text-highlighter':
        if (!generatedContent.text || !Array.isArray((generatedContent as { categories?: unknown[] }).categories)) {
          return failValidation('Text-highlighter.content must include text and categories array.');
        }
        break;
        
      default:
        // Unknown component type: do not synthesize content
        break;
    }

    // Log what we're returning to make debugging easier
    try {
      const outPreview = JSON.stringify(generatedContent ?? {});
      console.log('✅ Returning interactive component with content:', (outPreview || '').slice(0, 200) + '...');
    } catch {
      console.log('✅ Returning interactive component with content: [unserializable content]');
    }

    return {
      type: 'interactive_component',
      componentType: params.type,
      content: generatedContent,
      learningObjective: params.learning_objective,
      difficulty: params.difficulty || 'beginner'
    };
  }

  private async handleSubjectComplete(params: SubjectCompleteParams): Promise<Record<string, unknown>> {
    if (this.context.subject) {
      this.context.subject.progress = 100;
      this.context.subject.completedAt = new Date();
      this.context.subject.isActive = false;
    }

    return {
      success: true,
      subjectCompleted: true,
      finalScore: params.final_score,
      nextLevel: params.next_level,
      message: 'Congratulations on completing this subject!'
    };
  }

  private async handleReviewRequest(params: ReviewRequestParams): Promise<Record<string, unknown>> {
    return {
      type: 'review_session',
      topics: params.topics,
      focusAreas: params.focus_areas,
      reviewType: params.review_type || 'comprehensive',
      message: `Starting ${params.review_type || 'comprehensive'} review of: ${params.topics.join(', ')}`
    };
  }

  private async handleSummaryRequest(params: SummaryRequestParams): Promise<Record<string, unknown>> {
    let summaryContent = '';

    switch (params.content_type) {
      case 'progress':
        const accuracy = this.context.learningProgress 
          ? (this.context.learningProgress.correctAnswers / this.context.learningProgress.totalAttempts * 100).toFixed(1)
          : 0;
        summaryContent = `Learning Progress Summary:
- Accuracy: ${accuracy}%
- Lessons completed: ${this.context.lessonPlan?.lessons.filter(l => l.completed).length || 0}
- Current subject: ${this.context.subject?.name || 'None'}`;
        break;
      case 'lesson':
        const currentLesson = this.context.lessonPlan?.lessons[this.context.lessonPlan.currentLessonIndex];
        summaryContent = currentLesson 
          ? `Current Lesson Summary:\nTitle: ${currentLesson.title}\nDescription: ${currentLesson.description}`
          : 'No active lesson';
        break;
      case 'concept':
        summaryContent = `Concept Summary: ${params.scope || 'General overview of key concepts covered'}`;
        break;
    }

    return {
      type: 'summary',
      contentType: params.content_type,
      content: summaryContent,
      scope: params.scope
    };
  }

  private async handleRephraseRequest(params: RephraseRequestParams): Promise<Record<string, unknown>> {
    return {
      type: 'rephrase',
      originalContent: params.original_content,
      style: params.style,
      targetLevel: params.target_level,
      message: `Rephrasing content in a ${params.style} way...`
    };
  }

  private async handleFeedbackLog(params: FeedbackLogParams): Promise<Record<string, unknown>> {
    // Store feedback for adaptive learning
    this.context.conversationHistory.push({
      role: 'assistant',
      content: `Logged feedback: ${params.interaction_type}`,
      timestamp: new Date(),
      tool_calls: [{
        name: 'feedback_log',
        parameters: params,
        result: { logged: true }
      }]
    });

    return {
      success: true,
      logged: true,
      interactionType: params.interaction_type,
      engagementLevel: params.engagement_level,
      successRate: params.success_rate
    };
  }

  private generateFallbackResponse(userMessage: string): {
    response: string;
    toolCalls: Array<{
      name: TutorToolName;
      parameters: Record<string, unknown>;
      result: Record<string, unknown>;
    }>;
    updatedContext: TutorContext;
  } {
    // Check if the user is trying to create a new subject
    const subjectMatch = userMessage.match(/(?:learn|study|teach me|teach|I want to learn|help me with|let's learn|I'm interested in)\s+([a-zA-Z0-9\s\-]+)$/i);
    const simpleSubjectMatch = /^[a-zA-Z][a-zA-Z0-9\s\-]{2,}$/i.test(userMessage.trim());
    
    if (subjectMatch || simpleSubjectMatch) {
      // Extract subject name from the message
      const subjectName = subjectMatch ? subjectMatch[1].trim() : userMessage.trim();
      
      console.log(`🔍 Detected subject creation intent for: "${subjectName}"`);
      
      // Create new subject params
      const newSubjectParams = { 
        name: subjectName 
      } as Record<string, unknown>;
      
      // Create a new subject synchronously (the actual assistant will be created later)
      const newSubject: Subject = {
        id: `subject_${Date.now()}`,
        name: subjectName,
        progress: 0,
        color: '#3B82F6', // Default blue
        isActive: true,
        startedAt: new Date(),
        topicKeywords: [subjectName.toLowerCase()],
        messageCount: 0,
        lastActive: new Date()
      };

      // Update context with new subject
      this.context.subject = newSubject;
      
      // Associate the current active thread with the new subject if available; else create one
      if (this.openai) {
        (async () => {
          try {
            let threadId = this.currentThreadId;
            if (!threadId) {
              const thread = await this.openai!.beta.threads.create();
              threadId = thread.id;
              console.log('🆕 Created new thread in fallback for detected subject:', threadId);
              // Add the original user message to the new thread to seed context
              await this.openai!.beta.threads.messages.create(threadId, { role: 'user', content: userMessage });
            }
            this.subjectThreads.set(newSubject.id, threadId);
            try { await persistenceService.saveThreadForSubject(newSubject.id, threadId); } catch { /* ignore */ }
          } catch (error) {
            console.error('❌ Failed to associate thread for new subject in fallback:', error);
          }
        })();
      }
      
      return {
        response: `I'll help you learn ${subjectName}. Let's get started!`,
        toolCalls: [{
          name: 'new_subject',
          parameters: newSubjectParams,
          result: {
            success: true,
            subject: newSubject,
            message: `Started learning ${subjectName}. Let's begin by understanding your current level and goals.`
          }
        }],
        updatedContext: this.context
      };
    }
    
    // Default fallback response if no subject creation intent detected
    return {
      response: `I'm sorry—something went wrong while generating the tutor response. Please try again in a few seconds.`,
      toolCalls: [],
      updatedContext: this.context
    };
  }

  // Utility methods
  getContext(): TutorContext {
    return this.context;
  }

  updateContext(newContext: Partial<TutorContext>): void {
    this.context = { ...this.context, ...newContext };
    
    // Extract lesson plan from subject if available
    if (this.context.subject?.lessonPlan && !this.context.lessonPlan) {
      this.context.lessonPlan = {
        subject: this.context.subject.name,
        currentLessonIndex: this.context.subject.lessonPlan.currentLessonIndex,
        lessons: this.context.subject.lessonPlan.lessons.map(l => ({
          id: l.id,
          title: l.title,
          description: l.description,
          completed: false
        }))
      };
      console.log('📚 Extracted lesson plan from subject in updateContext:', this.context.lessonPlan.lessons.length, 'lessons');
    }
  }

  reset(): void {
    this.context = {
      conversationHistory: []
    };
    // Clear all stored threads and assistants when resetting
    this.subjectThreads.clear();
    this.assistants.clear();
    this.initializationPromises.clear();
  }

  // Clear thread and assistant for a specific subject (useful when subject is deleted)
  clearSubjectResources(subjectId: string): void {
    if (this.subjectThreads.has(subjectId)) {
      this.subjectThreads.delete(subjectId);
      console.log('🗑️ Cleared thread for subject:', subjectId);
    }
    
    if (this.assistants.has(subjectId)) {
      this.assistants.delete(subjectId);
      console.log('🗑️ Cleared assistant for subject:', subjectId);
    }
    
    if (this.initializationPromises.has(subjectId)) {
      this.initializationPromises.delete(subjectId);
      console.log('🗑️ Cleared initialization promise for subject:', subjectId);
    }
  }

  // Get thread ID for a subject (for debugging/monitoring)
  getSubjectThreadId(subjectId: string): string | undefined {
    return this.subjectThreads.get(subjectId);
  }

  // Get assistant ID for a subject (for debugging/monitoring)
  getSubjectAssistantId(subjectId: string): string | undefined {
    const assistant = this.assistants.get(subjectId);
    return assistant?.id;
  }
} 