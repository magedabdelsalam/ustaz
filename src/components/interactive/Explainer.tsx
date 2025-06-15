'use client'

/**
 * Explainer Interactive Component
 * -------------------------------
 * Rich card for explaining a concept with collapsible sections and interaction
 * buttons.  Exported via the `interactive` components index.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { memo, useState, useMemo } from 'react'
import { MessageCircle, BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { InteractiveComponentProps } from './index'

interface ExplainerContent {
  title: string
  overview: string
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>
  conclusion?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedReadTime?: number
}

export const Explainer = memo(function Explainer({ onInteraction, content, id, isLoading = false }: InteractiveComponentProps) {
  const explainerContent = content as ExplainerContent
  const [buttonLoadingStates, setButtonLoadingStates] = useState({
    askQuestion: false,
    moreDetail: false,
    nextTopic: false
  })

  // Utility to run an interaction while toggling a loading flag
  const runWithLoading = async (
    key: keyof typeof buttonLoadingStates,
    fn: () => Promise<void> | void
  ) => {
    setButtonLoadingStates(prev => ({ ...prev, [key]: true }))
    try {
      await fn()
    } finally {
      // Brief delay so users notice the state change
      setTimeout(
        () => setButtonLoadingStates(prev => ({ ...prev, [key]: false })),
        1000
      )
    }
  }

  // Validate and sanitize content
  const sanitizedContent = useMemo(() => {
    const defaultContent: ExplainerContent = {
      title: explainerContent?.title || 'Learning Topic',
      overview: explainerContent?.overview || 'Exploring this important concept in detail.',
      sections: [],
      conclusion: explainerContent?.conclusion,
      difficulty: explainerContent?.difficulty || 'beginner',
      estimatedReadTime: explainerContent?.estimatedReadTime
    }

    // Handle sections - convert old format or ensure proper structure
    if (explainerContent?.sections && Array.isArray(explainerContent.sections)) {
      defaultContent.sections = explainerContent.sections.map((section, index) => {
        // Handle old format where section has "title" and "content"
        if (section && typeof section === 'object') {
          const oldSection = section as { title?: string; content?: string; heading?: string; paragraphs?: string[] }
          
          if (oldSection.heading && oldSection.paragraphs && Array.isArray(oldSection.paragraphs)) {
            // New format - use as is
            return {
              heading: oldSection.heading,
              paragraphs: oldSection.paragraphs.filter(p => p && typeof p === 'string')
            }
          } else if (oldSection.title || oldSection.content) {
            // Old format - convert
            return {
              heading: oldSection.title || `Section ${index + 1}`,
              paragraphs: oldSection.content ? [oldSection.content] : [`Content for section ${index + 1}`]
            }
          }
        }
        
        // Fallback for invalid sections
        return {
          heading: `Section ${index + 1}`,
          paragraphs: [`This section covers important aspects of ${defaultContent.title}.`]
        }
      })
    }

    // If no valid sections, create default ones
    if (defaultContent.sections.length === 0) {
      defaultContent.sections = [
        {
          heading: `Understanding ${defaultContent.title}`,
          paragraphs: [
            `This topic is an important part of your learning journey.`,
            `Let's explore the key concepts and their practical applications.`
          ]
        },
        {
          heading: 'Key Points',
          paragraphs: [
            `There are several important aspects to understand about this topic.`,
            `Each point builds on the previous one to create a complete picture.`
          ]
        }
      ]
    }

    return defaultContent
  }, [explainerContent])

  const handleAskQuestion = async () =>
    runWithLoading('askQuestion', () =>
      onInteraction('question_requested', {
        componentId: id,
        topic: sanitizedContent.title,
        requestType: 'clarification'
      })
    )

  const handleMoreDetail = async () =>
    runWithLoading('moreDetail', () =>
      onInteraction('detail_expanded', {
        componentId: id,
        topic: sanitizedContent.title,
        needsMoreDetail: true
      })
    )

  const handleNextTopic = async () =>
    runWithLoading('nextTopic', () =>
      onInteraction('next_topic_requested', {
        componentId: id,
        currentTopic: sanitizedContent.title,
        difficulty: sanitizedContent.difficulty
      })
    )

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const estimateReadTime = (): number => {
    // Calculate read time based on content length (200 words per minute average reading speed)
    const overview = sanitizedContent.overview || ''
    const paragraphs = sanitizedContent.sections.flatMap(s => s.paragraphs || []).join(' ')
    const conclusion = sanitizedContent.conclusion || ''
    
    const totalContent = `${overview} ${paragraphs} ${conclusion}`
    const wordCount = totalContent.split(/\s+/).length
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))
    
    return sanitizedContent.estimatedReadTime || readTimeMinutes
  }

  const readTime = estimateReadTime()

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BookOpen className="h-6 w-6 text-blue-600 mr-2" />
            <CardTitle className="text-xl font-bold text-gray-900">
              {sanitizedContent.title}
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getDifficultyColor(sanitizedContent.difficulty)}>
              <span className="text-xs font-semibold capitalize tracking-wide">{sanitizedContent.difficulty}</span>
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {readTime} min read
            </Badge>
          </div>
        </div>
        <p className="text-gray-600 text-base leading-relaxed mt-2">{sanitizedContent.overview}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Content Sections - Now collapsible using ShadCN Accordion */}
        {sanitizedContent.sections && Array.isArray(sanitizedContent.sections) && sanitizedContent.sections.length > 0 ? (
          <Accordion type="multiple" className="w-full space-y-2">
            {sanitizedContent.sections.map((section, sectionIndex) => (
              <AccordionItem 
                key={sectionIndex} 
                value={`section-${sectionIndex}`}
                className="bg-gray-50 rounded-lg border border-gray-200 px-5"
              >
                <AccordionTrigger className="text-lg font-bold text-gray-900 hover:no-underline hover:text-indigo-600 transition-colors py-4">
                  {section?.heading || 'Section'}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-5">
                  {section?.paragraphs && Array.isArray(section.paragraphs) ? section.paragraphs
                    .filter(paragraph => paragraph && typeof paragraph === 'string')
                    .map((paragraph, paragraphIndex) => (
                    <p 
                      key={paragraphIndex} 
                      className="text-gray-800 text-base leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  )) : (
                    <p className="text-gray-600 italic">No content available for this section</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <p className="text-gray-600 italic">No sections available</p>
          </div>
        )}

        {/* Conclusion */}
        {sanitizedContent.conclusion && (
          <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200">
            <h4 className="text-base font-bold text-indigo-900 mb-3 flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Summary:
            </h4>
            <p className="text-indigo-800 text-base leading-relaxed">{sanitizedContent.conclusion}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          <Button 
            onClick={handleAskQuestion} 
            variant="outline" 
            size="default" 
            className="flex items-center justify-center text-sm font-medium h-11"
            disabled={buttonLoadingStates.askQuestion || isLoading}
          >
            {buttonLoadingStates.askQuestion ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4 mr-2" />
            )}
            {buttonLoadingStates.askQuestion ? 'Processing...' : 'Ask Question'}
          </Button>
          <Button 
            onClick={handleMoreDetail} 
            variant="outline" 
            size="default"
            className="flex items-center justify-center text-sm font-medium h-11"
            disabled={buttonLoadingStates.moreDetail || isLoading}
          >
            {buttonLoadingStates.moreDetail ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4 mr-2" />
            )}
            {buttonLoadingStates.moreDetail ? 'Loading...' : 'More Detail'}
          </Button>
          <Button 
            onClick={handleNextTopic} 
            size="default" 
            className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-sm font-medium h-11"
            disabled={buttonLoadingStates.nextTopic || isLoading}
          >
            {buttonLoadingStates.nextTopic ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            {buttonLoadingStates.nextTopic ? 'Processing...' : 'Continue'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
