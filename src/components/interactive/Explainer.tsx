'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { memo, useState } from 'react'
import { FileText, MessageCircle, BookOpen, ArrowRight, ChevronDown, Eye, Loader2 } from 'lucide-react'
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

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // Priority 1: Use title if it's specific and meaningful
    if (explainerContent.title && 
        explainerContent.title !== 'Explanation' && 
        explainerContent.title !== 'Learn about' &&
        !explainerContent.title.includes('Introduction to') &&
        !explainerContent.title.includes('Overview of')) {
      return explainerContent.title
    }

    // Priority 2: Check for specific educational keywords and create contextual titles
    const overviewLower = explainerContent.overview.toLowerCase()
    const allSectionsText = explainerContent.sections
      .map(section => `${section.heading} ${section.paragraphs.join(' ')}`)
      .join(' ')
      .toLowerCase()
    const allText = `${overviewLower} ${allSectionsText}`
    
    const topicKeywords = [
      { words: ['photosynthesis', 'chlorophyll', 'plant'], title: 'Plant Biology Explanation' },
      { words: ['equation', 'algebra', 'solve', 'variable'], title: 'Algebra Explanation' },
      { words: ['shakespeare', 'hamlet', 'literature', 'author'], title: 'Literature Analysis' },
      { words: ['world war', 'napoleon', 'revolution', 'treaty'], title: 'Historical Overview' },
      { words: ['atom', 'molecule', 'chemical', 'element'], title: 'Chemistry Explanation' },
      { words: ['cell', 'dna', 'biology', 'organism'], title: 'Biology Explanation' },
      { words: ['gravity', 'force', 'physics', 'motion'], title: 'Physics Explanation' },
      { words: ['geography', 'continent', 'country', 'capital'], title: 'Geography Overview' },
      { words: ['grammar', 'verb', 'noun', 'sentence'], title: 'Language Arts Guide' },
      { words: ['programming', 'code', 'algorithm', 'computer'], title: 'Computer Science Guide' },
      { words: ['economy', 'economics', 'market', 'finance'], title: 'Economics Explanation' },
      { words: ['democracy', 'government', 'politics', 'law'], title: 'Civics Overview' }
    ]

    for (const topic of topicKeywords) {
      if (topic.words.some(keyword => allText.includes(keyword))) {
        return topic.title
      }
    }

    // Priority 3: Subject-specific patterns based on content
    if (allText.includes('math') || allText.includes('calculation') || allText.includes('solve') || /\d+/.test(allText)) {
      return 'Math Explanation'
    }
    if (allText.includes('science') || allText.includes('experiment') || allText.includes('hypothesis')) {
      return 'Science Overview'
    }
    if (allText.includes('history') || allText.includes('historical') || allText.includes('century')) {
      return 'Historical Overview'
    }
    if (allText.includes('language') || allText.includes('grammar') || allText.includes('writing')) {
      return 'Language Guide'
    }

    // Priority 4: Extract key topic from first section heading
    if (explainerContent.sections.length > 0) {
      const firstHeading = explainerContent.sections[0].heading
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

    // Priority 5: Default fallback based on difficulty
    switch (explainerContent.difficulty) {
      case 'beginner':
        return 'Basic Topic Explanation'
      case 'intermediate':
        return 'Intermediate Topic Guide'
      case 'advanced':
        return 'Advanced Topic Analysis'
      default:
        return explainerContent.title || 'Topic Explanation'
    }
  }

  const handleAskQuestion = async () => {
    setButtonLoadingStates(prev => ({ ...prev, askQuestion: true }))
    try {
      onInteraction('question_requested', {
        componentId: id,
        topic: explainerContent.title,
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
        topic: explainerContent.title,
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
        topic: explainerContent.title,
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
    if (explainerContent.estimatedReadTime) {
      return explainerContent.estimatedReadTime
    }
    
    // Calculate based on content length (average 200 words per minute)
    const totalWords = explainerContent.overview.split(' ').length +
      explainerContent.sections.reduce((acc, section) => 
        acc + section.paragraphs.join(' ').split(' ').length, 0) +
      (explainerContent.conclusion?.split(' ').length || 0)
    
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
            <Badge className={getDifficultyColor(explainerContent.difficulty)}>
              <span className="text-xs font-semibold uppercase tracking-wide">{explainerContent.difficulty}</span>
            </Badge>
          </div>
        </div>
        <p className="text-gray-700 text-base leading-relaxed mt-2">{explainerContent.overview}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Content Sections */}
        <div className="space-y-6">
          {explainerContent.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <ChevronDown className="h-5 w-5 mr-2 text-indigo-600" />
                {section.heading}
              </h3>
              <div className="space-y-4">
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p 
                    key={paragraphIndex} 
                    className="text-gray-800 text-base leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Conclusion */}
        {explainerContent.conclusion && (
          <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200">
            <h4 className="text-base font-bold text-indigo-900 mb-3 flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Summary:
            </h4>
            <p className="text-indigo-800 text-base leading-relaxed">{explainerContent.conclusion}</p>
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