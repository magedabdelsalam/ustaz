import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AnalyticsService } from '@/lib/analyticsService'
import type { IterationInsights as IterationInsightsType } from '@/lib/analyticsService'
import { Star, Clock, AlertTriangle, Lightbulb } from 'lucide-react'

interface IterationInsightsProps {
  userId: string
}

export function IterationInsights({ userId }: IterationInsightsProps) {
  const analyticsService = AnalyticsService.getInstance()
  const insights = analyticsService.getIterationInsights(userId)
  const suggestions = analyticsService.generateImprovementSuggestions(userId)

  const renderFeedbackScore = (score: number, label: string) => (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= score ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Learning Experience Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Component Usage Rate */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Interactive Component Usage</span>
              <span className="text-sm text-gray-600">
                {Math.round(insights.componentUsageRate)}%
              </span>
            </div>
            <Progress value={insights.componentUsageRate} className="h-2" />
          </div>

          {/* Feedback Scores */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">User Feedback Scores</h4>
            {renderFeedbackScore(insights.averageFeedbackScores.clarity, 'Clarity')}
            {renderFeedbackScore(insights.averageFeedbackScores.engagement, 'Engagement')}
            {renderFeedbackScore(insights.averageFeedbackScores.learningOutcome, 'Learning Outcome')}
          </div>

          {/* Performance Metrics */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Performance Metrics</h4>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Avg. Completion Time: {Math.round(insights.performanceMetrics.averageCompletionTime / 60)} minutes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={insights.performanceMetrics.successRate >= 0.8 ? 'default' : 'destructive'}>
                Success Rate: {Math.round(insights.performanceMetrics.successRate * 100)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Improvement Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Improvement Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Common Issues */}
          {insights.commonIssues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Common Issues
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {insights.commonIssues.map((issue, index) => (
                  <li key={index} className="text-sm text-gray-600">{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* User Suggestions */}
          {insights.topSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                User Suggestions
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {insights.topSuggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-600">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Generated Suggestions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recommended Improvements</h4>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm text-gray-600">{suggestion}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 