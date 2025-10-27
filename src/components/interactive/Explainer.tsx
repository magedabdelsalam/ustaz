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
import { ExplainerContent } from '@/types'

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
    const mapped: ExplainerContent = {
      title: explainerContent?.title || 'Untitled',
      description: explainerContent?.description 
        || (explainerContent as unknown as { overview?: string })?.overview,
      sections: Array.isArray(explainerContent?.sections) ? explainerContent.sections : [],
      summary: explainerContent?.summary 
        || (explainerContent as unknown as { conclusion?: string })?.conclusion,
      keywords: explainerContent?.keywords,
      references: explainerContent?.references
    }
    return mapped
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
        currentTopic: sanitizedContent.title
      })
    )



  const estimateReadTime = (): number => {
    // Calculate read time based on content length (200 words per minute average reading speed)
    const description = sanitizedContent.description || ''
    const paragraphs = sanitizedContent.sections.flatMap(s => s.paragraphs || []).join(' ')
    const summary = sanitizedContent.summary || ''
    
    const totalContent = `${description} ${paragraphs} ${summary}`
    const wordCount = totalContent.split(/\s+/).length
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))
    
    return readTimeMinutes
  }

  const readTime = estimateReadTime()

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BookOpen className="h-6 w-6 text-blue-600 mr-2" />
            {sanitizedContent.title && (
              <CardTitle className="text-xl font-bold text-gray-900">
                {sanitizedContent.title}
              </CardTitle>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs font-medium">
              {readTime} min read
            </Badge>
          </div>
        </div>
        {sanitizedContent.description && (
          <p className="text-gray-600 text-base leading-relaxed mt-2">{sanitizedContent.description}</p>
        )}
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
                {section?.heading ? (
                  <AccordionTrigger className="text-lg font-bold text-gray-900 hover:no-underline hover:text-indigo-600 transition-colors py-4">
                    {section.heading}
                  </AccordionTrigger>
                ) : (
                  <div className="py-2" />
                )}
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
                    null
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          null
        )}

        {/* Summary */}
        {sanitizedContent.summary && (
          <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200">
            <p className="text-indigo-800 text-base leading-relaxed">{sanitizedContent.summary}</p>
          </div>
        )}

        {/* References */}
        {sanitizedContent.references && sanitizedContent.references.length > 0 && (
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <ul className="list-disc list-inside space-y-1">
              {sanitizedContent.references.map((ref, idx) => (
                <li key={idx} className="text-sm text-gray-800">
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {ref.title}
                    </a>
                  ) : (
                    <span>{ref.title}</span>
                  )}
                </li>
              ))}
            </ul>
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
