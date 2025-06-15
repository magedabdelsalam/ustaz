'use client'

/**
 * page
 * ----------------
 * TODO: Add description and exports for page.
 */


import { useAuth } from '@/hooks/useAuth'
import { AuthPage } from '@/components/AuthPage'
import { Dashboard } from '@/components/Dashboard'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function Home() {
  const { user, loading } = useAuth()

  // Debug logging
  console.log('🔐 Auth State:', { 
    user: user ? `✅ ${user.email || user.id}` : '❌ No user', 
    loading 
  })

  if (loading) {
    console.log('⏳ Auth loading...')
    return <LoadingSpinner fullScreen text="Loading Ustaz..." />
  }

  if (!user) {
    console.log('🚪 No user - showing AuthPage')
    return <AuthPage />
  }

  console.log('✅ User authenticated - showing Dashboard')
  return <Dashboard />
}
