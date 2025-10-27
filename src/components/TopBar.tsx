'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import { Plus, ChevronDown, BookOpen } from 'lucide-react'
import { Subject } from '@/types'
import { getUserInitials } from '@/lib/userUtils'
import { User } from '@supabase/supabase-js'

interface TopBarProps {
  user: User | null
  subjects: Subject[]
  currentSubject: Subject | null
  onSubjectSelect: (subject: Subject) => void
  onNewSubject: () => void
}

export function TopBar({ 
  user, 
  subjects, 
  currentSubject, 
  onSubjectSelect,
  onNewSubject 
}: TopBarProps) {
  return (
    <div className="bg-white/50 backdrop-blur-sm border border-black/10 rounded-2xl p-4 flex items-center gap-4 w-full max-w-[560px] mx-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <svg width="99" height="32" viewBox="0 0 99 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text 
            x="0" 
            y="24" 
            className="font-semibold text-lg" 
            fill="black"
          >
            USTAZ
          </text>
        </svg>
      </div>

      {/* User Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gray-300 text-gray-700 text-xs">
          {user?.email ? getUserInitials(user.email) : 'U'}
        </AvatarFallback>
      </Avatar>

      {/* Subject Selector */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {currentSubject ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded bg-white hover:bg-white/90 transition-colors">
                <span className="text-base font-bold truncate max-w-[200px]">
                  {currentSubject.name}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[250px]">
              {subjects.map((subject) => (
                <DropdownMenuItem
                  key={subject.id}
                  onClick={() => onSubjectSelect(subject)}
                  className={currentSubject.id === subject.id ? 'bg-blue-50' : ''}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">{subject.name}</span>
                  {currentSubject.id === subject.id && (
                    <Badge variant="secondary" className="ml-2 text-xs">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
              {subjects.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={onNewSubject} className="text-blue-600">
                <Plus className="h-4 w-4 mr-2" />
                <span>New Subject</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="text-sm text-gray-500">
            Start chatting to create a subject
          </div>
        )}
      </div>

      {/* New Subject Button */}
      <Button
        onClick={onNewSubject}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 h-8 gap-2 shrink-0"
        size="sm"
      >
        <Plus className="h-4 w-4" />
        <span className="text-base">New subject</span>
      </Button>
    </div>
  )
}

