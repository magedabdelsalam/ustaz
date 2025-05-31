import { supabase } from '@/lib/supabase'
import { PersistedMessage, PersistedContentItem, PersistedSubject } from '@/types'
import { errorHandler, RetryOptions } from '@/lib/errorHandler'
import { logger } from './logger'

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000
}

export class PersistenceService {
  
  // ===== MESSAGE PERSISTENCE =====
  
  async saveMessage(message: PersistedMessage): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert(message)
      
      if (error) throw error
    } catch (error) {
      logger.error('Failed to save message:', error)
      throw error
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
      const { error } = await supabase
        .from('subjects')
        .upsert(subject, { onConflict: 'id' })
      
      if (error) throw error
    } catch (error) {
      logger.error('Failed to save subject:', error)
      throw error
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
      // Delete cascade will handle messages and content
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('user_id', userId)
        .eq('id', subjectId)
      
      if (error) throw error
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
      const { error } = await supabase
        .from('subjects')
        .select('id')
        .limit(1)
      
      return !error
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const persistenceService = new PersistenceService() 