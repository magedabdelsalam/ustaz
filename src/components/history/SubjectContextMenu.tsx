import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2 } from 'lucide-react'
import { Subject } from '@/types'

interface SubjectContextMenuProps {
  subject: Subject
  onDelete: (subject: Subject) => void
  children: React.ReactNode
}

export function SubjectContextMenu({ subject, onDelete, children }: SubjectContextMenuProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Open context menu on Shift + F10 or Context Menu key
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault()
      const trigger = e.currentTarget as HTMLElement
      trigger.click()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        asChild 
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(subject)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onDelete(subject)
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Subject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 