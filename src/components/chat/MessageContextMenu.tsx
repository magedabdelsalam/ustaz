import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2, RotateCcw } from 'lucide-react'
import { Message } from '@/types'

interface MessageContextMenuProps {
  message: Message
  onDelete?: (messageId: string) => void
  onRetry?: (messageId: string) => void
  children: React.ReactNode
}

export function MessageContextMenu({ message, onDelete, onRetry, children }: MessageContextMenuProps) {
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
        {onRetry && message.role === 'assistant' && (
          <DropdownMenuItem
            onClick={() => onRetry(message.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onRetry(message.id)
              }
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(message.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onDelete(message.id)
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 