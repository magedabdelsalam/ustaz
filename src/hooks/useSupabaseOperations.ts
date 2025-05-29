'use client'

import { useState, useCallback } from 'react'
import { PersistenceService, PersistedMessage, PersistedSubject, PersistedContentItem } from '@/lib/persistenceService'
import { useAsyncOperation } from '@/components/ErrorProvider'

const persistenceService = new PersistenceService()

export function useSupabaseOperations() {
  const [isLoading, setIsLoading] = useState(false)
  const { executeWithRetry, executeWithErrorHandling } = useAsyncOperation()

  // Messages
  const saveMessage = useCallback(async (message: PersistedMessage, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.saveMessage(message)
      
      if (withRetry) {
        await executeWithRetry(operation, 'save_message')
      } else {
        await executeWithErrorHandling(operation, 'save_message')
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  const loadMessages = useCallback(async (userId: string, subjectId: string, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.getMessagesBySubject(userId, subjectId)
      
      if (withRetry) {
        return await executeWithRetry(operation, 'load_messages') || []
      } else {
        return await executeWithErrorHandling(operation, 'load_messages') || []
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  const deleteMessages = useCallback(async (userId: string, subjectId: string, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.deleteMessagesBySubject(userId, subjectId)
      
      if (withRetry) {
        await executeWithRetry(operation, 'delete_messages')
      } else {
        await executeWithErrorHandling(operation, 'delete_messages')
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  // Subjects
  const saveSubject = useCallback(async (subject: PersistedSubject, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.saveSubject(subject)
      
      if (withRetry) {
        await executeWithRetry(operation, 'save_subject')
      } else {
        await executeWithErrorHandling(operation, 'save_subject')
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  const loadSubjects = useCallback(async (userId: string, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.getSubjectsByUser(userId)
      
      if (withRetry) {
        return await executeWithRetry(operation, 'load_subjects') || []
      } else {
        return await executeWithErrorHandling(operation, 'load_subjects') || []
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  const deleteSubject = useCallback(async (userId: string, subjectId: string, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.deleteSubject(userId, subjectId)
      
      if (withRetry) {
        await executeWithRetry(operation, 'delete_subject')
      } else {
        await executeWithErrorHandling(operation, 'delete_subject')
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  // Content
  const saveContent = useCallback(async (content: PersistedContentItem, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.saveContentItem(content)
      
      if (withRetry) {
        await executeWithRetry(operation, 'save_content')
      } else {
        await executeWithErrorHandling(operation, 'save_content')
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  const loadContent = useCallback(async (userId: string, subjectId: string, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.getContentFeedBySubject(userId, subjectId)
      
      if (withRetry) {
        return await executeWithRetry(operation, 'load_content') || []
      } else {
        return await executeWithErrorHandling(operation, 'load_content') || []
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  // Utility operations
  const testConnection = useCallback(async () => {
    setIsLoading(true)
    try {
      return await persistenceService.testConnection()
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearUserData = useCallback(async (userId: string, withRetry = true) => {
    setIsLoading(true)
    try {
      const operation = () => persistenceService.clearAllUserData(userId)
      
      if (withRetry) {
        await executeWithRetry(operation, 'clear_user_data')
      } else {
        await executeWithErrorHandling(operation, 'clear_user_data')
      }
    } finally {
      setIsLoading(false)
    }
  }, [executeWithRetry, executeWithErrorHandling])

  return {
    // State
    isLoading,
    
    // Message operations
    saveMessage,
    loadMessages,
    deleteMessages,
    
    // Subject operations
    saveSubject,
    loadSubjects,
    deleteSubject,
    
    // Content operations
    saveContent,
    loadContent,
    
    // Utility operations
    testConnection,
    clearUserData
  }
} 