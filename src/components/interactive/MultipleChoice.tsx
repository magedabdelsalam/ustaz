'use client'

import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Brain, RotateCcw, Target, Loader2 } from 'lucide-react'
import { InteractiveComponentProps } from './index'

interface MultipleChoiceContent {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  hints?: string[]
  category?: string
}

export const MultipleChoice = memo(function MultipleChoice({ onInteraction, content, id, isLoading = false }: InteractiveComponentProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [buttonLoadingStates, setButtonLoadingStates] = useState({
    submit: false,
    reset: false,
    explainMore: false,
    nextQuestion: false
  })
  
  const mcContent = content as MultipleChoiceContent

  const handleSubmit = async () => {
    if (selectedOption === null) return
    
    setButtonLoadingStates(prev => ({ ...prev, submit: true }))
    try {
      setShowResult(true)
      const isCorrect = selectedOption === mcContent.correctAnswer
      
      onInteraction('answer_submitted', {
        componentId: id,
        selected: selectedOption,
        correct: isCorrect,
        question: mcContent.question,
        score: isCorrect ? 1 : 0
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
      setSelectedOption(null)
      setShowResult(false)
      setShowHints(false)
      onInteraction('reset_question', { componentId: id })
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
        topic: mcContent.category,
        question: mcContent.question
      })
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, explainMore: false }))
      }, 1000)
    }
  }

  const handleNextQuestion = async () => {
    setButtonLoadingStates(prev => ({ ...prev, nextQuestion: true }))
    console.log('🔵 ==========================================')
    console.log('🔵 MULTIPLE CHOICE: NEXT QUESTION CLICKED!')
    
    try {
      console.log('🔵 CALLING onInteraction NOW...')
      onInteraction('next_question', {
        componentId: id,
        category: mcContent.category,
        difficulty: mcContent.difficulty
      })
      console.log('🔵 onInteraction call completed successfully!')
    } catch (error) {
      console.error('🔵 ERROR calling onInteraction:', error)
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, nextQuestion: false }))
      }, 1000)
    }
    
    console.log('🔵 handleNextQuestion function completed!')
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isCorrect = showResult && selectedOption === mcContent.correctAnswer

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">
            {mcContent.category}
          </CardTitle>
          {mcContent.difficulty && (
            <Badge className={getDifficultyColor(mcContent.difficulty)}>
              <span className="text-xs font-semibold capitalize tracking-wide">{mcContent.difficulty}</span>
            </Badge>
          )}
        </div>
        <p className="text-gray-600 text-base leading-relaxed mt-1">{mcContent.question}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hints section */}
        {mcContent.hints && mcContent.hints.length > 0 && !showResult && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="default"
              onClick={() => setShowHints(!showHints)}
              className="flex items-center text-sm font-medium"
            >
              <Brain className="h-4 w-4 mr-2" />
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </Button>
            
            {showHints && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-base font-bold text-blue-900 mb-3 flex items-center">
                  💡 Hints:
                </h4>
                <ul className="text-blue-800 space-y-2">
                  {mcContent.hints.map((hint, index) => (
                    <li key={index} className="flex items-start text-base leading-relaxed">
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full text-xs flex items-center justify-center mr-3 mt-0.5 font-semibold">
                        {index + 1}
                      </span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-gray-800 mb-3">Choose your answer:</h4>
          {mcContent.options.map((option, index) => (
            <button
              key={index}
              onClick={() => !showResult && setSelectedOption(index)}
              disabled={showResult}
              className={`w-full p-5 text-left rounded-lg border-2 transition-all duration-200 ${
                selectedOption === index
                  ? showResult
                    ? index === mcContent.correctAnswer
                      ? 'bg-green-50 border-green-400 shadow-lg transform scale-[1.01]'
                      : 'bg-red-50 border-red-400 shadow-lg'
                    : 'bg-purple-50 border-purple-400 shadow-md'
                  : showResult && index === mcContent.correctAnswer
                  ? 'bg-green-50 border-green-400 shadow-lg'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className={`flex-shrink-0 w-10 h-10 rounded-full text-base flex items-center justify-center font-bold transition-colors ${
                  selectedOption === index
                    ? showResult
                      ? index === mcContent.correctAnswer
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-purple-500 text-white'
                    : showResult && index === mcContent.correctAnswer
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 font-medium text-base leading-relaxed">{option}</span>
                {showResult && (
                  <span className="flex-shrink-0">
                    {index === mcContent.correctAnswer ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : selectedOption === index ? (
                      <XCircle className="h-6 w-6 text-red-600" />
                    ) : null}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Result and Explanation */}
        {showResult && (
          <div className={`p-5 rounded-lg border-2 ${
            isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-4">
              {isCorrect ? (
                <CheckCircle className="h-7 w-7 text-green-600 mr-3" />
              ) : (
                <XCircle className="h-7 w-7 text-red-600 mr-3" />
              )}
              <h4 className={`font-bold text-lg ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {isCorrect ? '🎉 Correct!' : '❌ Not quite right'}
              </h4>
            </div>
            <div className="bg-white p-4 rounded-md border shadow-sm">
              <h5 className="text-base font-semibold text-gray-900 mb-2">Explanation:</h5>
              <p className="text-gray-700 text-base leading-relaxed">{mcContent.explanation}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={selectedOption === null || buttonLoadingStates.submit || isLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-base font-medium h-12"
            >
              {buttonLoadingStates.submit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Answer'
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
                onClick={handleNextQuestion}
                className="flex items-center bg-green-600 hover:bg-green-700 text-sm font-medium h-11"
                disabled={buttonLoadingStates.nextQuestion || isLoading}
              >
                {buttonLoadingStates.nextQuestion ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                {buttonLoadingStates.nextQuestion ? 'Processing...' : 'Next Question'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
