'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, BookOpen, Brain, Target } from 'lucide-react'
import { InteractiveComponentProps } from './index'

interface ConceptCardContent {
  title: string
  summary: string
  details: string
  examples: string[]
  keyPoints: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export function ConceptCard({ onInteraction, content, id }: InteractiveComponentProps) {
  const conceptContent = content as ConceptCardContent

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // If title is specific and meaningful, use it
    if (conceptContent.title && 
        conceptContent.title !== 'Concept Explanation' && 
        conceptContent.title !== 'Learn about' &&
        !conceptContent.title.includes('Introduction to') &&
        !conceptContent.title.includes('Learn about')) {
      return conceptContent.title
    }

    // Extract topic from details or summary
    const detailsLower = conceptContent.details.toLowerCase()
    const summaryLower = conceptContent.summary.toLowerCase()
    const allText = `${summaryLower} ${detailsLower}`
    
    // Look for key educational terms or concepts
    const educationalKeywords = [
      'equation', 'formula', 'theorem', 'principle', 'concept', 'definition',
      'history', 'biology', 'chemistry', 'physics', 'mathematics', 'science',
      'literature', 'grammar', 'vocabulary', 'sentence', 'paragraph',
      'function', 'variable', 'coefficient', 'derivative', 'integral',
      'cell', 'organism', 'ecosystem', 'evolution', 'genetics',
      'atom', 'molecule', 'reaction', 'element', 'compound',
      'force', 'energy', 'motion', 'wave', 'light', 'sound'
    ]

    // Check for educational keywords in content
    const foundKeywords = educationalKeywords.filter(keyword => 
      allText.includes(keyword.toLowerCase())
    )
    
    if (foundKeywords.length > 0) {
      const primaryKeyword = foundKeywords[0]
      return `${primaryKeyword.charAt(0).toUpperCase()}${primaryKeyword.slice(1)} Concept`
    }

    // Subject-specific patterns based on content
    if (allText.includes('math') || allText.includes('calculation') || allText.includes('solve') || allText.includes('number')) {
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

    // Look at the examples for context clues
    if (conceptContent.examples && conceptContent.examples.length > 0) {
      const allExamplesText = conceptContent.examples.join(' ').toLowerCase()
      
      // Check if examples suggest a topic
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

    // Extract meaningful words from title/summary (excluding common words)
    const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'learn', 'about', 'introduction']
    
    // Try title first
    const titleWords = conceptContent.title.split(' ')
      .filter(word => word.length > 3 && !commonWords.includes(word.toLowerCase()))
      .slice(0, 2)
    
    if (titleWords.length > 0) {
      return `${titleWords.join(' ')} Concept`
    }

    // Try summary if title doesn't yield good words
    const summaryWords = conceptContent.summary.split(' ')
      .filter(word => word.length > 3 && !commonWords.includes(word.toLowerCase()))
      .slice(0, 2)
    
    if (summaryWords.length > 0) {
      return `${summaryWords.join(' ')} Concept`
    }

    // Default fallback based on difficulty
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
            <BookOpen className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{generateMeaningfulTitle()}</CardTitle>
          </div>
          <Badge className={getDifficultyColor(conceptContent.difficulty)}>
            {conceptContent.difficulty}
          </Badge>
        </div>
        <p className="text-gray-600 text-sm">{conceptContent.summary}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Always visible details */}
        <div className="bg-blue-50 p-4 rounded-lg space-y-3">
          <p className="text-sm text-blue-800">{conceptContent.details}</p>
          
          {conceptContent.keyPoints.length > 0 && (
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                <Lightbulb className="h-4 w-4 mr-1" />
                Key Points:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                {conceptContent.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start">
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
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-green-900 mb-2">Examples:</p>
            <div className="space-y-2">
              {conceptContent.examples.map((example, index) => (
                <div key={index} className="bg-white p-3 rounded border border-green-200">
                  <p className="text-sm text-green-800">{example}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button 
            onClick={handleExplainFurther} 
            variant="outline" 
            size="sm" 
            className="flex items-center justify-center"
          >
            <Brain className="h-4 w-4 mr-1" />
            Explain Further
          </Button>
          <Button 
            onClick={handleShowExamples} 
            variant="outline" 
            size="sm"
            className="flex items-center justify-center"
          >
            <Lightbulb className="h-4 w-4 mr-1" />
            More Examples
          </Button>
          <Button 
            onClick={handlePracticeThis} 
            size="sm" 
            className="flex items-center justify-center bg-green-600 hover:bg-green-700"
          >
            <Target className="h-4 w-4 mr-1" />
            Practice This
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 