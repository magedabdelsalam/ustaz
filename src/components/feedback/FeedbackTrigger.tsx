import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { FeedbackForm } from './FeedbackForm'
import { useToast } from '@/components/ui/use-toast'

interface FeedbackTriggerProps {
  lessonId?: string
  subjectId?: string
  triggerAfter?: number // Time in milliseconds after which to show feedback
  onFeedbackSubmitted?: () => void
}

export function FeedbackTrigger({
  lessonId,
  subjectId,
  triggerAfter = 300000, // 5 minutes default
  onFeedbackSubmitted
}: FeedbackTriggerProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [hasShownFeedback, setHasShownFeedback] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!hasShownFeedback && triggerAfter > 0) {
      const timer = setTimeout(() => {
        setShowFeedback(true)
        setHasShownFeedback(true)
      }, triggerAfter)

      return () => clearTimeout(timer)
    }
  }, [triggerAfter, hasShownFeedback])

  const handleFeedbackSubmitted = () => {
    setShowFeedback(false)
    toast.success('Thank you for your feedback!')
    onFeedbackSubmitted?.()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFeedback(true)}
        className="flex items-center gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        <span>Give Feedback</span>
      </Button>

      {showFeedback && (
        <FeedbackForm
          onClose={handleFeedbackSubmitted}
          lessonId={lessonId}
          subjectId={subjectId}
        />
      )}
    </>
  )
} 