import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Star, StarHalf } from 'lucide-react'
import { motion } from 'framer-motion'
import { AnalyticsService } from '@/lib/analyticsService'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FeedbackFormProps {
  userId: string
  onClose: () => void
}

interface Feedback {
  clarity: number
  engagement: number
  learningOutcome: number
  comments: string
}

export function FeedbackForm({ userId, onClose }: FeedbackFormProps) {
  const analyticsService = AnalyticsService.getInstance()
  const [feedback, setFeedback] = useState<Feedback>({
    clarity: 3,
    engagement: 3,
    learningOutcome: 3,
    comments: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Track feedback in analytics
      analyticsService.trackUserFeedback(
        userId,
        feedback.clarity,
        feedback.engagement,
        feedback.learningOutcome,
        feedback.comments
      )

      // Close the form
      onClose()
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Provide Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Clarity</Label>
                  <RadioGroup
                    value={feedback.clarity.toString()}
                    onValueChange={(value: string) => setFeedback({ ...feedback, clarity: parseInt(value) })}
                    className="flex gap-4 mt-2"
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2">
                        <RadioGroupItem value={rating.toString()} id={`clarity-${rating}`} />
                        <Label htmlFor={`clarity-${rating}`}>{rating}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label>Engagement</Label>
                  <RadioGroup
                    value={feedback.engagement.toString()}
                    onValueChange={(value: string) => setFeedback({ ...feedback, engagement: parseInt(value) })}
                    className="flex gap-4 mt-2"
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2">
                        <RadioGroupItem value={rating.toString()} id={`engagement-${rating}`} />
                        <Label htmlFor={`engagement-${rating}`}>{rating}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label>Learning Outcome</Label>
                  <RadioGroup
                    value={feedback.learningOutcome.toString()}
                    onValueChange={(value: string) => setFeedback({ ...feedback, learningOutcome: parseInt(value) })}
                    className="flex gap-4 mt-2"
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2">
                        <RadioGroupItem value={rating.toString()} id={`outcome-${rating}`} />
                        <Label htmlFor={`outcome-${rating}`}>{rating}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="comments">Additional Comments</Label>
                  <Textarea
                    id="comments"
                    value={feedback.comments}
                    onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
                    className="mt-2"
                    placeholder="Share your thoughts about the lesson..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
} 