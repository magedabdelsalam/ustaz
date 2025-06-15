'use client'

/**
 * useAuth
 * ----------------
 * TODO: Add description and exports for useAuth.
 */


import { useSyncExternalStore, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// External store for auth state - eliminates useEffect
class AuthStore {
  private user: User | null = null
  private loading = true
  private listeners = new Set<() => void>()
  private cachedSnapshot: { user: User | null; loading: boolean } | null = null
  private serverSnapshot = { user: null as User | null, loading: true }

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      this.user = session?.user ?? null
      this.loading = false
      this.invalidateCache()
      this.notifyListeners()

      // Single auth listener for entire app
      supabase.auth.onAuthStateChange((event, session) => {
        this.user = session?.user ?? null
        this.loading = false
        this.invalidateCache()
        this.notifyListeners()
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      this.loading = false
      this.invalidateCache()
      this.notifyListeners()
    }
  }

  private invalidateCache() {
    this.cachedSnapshot = null
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }

  subscribe = (callback: () => void) => {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  getSnapshot = () => {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        user: this.user,
        loading: this.loading
      }
    }
    return this.cachedSnapshot
  }

  // Server snapshot should be stable
  getServerSnapshot = () => this.serverSnapshot
}

const authStore = new AuthStore()

export function useAuth() {
  const { user, loading } = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { user, loading, signOut }
} 