'use client'

import React from 'react'
import { memo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsTrigger } from '@/components/ui/tabs'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Subject } from '@/types'
import { isRecentlyActive } from '@/lib/userUtils'

interface SubjectItemProps {
  subject: Subject
  isDeleting: boolean
  onSelect: (subjectId: string) => void
  onDelete?: (subject: Subject) => void
}

export const SubjectItem = memo(function SubjectItem({
  subject,
  isDeleting,
  onSelect,
  onDelete
}: SubjectItemProps) {
  const handleSelect = useCallback(() => onSelect(subject.id), [onSelect, subject.id])

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete?.(subject)
    },
    [onDelete, subject]
  )

  return (
    <div className="relative w-full group">
      <TabsTrigger
        value={subject.id}
        disabled={isDeleting}
        onClick={handleSelect}
        className={cn(
          'w-full justify-start px-4 py-3 h-auto',
          'data-[state=active]:bg-accent data-[state=active]:text-accent-foreground',
          'hover:bg-muted/50 transition-colors',
          isDeleting && 'opacity-50'
        )}
      >
        <div className="flex items-center space-x-3 w-full">
          <div
            className={cn(
              'w-3 h-3 rounded-full flex-shrink-0',
              subject.color,
              subject.isActive && 'ring-2 ring-ring ring-offset-1'
            )}
          />
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className="text-sm font-medium truncate capitalize">{subject.name}</span>
                {isRecentlyActive(subject.lastActive) && (
                  <div
                    className="w-2 h-2 bg-primary rounded-full flex-shrink-0"
                    title="Recently active (last 24 hours)"
                  />
                )}
              </div>
              <Badge
                variant={subject.progress === 100 ? 'default' : 'secondary'}
                className="ml-2 flex-shrink-0"
              >
                {subject.progress}%
              </Badge>
            </div>
            {subject.completedAt && (
              <span className="text-xs text-muted-foreground">
                Completed {subject.completedAt.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </TabsTrigger>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          )}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
})
