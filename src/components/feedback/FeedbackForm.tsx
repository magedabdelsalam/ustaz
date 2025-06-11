import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Star, StarHalf } from 'lucide-react'
import { motion } from 'framer-motion'
import { AnalyticsService } from '@/lib/analyticsService'

interface FeedbackFormProps {
  onClose: () => void
  lessonId?: string
  subjectId?: string
}

export function FeedbackForm({ onClose, lessonId, subjectId }: FeedbackFormProps) {
  const [clarity, setClarity] = useState(3)
  const [engagement, setEngagement] = useState(3)
  const [learningOutcome, setLearningOutcome] = useState(3)
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const analyticsService = AnalyticsService.getInstance()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Track feedback in analytics
      analyticsService.trackUserFeedback(
        'current-user', // TODO: Get actual user ID
        clarity,
        engagement,
        learningOutcome,
        comments
      )

      // Close the form
      onClose()
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderRatingStars = (value: number, onChange: (value: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1"
            aria-label={`Rate ${star} out of 5`}
          >
            {star <= value ? (
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            ) : star - 0.5 <= value ? (
              <StarHalf className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            ) : (
              <Star className="h-6 w-6 text-gray-300" />
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            How was your learning experience?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Clarity of Explanation</label>
              {renderRatingStars(clarity, setClarity)}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Engagement Level</label>
              {renderRatingStars(engagement, setEngagement)}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Learning Outcome</label>
              {renderRatingStars(learningOutcome, setLearningOutcome)}
            </div>

            <div className="space-y-2">
              <label htmlFor="comments" className="text-sm font-medium">
                Additional Comments
              </label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Share your thoughts about the lesson..."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
} 