import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FeedbackForm } from './FeedbackForm'
import { useToast } from '@/components/ui/use-toast'

interface FeedbackTriggerProps {
  userId: string
  triggerAfter?: number // Time in milliseconds after which to show feedback
  onFeedbackSubmitted?: () => void
  onClick?: () => void
  className?: string
}

export function FeedbackTrigger({
  userId,
  triggerAfter = 300000, // 5 minutes default
  onFeedbackSubmitted,
  onClick,
  className
}: FeedbackTriggerProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const { toast } = useToast()

  const handleClose = () => {
    setShowFeedback(false)
    toast.success('Thank you for your feedback! Your input helps us improve the learning experience.')
    onFeedbackSubmitted?.()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick || (() => setShowFeedback(true))}
        className={cn('flex items-center gap-2', className)}
      >
        <MessageSquare className="h-4 w-4" />
        <span>Feedback</span>
      </Button>

      {showFeedback && (
        <FeedbackForm
          userId={userId}
          onClose={handleClose}
        />
      )}
    </>
  )
} 