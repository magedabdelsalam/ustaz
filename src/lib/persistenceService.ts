import { supabase } from '@/lib/supabase'
import { ComponentType } from '@/components/interactive'

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
  data: unknown
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
  lesson_plan?: {
    subject: string
    lessons: Array<{
      id: string
      title: string
      description: string
      completed: boolean
    }>
    currentLessonIndex: number
  }
  learning_progress?: {
    correctAnswers: number
    totalAttempts: number
    needsReview: boolean
    readyForNext: boolean
    currentLessonIndex?: number
    totalLessons?: number
  }
  last_active: string
  created_at?: string
}

export class PersistenceService {
  
  // ===== MESSAGE PERSISTENCE =====
  
  async saveMessage(message: PersistedMessage): Promise<void> {
    try {
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
        throw error
      }
      console.log('✅ Message saved to Supabase successfully')
    } catch (error) {
      console.error('❌ Failed to save message to Supabase:', error)
    }
  }

  async getMessagesBySubject(userId: string, subjectId: string): Promise<PersistedMessage[]> {
    try {
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
        return []
      }
      
      console.log('📥 Supabase returned messages:', data?.length || 0)
      if (data && data.length > 0) {
        console.log('📋 Sample message user_ids from DB:', data.slice(0, 3).map(m => m.user_id))
      }
      return data || []
    } catch (error) {
      console.error('❌ Failed to load messages from Supabase:', error)
      return []
    }
  }

  async deleteMessagesBySubject(userId: string, subjectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
      
      if (error) {
        console.error('Error deleting messages:', error)
        throw error
      }
    } catch (error) {
      console.error('Failed to delete messages:', error)
    }
  }

  async updateMessageSubject(messageId: string, userId: string, newSubjectId: string): Promise<void> {
    try {
      console.log('🔄 Moving message to new subject:', { messageId, userId, newSubjectId })
      
      const { error } = await supabase
        .from('chat_messages')
        .update({ subject_id: newSubjectId })
        .eq('id', messageId)
        .eq('user_id', userId)
      
      if (error) {
        console.error('❌ Supabase error updating message subject:', error)
        throw error
      }
      
      console.log('✅ Message moved to new subject successfully')
    } catch (error) {
      console.error('❌ Failed to move message to new subject:', error)
    }
  }

  // ===== CONTENT FEED PERSISTENCE =====
  
  async saveContentItem(item: PersistedContentItem): Promise<void> {
    try {
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
        throw error
      }
      
      console.log('✅ Content item saved successfully')
    } catch (error) {
      console.error('❌ Failed to save content item:', error)
      console.error('❌ Caught error details:', JSON.stringify(error, null, 2))
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
      
      if (error) {
        console.error('Error loading content feed:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Failed to load content feed:', error)
      return []
    }
  }

  async deleteContentFeedBySubject(userId: string, subjectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('content_feed')
        .delete()
        .eq('user_id', userId)
        .eq('subject_id', subjectId)
      
      if (error) {
        console.error('Error deleting content feed:', error)
        throw error
      }
    } catch (error) {
      console.error('Failed to delete content feed:', error)
    }
  }

  // ===== SUBJECT PERSISTENCE =====
  
  async saveSubject(subject: PersistedSubject): Promise<void> {
    try {
      // Debug logging to see what we're trying to save
      console.log('💾 DEBUG: Saving subject to DB:', {
        id: subject.id,
        name: subject.name,
        hasLessonPlan: !!subject.lesson_plan,
        hasLearningProgress: !!subject.learning_progress
      })
      
      if (subject.lesson_plan) {
        console.log('💾 DEBUG: Lesson plan details:', {
          subject: subject.lesson_plan.subject,
          lessonsCount: subject.lesson_plan.lessons?.length || 0,
          currentLessonIndex: subject.lesson_plan.currentLessonIndex,
          firstLessonTitle: subject.lesson_plan.lessons?.[0]?.title
        })
      }
      
      if (subject.learning_progress) {
        console.log('💾 DEBUG: Learning progress details:', {
          correctAnswers: subject.learning_progress.correctAnswers,
          totalAttempts: subject.learning_progress.totalAttempts,
          needsReview: subject.learning_progress.needsReview,
          readyForNext: subject.learning_progress.readyForNext
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
        throw error
      }
      
      console.log('✅ DEBUG: Subject saved successfully to DB')
    } catch (error) {
      console.error('Failed to save subject:', error)
    }
  }

  async getSubjectsByUser(userId: string): Promise<PersistedSubject[]> {
    try {
      console.log('📚 Loading subjects for user_id:', userId)
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })
      
      if (error) {
        console.error('Error loading subjects:', error)
        return []
      }
      
      console.log('📚 Found subjects:', data?.length || 0)
      if (data && data.length > 0) {
        console.log('📋 Subject names:', data.map(s => s.name))
        console.log('📋 Sample subject user_ids:', data.slice(0, 3).map(s => s.user_id))
      }
      
      return data || []
    } catch (error) {
      console.error('Failed to load subjects:', error)
      return []
    }
  }

  async deleteSubject(userId: string, subjectId: string): Promise<void> {
    try {
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
        throw error
      }
    } catch (error) {
      console.error('Failed to delete subject:', error)
    }
  }

  // ===== UTILITY METHODS =====
  
  async clearAllUserData(userId: string): Promise<void> {
    try {
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
      
    } catch (error) {
      console.error('Failed to clear user data:', error)
    }
  }
}

// Export singleton instance
export const persistenceService = new PersistenceService() 