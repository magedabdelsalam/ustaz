import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AnalyticsService } from '@/lib/analyticsService'
import type { IterationInsights as IterationInsightsType } from '@/lib/analyticsService'
import { Star, Clock, AlertTriangle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IterationInsightsProps {
  userId: string
}

export function IterationInsights({ userId }: IterationInsightsProps) {
  const analyticsService = AnalyticsService.getInstance()
  const insights = analyticsService.getIterationInsights(userId)
  const suggestions = analyticsService.generateImprovementSuggestions(userId)

  const renderScore = (score: number, label: string) => (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < score ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"
            )}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )

  return (
    <div className={cn('space-y-6')}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Learning Experience Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Interactive Component Usage */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Interactive Component Usage</span>
              <span className="text-sm text-muted-foreground">
                {insights.componentUsageRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={insights.componentUsageRate} className="h-2" />
          </div>

          {/* User Feedback Scores */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">User Feedback Scores</h4>
            {renderScore(insights.averageFeedbackScores.clarity, 'Clarity')}
            {renderScore(insights.averageFeedbackScores.engagement, 'Engagement')}
            {renderScore(insights.averageFeedbackScores.learningOutcome, 'Learning Outcome')}
          </div>

          {/* Performance Metrics */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Performance Metrics</h4>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Avg. Completion Time: {insights.performanceMetrics.averageCompletionTime.toFixed(0)}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Success Rate: {(insights.performanceMetrics.successRate * 100).toFixed(1)}%
              </span>
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
                  <li key={index} className="text-sm text-muted-foreground">{issue}</li>
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
                  <li key={index} className="text-sm text-muted-foreground">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Improvements */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recommended Improvements</h4>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm text-muted-foreground">{suggestion}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 