import { NextResponse } from 'next/server'
import { AITutorService } from '@/lib/ai-tutor-service'
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

// Initialize the service once
if (!tutorService) {
  tutorService = new AITutorService();
}

export async function POST(request: Request) {
  console.log('🌐 OpenAI API route called');
  
  try {
    const params = await request.json()
    const { message, context: tutorContext, sessionId, userId } = params;
    
    console.log('📝 Received message:', message?.substring(0, 50) + '...');
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

    if (!tutorService) {
      console.log('❌ Tutor service not initialized');
      return NextResponse.json({ error: 'Tutor service not initialized' }, { status: 500 });
    }

    console.log('🤖 Calling tutor service generateResponse...');
    console.log('📤 Context instructionOverrides:', tutorContext?.instructionOverrides ? 'YES' : 'NO');
    if (tutorContext?.instructionOverrides?.preferInteractiveContent) {
      console.log('✅ preferInteractiveContent is enabled');
      console.log('📝 Interactive content guidelines:', 
        tutorContext.instructionOverrides.interactiveContentGuidelines?.substring(0, 200) + '...');
    } else {
      console.log('⚠️ preferInteractiveContent is NOT enabled in context');
    }
    
    // Let the AI make ALL decisions about tool calling and responses
    const result = await tutorService.generateResponse(message, tutorContext);

    console.log('✅ Got AI response:', result.response?.substring(0, 50) + '...');
    console.log('🔧 Tool calls made:', result.toolCalls?.length || 0);
    
    // Check if a new subject was created
    const newSubjectToolCall = result.toolCalls.find(tc => tc.name === 'new_subject');
    const newSubjectCreated = newSubjectToolCall ? newSubjectToolCall.result.success : false;
    const newSubjectData = newSubjectToolCall ? newSubjectToolCall.result.subject : null;
    
    // If the response is the fallback error message and we have a subject context, try to recover
    if (result.response.includes("I'm sorry, I encountered an error") && 
        tutorContext?.subject && 
        tutorContext.subject.id) {
      
      console.log('🔄 Attempting recovery with explicit subject context');
      
      // Try again with a more explicit subject context
      const recoveryResult = await tutorService.generateResponse(message, {
        ...tutorContext,
        subject: {
          ...tutorContext.subject,
          // Ensure these fields are present
          progress: tutorContext.subject.progress || 0,
          messageCount: tutorContext.subject.messageCount || 0,
          isActive: true,
          topicKeywords: tutorContext.subject.topicKeywords || [tutorContext.subject.name.toLowerCase()]
        }
      });
      
      // If recovery succeeded (no error message), use the recovery result
      if (!recoveryResult.response.includes("I'm sorry, I encountered an error")) {
        console.log('✅ Recovery successful, using recovered response');
        return NextResponse.json({
          response: recoveryResult.response,
          toolCalls: recoveryResult.toolCalls,
          context: recoveryResult.updatedContext,
          sessionId,
          newSubjectCreated,
          newSubjectData
        });
      } else {
        console.log('❌ Recovery failed, using original fallback response');
      }
    }
    
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
    
    // Check for interactive component tool calls and enhance them with content from the AI response if needed
    const interactiveComponentToolCall = result.toolCalls.find(tc => tc.name === 'interactive_component');
    if (interactiveComponentToolCall) {
      console.log('🎯 Found interactive component tool call - SUCCESS!');
      console.log('📊 Component type:', interactiveComponentToolCall.parameters.type);
      console.log('📝 Learning objective:', interactiveComponentToolCall.parameters.learning_objective);
      
      // Extract component type only - removing unused learningObjective variable
      const componentType = interactiveComponentToolCall.parameters.type as string;
      
      // The AI's response often contains valuable content that should be used in the interactive component
      // Not currently used - the AI should directly generate structured content
      // const aiResponse = result.response;
      
      // Parse the response to extract relevant content based on component type
      if (componentType === 'explainer' && 
          typeof interactiveComponentToolCall.parameters.content === 'object' &&
          interactiveComponentToolCall.parameters.content) {
        
        const content = interactiveComponentToolCall.parameters.content as Record<string, unknown>;
        
        // If the content doesn't have rich sections, provide a minimal default structure
        // but don't try to parse it from the AI response text - the AI should directly generate structured content
        if (!content.sections || (Array.isArray(content.sections) && content.sections.length === 0)) {
          console.log('🔍 Adding default structure to explainer content');
          
          // Set default sections only if none were provided
          content.sections = content.sections || [];
          
          // Ensure we have a title
          if (!content.title) {
            const learningObjective = interactiveComponentToolCall.parameters.learning_objective as string;
            content.title = learningObjective || 'Learning Topic';
          }
          
          // Ensure we have an overview
          if (!content.overview) {
            content.overview = "Let's explore this important topic in detail.";
          }
          
          // Update the tool call with the enhanced content
          interactiveComponentToolCall.parameters.content = content;
          
          // Also update the result if it exists
          if (interactiveComponentToolCall.result && 
              typeof interactiveComponentToolCall.result === 'object' &&
              interactiveComponentToolCall.result.content) {
            interactiveComponentToolCall.result.content = content;
          }
        }
      }
    }

    return NextResponse.json({
      response: result.response,
      toolCalls: result.toolCalls,
      context: result.updatedContext,
      sessionId,
      newSubjectCreated,
      newSubjectData
    });

  } catch (error) {
    console.error('❌ AI Tutor API error:', error)
    const appError = errorHandler.handleError(error, 'ai_tutor_api')
    return NextResponse.json({
      error: appError.message,
      userMessage: appError.userMessage
    }, { status: 500 })
  }
}

