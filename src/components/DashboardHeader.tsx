'use client'

import { User } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { GraduationCap, LogOut } from 'lucide-react'

interface DashboardHeaderProps {
  user: User | null
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { signOut } = useAuth()

  const getUserInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase()
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Logo */}
      <div className="flex items-center space-x-2">
        <GraduationCap className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-semibold text-gray-900">AI StudyMate</span>
      </div>

      {/* User Profile */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
              {user?.email ? getUserInitials(user.email) : 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700">
            {user?.email?.split('@')[0] || 'User'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-gray-500 hover:text-gray-700"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
} 