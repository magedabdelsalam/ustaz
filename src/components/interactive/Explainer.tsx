'use client'

import React, { memo, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { MessageCircle, BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { InteractiveComponentProps } from './index'
import type { ExplainerContent } from '@/types'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from "@/lib/utils"

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
      difficulty: (explainerContent as any)?.difficulty || 'beginner',
      estimatedReadTime: (explainerContent as any)?.estimatedReadTime,
      overview: (explainerContent as any)?.overview,
      conclusion: (explainerContent as any)?.conclusion,
    }

    if (explainerContent?.sections && Array.isArray(explainerContent.sections)) {
      defaultContent.sections = explainerContent.sections.map((section, index) => {
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

  const getDifficultyVariant = (difficulty: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (difficulty) {
      case 'beginner': return 'secondary'
      case 'intermediate': return 'outline'
      case 'advanced': return 'destructive'
      default: return 'default'
    }
  }

  const estimateReadTime = (): number => {
    const overview = sanitizedContent.overview || ''
    const paragraphs = sanitizedContent.sections.flatMap(s => s.paragraphs || []).join(' ')
    const conclusion = sanitizedContent.conclusion || ''
    
    const totalContent = `${overview} ${paragraphs} ${conclusion}`
    const wordCount = totalContent.split(/\s+/).length
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))
    
    return sanitizedContent.estimatedReadTime || readTimeMinutes
  }

  const readTime = estimateReadTime()

  if (isLoading) {
    return (
      <Card className="w-full mb-6">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

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
              <BookOpen className="h-6 w-6 text-primary mr-2" />
              <CardTitle className="text-xl font-bold">
                {sanitizedContent.title}
              </CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getDifficultyVariant(sanitizedContent.difficulty)}>
                <span className="capitalize tracking-wide">{sanitizedContent.difficulty}</span>
              </Badge>
              <Badge variant="outline" className="text-xs font-medium">
                {readTime} min read
              </Badge>
            </div>
          </div>
          {sanitizedContent.description && (
            <p className="text-muted-foreground text-base mt-1">{sanitizedContent.description}</p>
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
          {sanitizedContent.sections && Array.isArray(sanitizedContent.sections) && sanitizedContent.sections.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-2">
              {sanitizedContent.sections.map((section, sectionIndex) => (
                <AccordionItem 
                  key={sectionIndex} 
                  value={`section-${sectionIndex}`}
                  className="px-0"
                >
                  <AccordionTrigger className="text-lg font-bold hover:no-underline hover:text-primary transition-colors py-4">
                    {section?.heading || 'Section'}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-5">
                    <Card className="bg-muted/50">
                      <CardContent className="px-5">
                        {section?.image && (
                          <div className="flex flex-col items-center mb-3">
                            <img 
                              src={section.image.url} 
                              alt={section.image.alt} 
                              className="rounded shadow max-h-64 object-contain" 
                            />
                            {section.image.caption && (
                              <span className="text-xs text-muted-foreground mt-1">{section.image.caption}</span>
                            )}
                          </div>
                        )}
                        {section?.paragraphs && Array.isArray(section.paragraphs) ? section.paragraphs
                          .filter(paragraph => paragraph && typeof paragraph === 'string')
                          .map((paragraph, paragraphIndex) => (
                            <p 
                              key={paragraphIndex} 
                              className="text-foreground text-base leading-relaxed"
                            >
                              {paragraph}
                            </p>
                          )) : null}
                      </CardContent>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}

          <div className="flex flex-wrap gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAskQuestion}
              disabled={buttonLoadingStates.askQuestion}
              className="flex items-center gap-2"
            >
              {buttonLoadingStates.askQuestion ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Ask a Question
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMoreDetail}
              disabled={buttonLoadingStates.moreDetail}
              className="flex items-center gap-2"
            >
              {buttonLoadingStates.moreDetail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              More Details
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleNextTopic}
              disabled={buttonLoadingStates.nextTopic}
              className="flex items-center gap-2"
            >
              {buttonLoadingStates.nextTopic ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Next Topic
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
