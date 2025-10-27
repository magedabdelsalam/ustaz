/**
 * route
 * ----------------
 * TODO: Add description and exports for route.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { AITutorService, TutorContext } from '@/lib/ai-tutor-service'
import { OPENAI_API_KEY } from '@/lib/config'
import { persistenceService } from '@/lib/persistenceService'
import { errorHandler } from '@/lib/errorHandler'

// Define an interface for the subject data structure
interface SubjectData {
  id: string;
  name: string;
  topicKeywords?: string[];
  progress?: number;
  color?: string;
  isActive?: boolean;
  startedAt?: Date;
  messageCount?: number;
  lastActive?: Date;
}

// Global instance of the AI Tutor Service
let tutorService: AITutorService | null = null;

function getTutorService(): AITutorService {
  if (tutorService) return tutorService;
  tutorService = new AITutorService();
  return tutorService;
}

export async function POST(request: Request) {
  console.log('🌐 OpenAI API route called');
  
  try {
    const params = await request.json()
    const { 
      message, 
      messages, 
      context: rawContext, 
      sessionId, 
      userId, 
      stream, 
      courseContext,
      createSubjectRequest 
    } = params as { 
      message?: string; 
      messages?: Array<{ role: string; content: string }>; 
      context?: Partial<TutorContext>; 
      sessionId?: string; 
      userId?: string; 
      stream?: boolean;
      courseContext?: { courseId?: string; lessonId?: string; slideId?: string };
      createSubjectRequest?: {
        name: string;
        description: string;
        difficulty: 'beginner' | 'intermediate' | 'advanced';
        learningGoals: string[];
        estimatedDuration: string;
      };
    };
    
    // Sanitize context to avoid undefined wiping server-side values
    const tutorContext = rawContext
      ? (Object.fromEntries(Object.entries(rawContext as Record<string, unknown>).filter(([, v]) => v !== undefined)) as Partial<TutorContext>)
      : undefined
    
    // If courseContext is provided, this is a course-aware hint request
    if (courseContext && messages) {
      console.log('📚 Course-aware AI hint request');
      const cookieStore = await cookies()
      const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            },
          },
        }
      )
      
      // Enrich system prompt with course/lesson/slide metadata
      let contextInfo = ''
      if (courseContext.courseId) {
        const { data: course } = await supabase.from('courses').select('title, subject, grade_level').eq('id', courseContext.courseId).single()
        if (course) contextInfo += `Course: ${course.title} (${course.subject}, Grade ${course.grade_level})\n`
      }
      if (courseContext.lessonId) {
        const { data: lesson } = await supabase.from('lessons').select('title').eq('id', courseContext.lessonId).single()
        if (lesson) contextInfo += `Lesson: ${lesson.title}\n`
      }
      
      // Call OpenAI directly for simple hint generation
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: (messages[0]?.content || '') + '\n\n' + contextInfo },
            ...messages.slice(1)
          ]
        })
      })
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || 'No hint available.'
      return NextResponse.json({ content })
    }
    
    const effectiveMessage = message || (messages && messages.length > 0 ? messages[messages.length - 1]?.content : '')
    
    console.log('📝 Received message:', effectiveMessage?.substring(0, 50) + '...');
    console.log('🔧 Service initialized:', !!tutorService);

    // If no OpenAI API key, return simple message explaining API key is needed
    if (!OPENAI_API_KEY) {
      console.log('❌ No OPENAI_API_KEY found');
      return NextResponse.json({
        response: "I need an OpenAI API key to provide intelligent tutoring with adaptive tool calling. Please add your OPENAI_API_KEY to .env.local to enable full AI functionality with automatic lesson planning, interactive components, and personalized learning guidance.",
        toolCalls: [],
        context: tutorContext || { conversationHistory: [] },
        simulated: true,
        message: "Add your OpenAI API key to .env.local for full AI tutor functionality."
      });
    }

    console.log('✅ OPENAI_API_KEY is available');

    const service = getTutorService();

    console.log('🤖 Calling tutor service generateResponse...');
    console.log('📤 Context instructionOverrides:', tutorContext?.instructionOverrides ? 'YES' : 'NO');
    if (tutorContext?.instructionOverrides?.preferInteractiveContent) {
      console.log('✅ preferInteractiveContent is enabled');
    } else {
      console.log('⚠️ preferInteractiveContent is NOT enabled in context');
    }
    
    // Build a request-scoped Supabase client so RLS sees the user's JWT
    // This MUST happen before any AI service calls that might access the database
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )
    ;(persistenceService as unknown as { setClient: (c: unknown) => void }).setClient(supabase as unknown)
    
    // If client requests streaming, return an SSE-like stream of events
    if (stream) {
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream<Uint8Array>({
        start(controller) {
          const write = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
          const close = () => controller.close();
          (async () => {
            try {
              await service.generateResponseStreaming(
                effectiveMessage,
                tutorContext,
                async (event) => {
                  write({ event: event.type, data: event.data });
                }
              );
              write({ event: 'done' });
              close();
            } catch (e) {
              write({ event: 'error', data: { message: (e as Error)?.message || 'stream error' } });
              close();
            } finally {
              ;(persistenceService as unknown as { clearClient: () => void }).clearClient()
            }
          })();
        }
      });
      return new Response(streamBody, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }
    
    // Handle direct subject creation request from the UI dialog
    if (createSubjectRequest && userId) {
      console.log('🎯 Processing direct subject creation request:', createSubjectRequest.name);
      
      // Create subject ID
      const subjectId = `subject-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Create the subject data
      const newSubjectData = {
        id: subjectId,
        name: createSubjectRequest.name,
        progress: 0,
        color: 'bg-blue-500',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: createSubjectRequest.name.toLowerCase().split(' ').filter(w => w.length > 2),
        messageCount: 0,
        lastActive: new Date()
      };
      
      // Save subject to database
      await persistenceService.saveSubject({
        id: subjectId,
        user_id: userId,
        name: createSubjectRequest.name,
        keywords: newSubjectData.topicKeywords,
        lesson_plan: null,
        learning_progress: null,
        last_active: new Date().toISOString()
      });
      
      console.log('✅ Subject saved to database:', subjectId);
      
      // Generate lesson plan using AI
      const planMessage = `Create a lesson plan for ${createSubjectRequest.name}. ${createSubjectRequest.description}. 
      Difficulty: ${createSubjectRequest.difficulty}. 
      Learning goals: ${createSubjectRequest.learningGoals.join(', ')}. 
      Duration: ${createSubjectRequest.estimatedDuration}.
      
      Please create a structured lesson plan with the new_lesson_plan tool.`;
      
      const planContext = {
        ...tutorContext,
        userId,
        subject: newSubjectData,
        instructionOverrides: {
          preferInteractiveContent: false,
          interactiveContentGuidelines: 'Focus on creating a comprehensive lesson plan.'
        }
      };
      
      const planResult = await service.generateResponse(planMessage, planContext);
      
      // Extract lesson plan from tool calls
      const lessonPlanToolCall = planResult.toolCalls.find(tc => tc.name === 'new_lesson_plan');
      if (lessonPlanToolCall && lessonPlanToolCall.result.lessonPlan) {
        const lessonPlan = lessonPlanToolCall.result.lessonPlan;
        
        // Update subject with lesson plan
        await persistenceService.saveSubject({
          id: subjectId,
          user_id: userId,
          name: createSubjectRequest.name,
          keywords: newSubjectData.topicKeywords,
          lesson_plan: lessonPlan,
          learning_progress: null,
          last_active: new Date().toISOString()
        });
        
        console.log('✅ Lesson plan saved to database:', lessonPlan);
        
        // Add lesson plan to subject data
        (newSubjectData as typeof newSubjectData & { lessonPlan?: unknown }).lessonPlan = lessonPlan;
      }
      
      const responseJson = NextResponse.json({
        response: planResult.response || `Created ${createSubjectRequest.name} with a comprehensive lesson plan!`,
        toolCalls: planResult.toolCalls,
        context: planResult.updatedContext,
        sessionId: subjectId,
        newSubjectCreated: true,
        newSubjectData
      });
      
      ;(persistenceService as unknown as { clearClient: () => void }).clearClient()
      return responseJson;
    }
    
    // Non-streaming: Let the AI make ALL decisions about tool calling and responses
    const result = await service.generateResponse(effectiveMessage, tutorContext);

    console.log('✅ Got AI response:', result.response?.substring(0, 50) + '...');
    console.log('🔧 Tool calls made:', result.toolCalls?.length || 0);
    
    // Check if a new subject was created
    const newSubjectToolCall = result.toolCalls.find(tc => tc.name === 'new_subject');
    const newSubjectCreated = newSubjectToolCall ? newSubjectToolCall.result.success : false;
    const newSubjectData = newSubjectToolCall ? newSubjectToolCall.result.subject : null;
    
    if (newSubjectCreated && newSubjectData && userId) {
      console.log('🎯 New subject created:', newSubjectData);
      
      // IMPORTANT: Ensure the subject exists in the database before messages reference it
      try {
        // Cast newSubjectData to our defined interface
        const subjectData = newSubjectData as SubjectData;
        
        // Ensure subject exists in the database immediately
        await persistenceService.saveSubject({
          id: subjectData.id,
          user_id: userId,
          name: subjectData.name,
          keywords: Array.isArray(subjectData.topicKeywords) ? subjectData.topicKeywords : [],
          lesson_plan: null,
          learning_progress: null,
          last_active: new Date().toISOString()
        });
        
        console.log('✅ Subject saved to database before sending response:', subjectData.id);
      } catch (error) {
        console.error('❌ Failed to save subject to database:', error);
        // Continue anyway - the UI will handle this case
      }
    }
    
    // Prepare array so we can add synthesized tool calls if needed
    const toolCalls = Array.isArray(result.toolCalls) ? [...result.toolCalls] : [];
    let responseText = result.response || '';

    // Helper: attempt to extract a JSON object from the chat text
    const extractJsonFromText = (text: string): Record<string, unknown> | null => {
      try {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
        let candidate = text.slice(firstBrace, lastBrace + 1).trim();
        
        // Try direct parse first
        try {
          return JSON.parse(candidate) as Record<string, unknown>;
        } catch {
          // Try repair strategies
          const strategies = [
            // Fix progress-quiz specific issue
            (s: string) => {
              const questionsStart = s.indexOf('"questions":');
              if (questionsStart === -1) return s;
              const arrayStart = s.indexOf('[', questionsStart);
              if (arrayStart === -1) return s;
              const passingScoreMatch = s.substring(arrayStart).match(/\}\s*,\s*"passingScore":\s*\d+/);
              if (passingScoreMatch && passingScoreMatch.index) {
                const insertPos = arrayStart + passingScoreMatch.index + 1;
                return s.substring(0, insertPos) + '],' + s.substring(insertPos + 1).replace(/^\s*,\s*/, '');
              }
              return s;
            },
            // Fix extra brackets
            (s: string) => s.replace(/(\}\])+$/, '}').replace(/(\]\})+$/, '}'),
            // Remove trailing commas
            (s: string) => s.replace(/,(\s*[}\]])/g, '$1')
          ];
          
          for (const strategy of strategies) {
            try {
              candidate = strategy(candidate);
              return JSON.parse(candidate) as Record<string, unknown>;
            } catch {
              continue;
            }
          }
          
          return null;
        }
      } catch {
        return null;
      }
    };

    // If AI embedded a JSON component in chat instead of using the tool, synthesize a tool call
    if (!toolCalls.some(tc => tc.name === 'interactive_component')) {
      const parsed = extractJsonFromText(responseText);
      if (parsed && typeof parsed === 'object') {
        console.log('🧩 Detected embedded JSON interactive content in chat. Converting to tool call.');
        const title = (parsed as { title?: string }).title || 'Interactive Lesson';
        const synthesized = {
          name: 'interactive_component',
          parameters: {
            type: 'explainer',
            content: parsed,
            learning_objective: title,
            difficulty: 'beginner'
          },
          result: {
            type: 'interactive_component',
            componentType: 'explainer',
            content: parsed,
            learningObjective: title,
            difficulty: 'beginner'
          }
        } as const;
        toolCalls.push(synthesized as unknown as typeof toolCalls[number]);
        // Suppress chat text entirely; UI will show the component only
        responseText = '';
      }
    }

    // If the model provided an interactive_component tool call, trust its content as-is.
    // We avoid server-side restructuring to stay faithful to model output.

    // Suppress chat only if we have a valid interactive_component result (not validation_error)
    const hasValidInteractive = toolCalls.some(tc => tc.name === 'interactive_component' && tc.result && (tc.result as { type?: string }).type === 'interactive_component');
    if (hasValidInteractive) {
      responseText = '';
    }

    const responseJson = NextResponse.json({
      response: responseText,
      toolCalls,
      context: result.updatedContext,
      sessionId,
      newSubjectCreated,
      newSubjectData
    });
    // Clear the client after use to avoid cross-request leakage in dev
    ;(persistenceService as unknown as { clearClient: () => void }).clearClient()
    return responseJson

  } catch (error) {
    console.error('❌ AI Tutor API error:', error)
    const appError = errorHandler.handleError(error, 'ai_tutor_api')
    return NextResponse.json({
      error: appError.message,
      userMessage: appError.userMessage
    }, { status: 500 })
  }
}

