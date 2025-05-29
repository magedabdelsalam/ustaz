'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { memo, useState, useMemo } from 'react'
import { FileText, MessageCircle, BookOpen, ArrowRight, Eye, Loader2 } from 'lucide-react'
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

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // Priority 1: Use provided title if it's meaningful (not generic)
    if (sanitizedContent.title && 
        sanitizedContent.title.trim().length > 3 &&
        !['content', 'lesson', 'topic', 'explanation', 'overview'].some(generic => 
          sanitizedContent.title.toLowerCase().includes(generic))) {
      return sanitizedContent.title
    }

    // Priority 2: Extract key topic from first section heading
    if (sanitizedContent.sections.length > 0) {
      const firstHeading = sanitizedContent.sections[0].heading
      const meaningfulWords = firstHeading.split(' ')
        .filter(word => {
          const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
          return cleanWord.length > 3 && 
                 !['what', 'how', 'why', 'when', 'where', 'introduction', 'overview', 'explanation', 'the', 'a', 'an', 'is', 'are', 'was', 'were'].includes(cleanWord)
        })
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0)

      if (meaningfulWords.length > 0) {
        const keyTopic = meaningfulWords[0]
        return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Explanation`
      }
    }

    // Priority 3: Extract from overview content
    if (sanitizedContent.overview) {
      const overviewWords = sanitizedContent.overview.split(' ')
        .filter(word => {
          const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
          return cleanWord.length > 4 && 
                 !['this', 'that', 'these', 'those', 'will', 'learn', 'about', 'understanding', 'explanation', 'overview'].includes(cleanWord)
        })
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0)

      if (overviewWords.length > 0) {
        const keyTopic = overviewWords[0]
        return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Guide`
      }
    }

    // Priority 4: Extract from conclusion
    if (sanitizedContent.conclusion) {
      const conclusionWords = sanitizedContent.conclusion.split(' ')
        .filter(word => {
          const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
          return cleanWord.length > 4 && 
                 !['conclusion', 'summary', 'therefore', 'finally', 'overall'].includes(cleanWord)
        })
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0)

      if (conclusionWords.length > 0) {
        const keyTopic = conclusionWords[0]
        return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Summary`
      }
    }

    // Final fallback based on difficulty
    switch (sanitizedContent.difficulty) {
      case 'beginner':
        return 'Basic Topic Explanation'
      case 'intermediate':
        return 'Intermediate Topic Guide'
      case 'advanced':
        return 'Advanced Topic Analysis'
      default:
        return sanitizedContent.title || 'Topic Explanation'
    }
  }

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
      onInteraction('ready_for_next', {
        componentId: id,
        topic: sanitizedContent.title,
        action: 'continue'
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
    if (sanitizedContent.estimatedReadTime) {
      return sanitizedContent.estimatedReadTime
    }
    
    // Calculate based on content length (average 200 words per minute)
    // Add null/undefined checks to prevent split errors
    const overviewWords = sanitizedContent.overview ? sanitizedContent.overview.split(' ').length : 0
    const sectionsWords = sanitizedContent.sections ? sanitizedContent.sections.reduce((acc, section) => {
      if (!section || !section.paragraphs || !Array.isArray(section.paragraphs)) {
        return acc
      }
      return acc + section.paragraphs
        .filter(paragraph => paragraph && typeof paragraph === 'string')
        .join(' ')
        .split(' ')
        .length
    }, 0) : 0
    const conclusionWords = sanitizedContent.conclusion ? sanitizedContent.conclusion.split(' ').length : 0
    
    const totalWords = overviewWords + sectionsWords + conclusionWords
    
    return Math.max(1, Math.ceil(totalWords / 200))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            <CardTitle className="text-xl font-bold text-gray-900">{generateMeaningfulTitle()}</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              {estimateReadTime()} min read
            </Badge>
            <Badge className={getDifficultyColor(sanitizedContent.difficulty)}>
              <span className="text-xs font-semibold capitalize tracking-wide">{sanitizedContent.difficulty}</span>
            </Badge>
          </div>
        </div>
        <p className="text-gray-700 text-base leading-relaxed mt-2">{sanitizedContent.overview || 'No overview available'}</p>
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
