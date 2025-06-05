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
  includeNextSteps?: boolean;
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
  userGoals?: string;
  userLevel?: 'beginner' | 'intermediate' | 'advanced' | string;
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
      description: 'Create a structured lesson sequence for the current subject.',
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
      description: 'Create an interactive learning component to teach or test understanding.',
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
            description: 'Content data specific to the component type'
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

// Learning stage to interactive component type mapping
const LEARNING_STAGE_COMPONENT_MAP = {
  explainer: 'explainer',
  interactiveExample: 'interactive-example',
  // Practice now includes all interactive types except 'placeholder'
  practice: [
    'multiple-choice',
    'fill-blank',
    'drag-drop',
    'step-solver',
    'concept-card',
    'interactive-example',
    'formula-explorer',
    'graph-visualizer',
    'text-highlighter'
  ],
  // Assessment includes quiz, step-solver, and other assessment types
  assessment: [
    'progress-quiz',
    'step-solver',
    'formula-explorer',
    'graph-visualizer',
    'text-highlighter'
  ]
} as const;

// Helper to get a component type for a given stage (rotates for practice/assessment)
function getComponentTypeForStage(stage: keyof typeof LEARNING_STAGE_COMPONENT_MAP, usedTypes: string[] = []): ComponentType {
  const types = LEARNING_STAGE_COMPONENT_MAP[stage];
  if (Array.isArray(types)) {
    // Pick a type not used yet, or rotate
    const unused = types.filter(t => !usedTypes.includes(t));
    return (unused.length > 0 ? unused[0] : types[0]) as ComponentType;
  }
  return types as ComponentType;
}

// Main AI Tutor Service Class
export class AITutorService {
  private openai: OpenAI | null = null;
  private assistants: Map<string, OpenAI.Beta.Assistant> = new Map(); // Map subject ID to assistant                                                                                              
  private context: TutorContext;
  private subjectThreads: Map<string, string> = new Map(); // Map subject ID to thread ID
  private initializationPromises: Map<string, Promise<void>> = new Map(); // Map subject ID to initialization promise

  constructor() {
    console.log('🤖 Initializing AI Tutor Service...');
    
    // Initialize empty context
    this.context = {
      conversationHistory: [],
      instructionOverrides: {
        preferInteractiveContent: true,
        interactiveContentGuidelines: `
          INTERACTIVE CONTENT PRIORITY:
          When responding to educational queries, ALWAYS create rich interactive components instead of providing detailed text responses in chat.
          
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

      // Define models to try in order of preference
      const modelsToTry = [
        OPENAI_MODEL,
        'gpt-4o-mini',
      ];
      
      let assistant = null;
      let usedModel = '';
      
      // Try each model until one works
      for (const model of modelsToTry) {
        try {
          console.log(`🔄 Attempting to create assistant with model: ${model}`);
          
          // Create new assistant for this subject
          console.log(`🔄 Creating new OpenAI Assistant for subject: ${subjectName}...`);
          assistant = await this.openai.beta.assistants.create({
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
            model: model,
            tools: TUTOR_TOOLS
          });
          
          // If successful, break the loop
          usedModel = model;
          console.log(`✅ Successfully created assistant with model: ${model}`);
          break;
          
        } catch (modelError) {
          console.log(`⚠️ Failed to create assistant with model ${model}:`, modelError);
          // Continue to the next model
        }
      }
      
      // If all models failed, throw an error
      if (!assistant) {
        throw new Error('Failed to create assistant with any available model');
      }
      
      this.assistants.set(subjectId, assistant);
      console.log(`✅ New OpenAI Assistant created for ${subjectName}:`, assistant.id);
      
      // Save the new assistant to database
      console.log(`💾 Saving assistant to database for ${subjectName}...`);
      const savedSettings = await persistenceService.saveAssistantForSubject({
        assistant_id: assistant.id,
        subject_id: subjectId,
        model: usedModel,
        name: `Ustaz AI Tutor - ${subjectName}`
      });
      
      if (savedSettings) {
        console.log(`✅ Assistant saved to database successfully for ${subjectName}`);
      } else {
        console.log(`⚠️ Failed to save assistant to database for ${subjectName}, but continuing...`);
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

    // Update context
    if (context) {
      this.context = { ...this.context, ...context };
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

    // Check if we have a subject - required for per-subject assistants
    if (!this.context.subject?.id) {
      console.log('⚠️ No subject context available, generating fallback response');
      return this.generateFallbackResponse(userMessage);
    }

    try {
      // Get or create thread for this subject
      let threadId: string;
      const subjectId = this.context.subject.id;
      
      if (subjectId && this.subjectThreads.has(subjectId)) {
        // Use existing thread for this subject
        threadId = this.subjectThreads.get(subjectId)!;
        console.log('🔄 Using existing thread for subject:', subjectId, 'threadId:', threadId);
      } else {
        // Create a new thread for new subject or when no subject context
        const thread = await this.openai.beta.threads.create();
        threadId = thread.id;
        
        if (subjectId) {
          this.subjectThreads.set(subjectId, threadId);
          console.log('🆕 Created new thread for subject:', subjectId, 'threadId:', threadId);
        } else {
          console.log('🆕 Created temporary thread (no subject context):', threadId);
        }
      }

      // Add the user message to the thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage
      });

      // Get or create assistant for this subject
      const assistant = await this.getOrCreateAssistantForSubject(subjectId, this.context.subject.name);
      if (!assistant) {
        console.log('❌ Assistant not available for subject:', this.context.subject.name);
        return this.generateFallbackResponse(userMessage);
      }

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: assistant.id,
        additional_instructions: this.buildContextualInstructions()
      });

      // Wait for completion and handle tool calls
      let completedRun = await this.waitForRunCompletion(threadId, run.id);
      const toolCalls: Array<{
        name: TutorToolName;
        parameters: Record<string, unknown>;
        result: Record<string, unknown>;
      }> = [];

      // Handle tool calls if present
      if (completedRun.status === 'requires_action' && completedRun.required_action) {
        const toolOutputs = [];
        
        for (const toolCall of completedRun.required_action.submit_tool_outputs.tool_calls) {
          const result = await this.handleToolCall(
            toolCall.function.name as TutorToolName,
            JSON.parse(toolCall.function.arguments)
          );
          
          toolCalls.push({
            name: toolCall.function.name as TutorToolName,
            parameters: JSON.parse(toolCall.function.arguments),
            result
          });

          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(result)
          });
        }

        // Submit tool outputs and wait for completion
        await this.openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
          tool_outputs: toolOutputs
        });

        completedRun = await this.waitForRunCompletion(threadId, run.id);
      }

      // Get the assistant's response
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      const response = lastMessage.content[0].type === 'text'
        ? lastMessage.content[0].text.value
        : 'Unable to generate a response. Check server logs for details.';

      // Add assistant response to conversation history
      this.context.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        tool_calls: toolCalls
      });

      // --- Auditing: Track interactive component usage rate ---
      let totalResponses = 0;
      let responsesWithInteractiveComponent = 0;
      // --- End auditing logic ---
      // Check if an interactive_component tool call was made
      const hasInteractiveComponent = toolCalls.some(tc => tc.name === 'interactive_component');
      // --- Auditing logic ---
      totalResponses++;
      if (hasInteractiveComponent) responsesWithInteractiveComponent++;
      const usageRate = ((responsesWithInteractiveComponent / totalResponses) * 100).toFixed(1);
      console.log(`📊 Interactive component usage rate: ${usageRate}% (${responsesWithInteractiveComponent}/${totalResponses})`);
      // --- End auditing logic ---
      if (!hasInteractiveComponent && this.context.lessonPlan?.lessons[this.context.lessonPlan.currentLessonIndex]?.title) {
        // Fallback: generate a default explainer interactive component
        const lessonTitle = this.context.lessonPlan?.lessons[this.context.lessonPlan.currentLessonIndex]?.title || ''
        const lessonDescription = this.context.lessonPlan?.lessons[this.context.lessonPlan.currentLessonIndex]?.description || ''
        const lessonDifficulty = (this.context.userLevel === 'beginner' || this.context.userLevel === 'intermediate' || this.context.userLevel === 'advanced') ? this.context.userLevel : 'beginner'
        const explainerType = getComponentTypeForStage('explainer') as ComponentType;
        const explainerToolCall = await this.handleInteractiveComponent({
          type: explainerType,
          content: {
            title: lessonTitle,
            overview: `Overview of ${lessonTitle}`,
            sections: [
              {
                heading: `Introduction to ${lessonTitle}`,
                paragraphs: [lessonDescription]
              }
            ],
            conclusion: `Summary of ${lessonTitle}`,
            difficulty: lessonDifficulty
          },
          learning_objective: lessonTitle,
          difficulty: lessonDifficulty
        });
        toolCalls.push({
          name: 'interactive_component',
          parameters: {
            type: explainerType,
            content: {
              title: lessonTitle,
              overview: `Overview of ${lessonTitle}`,
              sections: [
                {
                  heading: `Introduction to ${lessonTitle}`,
                  paragraphs: [lessonDescription]
                }
              ],
              conclusion: `Summary of ${lessonTitle}`,
              difficulty: lessonDifficulty
            },
            learning_objective: lessonTitle,
            difficulty: lessonDifficulty
          },
          result: explainerToolCall
        });
      }
      // --- End new logic ---

      // In generateResponse, after parsing the user message, if intent is unclear, trigger clarifying question
      // Example: If userMessage is too short, vague, or doesn't match known patterns, call handleClarifyingQuestion
      if (userMessage.trim().length < 5 || /\b(what|help|explain|how)\b/i.test(userMessage.trim())) {
        const clarifying = await this.handleClarifyingQuestion({
          question: 'Can you clarify what you want to learn or practice?',
          context: 'The request was too short or ambiguous.'
        })
        return {
          response: typeof clarifying.question === 'string' ? clarifying.question : 'Can you clarify your request?',
          toolCalls: [{ name: 'clarifying_question', parameters: { question: clarifying.question, context: clarifying.context }, result: clarifying }],
          updatedContext: this.context
        }
      }

      // Update context with new message
      this.context = {
        ...this.context,
        messages: [...this.context.messages, userMessage, response],
        lastUpdated: new Date().toISOString()
      };

      // Save context to server if userId and subjectId are available
      const userId = this.context.userProfile?.userId;
      const subjectId = this.context.subject?.id;
      if (userId && subjectId) {
        await persistenceService.saveTutorContext(userId, subjectId, this.context);
      }

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
        
        // Add more detailed error analysis
        if (error.message.includes('401')) {
          console.error('🔑 API KEY ERROR: Authentication failed - check your OpenAI API key validity');
        } else if (error.message.includes('429')) {
          console.error('⏱️ RATE LIMIT ERROR: Too many requests - you may need to upgrade your OpenAI plan');
        } else if (error.message.includes('model')) {
          console.error('🤖 MODEL ERROR: Problem with the specified model - may be deprecated or unavailable');
        } else if (error.message.includes('context_length_exceeded')) {
          console.error('📝 CONTEXT LENGTH ERROR: The conversation history is too long for the model');
        } else if (error.message.includes('assistant')) {
          console.error('👨‍🏫 ASSISTANT ERROR: Issue with the OpenAI assistant - may need to recreate it');
        } else if (error.message.includes('thread')) {
          console.error('🧵 THREAD ERROR: Problem with the conversation thread - may need to create a new one');
        }
        
        console.error('💡 DEBUGGING INFO:');
        console.error('Subject ID:', this.context.subject?.id);
        console.error('Subject Name:', this.context.subject?.name);
        console.error('Thread ID:', this.context.subject?.id ? this.subjectThreads.get(this.context.subject.id) : 'none');
        console.error('Assistant ID:', this.context.subject?.id ? this.assistants.get(this.context.subject.id)?.id : 'none');
        console.error('Conversation History:', this.context.conversationHistory.length, 'messages');
      }
      
      // Try to use a more helpful fallback response based on the error
      const fallbackResponse = this.generateFallbackResponse(userMessage);
      
      // Log the error for debugging but don't add to return type
      console.error('🚨 Using fallback response due to error:', error instanceof Error ? error.message : String(error));
      
      return fallbackResponse;
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
      instructions.push(`IMPORTANT - ALWAYS use the interactive_component tool call for ANY educational topic:`);
      instructions.push(`1. MUST use tool calls when explaining concepts, NOT just text responses`);
      instructions.push(`2. Create interactive components for ALL educational topics using the interactive_component tool`);
      instructions.push(`3. Every educational response REQUIRES an interactive component`);
      instructions.push(`4. Keep chat responses BRIEF and focus on creating rich interactive components`);
      instructions.push(`5. For ANY topic, create an appropriate interactive component type (explainer, interactive-example, etc.)`);
      
      if (this.context.instructionOverrides.interactiveContentGuidelines) {
        instructions.push(this.context.instructionOverrides.interactiveContentGuidelines);
      }
    }

    if (this.context.userGoals) {
      instructions.push(`Learning goals: ${this.context.userGoals}`);
    }
    if (this.context.userLevel) {
      instructions.push(`Self-assessed level: ${this.context.userLevel}`);
    }

    return instructions.length > 0 
      ? `Additional context for this conversation:\n${instructions.join('\n')}`
      : '';
  }

  private async waitForRunCompletion(threadId: string, runId: string): Promise<OpenAI.Beta.Threads.Run> {
    if (!this.openai) throw new Error('OpenAI client not initialized');
    
    let run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
    
    while (run.status === 'queued' || run.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
    }
    
    return run;
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

    // Create a new thread for this new subject
    if (this.openai) {
      try {
        const thread = await this.openai.beta.threads.create();
        this.subjectThreads.set(newSubject.id, thread.id);
        console.log('🆕 Created new thread for new subject:', newSubject.name, 'threadId:', thread.id);
        
        // Check if we have a user message in the conversation history
        // and add it to the new thread to maintain conversation context
        const lastUserMessage = this.context.conversationHistory.find(msg => msg.role === 'user');
        if (lastUserMessage && thread.id) {
          await this.openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: lastUserMessage.content
          });
          console.log('🔄 Added initial user message to new thread:', lastUserMessage.content.substring(0, 30) + '...');
        }
      } catch (error) {
        console.error('❌ Failed to create thread for new subject:', error);
      }
    }

    // Add prompt for user goals and level
    this.context.conversationHistory.push({
      role: 'assistant',
      content: `To personalize your learning, what are your main goals for ${params.name}? How would you rate your current level (beginner, intermediate, advanced)?`,
      timestamp: new Date(),
    });

    return {
      success: true,
      subject: newSubject,
      message: `Started learning ${params.name}. Let's begin by understanding your current level and goals.`
    };
  }

  private async handleNewLessonPlan(params: NewLessonPlanParams): Promise<Record<string, unknown>> {
    // If learning_goals or difficulty_level are missing, use from context
    const learningGoals = params.learning_goals && params.learning_goals.length > 0
      ? params.learning_goals
      : (this.context.userGoals ? [this.context.userGoals] : []);
    const difficultyLevel = params.difficulty_level || this.context.userLevel || 'beginner';

    // Generate lesson plan based on subject and goals
    const lessons: Lesson[] = learningGoals.map((goal, index) => ({
      id: `lesson_${index + 1}`,
      title: `Lesson ${index + 1}: ${goal}`,
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

    const currentIdx = this.context.lessonPlan.currentLessonIndex;
    const currentLesson = this.context.lessonPlan.lessons[currentIdx];
    if (!currentLesson.completed) {
      return {
        error: 'Current lesson is not yet completed. Please demonstrate understanding (e.g., pass the assessment or practice) before advancing to the next lesson.'
      };
    }

    if (currentIdx >= this.context.lessonPlan.lessons.length - 1) {
      return { 
        completed: true, 
        message: 'Congratulations! You have completed all lessons in this subject.' 
      };
    }

    this.context.lessonPlan.currentLessonIndex++;
    const nextLesson = this.context.lessonPlan.lessons[this.context.lessonPlan.currentLessonIndex];

    // --- New logic: Always generate an explainer interactive component for the new lesson ---
    const lessonTitle = nextLesson.title || ''
    const lessonDescription = nextLesson.description || ''
    const lessonDifficulty = (this.context.userLevel === 'beginner' || this.context.userLevel === 'intermediate' || this.context.userLevel === 'advanced') ? this.context.userLevel : 'beginner'
    const explainerType = getComponentTypeForStage('explainer') as ComponentType;
    const explainerToolCall = await this.handleInteractiveComponent({
      type: explainerType,
      content: {
        title: lessonTitle,
        overview: `Overview of ${lessonTitle}`,
        sections: [
          {
            heading: `Introduction to ${lessonTitle}`,
            paragraphs: [lessonDescription]
          }
        ],
        conclusion: `Summary of ${lessonTitle}`,
        difficulty: lessonDifficulty
      },
      learning_objective: lessonTitle,
      difficulty: lessonDifficulty
    })
    // --- End new logic ---

    // Track which types have been used for this lesson in context
    let usedTypes = this.context.lessonPlan.lessons[this.context.lessonPlan.currentLessonIndex].usedPracticeTypes
    if (!usedTypes) {
      usedTypes = []
      this.context.lessonPlan.lessons[this.context.lessonPlan.currentLessonIndex].usedPracticeTypes = usedTypes
    }
    const practiceType = getComponentTypeForStage('practice', usedTypes) as ComponentType;
    usedTypes.push(practiceType)
    // Generate a basic practice component for the current lesson
    const practiceComponent = await this.handleInteractiveComponent({
      type: practiceType,
      content: {
        title: `Practice: ${lessonTitle}`,
        question: `Test your understanding of ${lessonTitle}`,
        // The rest of the content will be filled in by the AI or left as default
      },
      learning_objective: lessonTitle,
      difficulty: lessonDifficulty
    })

    return {
      success: true,
      nextLesson,
      lessonNumber: this.context.lessonPlan.currentLessonIndex + 1,
      totalLessons: this.context.lessonPlan.lessons.length,
      explainerComponent: explainerToolCall,
      practiceComponent
    };
  }

  private async handleInteractiveComponent(params: InteractiveComponentParams): Promise<Record<string, unknown>> {
    console.log('🎯 Creating interactive component:', params.type, 'for', params.learning_objective);
    console.log('📝 Content provided by AI:', JSON.stringify(params.content).substring(0, 200) + '...');
    
    // We'll use the AI-provided content directly instead of creating generic templates
    // The content structure should match what the frontend expects

    // First, validate and ensure the AI-provided content has the necessary structure
    // but preserve all the AI-generated content rather than replacing it with templates
    const generatedContent = params.content || {};
    
    // Add minimal structure if completely missing, but preserve AI content
    switch (params.type) {
      case 'explainer':
        if (!generatedContent.title) {
          generatedContent.title = params.learning_objective;
        }
        if (!generatedContent.overview && !generatedContent.sections) {
          // Only add these if completely missing
          generatedContent.overview = `Understanding ${params.learning_objective}`;
          generatedContent.sections = [];
        }
        if (!generatedContent.difficulty) {
          generatedContent.difficulty = params.difficulty || 'beginner';
        }
        break;
        
      case 'interactive-example':
        if (!generatedContent.title) {
          generatedContent.title = `Interactive Example: ${params.learning_objective}`;
        }
        if (!generatedContent.description) {
          generatedContent.description = `Explore ${params.learning_objective} interactively`;
        }
        // Only provide empty arrays for these if missing
        if (!generatedContent.controls) {
          generatedContent.controls = [];
        }
        if (!generatedContent.display) {
          generatedContent.display = [];
        }
        if (!generatedContent.explanation) {
          generatedContent.explanation = `This interactive example helps you understand ${params.learning_objective}`;
        }
        break;
        
      case 'multiple-choice':
        if (!generatedContent.question) {
          generatedContent.question = params.learning_objective;
        }
        if (!generatedContent.choices) {
          generatedContent.choices = [];
        }
        if (!generatedContent.explanation) {
          generatedContent.explanation = `Practice question for: ${params.learning_objective}`;
        }
        break;
        
      case 'concept-card':
        if (!generatedContent.title) {
          generatedContent.title = params.learning_objective;
        }
        if (!generatedContent.summary) {
          generatedContent.summary = `Key concept: ${params.learning_objective}`;
        }
        if (!generatedContent.details) {
          generatedContent.details = `This concept is fundamental to understanding the subject.`;
        }
        if (!generatedContent.keyPoints) {
          generatedContent.keyPoints = [];
        }
        if (!generatedContent.examples) {
          generatedContent.examples = [];
        }
        if (!generatedContent.difficulty) {
          generatedContent.difficulty = params.difficulty || 'beginner';
        }
        break;
        
      case 'fill-blank':
        if (!generatedContent.title) {
          generatedContent.title = `Fill in the Blanks: ${params.learning_objective}`;
        }
        if (!generatedContent.text) {
          generatedContent.text = `Complete the following sentences about ${params.learning_objective}.`;
        }
        if (!generatedContent.blanks) {
          generatedContent.blanks = [];
        }
        if (!generatedContent.hints) {
          generatedContent.hints = [];
        }
        break;
        
      case 'step-solver':
        if (!generatedContent.title) {
          generatedContent.title = `Step-by-Step: ${params.learning_objective}`;
        }
        if (!generatedContent.problem) {
          generatedContent.problem = `Practice problem for ${params.learning_objective}`;
        }
        if (!generatedContent.steps) {
          generatedContent.steps = [];
        }
        if (!generatedContent.hints) {
          generatedContent.hints = [];
        }
        break;
        
      case 'drag-drop':
        if (!generatedContent.title) {
          generatedContent.title = `Drag & Drop: ${params.learning_objective}`;
        }
        if (!generatedContent.instructions) {
          generatedContent.instructions = `Organize items related to ${params.learning_objective}`;
        }
        if (!generatedContent.items) {
          generatedContent.items = [];
        }
        if (!generatedContent.targets) {
          generatedContent.targets = [];
        }
        break;
        
      case 'progress-quiz':
        if (!generatedContent.title) {
          generatedContent.title = `Progress Quiz: ${params.learning_objective}`;
        }
        if (!generatedContent.description) {
          generatedContent.description = `Test your knowledge of ${params.learning_objective}`;
        }
        if (!generatedContent.questions) {
          generatedContent.questions = [];
        }
        if (!generatedContent.passingScore) {
          generatedContent.passingScore = 70;
        }
        break;
        
      case 'graph-visualizer':
        if (!generatedContent.title) {
          generatedContent.title = `Graph: ${params.learning_objective}`;
        }
        if (!generatedContent.description) {
          generatedContent.description = `Visualizing data for ${params.learning_objective}`;
        }
        if (!generatedContent.data) {
          generatedContent.data = [];
        }
        if (!generatedContent.chartType) {
          generatedContent.chartType = 'line';
        }
        break;
        
      case 'formula-explorer':
        if (!generatedContent.title) {
          generatedContent.title = `Formula Explorer: ${params.learning_objective}`;
        }
        if (!generatedContent.description) {
          generatedContent.description = `Explore the formula for ${params.learning_objective}`;
        }
        if (!generatedContent.formula) {
          generatedContent.formula = '';
        }
        if (!generatedContent.variables) {
          generatedContent.variables = [];
        }
        if (!generatedContent.steps) {
          generatedContent.steps = [];
        }
        break;
        
      case 'text-highlighter':
        if (!generatedContent.title) {
          generatedContent.title = `Text Analysis: ${params.learning_objective}`;
        }
        if (!generatedContent.description) {
          generatedContent.description = `Analyze text related to ${params.learning_objective}`;
        }
        if (!generatedContent.text) {
          generatedContent.text = `Sample text for ${params.learning_objective}`;
        }
        if (!generatedContent.categories) {
          generatedContent.categories = [];
        }
        break;
        
      default:
        // For any other component type, provide minimal structure
        if (!generatedContent.title) {
          generatedContent.title = params.learning_objective;
        }
        if (!generatedContent.description) {
          generatedContent.description = `Interactive content for ${params.learning_objective}`;
        }
        break;
    }

    // Log what we're returning to make debugging easier
    console.log('✅ Returning interactive component with content:', JSON.stringify(generatedContent).substring(0, 200) + '...');

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
      
      // Create a new thread for this new subject if OpenAI is available
      if (this.openai) {
        // Using async IIFE to handle async operations
        (async () => {
          try {
            const thread = await this.openai!.beta.threads.create();
            this.subjectThreads.set(newSubject.id, thread.id);
            console.log('🆕 Created new thread for detected subject:', newSubject.name, 'threadId:', thread.id);
            
            // Add the original user message to the new thread
            await this.openai!.beta.threads.messages.create(thread.id, {
              role: 'user',
              content: userMessage
            });
            console.log('🔄 Added initial user message to new thread:', userMessage.substring(0, 30) + '...');
          } catch (error) {
            console.error('❌ Failed to create thread for new subject in fallback:', error);
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
      response: `I'm sorry, I encountered an error while processing your request. Please check your OpenAI API key configuration and try again.`,
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

  // Helper: Get adaptive mastery threshold based on userLevel and lesson difficulty
  getAdaptiveMasteryThreshold(userLevel: string | undefined, lessonDifficulty: string | undefined): number {
    // Example logic: beginners need 70%, intermediate 80%, advanced 90%
    if (lessonDifficulty === 'advanced' || userLevel === 'advanced') return 0.9
    if (lessonDifficulty === 'intermediate' || userLevel === 'intermediate') return 0.8
    return 0.7 // default for beginner or undefined
  }

  // Place this method inside the AITutorService class:
  // ---
  public processAssessmentResult({ lessonId, score, total, difficulty }: { lessonId: string, score: number, total: number, difficulty?: string }) {
    const lesson = this.context.lessonPlan?.lessons.find(l => l.id === lessonId)
    if (!lesson) return { error: 'Lesson not found' }
    const userLevel = this.context.userLevel
    const threshold = this.getAdaptiveMasteryThreshold(userLevel, difficulty)
    const percent = total > 0 ? score / total : 0
    let summary = null
    let subjectSummary = null
    if (percent >= threshold) {
      lesson.completed = true
      // Optionally update subject progress
      if (this.context.subject && this.context.lessonPlan) {
        const completedLessons = this.context.lessonPlan.lessons.filter(l => l.completed).length
        this.context.subject.progress = (completedLessons / this.context.lessonPlan.lessons.length) * 100
      }
      // --- New logic: Trigger lesson summary ---
      summary = this.handleSummaryRequest({ content_type: 'lesson', scope: lesson.title })
      // If this was the last lesson, trigger subject summary
      if (this.context.lessonPlan && this.context.lessonPlan.lessons.every(l => l.completed)) {
        subjectSummary = this.handleSummaryRequest({ content_type: 'progress', scope: this.context.subject?.name })
      }
      return { success: true, message: 'Lesson mastered! You can advance to the next lesson.', summary, subjectSummary }
    } else {
      lesson.completed = false
      return { success: false, message: `You scored ${Math.round(percent * 100)}%. Mastery requires ${(threshold * 100).toFixed(0)}%. Try again or review the material.` }
    }
  }
  // ---

  /**
   * Load TutorContext from the server for a given subject
   */
  async loadContextForSubject(userId: string, subjectId: string): Promise<void> {
    const loadedContext = await persistenceService.loadTutorContext(userId, subjectId);
    if (loadedContext) {
      this.context = loadedContext;
    }
  }
}

// Helper: List of all interactive practice/assessment types
const PRACTICE_COMPONENT_TYPES: ComponentType[] = [
  'multiple-choice',
  'fill-blank',
  'drag-drop',
  'step-solver',
  'concept-card',
  'interactive-example',
  'progress-quiz',
  'graph-visualizer',
  'formula-explorer',
  'text-highlighter',
]

// Helper: Randomly select a practice component type, ensuring variety
function getNextPracticeType(usedTypes: string[]): ComponentType {
  const unused = PRACTICE_COMPONENT_TYPES.filter(t => !usedTypes.includes(t))
  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)]
  }
  // If all used, reset
  return PRACTICE_COMPONENT_TYPES[Math.floor(Math.random() * PRACTICE_COMPONENT_TYPES.length)]
} 