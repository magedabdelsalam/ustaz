import { supabase } from '@/lib/supabase'
import { ComponentType } from '@/components/interactive'
import { errorHandler, RetryOptions } from '@/lib/errorHandler'

// Types for persistence
export interface PersistedMessage {
  id: string
  user_id: string
  subject_id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  has_generated_content?: boolean
  created_at?: string
}

export interface PersistedContentItem {
  id: string
  user_id: string
  subject_id: string
  type: ComponentType
  data: Record<string, unknown>
  title: string
  order_index: number
  timestamp: string
  created_at?: string
}

export interface PersistedSubject {
  id: string
  user_id: string
  name: string
  keywords: string[]
  lesson_plan?: Record<string, unknown>
  learning_progress?: Record<string, unknown>
  last_active: string
  created_at?: string
}

export interface LearningProgress {
  correctAnswers: number
  totalAttempts: number
  needsReview: boolean
  readyForNext: boolean
  currentLessonIndex?: number
  completedLessons?: number[]
  streakCount?: number
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000
}

export class PersistenceService {
  
  // ===== MESSAGE PERSISTENCE =====
  
  async saveMessage(message: PersistedMessage): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        console.log('🔗 Attempting to save message to Supabase...', message.content.substring(0, 30))
        console.log('👤 Saving with user_id:', message.user_id)
        console.log('📚 Saving with subject_id:', message.subject_id)
        
        const { error } = await supabase
          .from('chat_messages')
          .insert([{
            id: message.id,
            user_id: message.user_id,
            subject_id: message.subject_id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            has_generated_content: message.has_generated_content || false
          }])
        
        if (error) {
          console.error('❌ Supabase error saving message:', error)
          throw new Error(`Database error: ${error.message}`)
        }
        console.log('✅ Message saved to Supabase successfully')
      },
      'save_message',
      DEFAULT_RETRY_OPTIONS
    )
  }

  async getMessagesBySubject(userId: string, subjectId: string): Promise<PersistedMessage[]> {
    return await errorHandler.withRetry(
      async () => {
        console.log('🔍 Querying messages from Supabase for subject:', subjectId)
        console.log('👤 Loading with user_id:', userId)
        console.log('📚 Loading with subject_id:', subjectId)
        
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .order('timestamp', { ascending: true })
        
        if (error) {
          console.error('❌ Supabase error loading messages:', error)
          throw new Error(`Database error: ${error.message}`)
        }
        
        console.log('📥 Supabase returned messages:', data?.length || 0)
        if (data && data.length > 0) {
          console.log('📋 Sample message user_ids from DB:', data.slice(0, 3).map(m => m.user_id))
        }
        return data || []
      },
      'load_messages',
      DEFAULT_RETRY_OPTIONS
    )
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
    await errorHandler.withRetry(
      async () => {
        console.log('💾 Attempting to save content item:', {
          id: item.id,
          user_id: item.user_id,
          subject_id: item.subject_id,
          type: item.type,
          title: item.title
        })
        
        const { error } = await supabase
          .from('content_feed')
          .insert([{
            id: item.id,
            user_id: item.user_id,
            subject_id: item.subject_id,
            type: item.type,
            data: item.data,
            title: item.title,
            order_index: item.order_index,
            timestamp: item.timestamp
          }])
        
        if (error) {
          console.error('❌ Supabase error saving content item:', error)
          console.error('❌ Error details:', JSON.stringify(error, null, 2))
          throw new Error(`Database error: ${error.message}`)
        }
        
        console.log('✅ Content item saved successfully')
      },
      'save_content',
      DEFAULT_RETRY_OPTIONS
    )
  }

  async getContentFeedBySubject(userId: string, subjectId: string): Promise<PersistedContentItem[]> {
    return await errorHandler.withRetry(
      async () => {
        const { data, error } = await supabase
          .from('content_feed')
          .select('*')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .order('order_index', { ascending: true })
        
        if (error) {
          console.error('Error loading content feed:', error)
          throw new Error(`Database error: ${error.message}`)
        }
        
        return data || []
      },
      'load_content',
      DEFAULT_RETRY_OPTIONS
    )
  }

  async deleteContentFeedBySubject(userId: string, subjectId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        const { error } = await supabase
          .from('content_feed')
          .delete()
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
        
        if (error) {
          console.error('Error deleting content feed:', error)
          throw new Error(`Database error: ${error.message}`)
        }
      },
      'delete_content',
      DEFAULT_RETRY_OPTIONS
    )
  }

  // ===== SUBJECT PERSISTENCE =====
  
  async saveSubject(subject: PersistedSubject): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        // Debug logging to see what we're trying to save
        console.log('💾 DEBUG: Saving subject to DB:', {
          id: subject.id,
          name: subject.name,
          hasLessonPlan: !!subject.lesson_plan,
          hasLearningProgress: !!subject.learning_progress
        })
        
        if (subject.lesson_plan) {
          // Type assertion for debugging - we know this structure for lesson plans
          const lessonPlan = subject.lesson_plan as { 
            subject?: string;
            lessons?: Array<{ title?: string }>;
            currentLessonIndex?: number;
          }
          console.log('💾 DEBUG: Lesson plan details:', {
            subject: lessonPlan.subject,
            lessonsCount: lessonPlan.lessons?.length || 0,
            currentLessonIndex: lessonPlan.currentLessonIndex,
            firstLessonTitle: lessonPlan.lessons?.[0]?.title
          })
        }
        
        if (subject.learning_progress) {
          // Type assertion for debugging - we know this structure for learning progress
          const learningProgress = subject.learning_progress as {
            correctAnswers?: number;
            totalAttempts?: number;
            needsReview?: boolean;
            readyForNext?: boolean;
          }
          console.log('💾 DEBUG: Learning progress details:', {
            correctAnswers: learningProgress.correctAnswers,
            totalAttempts: learningProgress.totalAttempts,
            needsReview: learningProgress.needsReview,
            readyForNext: learningProgress.readyForNext
          })
        }
        
        const { error } = await supabase
          .from('subjects')
          .upsert([{
            id: subject.id,
            user_id: subject.user_id,
            name: subject.name,
            keywords: subject.keywords,
            lesson_plan: subject.lesson_plan,
            learning_progress: subject.learning_progress,
            last_active: subject.last_active
          }], {
            onConflict: 'id'
          })
        
        if (error) {
          console.error('❌ Error saving subject:', error)
          throw new Error(`Database error: ${error.message}`)
        }
        
        console.log('✅ DEBUG: Subject saved successfully to DB')
      },
      'save_subject',
      DEFAULT_RETRY_OPTIONS
    )
  }

  async getSubjectsByUser(userId: string): Promise<PersistedSubject[]> {
    return await errorHandler.withRetry(
      async () => {
        console.log('📚 Loading subjects for user_id:', userId)
        
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('user_id', userId)
          .order('last_active', { ascending: false })
        
        if (error) {
          console.error('Error loading subjects:', error)
          throw new Error(`Database error: ${error.message}`)
        }
        
        console.log('📚 Found subjects:', data?.length || 0)
        if (data && data.length > 0) {
          console.log('📋 Subject names:', data.map(s => s.name))
          console.log('📋 Sample subject user_ids:', data.slice(0, 3).map(s => s.user_id))
        }
        
        return data || []
      },
      'load_subjects',
      DEFAULT_RETRY_OPTIONS
    )
  }

  async deleteSubject(userId: string, subjectId: string): Promise<void> {
    await errorHandler.withRetry(
      async () => {
        // Delete in order: content_feed, chat_messages, then subject
        await this.deleteContentFeedBySubject(userId, subjectId)
        await this.deleteMessagesBySubject(userId, subjectId)
        
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('user_id', userId)
          .eq('id', subjectId)
        
        if (error) {
          console.error('Error deleting subject:', error)
          throw new Error(`Database error: ${error.message}`)
        }
      },
      'delete_subject',
      DEFAULT_RETRY_OPTIONS
    )
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