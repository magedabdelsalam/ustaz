'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { memo } from 'react'
import { Lightbulb, BookOpen, Brain, Target } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface ConceptCardContent {
  title: string
  summary: string
  details: string
  examples: string[]
  keyPoints: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export const ConceptCard = memo(function ConceptCard({ onInteraction, content, id }: InteractiveComponentProps) {
  const conceptContent = content as ConceptCardContent

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // Priority 1: Use title if it's specific and meaningful
    if (conceptContent.title && 
        conceptContent.title !== 'Concept Explanation' && 
        conceptContent.title !== 'Learn about' &&
        !conceptContent.title.includes('Introduction to') &&
        !conceptContent.title.includes('Learn about')) {
      return conceptContent.title
    }

    // Priority 2: Check for specific educational keywords and create contextual titles
    const detailsLower = conceptContent.details.toLowerCase()
    const summaryLower = conceptContent.summary.toLowerCase()
    const allText = `${summaryLower} ${detailsLower}`
    
    const topicKeywords = [
      { words: ['photosynthesis', 'chlorophyll', 'plant'], title: 'Plant Biology Concept' },
      { words: ['equation', 'algebra', 'solve', 'variable'], title: 'Algebra Concept' },
      { words: ['shakespeare', 'hamlet', 'literature', 'author'], title: 'Literature Concept' },
      { words: ['world war', 'napoleon', 'revolution', 'treaty'], title: 'History Concept' },
      { words: ['atom', 'molecule', 'chemical', 'element'], title: 'Chemistry Concept' },
      { words: ['cell', 'dna', 'biology', 'organism'], title: 'Biology Concept' },
      { words: ['gravity', 'force', 'physics', 'motion'], title: 'Physics Concept' },
      { words: ['geography', 'continent', 'country', 'capital'], title: 'Geography Concept' },
      { words: ['grammar', 'verb', 'noun', 'sentence'], title: 'Language Arts Concept' },
      { words: ['programming', 'code', 'algorithm', 'computer'], title: 'Computer Science Concept' }
    ]

    for (const topic of topicKeywords) {
      if (topic.words.some(keyword => allText.includes(keyword))) {
        return topic.title
      }
    }

    // Priority 3: Subject-specific patterns based on content
    if (allText.includes('math') || allText.includes('calculation') || allText.includes('solve') || allText.includes('number') || /\d+/.test(allText)) {
      return 'Math Concept'
    }
    if (allText.includes('science') || allText.includes('experiment') || allText.includes('hypothesis')) {
      return 'Science Concept'
    }
    if (allText.includes('history') || allText.includes('historical') || allText.includes('century') || allText.includes('war')) {
      return 'History Concept'
    }
    if (allText.includes('language') || allText.includes('grammar') || allText.includes('verb') || allText.includes('noun')) {
      return 'Language Concept'
    }
    if (allText.includes('literature') || allText.includes('author') || allText.includes('novel') || allText.includes('poem')) {
      return 'Literature Concept'
    }

    // Priority 4: Look at the examples for context clues
    if (conceptContent.examples && conceptContent.examples.length > 0) {
      const allExamplesText = conceptContent.examples.join(' ').toLowerCase()
      
      if (/\d+/.test(allExamplesText) || allExamplesText.includes('=') || allExamplesText.includes('+')) {
        return 'Math Concept'
      }
      if (allExamplesText.includes('cell') || allExamplesText.includes('dna') || allExamplesText.includes('protein')) {
        return 'Biology Concept'
      }
      if (allExamplesText.includes('element') || allExamplesText.includes('atom') || allExamplesText.includes('molecule')) {
        return 'Chemistry Concept'
      }
    }

    // Priority 5: Extract key topic more intelligently from title
    if (conceptContent.title) {
      const meaningfulWords = conceptContent.title.split(' ')
        .filter(word => {
          const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
          return cleanWord.length > 3 && 
                 !['learn', 'about', 'introduction', 'concept', 'explanation', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'very', 'can', 'will', 'just', 'should', 'now'].includes(cleanWord)
        })
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0)

      if (meaningfulWords.length > 0) {
        const keyTopic = meaningfulWords[0]
        return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Concept`
      }
    }

    // Priority 6: Extract from summary if title doesn't work
    const summaryMeaningfulWords = conceptContent.summary.split(' ')
      .filter(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
        return cleanWord.length > 3 && 
               !['learn', 'about', 'introduction', 'concept', 'explanation', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'very', 'can', 'will', 'just', 'should', 'now'].includes(cleanWord)
      })
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)

    if (summaryMeaningfulWords.length > 0) {
      const keyTopic = summaryMeaningfulWords[0]
      return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Concept`
    }

    // Priority 7: Default fallback based on difficulty
    switch (conceptContent.difficulty) {
      case 'beginner':
        return 'Basic Concept'
      case 'intermediate':
        return 'Intermediate Concept'
      case 'advanced':
        return 'Advanced Concept'
      default:
        return conceptContent.title || 'Learning Concept'
    }
  }

  const handleExplainFurther = () => {
    onInteraction('concept_expanded', {
      componentId: id,
      concept: conceptContent.title,
      needsMoreDetail: true
    })
  }

  const handleShowExamples = () => {
    onInteraction('examples_requested', {
      componentId: id,
      concept: conceptContent.title,
      requestType: 'examples'
    })
  }

  const handlePracticeThis = () => {
    onInteraction('ready_for_next', {
      componentId: id,
      concept: conceptContent.title,
      action: 'practice'
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl font-bold text-gray-900">{generateMeaningfulTitle()}</CardTitle>
          </div>
          <Badge className={getDifficultyColor(conceptContent.difficulty)}>
            <span className="text-xs font-semibold uppercase tracking-wide">{conceptContent.difficulty}</span>
          </Badge>
        </div>
        <p className="text-gray-700 text-base leading-relaxed mt-2">{conceptContent.summary}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Always visible details */}
        <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 space-y-4">
          <p className="text-blue-900 text-base leading-relaxed">{conceptContent.details}</p>
          
          {conceptContent.keyPoints.length > 0 && (
            <div>
              <h4 className="text-base font-bold text-blue-900 mb-3 flex items-center">
                <Lightbulb className="h-5 w-5 mr-2" />
                Key Points:
              </h4>
              <ul className="text-blue-800 space-y-2">
                {conceptContent.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start text-base leading-relaxed">
                    <span className="flex-shrink-0 w-4 h-4 bg-blue-200 rounded-full text-xs flex items-center justify-center mr-2 mt-0.5">
                      {index + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Always visible examples */}
        {conceptContent.examples.length > 0 && (
          <div className="bg-green-50 p-5 rounded-lg border border-green-200">
            <h4 className="text-base font-bold text-green-900 mb-3 flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Examples:
            </h4>
            <div className="space-y-3">
              {conceptContent.examples.map((example, index) => (
                <div key={index} className="bg-white p-4 rounded-md border border-green-200 shadow-sm">
                  <p className="text-green-800 text-base leading-relaxed">{example}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          <Button 
            onClick={handleExplainFurther} 
            variant="outline" 
            size="default" 
            className="flex items-center justify-center text-sm font-medium h-11"
          >
            <Brain className="h-4 w-4 mr-2" />
            Explain Further
          </Button>
          <Button 
            onClick={handleShowExamples} 
            variant="outline" 
            size="default"
            className="flex items-center justify-center text-sm font-medium h-11"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            More Examples
          </Button>
          <Button 
            onClick={handlePracticeThis} 
            size="default" 
            className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-sm font-medium h-11"
          >
            <Target className="h-4 w-4 mr-2" />
            Practice This
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
