'use client'

import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Lightbulb, Brain, RotateCcw, Target, Eye, EyeOff, PenTool, Loader2 } from 'lucide-react'
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

export const FillInTheBlank = memo(function FillInTheBlank({ onInteraction, content, id, isLoading = false }: InteractiveComponentProps) {
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [showHints, setShowHints] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [buttonLoadingStates, setButtonLoadingStates] = useState({
    submit: false,
    reset: false,
    explainMore: false,
    nextExercise: false
  })
  
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
    // Priority 1: Use category if available
    if (fillContent.category && fillContent.category !== 'Complete the Text') {
      return `${fillContent.category} Exercise`
    }

    // Priority 2: Check for specific educational keywords and create contextual titles
    const templateText = fillContent.template.replace(/___/g, '').trim()
    const questionLower = fillContent.question.toLowerCase()
    const combinedText = `${templateText} ${questionLower}`.toLowerCase()
    
    const topicKeywords = [
      { words: ['photosynthesis', 'chlorophyll', 'plant'], title: 'Plant Biology Exercise' },
      { words: ['equation', 'algebra', 'solve', 'variable'], title: 'Algebra Practice' },
      { words: ['shakespeare', 'hamlet', 'literature', 'author'], title: 'Literature Exercise' },
      { words: ['world war', 'napoleon', 'revolution', 'treaty'], title: 'History Exercise' },
      { words: ['atom', 'molecule', 'chemical', 'element'], title: 'Chemistry Exercise' },
      { words: ['cell', 'dna', 'biology', 'organism'], title: 'Biology Exercise' },
      { words: ['gravity', 'force', 'physics', 'motion'], title: 'Physics Exercise' },
      { words: ['geography', 'continent', 'country', 'capital'], title: 'Geography Exercise' },
      { words: ['grammar', 'verb', 'noun', 'sentence'], title: 'Language Arts Exercise' },
      { words: ['programming', 'code', 'algorithm', 'computer'], title: 'Computer Science Exercise' }
    ]

    for (const topic of topicKeywords) {
      if (topic.words.some(keyword => combinedText.includes(keyword))) {
        return topic.title
      }
    }

    // Priority 3: Subject-specific patterns
    if (questionLower.includes('math') || questionLower.includes('calculation') || questionLower.includes('solve') || /\d+/.test(combinedText)) {
      return 'Math Exercise'
    }
    if (questionLower.includes('science') || questionLower.includes('experiment')) {
      return 'Science Exercise'
    }
    if (questionLower.includes('history') || questionLower.includes('historical')) {
      return 'History Exercise'
    }
    if (questionLower.includes('language') || questionLower.includes('grammar') || questionLower.includes('sentence')) {
      return 'Language Arts Exercise'
    }
    if (questionLower.includes('literature') || questionLower.includes('story') || questionLower.includes('poem')) {
      return 'Literature Exercise'
    }

    // Priority 4: Look at the answers for context clues
    if (fillContent.answers && fillContent.answers.length > 0) {
      const firstAnswer = fillContent.answers[0].toLowerCase()
      
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

    // Priority 5: Extract key topic more intelligently
    const meaningfulWords = templateText.split(' ')
      .filter(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
        return cleanWord.length > 3 && 
               !['what', 'which', 'how', 'where', 'when', 'why', 'who', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'very', 'can', 'will', 'just', 'should', 'now'].includes(cleanWord)
      })
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)

    if (meaningfulWords.length > 0) {
      const keyTopic = meaningfulWords[0]
      return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Exercise`
    }

    // Priority 6: Determine based on exercise characteristics
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

  const handleSubmit = async () => {
    setButtonLoadingStates(prev => ({ ...prev, submit: true }))
    try {
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
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, submit: false }))
      }, 1000)
    }
  }

  const handleReset = async () => {
    setButtonLoadingStates(prev => ({ ...prev, reset: true }))
    try {
      setUserAnswers(new Array(blanksCount).fill(''))
      setShowResult(false)
      setResults([])
      setShowHints(false)
      setShowAnswers(false)
      onInteraction('fill_blank_reset', { componentId: id })
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, reset: false }))
      }, 1000)
    }
  }

  const handleExplainMore = async () => {
    setButtonLoadingStates(prev => ({ ...prev, explainMore: true }))
    try {
      onInteraction('explain_more', {
        componentId: id,
        topic: fillContent.category || 'this concept',
        question: fillContent.question
      })
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, explainMore: false }))
      }, 1000)
    }
  }

  const handleNextExercise = async () => {
    setButtonLoadingStates(prev => ({ ...prev, nextExercise: true }))
    try {
      onInteraction('next_exercise', {
        componentId: id,
        category: fillContent.category,
        difficulty: fillContent.difficulty
      })
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, nextExercise: false }))
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

  const score = results.filter(Boolean).length
  const totalScore = results.length
  const accuracy = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <PenTool className="h-6 w-6 text-indigo-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {fillContent.category && (
              <Badge variant="outline" className="text-xs font-medium">
                {fillContent.category}
              </Badge>
            )}
            {fillContent.difficulty && (
              <Badge className={getDifficultyColor(fillContent.difficulty)}>
                <span className="text-xs font-semibold capitalize tracking-wide">{fillContent.difficulty}</span>
              </Badge>
            )}
            {showResult && (
              <Badge className={accuracy >= 80 ? 'bg-green-100 text-green-800' : accuracy >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                <span className="text-xs font-semibold">{accuracy}% ({score}/{totalScore})</span>
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200 mt-3">
          <h3 className="text-indigo-900 font-semibold text-lg leading-relaxed">{fillContent.question}</h3>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Hints section */}
        {fillContent.hints && fillContent.hints.length > 0 && !showResult && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="default"
              onClick={() => setShowHints(!showHints)}
              className="flex items-center text-sm font-medium"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </Button>
            
            {showHints && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-base font-bold text-blue-900 mb-3 flex items-center">💡 Hints:</h4>
                <div className="space-y-3">
                  {fillContent.hints.map((hint, index) => (
                    <div key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-200 rounded-full text-sm flex items-center justify-center mr-3 mt-0.5 font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-blue-800 text-base leading-relaxed">{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Template with input fields */}
        <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
          <h4 className="text-base font-semibold text-gray-800 mb-4">Fill in the blanks:</h4>
          <div className="flex flex-wrap items-center gap-3 text-lg leading-relaxed">
            {parts.map((part, index) => (
              <span key={index} className="flex items-center gap-3">
                <span className="text-gray-900 font-medium">{part}</span>
                {index < blanksCount && (
                  <div className="inline-flex flex-col items-center">
                    <div className="relative">
                      <Input
                        value={userAnswers[index] || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        disabled={showResult}
                        className={`w-40 h-12 text-center font-semibold border-2 transition-all text-base ${
                          showResult
                            ? results[index]
                              ? 'bg-green-50 border-green-400 text-green-800'
                              : 'bg-red-50 border-red-400 text-red-800'
                            : 'bg-white border-indigo-300 focus:border-indigo-500'
                        }`}
                        placeholder={
                          fillContent.hints && fillContent.hints[index] 
                            ? `Hint: ${fillContent.hints[index].substring(0, 20)}...`
                            : fillContent.category
                            ? `Enter ${fillContent.category.toLowerCase()} term`
                            : `Fill blank ${index + 1}`
                        }
                      />
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                    </div>
                    {showResult && (
                      <div className="mt-2">
                        {results[index] ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-600" />
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
          <div className="space-y-4">
            <Button
              variant="outline"
              size="default"
              onClick={() => setShowAnswers(!showAnswers)}
              className="flex items-center text-sm font-medium"
            >
              {showAnswers ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showAnswers ? 'Hide Answers' : 'Show Correct Answers'}
            </Button>
            
            {showAnswers && (
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">✅ Correct Answers:</h4>
                <div className="grid gap-3">
                  {fillContent.answers.map((answer, index) => (
                    <div key={index} className={`flex items-center justify-between p-4 rounded-lg ${results[index] ? 'bg-green-100' : 'bg-red-100'}`}>
                      <span className="text-base text-gray-800 font-semibold">Blank {index + 1}:</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-base font-bold text-gray-900">{answer}</span>
                        {results[index] ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
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
          <div className={`p-5 rounded-lg border-2 ${
            accuracy >= 80 ? 'bg-green-50 border-green-200' : 
            accuracy >= 60 ? 'bg-yellow-50 border-yellow-200' : 
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-4">
              {accuracy >= 80 ? (
                <CheckCircle className="h-7 w-7 text-green-600 mr-3" />
              ) : accuracy >= 60 ? (
                <CheckCircle className="h-7 w-7 text-yellow-600 mr-3" />
              ) : (
                <XCircle className="h-7 w-7 text-red-600 mr-3" />
              )}
              <h4 className={`font-bold text-lg ${
                accuracy >= 80 ? 'text-green-800' : 
                accuracy >= 60 ? 'text-yellow-800' : 
                'text-red-800'
              }`}>
                {accuracy >= 80 ? 
                  `🎉 ${fillContent.category ? `${fillContent.category} ` : ''}Mastered!` : 
                 accuracy >= 60 ? 
                  `👍 ${fillContent.category ? `${fillContent.category} ` : ''}Progress!` : 
                  `💪 ${fillContent.category ? `${fillContent.category} ` : ''}Keep Trying!`
                }
              </h4>
            </div>
            <div className="bg-white p-4 rounded-md border shadow-sm">
              <h5 className="text-base font-semibold text-gray-900 mb-2">Explanation:</h5>
              <p className="text-gray-700 text-base leading-relaxed">
                {accuracy >= 80 
                  ? `Outstanding work${fillContent.category ? ` on ${fillContent.category.toLowerCase()}` : ''}! ${fillContent.explanation}` 
                  : accuracy >= 60 
                  ? `Good progress${fillContent.category ? ` with ${fillContent.category.toLowerCase()}` : ''}! You got ${score} out of ${totalScore} correct. ${fillContent.explanation}` 
                  : `You got ${score} out of ${totalScore} correct${fillContent.category ? ` for ${fillContent.category.toLowerCase()}` : ''}. Try reviewing the material again. ${fillContent.explanation.replace(/^(These answers are correct|Why these answers are correct)/, 'The correct answers are important')}`
                }
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={userAnswers.some(answer => !answer.trim()) || buttonLoadingStates.submit || isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-base font-medium h-12"
            >
              {buttonLoadingStates.submit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check Answers'
              )}
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleReset} 
                variant="outline" 
                className="flex items-center text-sm font-medium h-11"
                disabled={buttonLoadingStates.reset || isLoading}
              >
                {buttonLoadingStates.reset ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                {buttonLoadingStates.reset ? 'Resetting...' : 'Try Again'}
              </Button>
              <Button 
                onClick={handleExplainMore} 
                variant="outline"
                className="flex items-center text-sm font-medium h-11"
                disabled={buttonLoadingStates.explainMore || isLoading}
              >
                {buttonLoadingStates.explainMore ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                {buttonLoadingStates.explainMore ? 'Loading...' : 'Explain More'}
              </Button>
              <Button 
                onClick={handleNextExercise}
                className="flex items-center bg-green-600 hover:bg-green-700 text-sm font-medium h-11"
                disabled={buttonLoadingStates.nextExercise || isLoading}
              >
                {buttonLoadingStates.nextExercise ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                {buttonLoadingStates.nextExercise ? 'Processing...' : 
                 fillContent.category ? `Next ${fillContent.category} Exercise` : 'Next Exercise'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
