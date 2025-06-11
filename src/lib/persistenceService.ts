import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { PersistedMessage, PersistedContentItem, PersistedSubject } from '@/types'
import { TutorContext } from '@/lib/ai-tutor-service'
import { errorHandler, RetryOptions } from '@/lib/errorHandler'
import { logger } from './logger'

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000
}

export interface AIAssistantSettings {
  id: number
  assistant_id: string
  subject_id: string
  model: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export class PersistenceService {
  
  // Helper method to check if database is properly configured
  checkDatabaseConfig(): boolean {
    if (!isSupabaseConfigured) {
      console.error('❌ Supabase not properly configured - check .env.local file');
      return false;
    }
    
    // Check if we can get the Supabase auth session
    try {
      // This is a synchronous check - we'll do async checks in the actual operations
      if (!supabase) {
        console.error('❌ Supabase client is not available');
        return false;
      }
      
      // Additional environment variable checks
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
        return false;
      }
      
      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error checking Supabase configuration:', error);
      return false;
    }
  }
  
  // ===== AI ASSISTANT SETTINGS (PER SUBJECT) =====
  
  async getAssistantBySubject(subjectId: string): Promise<AIAssistantSettings | null> {
    try {
      const { data, error } = await supabase
        .from('ai_assistant_settings')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null
        }
        throw error
      }
      return data
    } catch (error) {
      logger.error('Failed to get assistant for subject:', error)
      return null
    }
  }

  async saveAssistantForSubject(settings: {
    assistant_id: string
    subject_id: string
    model: string
    name: string
  }): Promise<AIAssistantSettings | null> {
    try {
      // Check if authentication is active
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error('Failed to save assistant: No active Supabase session');
        logger.error('Failed to save assistant: No active Supabase session');
        return null;
      }

      // First, deactivate any existing assistants for this subject
      await supabase
        .from('ai_assistant_settings')
        .update({ is_active: false })
        .eq('subject_id', settings.subject_id)
        .eq('is_active', true);
      
      // Insert new active assistant for this subject
      const { data, error } = await supabase
        .from('ai_assistant_settings')
        .insert({
          assistant_id: settings.assistant_id,
          subject_id: settings.subject_id,
          model: settings.model,
          name: settings.name,
          is_active: true,
          user_id: authData.session.user.id // Add user_id to satisfy RLS policy
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '42501') {
          // Row-level security policy violation
          console.error('RLS policy violation when saving assistant:', error.message);
          logger.error('RLS policy violation when saving assistant:', error);
          console.warn('Continuing operation despite RLS error');
          
          // Try to return a mock assistant for continuity
          return {
            id: 0,
            assistant_id: settings.assistant_id,
            subject_id: settings.subject_id,
            model: settings.model,
            name: settings.name,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        } else {
          logger.error('Failed to save assistant for subject:', error);
          throw error;
        }
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to save assistant for subject:', error);
      return null;
    }
  }

  async deleteAssistantsBySubject(subjectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_assistant_settings')
        .delete()
        .eq('subject_id', subjectId)
      
      if (error) throw error
    } catch (error) {
      logger.error('Failed to delete assistants for subject:', error)
      throw error
    }
  }
  
  // ===== MESSAGE PERSISTENCE =====
  
  async saveMessage(message: PersistedMessage): Promise<boolean> {
    // Enhanced database config check with more details
    if (!this.checkDatabaseConfig()) {
      console.error('Failed to save message: Database not properly configured');
      return false;
    }
    
    // Check for active Supabase session
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error('Failed to save message: No active Supabase session');
        return false;
      }
      
      // Ensure user_id matches the authenticated user to satisfy RLS policy
      const authenticatedUserId = authData.session.user.id;
      if (message.user_id !== authenticatedUserId) {
        console.warn(`User ID mismatch - updating message.user_id to match authenticated user: ${authenticatedUserId}`);
        message.user_id = authenticatedUserId;
      }
    } catch (authError) {
      console.error('Failed to check auth session:', authError);
      // Continue anyway to see if the insert works
    }
    
    try {
      // Validate message structure
      const validationError = this.validateMessage(message);
      if (validationError) {
        logger.error(`Invalid message data: ${validationError}`, { message });
        console.error(`Message validation failed: ${validationError}`, message);
        return false;
      }
      
      // Make sure we have the right fields for database
      const sanitizedMessage = {
        id: message.id,
        user_id: message.user_id,
        subject_id: message.subject_id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        has_generated_content: message.has_generated_content || false
      };
      
      // Skip subject existence check as it may be causing issues
      console.log('Saving message to database:', sanitizedMessage);
      
      // Check if the message already exists to avoid duplicate key errors
      const { data: existingMessage } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('id', sanitizedMessage.id)
        .maybeSingle();
        
      if (existingMessage) {
        console.warn(`Message with ID ${sanitizedMessage.id} already exists. Generating a new ID.`);
        sanitizedMessage.id = `${sanitizedMessage.id}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Attempt direct insert - simplest approach that we know works
      const { error } = await supabase
        .from('chat_messages')
        .insert(sanitizedMessage);
      
      if (error) {
        // Log detailed error information
        logger.error('Supabase error when saving message:', JSON.stringify(error));
        console.error('Detailed error object:', error);
        
        // Analyze error type
        if (error.code === '23503') {
          console.error('Foreign key violation - referenced row doesn\'t exist');
        } else if (error.code === '23505') {
          console.error('Unique constraint violation - ID already exists');
          // Try one more time with a new ID
          sanitizedMessage.id = `${sanitizedMessage.id}-retry-${Date.now()}`;
          const { error: retryError } = await supabase
            .from('chat_messages')
            .insert(sanitizedMessage);
            
          if (!retryError) {
            console.log('✅ Message saved successfully on retry with new ID');
            return true;
          }
        } else if (error.code === '42P01') {
          console.error('Table does not exist - check schema');
        } else if (error.code === '42703') {
          console.error('Column does not exist - check schema');
        } else if (error.code?.startsWith('28')) {
          console.error('Authorization error - check permissions');
        } else if (error.code === '42501') {
          console.error('Row-level security policy violation:', error.message);
        }
        
        return false;
      }
      
      console.log('✅ Message saved successfully');
      return true;
    } catch (error) {
      logger.error('Failed to save message:', error instanceof Error ? error.message : String(error));
      console.error('Caught exception during message save:', error);
      return false;
    }
  }

  async getMessagesBySubject(userId: string, subjectId: string): Promise<PersistedMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .order('timestamp', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to get messages by subject:', error)
      throw error
    }
  }

  async deleteMessagesBySubject(userId: string, subjectId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
        
        if (error) {
          console.error('Error deleting messages:', error)
          throw new Error(`Database error: ${error.message}`)
        }
      },
      'delete_messages',
      DEFAULT_RETRY_OPTIONS
    )
  }

  async updateMessageSubject(messageId: string, userId: string, newSubjectId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        console.log('🔄 Moving message to new subject:', { messageId, userId, newSubjectId })
        
        const { error } = await supabase
          .from('chat_messages')
          .update({ subject_id: newSubjectId })
          .eq('id', messageId)
          .eq('user_id', userId)
        
        if (error) {
          console.error('❌ Supabase error updating message subject:', error)
          throw new Error(`Database error: ${error.message}`)
        }
        
        console.log('✅ Message moved to new subject successfully')
      },
      'update_message',
      DEFAULT_RETRY_OPTIONS
    )
  }

  // ===== CONTENT FEED PERSISTENCE =====
  
  async saveContentItem(item: PersistedContentItem): Promise<void> {
    try {
      const { error } = await supabase
        .from('content_feed')
        .insert(item)
      
      if (error) throw error
    } catch (error) {
      logger.error('Failed to save content item:', error)
      throw error
    }
  }

  async getContentFeedBySubject(userId: string, subjectId: string): Promise<PersistedContentItem[]> {
    try {
      const { data, error } = await supabase
        .from('content_feed')
        .select('*')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to get content feed by subject:', error)
      throw error
    }
  }

  async deleteContentFeedBySubject(userId: string, subjectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('content_feed')
        .delete()
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
      
      if (error) throw error
    } catch (error) {
      logger.error('Failed to delete content feed by subject:', error)
      throw error
    }
  }

  // ===== SUBJECT PERSISTENCE =====
  
  async saveSubject(subject: PersistedSubject): Promise<void> {
    try {
      // First check if authentication is active
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error('Failed to save subject: No active Supabase session');
        logger.error('Failed to save subject: No active Supabase session');
        return;
      }

      // Ensure user_id matches the authenticated user to satisfy RLS policy
      const authenticatedUserId = authData.session.user.id;
      if (subject.user_id !== authenticatedUserId) {
        console.warn(`User ID mismatch - updating subject.user_id to match authenticated user: ${authenticatedUserId}`);
        subject.user_id = authenticatedUserId;
      }

      // Make the upsert call
      const { error } = await supabase
        .from('subjects')
        .upsert(subject, { onConflict: 'id' });
      
      if (error) {
        if (error.code === '42501') {
          // Row-level security policy violation
          console.error('RLS policy violation when saving subject:', error.message);
          logger.error('RLS policy violation when saving subject:', error);
        } else {
          console.error('Database error when saving subject:', error);
          logger.error('Failed to save subject:', error);
        }
        
        throw error;
      }
      
      console.log('✅ Subject saved successfully:', subject.id);
    } catch (error) {
      logger.error('Failed to save subject:', error);
      throw error;
    }
  }

  async getSubjectsByUser(userId: string): Promise<PersistedSubject[]> {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to get subjects by user:', error)
      throw error
    }
  }

  async deleteSubject(userId: string, subjectId: string): Promise<void> {
    try {
      // Delete cascade will handle messages, content, and assistant settings
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('user_id', userId)
        .eq('id', subjectId)
      
      if (error) throw error
      
      // Note: ai_assistant_settings will be deleted automatically via CASCADE
      console.log('✅ Subject and associated assistant settings deleted successfully')
    } catch (error) {
      logger.error('Failed to delete subject:', error)
      throw error
    }
  }

  // ===== TUTOR CONTEXT PERSISTENCE =====
  /**
   * Save the full TutorContext for a user and subject
   */
  async saveTutorContext(userId: string, subjectId: string, context: TutorContext): Promise<void> {
    try {
      // Ensure user is authenticated
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error('Failed to save tutor context: No active Supabase session');
        logger.error('Failed to save tutor context: No active Supabase session');
        return;
      }
      // Upsert context
      const { error } = await supabase
        .from('tutor_contexts')
        .upsert({
          user_id: userId,
          subject_id: subjectId,
          context_json: context,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,subject_id' });
      if (error) {
        if (error.code === '42501') {
          console.error('RLS policy violation when saving tutor context:', error.message);
          logger.error('RLS policy violation when saving tutor context:', error);
        } else {
          logger.error('Failed to save tutor context:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to save tutor context:', error);
    }
  }

  /**
   * Load the TutorContext for a user and subject
   */
  async loadTutorContext(userId: string, subjectId: string): Promise<TutorContext | null> {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error('Failed to load tutor context: No active Supabase session');
        logger.error('Failed to load tutor context: No active Supabase session');
        return null;
      }
      const { data, error } = await supabase
        .from('tutor_contexts')
        .select('context_json')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .single();
      if (error) {
        if (error.code === '42501') {
          console.error('RLS policy violation when loading tutor context:', error.message);
          logger.error('RLS policy violation when loading tutor context:', error);
        } else {
          logger.error('Failed to load tutor context:', error);
        }
        return null;
      }
      return data?.context_json || null;
    } catch (error) {
      logger.error('Failed to load tutor context:', error);
      return null;
    }
  }

  // ===== UTILITY METHODS =====
  
  async clearAllUserData(userId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        // Delete all content feed items
        await supabase
          .from('content_feed')
          .delete()
          .eq('user_id', userId)
        
        // Delete all chat messages
        await supabase
          .from('chat_messages')
          .delete()
          .eq('user_id', userId)
        
        // Delete all subjects
        await supabase
          .from('subjects')
          .delete()
          .eq('user_id', userId)
      },
      'clear_user_data',
      DEFAULT_RETRY_OPTIONS
    )
  }

  // ===== CONNECTION HEALTH CHECK =====
  
  async testConnection(): Promise<boolean> {
    try {
      // Use a simpler query that doesn't use count() with exact parameter
      const { data, error } = await supabase
        .from('subjects')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('Database connection test failed:', error);
        logger.error('Database connection test failed:', JSON.stringify(error));
        return false;
      }
      
      console.log('Database connection test succeeded:', data);
      return true;
    } catch (error) {
      console.error('Database connection test exception:', error);
      logger.error('Database connection test exception:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  // Helper to validate message structure before saving
  validateMessage(message: PersistedMessage): string | null {
    if (!message.id) return 'Missing message id';
    if (!message.user_id) return 'Missing user_id';
    if (!message.subject_id) return 'Missing subject_id';
    if (!message.role || !['user', 'assistant'].includes(message.role)) return 'Invalid role';
    if (!message.content) return 'Missing content';
    if (!message.timestamp) return 'Missing timestamp';
    return null;
  }
}

// Export singleton instance
export const persistenceService = new PersistenceService() 