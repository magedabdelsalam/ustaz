'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, FileText, Lightbulb, Brain, RotateCcw, Target, Eye, EyeOff } from 'lucide-react'
import { InteractiveComponentProps } from './index'

interface FillInTheBlankContent {
  question: string
  template: string // Text with ___ for blanks
  answers: string[] // Correct answers for each blank
  hints?: string[] // Optional hints for each blank
  explanation: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  category?: string
  acceptAlternatives?: boolean // Whether to accept close matches
}

export function FillInTheBlank({ onInteraction, content, id }: InteractiveComponentProps) {
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [showHints, setShowHints] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  
  const fillContent = content as FillInTheBlankContent
  
  // Parse template to find blanks and text segments
  const parts = fillContent.template.split('___')
  const blanksCount = parts.length - 1

  // Initialize answers array if needed
  if (userAnswers.length === 0) {
    setUserAnswers(new Array(blanksCount).fill(''))
  }

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // If category is provided and meaningful, use it
    if (fillContent.category && fillContent.category !== 'Complete the Text') {
      return fillContent.category
    }

    // Extract topic from template text
    const templateText = fillContent.template.replace(/___/g, '').trim()
    
    // Look for key educational terms or concepts in the template
    const educationalKeywords = [
      'equation', 'formula', 'theorem', 'principle', 'concept', 'definition',
      'history', 'biology', 'chemistry', 'physics', 'mathematics', 'science',
      'literature', 'grammar', 'vocabulary', 'sentence', 'paragraph',
      'function', 'variable', 'coefficient', 'derivative', 'integral',
      'cell', 'organism', 'ecosystem', 'evolution', 'genetics',
      'atom', 'molecule', 'reaction', 'element', 'compound',
      'force', 'energy', 'motion', 'wave', 'light', 'sound'
    ]

    // Check for educational keywords in template
    const foundKeywords = educationalKeywords.filter(keyword => 
      templateText.toLowerCase().includes(keyword.toLowerCase())
    )
    
    if (foundKeywords.length > 0) {
      const primaryKeyword = foundKeywords[0]
      return `${primaryKeyword.charAt(0).toUpperCase()}${primaryKeyword.slice(1)} Exercise`
    }

    // Look for specific subjects or topics mentioned in question
    const questionLower = fillContent.question.toLowerCase()
    
    // Subject-specific patterns
    if (questionLower.includes('math') || questionLower.includes('calculation') || questionLower.includes('solve')) {
      return 'Math Problem'
    }
    if (questionLower.includes('science') || questionLower.includes('experiment')) {
      return 'Science Concept'
    }
    if (questionLower.includes('history') || questionLower.includes('historical')) {
      return 'History Facts'
    }
    if (questionLower.includes('language') || questionLower.includes('grammar') || questionLower.includes('sentence')) {
      return 'Language Skills'
    }
    if (questionLower.includes('literature') || questionLower.includes('story') || questionLower.includes('poem')) {
      return 'Literature Study'
    }

    // Extract first meaningful words from template (excluding common words)
    const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    const templateWords = templateText.split(' ')
      .filter(word => word.length > 3 && !commonWords.includes(word.toLowerCase()))
      .slice(0, 2)
    
    if (templateWords.length > 0) {
      return `${templateWords.join(' ')} Exercise`
    }

    // Look at the answers for context clues
    if (fillContent.answers && fillContent.answers.length > 0) {
      const firstAnswer = fillContent.answers[0].toLowerCase()
      
      // Check if answers suggest a topic
      if (/^\d+$/.test(firstAnswer) || firstAnswer.includes('=') || firstAnswer.includes('+') || firstAnswer.includes('-')) {
        return 'Math Exercise'
      }
      if (firstAnswer.includes('cell') || firstAnswer.includes('dna') || firstAnswer.includes('protein')) {
        return 'Biology Exercise'
      }
      if (firstAnswer.includes('element') || firstAnswer.includes('atom') || firstAnswer.includes('molecule')) {
        return 'Chemistry Exercise'
      }
    }

    // Determine based on number of blanks
    if (blanksCount === 1) {
      return 'Complete the Statement'
    } else if (blanksCount <= 3) {
      return 'Fill in the Blanks'
    } else {
      return 'Complete the Passage'
    }
  }

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...userAnswers]
    newAnswers[index] = value
    setUserAnswers(newAnswers)
  }

  const checkAnswer = (userAnswer: string, correctAnswer: string): boolean => {
    const userClean = userAnswer.toLowerCase().trim()
    const correctClean = correctAnswer.toLowerCase().trim()
    
    if (userClean === correctClean) return true
    
    // If alternatives are accepted, check for close matches
    if (fillContent.acceptAlternatives) {
      // Remove common articles/prepositions and check
      const cleanUser = userClean.replace(/^(the|a|an|in|on|at|to|for|of|with|by)\s+/, '')
      const cleanCorrect = correctClean.replace(/^(the|a|an|in|on|at|to|for|of|with|by)\s+/, '')
      if (cleanUser === cleanCorrect) return true
      
      // Check if user answer contains the correct answer or vice versa
      if (userClean.includes(correctClean) || correctClean.includes(userClean)) {
        return Math.abs(userClean.length - correctClean.length) <= 3
      }
    }
    
    return false
  }

  const handleSubmit = () => {
    const checkResults = userAnswers.map((answer, index) => 
      checkAnswer(answer, fillContent.answers[index])
    )
    
    setResults(checkResults)
    setShowResult(true)
    
    const score = checkResults.filter(Boolean).length
    const totalScore = checkResults.length
    
    onInteraction('fill_blank_submitted', {
      componentId: id,
      userAnswers,
      correctAnswers: fillContent.answers,
      score: score,
      totalScore: totalScore,
      allCorrect: score === totalScore,
      accuracy: Math.round((score / totalScore) * 100)
    })
  }

  const handleReset = () => {
    setUserAnswers(new Array(blanksCount).fill(''))
    setShowResult(false)
    setResults([])
    setShowHints(false)
    setShowAnswers(false)
    onInteraction('fill_blank_reset', { componentId: id })
  }

  const handleExplainMore = () => {
    onInteraction('explain_more', {
      componentId: id,
      topic: fillContent.category || 'this concept',
      question: fillContent.question
    })
  }

  const handleNextExercise = () => {
    onInteraction('next_exercise', {
      componentId: id,
      category: fillContent.category,
      difficulty: fillContent.difficulty
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

  const score = results.filter(Boolean).length
  const totalScore = results.length
  const accuracy = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <FileText className="h-5 w-5 text-indigo-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {fillContent.difficulty && (
              <Badge className={getDifficultyColor(fillContent.difficulty)}>
                {fillContent.difficulty}
              </Badge>
            )}
            {showResult && (
              <Badge className={accuracy >= 80 ? 'bg-green-100 text-green-800' : accuracy >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                {accuracy}% ({score}/{totalScore})
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg">
          <p className="text-indigo-900 font-medium">{fillContent.question}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Hints section */}
        {fillContent.hints && fillContent.hints.length > 0 && !showResult && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHints(!showHints)}
              className="flex items-center"
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </Button>
            
            {showHints && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">💡 Hints:</p>
                <div className="space-y-2">
                  {fillContent.hints.map((hint, index) => (
                    <div key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full text-xs flex items-center justify-center mr-2 mt-0.5 font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm text-blue-800">{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Template with input fields */}
        <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
          <div className="flex flex-wrap items-center gap-2 text-base leading-relaxed">
            {parts.map((part, index) => (
              <span key={index} className="flex items-center gap-2">
                <span className="text-gray-800">{part}</span>
                {index < blanksCount && (
                  <div className="inline-flex flex-col items-center">
                    <div className="relative">
                      <Input
                        value={userAnswers[index] || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        disabled={showResult}
                        className={`w-36 h-10 text-center font-medium border-2 transition-all ${
                          showResult
                            ? results[index]
                              ? 'bg-green-50 border-green-400 text-green-800'
                              : 'bg-red-50 border-red-400 text-red-800'
                            : 'bg-white border-indigo-300 focus:border-indigo-500'
                        }`}
                        placeholder={`Blank ${index + 1}`}
                      />
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                    </div>
                    {showResult && (
                      <div className="mt-1">
                        {results[index] ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Show/Hide answers button for after submission */}
        {showResult && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnswers(!showAnswers)}
              className="flex items-center"
            >
              {showAnswers ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showAnswers ? 'Hide Answers' : 'Show Correct Answers'}
            </Button>
            
            {showAnswers && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm font-medium text-gray-900 mb-3">✅ Correct Answers:</p>
                <div className="grid gap-2">
                  {fillContent.answers.map((answer, index) => (
                    <div key={index} className={`flex items-center justify-between p-2 rounded ${results[index] ? 'bg-green-100' : 'bg-red-100'}`}>
                      <span className="text-sm text-gray-700 font-medium">Blank {index + 1}:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-900">{answer}</span>
                        {results[index] ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results and Explanation */}
        {showResult && (
          <div className={`p-4 rounded-lg border-2 ${
            accuracy >= 80 ? 'bg-green-50 border-green-200' : 
            accuracy >= 60 ? 'bg-yellow-50 border-yellow-200' : 
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-3">
              {accuracy >= 80 ? (
                <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
              ) : accuracy >= 60 ? (
                <CheckCircle className="h-6 w-6 text-yellow-600 mr-2" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600 mr-2" />
              )}
              <p className={`font-bold ${
                accuracy >= 80 ? 'text-green-800' : 
                accuracy >= 60 ? 'text-yellow-800' : 
                'text-red-800'
              }`}>
                {accuracy >= 80 ? '🎉 Excellent!' : 
                 accuracy >= 60 ? '👍 Good effort!' : 
                 '💪 Keep trying!'}
              </p>
            </div>
            <div className="bg-white p-3 rounded border">
              <p className="text-sm font-medium text-gray-800 mb-2">Explanation:</p>
              <p className="text-sm text-gray-700">{fillContent.explanation}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={userAnswers.some(answer => !answer.trim())}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Check Answers
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleReset} 
                variant="outline" 
                className="flex items-center"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Try Again
              </Button>
              <Button 
                onClick={handleExplainMore} 
                variant="outline"
                className="flex items-center"
              >
                <Brain className="h-4 w-4 mr-1" />
                Explain More
              </Button>
              <Button 
                onClick={handleNextExercise}
                className="flex items-center bg-green-600 hover:bg-green-700"
              >
                <Target className="h-4 w-4 mr-1" />
                Next Exercise
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 