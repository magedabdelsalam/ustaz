import { StreamItem, StreamInteractiveContent } from '@/types'

export interface ComponentUsageMetrics {
  totalInteractions: number
  componentTypeCounts: Record<string, number>
  successRates: Record<string, number>
  averageEngagementTime: number
  lastInteraction: Date
}

export interface UserFeedbackMetrics {
  clarity: number
  engagement: number
  learningOutcome: number
  comments: string[]
  timestamp: Date
}

export interface TestingMetrics {
  testId: string
  userId: string
  testType: 'usability' | 'learning' | 'performance'
  startTime: Date
  endTime: Date
  successRate: number
  completionTime: number
  issues: string[]
  suggestions: string[]
}

export interface IterationInsights {
  componentUsageRate: number
  averageFeedbackScores: {
    clarity: number
    engagement: number
    learningOutcome: number
  }
  commonIssues: string[]
  topSuggestions: string[]
  performanceMetrics: {
    averageCompletionTime: number
    successRate: number
  }
}

export class AnalyticsService {
  private static instance: AnalyticsService
  private componentMetrics: Map<string, ComponentUsageMetrics>
  private feedbackMetrics: Map<string, UserFeedbackMetrics[]>
  private testingMetrics: Map<string, TestingMetrics[]>

  private constructor() {
    this.componentMetrics = new Map()
    this.feedbackMetrics = new Map()
    this.testingMetrics = new Map()
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  public trackInteractiveComponentUsage(
    userId: string,
    componentId: string,
    componentType: string,
    success: boolean,
    engagementTime: number
  ): void {
    const metrics = this.componentMetrics.get(userId) || {
      totalInteractions: 0,
      componentTypeCounts: {},
      successRates: {},
      averageEngagementTime: 0,
      lastInteraction: new Date()
    }

    // Update total interactions
    metrics.totalInteractions++

    // Update component type counts
    metrics.componentTypeCounts[componentType] = (metrics.componentTypeCounts[componentType] || 0) + 1

    // Update success rates
    const currentSuccess = metrics.successRates[componentType] || 0
    const currentCount = metrics.componentTypeCounts[componentType] || 0
    metrics.successRates[componentType] = ((currentSuccess * (currentCount - 1)) + (success ? 1 : 0)) / currentCount

    // Update average engagement time
    metrics.averageEngagementTime = 
      (metrics.averageEngagementTime * (metrics.totalInteractions - 1) + engagementTime) / metrics.totalInteractions

    // Update last interaction
    metrics.lastInteraction = new Date()

    this.componentMetrics.set(userId, metrics)
  }

  public trackUserFeedback(
    userId: string,
    clarity: number,
    engagement: number,
    learningOutcome: number,
    comments: string
  ): void {
    const feedback = this.feedbackMetrics.get(userId) || []
    feedback.push({
      clarity,
      engagement,
      learningOutcome,
      comments: comments ? [comments] : [],
      timestamp: new Date()
    })
    this.feedbackMetrics.set(userId, feedback)
  }

  public trackTestingSession(metrics: TestingMetrics): void {
    const userTests = this.testingMetrics.get(metrics.userId) || []
    userTests.push(metrics)
    this.testingMetrics.set(metrics.userId, userTests)
  }

  public getComponentUsageMetrics(userId: string): ComponentUsageMetrics | undefined {
    return this.componentMetrics.get(userId)
  }

  public getFeedbackMetrics(userId: string): UserFeedbackMetrics[] | undefined {
    return this.feedbackMetrics.get(userId)
  }

  public calculateInteractiveComponentUsageRate(userId: string): number {
    const metrics = this.componentMetrics.get(userId)
    if (!metrics) return 0

    const totalMessages = metrics.totalInteractions
    const interactiveComponents = Object.values(metrics.componentTypeCounts).reduce((a, b) => a + b, 0)
    
    return totalMessages > 0 ? (interactiveComponents / totalMessages) * 100 : 0
  }

  public getSuccessMetrics(userId: string): {
    overallSuccessRate: number
    componentSuccessRates: Record<string, number>
    averageEngagementTime: number
  } {
    const metrics = this.componentMetrics.get(userId)
    if (!metrics) {
      return {
        overallSuccessRate: 0,
        componentSuccessRates: {},
        averageEngagementTime: 0
      }
    }

    const overallSuccessRate = Object.values(metrics.successRates).reduce((a, b) => a + b, 0) / 
      Object.keys(metrics.successRates).length

    return {
      overallSuccessRate,
      componentSuccessRates: metrics.successRates,
      averageEngagementTime: metrics.averageEngagementTime
    }
  }

  public getIterationInsights(userId: string): IterationInsights {
    const componentMetrics = this.componentMetrics.get(userId)
    const feedbackHistory = this.feedbackMetrics.get(userId) || []
    const testHistory = this.testingMetrics.get(userId) || []

    // Calculate average feedback scores
    const averageFeedbackScores = {
      clarity: this.calculateAverage(feedbackHistory.map(f => f.clarity)),
      engagement: this.calculateAverage(feedbackHistory.map(f => f.engagement)),
      learningOutcome: this.calculateAverage(feedbackHistory.map(f => f.learningOutcome))
    }

    // Extract common issues and suggestions
    const allIssues = testHistory.flatMap(t => t.issues)
    const allSuggestions = testHistory.flatMap(t => t.suggestions)
    const commonIssues = this.getMostFrequent(allIssues)
    const topSuggestions = this.getMostFrequent(allSuggestions)

    // Calculate performance metrics
    const performanceMetrics = {
      averageCompletionTime: this.calculateAverage(testHistory.map(t => t.completionTime)),
      successRate: this.calculateAverage(testHistory.map(t => t.successRate))
    }

    return {
      componentUsageRate: componentMetrics ? this.calculateInteractiveComponentUsageRate(userId) : 0,
      averageFeedbackScores,
      commonIssues,
      topSuggestions,
      performanceMetrics
    }
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((a, b) => a + b, 0) / numbers.length
  }

  private getMostFrequent(items: string[]): string[] {
    const frequency = new Map<string, number>()
    items.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1)
    })

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item]) => item)
  }

  public generateImprovementSuggestions(userId: string): string[] {
    const insights = this.getIterationInsights(userId)
    const suggestions: string[] = []

    // Analyze component usage
    if (insights.componentUsageRate < 0.95) {
      suggestions.push('Increase interactive component usage to meet 95% target')
    }

    // Analyze feedback scores
    if (insights.averageFeedbackScores.clarity < 4) {
      suggestions.push('Improve explanation clarity based on user feedback')
    }
    if (insights.averageFeedbackScores.engagement < 4) {
      suggestions.push('Enhance engagement through more interactive elements')
    }
    if (insights.averageFeedbackScores.learningOutcome < 4) {
      suggestions.push('Strengthen learning outcomes with better practice exercises')
    }

    // Address common issues
    insights.commonIssues.forEach(issue => {
      suggestions.push(`Address reported issue: ${issue}`)
    })

    // Consider user suggestions
    insights.topSuggestions.forEach(suggestion => {
      suggestions.push(`Implement user suggestion: ${suggestion}`)
    })

    // Performance improvements
    if (insights.performanceMetrics.successRate < 0.8) {
      suggestions.push('Improve success rate through better guidance and practice')
    }
    if (insights.performanceMetrics.averageCompletionTime > 1800) { // 30 minutes
      suggestions.push('Optimize lesson completion time')
    }

    return suggestions
  }
} 