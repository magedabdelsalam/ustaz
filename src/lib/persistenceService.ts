/**
 * PersistenceService
 * -------------------
 * Wrapper around Supabase operations used by the app.  Provides CRUD helpers
 * for chat messages, content items, subjects and AI assistant settings.
 * Exported as a singleton `persistenceService`.
 */
import { supabase, serverSupabase, isSupabaseConfigured, isSupabaseAdminConfigured } from '@/lib/supabase'
import type { Json } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PersistedMessage, PersistedContentItem, PersistedSubject } from '@/types'
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
  user_id: string | null
  model: string
  name: string
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  // Optional: may not exist in all deployments
  thread_id?: string | null
}

export class PersistenceService {
  private clientOverride?: SupabaseClient

  setClient(client: SupabaseClient) {
    this.clientOverride = client
  }

  clearClient() {
    this.clientOverride = undefined
  }

  private getDb(): SupabaseClient {
    if (this.clientOverride) return this.clientOverride
    return (isSupabaseAdminConfigured ? (serverSupabase as unknown as SupabaseClient) : (supabase as unknown as SupabaseClient))
  }

  // Helper method to check if database is properly configured
  private checkDatabaseConfig(): boolean {
    if (!isSupabaseConfigured) {
      logger.error('Database not properly configured. Check your environment variables.');
      return false;
    }
    return true;
  }
  
  // ===== AI ASSISTANT SETTINGS (PER SUBJECT) =====
  
  async getAssistantBySubject(subjectId: string): Promise<AIAssistantSettings | null> {
    try {
      const db = isSupabaseAdminConfigured ? serverSupabase : supabase
      const { data, error } = await db
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
    user_id: string
  }): Promise<AIAssistantSettings | null> {
    try {
      const db = isSupabaseAdminConfigured ? serverSupabase : supabase
      // First, deactivate any existing assistants for this subject
      await db
        .from('ai_assistant_settings')
        .update({ is_active: false })
        .eq('subject_id', settings.subject_id)
        .eq('user_id', settings.user_id)
        .eq('is_active', true)
      
      // Insert new active assistant for this subject
      const { data, error } = await db
        .from('ai_assistant_settings')
        .insert({
          assistant_id: settings.assistant_id,
          subject_id: settings.subject_id,
          user_id: settings.user_id,
          model: settings.model,
          name: settings.name,
          is_active: true
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      logger.error('Failed to save assistant for subject:', error)
      return null
    }
  }

  async deleteAssistantsBySubject(subjectId: string): Promise<void> {
    try {
      const db = isSupabaseAdminConfigured ? serverSupabase : supabase
      const { error } = await db
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
      
      // Attempt direct insert - simplest approach that we know works
      const { error } = await this.getDb()
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
        } else if (error.code === '42P01') {
          console.error('Table does not exist - check schema');
        } else if (error.code === '42703') {
          console.error('Column does not exist - check schema');
        } else if (error.code?.startsWith('28')) {
          console.error('Authorization error - check permissions');
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
      const { data, error } = await this.getDb()
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .order('timestamp', { ascending: true })
      
      if (error) throw error
      return (data as unknown as PersistedMessage[]) || []
    } catch (error) {
      logger.error('Failed to get messages by subject:', error)
      throw error
    }
  }

  async deleteMessagesBySubject(userId: string, subjectId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        const { error } = await this.getDb()
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
        
        const { error } = await this.getDb()
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
      const row = {
        id: item.id,
        user_id: item.user_id,
        subject_id: item.subject_id,
        type: item.type as unknown as string,
        data: item.data as unknown as Json,
        title: item.title,
        order_index: item.order_index,
        timestamp: item.timestamp,
        created_at: item.created_at ?? null
      }
      const { error } = await this.getDb()
        .from('content_feed')
        .insert(row)
      
      if (error) throw error
    } catch (error) {
      logger.error('Failed to save content item:', error)
      throw error
    }
  }

  async getContentFeedBySubject(userId: string, subjectId: string): Promise<PersistedContentItem[]> {
    try {
      const { data, error } = await this.getDb()
        .from('content_feed')
        .select('*')
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      const mapped = (data as Array<{ id: string; user_id: string; subject_id: string; type: string; data: unknown; title: string; order_index: number; timestamp: string; created_at?: string | null }> | null) ?? []
      return mapped.map(d => ({
        id: d.id,
        user_id: d.user_id,
        subject_id: d.subject_id,
        type: (d.type as unknown as import('@/types').ComponentType),
        data: d.data as Record<string, unknown>,
        title: d.title,
        order_index: d.order_index,
        timestamp: d.timestamp,
        created_at: d.created_at ?? undefined
      })) as unknown as PersistedContentItem[]
    } catch (error) {
      logger.error('Failed to get content feed by subject:', error)
      throw error
    }
  }

  async deleteContentFeedBySubject(userId: string, subjectId: string): Promise<void> {
    try {
      const { error } = await this.getDb()
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
      const db = this.getDb()
      const { error } = await db
        .from('subjects')
        .upsert(subject, { onConflict: 'id' })
      
      if (error) {
        // Soft-fail on RLS for non-critical flows
        if ((error as { code?: string }).code === '42501') {
          console.warn('RLS prevented subject save. Continuing without persistence.');
          return;
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to save subject:', error)
      throw error
    }
  }

  async getSubjectsByUser(userId: string): Promise<PersistedSubject[]> {
    try {
      const { data, error } = await this.getDb()
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
      const { error } = await this.getDb()
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

  // ===== UTILITY METHODS =====
  
  async clearAllUserData(userId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        // Delete all content feed items
        await this.getDb()
          .from('content_feed')
          .delete()
          .eq('user_id', userId)
        
        // Delete all chat messages
        await this.getDb()
          .from('chat_messages')
          .delete()
          .eq('user_id', userId)
        
        // Delete all subjects
        await this.getDb()
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
      const { data, error } = await this.getDb()
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

  // ===== THREAD PERSISTENCE (OPTIONAL) =====
  // Some deployments add a thread_id column on ai_assistant_settings to persist the OpenAI thread per subject
  async getThreadBySubject(subjectId: string): Promise<string | null> {
    try {
      const db = isSupabaseAdminConfigured ? serverSupabase : supabase
      const { data, error } = await db
        .from('ai_assistant_settings')
        .select('thread_id')
        .eq('subject_id', subjectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if ((error as unknown) && (error as { code?: string }).code === '42703') {
        // Column does not exist; feature not enabled
        return null
      }
      if (error) throw error
      const threadId = (data as { thread_id?: string } | null)?.thread_id
      return threadId || null
    } catch (error) {
      logger.error('Failed to get thread by subject (optional):', error)
      return null
    }
  }

  async saveThreadForSubject(subjectId: string, threadId: string): Promise<boolean> {
    try {
      const db = isSupabaseAdminConfigured ? serverSupabase : supabase
      const { error } = await db
        .from('ai_assistant_settings')
        .update({ thread_id: threadId })
        .eq('subject_id', subjectId)
        .eq('is_active', true)

      if ((error as unknown) && (error as { code?: string }).code === '42703') {
        // Column does not exist; ignore silently
        return false
      }
      if (error) throw error
      return true
    } catch (error) {
      logger.error('Failed to save thread for subject (optional):', error)
      return false
    }
  }
}

// Export singleton instance
export const persistenceService = new PersistenceService() 