'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { memo, useState, useMemo } from 'react'
import { MessageCircle, BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { InteractiveComponentProps } from './index'
import type { ExplainerContent } from '@/types'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export const Explainer = memo(function Explainer({ onInteraction, content, id, isLoading = false }: InteractiveComponentProps) {
  const explainerContent = content as ExplainerContent
  const [buttonLoadingStates, setButtonLoadingStates] = useState({
    askQuestion: false,
    moreDetail: false,
    nextTopic: false
  })

  // Validate and sanitize content
  const sanitizedContent = useMemo(() => {
    const defaultContent: ExplainerContent & {
      difficulty: 'beginner' | 'intermediate' | 'advanced'
      estimatedReadTime?: number
      overview?: string
      conclusion?: string
    } = {
      title: explainerContent?.title || 'Learning Topic',
      description: explainerContent?.description || '',
      sections: [],
      summary: explainerContent?.summary,
      keywords: explainerContent?.keywords,
      references: explainerContent?.references,
      // Add local fields for UI compatibility
      difficulty: (explainerContent as any)?.difficulty || 'beginner',
      estimatedReadTime: (explainerContent as any)?.estimatedReadTime,
      overview: (explainerContent as any)?.overview,
      conclusion: (explainerContent as any)?.conclusion,
    }
    // Handle sections - convert old format or ensure proper structure
    if (explainerContent?.sections && Array.isArray(explainerContent.sections)) {
      defaultContent.sections = explainerContent.sections.map((section, index) => {
        // Support both new and old formats
        const oldSection = section as any
        return {
          heading: oldSection.heading || oldSection.title || `Section ${index + 1}`,
          paragraphs: oldSection.paragraphs || (oldSection.content ? [oldSection.content] : []),
          image: oldSection.image,
        }
      })
    }
    if (defaultContent.sections.length === 0) {
      defaultContent.sections = [
        {
          heading: `Understanding ${defaultContent.title}`,
          paragraphs: [
            `This topic is an important part of your learning journey.`,
            `Let's explore the key concepts and their practical applications.`
          ]
        }
      ]
    }
    if (explainerContent?.summary) defaultContent.summary = explainerContent.summary
    if (explainerContent?.keywords) defaultContent.keywords = explainerContent.keywords
    if (explainerContent?.references) defaultContent.references = explainerContent.references
    return defaultContent
  }, [explainerContent])

  const handleAskQuestion = async () => {
    setButtonLoadingStates(prev => ({ ...prev, askQuestion: true }))
    try {
      onInteraction('question_requested', {
        componentId: id,
        topic: sanitizedContent.title,
        requestType: 'clarification'
      })
    } finally {
      // Reset loading state after a brief delay to show feedback
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, askQuestion: false }))
      }, 1000)
    }
  }

  const handleMoreDetail = async () => {
    setButtonLoadingStates(prev => ({ ...prev, moreDetail: true }))
    try {
      onInteraction('detail_expanded', {
        componentId: id,
        topic: sanitizedContent.title,
        needsMoreDetail: true
      })
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, moreDetail: false }))
      }, 1000)
    }
  }

  const handleNextTopic = async () => {
    setButtonLoadingStates(prev => ({ ...prev, nextTopic: true }))
    try {
      onInteraction('next_topic_requested', {
        componentId: id,
        currentTopic: sanitizedContent.title,
        difficulty: sanitizedContent.difficulty
      })
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, nextTopic: false }))
      }, 1000)
    }
  }

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.18 }}
    >
      <Card className="w-full mb-6" role="article" aria-label={`Explainer: ${sanitizedContent.title}`} tabIndex={0}>
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
          {sanitizedContent.description && (
            <p className="text-gray-700 text-base mt-1">{sanitizedContent.description}</p>
          )}
          {sanitizedContent.keywords && sanitizedContent.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {sanitizedContent.keywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
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
                  <AccordionTrigger className="text-lg font-bold text-gray-900 hover:no-underline hover:text-indigo-600 transition-colors py-4">
                    {section?.heading || 'Section'}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-5">
                    {section?.image && (
                      <div className="flex flex-col items-center mb-3">
                        <img src={section.image.url} alt={section.image.alt} className="rounded shadow max-h-64 object-contain" />
                        {section.image.caption && (
                          <span className="text-xs text-gray-500 mt-1">{section.image.caption}</span>
                        )}
                      </div>
                    )}
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

          {/* Summary */}
          {sanitizedContent.summary && (
            <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200">
              <h4 className="text-base font-bold text-indigo-900 mb-3 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Summary:
              </h4>
              <p className="text-indigo-800 text-base leading-relaxed">{sanitizedContent.summary}</p>
            </div>
          )}

          {/* References */}
          {sanitizedContent.references && sanitizedContent.references.length > 0 && (
            <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 mt-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-2">References</h5>
              <ul className="list-disc list-inside space-y-1">
                {sanitizedContent.references.map((ref, i) => (
                  <li key={i}>
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{ref.title}</a>
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
              className="flex items-center justify-center text-sm font-medium h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Ask a question about this topic"
              disabled={buttonLoadingStates.askQuestion || isLoading}
            >
              {buttonLoadingStates.askQuestion ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4 mr-2" />
              )}
              {buttonLoadingStates.askQuestion ? 'Loading...' : 'Ask a Question'}
            </Button>
            <Button 
              onClick={handleMoreDetail} 
              variant="outline" 
              size="default"
              className="flex items-center justify-center text-sm font-medium h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Request more detail"
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
              className="flex items-center justify-center bg-green-700 hover:bg-green-800 text-sm font-medium h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              aria-label="Next topic"
              disabled={buttonLoadingStates.nextTopic || isLoading}
            >
              {buttonLoadingStates.nextTopic ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4 mr-2" />
              )}
              {buttonLoadingStates.nextTopic ? 'Loading...' : 'Next Topic'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
