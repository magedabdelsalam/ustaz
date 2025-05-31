'use client'

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
          'w-full justify-start px-4 py-3 h-auto data-[state=active]:border-2 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/50',
          'hover:bg-gray-100 transition-colors border-2 border-transparent',
          isDeleting && 'opacity-50'
        )}
      >
        <div className="flex items-center space-x-3 w-full">
          <div
            className={cn(
              'w-3 h-3 rounded-full flex-shrink-0',
              subject.color,
              subject.isActive && 'ring-2 ring-blue-500 ring-offset-1'
            )}
          />
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className="text-sm font-medium truncate capitalize">{subject.name}</span>
                {isRecentlyActive(subject.lastActive) && (
                  <div
                    className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"
                    title="Recently active (last 24 hours)"
                  />
                )}
              </div>
              <Badge
                variant={subject.progress === 100 ? 'default' : 'secondary'}
                className={cn(
                  'text-xs font-medium ml-2 flex-shrink-0',
                  subject.progress === 100
                    ? 'bg-green-100 text-green-800 hover:bg-green-100'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                )}
              >
                {subject.progress}%
              </Badge>
            </div>
            {subject.completedAt && (
              <span className="text-xs text-gray-500">
                Completed {subject.completedAt.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </TabsTrigger>
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50 z-10"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
})
