'use client'

import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, HelpCircle, Brain, RotateCcw, Target } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface MultipleChoiceContent {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  hints?: string[]
  category?: string
}

export const MultipleChoice = memo(function MultipleChoice({ onInteraction, content, id }: InteractiveComponentProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showHints, setShowHints] = useState(false)
  
  const mcContent = content as MultipleChoiceContent

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    const questionLower = mcContent.question.toLowerCase()
    
    // Priority 1: Use category if available
    if (mcContent.category) {
      return `${mcContent.category} Quiz`
    }

    // Priority 2: Check for specific educational keywords and create contextual titles
    const topicKeywords = [
      { words: ['photosynthesis', 'chlorophyll', 'plant'], title: 'Plant Biology Quiz' },
      { words: ['equation', 'algebra', 'solve', 'variable'], title: 'Algebra Quiz' },
      { words: ['shakespeare', 'hamlet', 'literature', 'author'], title: 'Literature Quiz' },
      { words: ['world war', 'napoleon', 'revolution', 'treaty'], title: 'History Quiz' },
      { words: ['atom', 'molecule', 'chemical', 'element'], title: 'Chemistry Quiz' },
      { words: ['cell', 'dna', 'biology', 'organism'], title: 'Biology Quiz' },
      { words: ['gravity', 'force', 'physics', 'motion'], title: 'Physics Quiz' },
      { words: ['geography', 'continent', 'country', 'capital'], title: 'Geography Quiz' },
      { words: ['grammar', 'verb', 'noun', 'sentence'], title: 'Language Arts Quiz' },
      { words: ['programming', 'code', 'algorithm', 'computer'], title: 'Computer Science Quiz' }
    ]

    for (const topic of topicKeywords) {
      if (topic.words.some(keyword => questionLower.includes(keyword))) {
        return topic.title
      }
    }

    // Priority 3: Subject-specific patterns based on question content
    if (questionLower.includes('math') || questionLower.includes('calculate') || questionLower.includes('solve') || questionLower.includes('number') || /\d+/.test(questionLower)) {
      return 'Math Quiz'
    }
    if (questionLower.includes('science') || questionLower.includes('experiment') || questionLower.includes('hypothesis')) {
      return 'Science Quiz'
    }
    if (questionLower.includes('history') || questionLower.includes('historical') || questionLower.includes('century') || questionLower.includes('war')) {
      return 'History Quiz'
    }
    if (questionLower.includes('language') || questionLower.includes('grammar') || questionLower.includes('verb') || questionLower.includes('noun')) {
      return 'Language Quiz'
    }
    if (questionLower.includes('literature') || questionLower.includes('author') || questionLower.includes('novel') || questionLower.includes('poem')) {
      return 'Literature Quiz'
    }

    // Priority 4: Look at the answers for context clues
    if (mcContent.options && mcContent.options.length > 0) {
      const allOptionsText = mcContent.options.join(' ').toLowerCase()
      
      // Check if options suggest a topic
      if (/\d+/.test(allOptionsText) || allOptionsText.includes('=') || allOptionsText.includes('+') || allOptionsText.includes('-')) {
        return 'Math Quiz'
      }
      if (allOptionsText.includes('cell') || allOptionsText.includes('dna') || allOptionsText.includes('protein')) {
        return 'Biology Quiz'
      }
      if (allOptionsText.includes('element') || allOptionsText.includes('atom') || allOptionsText.includes('molecule')) {
        return 'Chemistry Quiz'
      }
    }

    // Priority 5: Extract key topic from question more intelligently
    const meaningfulWords = mcContent.question.split(' ')
      .filter(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
        return cleanWord.length > 3 && 
               !['what', 'which', 'how', 'where', 'when', 'why', 'who', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'very', 'can', 'will', 'just', 'should', 'now'].includes(cleanWord)
      })
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)

    if (meaningfulWords.length > 0) {
      // Take the most meaningful word (usually a noun or key concept)
      const keyTopic = meaningfulWords[0]
      return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Quiz`
    }

    // Priority 6: Question type-based fallbacks
    if (questionLower.includes('true') || questionLower.includes('false')) {
      return 'True/False Question'
    }
    if (questionLower.includes('best') || questionLower.includes('correct') || questionLower.includes('most')) {
      return 'Multiple Choice Question'
    }
    if (questionLower.includes('define') || questionLower.includes('definition')) {
      return 'Definition Quiz'
    }
    if (questionLower.includes('compare') || questionLower.includes('contrast')) {
      return 'Comparison Quiz'
    }

    // Final fallback
    return 'Knowledge Quiz'
  }

  const handleSubmit = () => {
    if (selectedOption === null) return
    
    setShowResult(true)
    const isCorrect = selectedOption === mcContent.correctAnswer
    
    onInteraction('answer_submitted', {
      componentId: id,
      selected: selectedOption,
      correct: isCorrect,
      question: mcContent.question,
      score: isCorrect ? 1 : 0
    })
  }

  const handleReset = () => {
    setSelectedOption(null)
    setShowResult(false)
    setShowHints(false)
    onInteraction('reset_question', { componentId: id })
  }

  const handleExplainMore = () => {
    onInteraction('explain_more', {
      componentId: id,
      topic: mcContent.category || 'this concept',
      question: mcContent.question
    })
  }

  const handleNextQuestion = () => {
    console.log('🔵 ==========================================')
    console.log('🔵 MULTIPLE CHOICE: NEXT QUESTION CLICKED!')
    console.log('🔵 About to call onInteraction with:')
    console.log('🔵 Action: next_question')
    console.log('🔵 Data:', {
      componentId: id,
      category: mcContent.category,
      difficulty: mcContent.difficulty
    })
    console.log('🔵 onInteraction function exists:', !!onInteraction)
    console.log('🔵 onInteraction function type:', typeof onInteraction)
    console.log('🔵 onInteraction function stringified:', onInteraction.toString().substring(0, 100))
    console.log('🔵 ==========================================')
    
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <HelpCircle className="h-5 w-5 text-purple-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {mcContent.category && (
              <Badge variant="outline" className="text-xs">
                {mcContent.category}
              </Badge>
            )}
            {mcContent.difficulty && (
              <Badge className={getDifficultyColor(mcContent.difficulty)}>
                {mcContent.difficulty}
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-purple-900 font-medium">{mcContent.question}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Hints section */}
        {mcContent.hints && mcContent.hints.length > 0 && !showResult && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHints(!showHints)}
              className="flex items-center"
            >
              <Brain className="h-4 w-4 mr-1" />
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </Button>
            
            {showHints && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">💡 Hints:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  {mcContent.hints.map((hint, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 w-4 h-4 bg-blue-200 rounded-full text-xs flex items-center justify-center mr-2 mt-0.5">
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
          {mcContent.options.map((option, index) => (
            <button
              key={index}
              onClick={() => !showResult && setSelectedOption(index)}
              disabled={showResult}
              className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-200 ${
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
              <div className="flex items-center space-x-3">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full text-sm flex items-center justify-center font-bold transition-colors ${
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
                <span className="flex-1 font-medium">{option}</span>
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
          <div className={`p-4 rounded-lg border-2 ${
            isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-3">
              {isCorrect ? (
                <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600 mr-2" />
              )}
              <p className={`font-bold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {isCorrect ? '🎉 Correct!' : '❌ Not quite right'}
              </p>
            </div>
            <div className="bg-white p-3 rounded border">
              <p className="text-sm font-medium text-gray-800 mb-2">Explanation:</p>
              <p className="text-sm text-gray-700">{mcContent.explanation}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={selectedOption === null}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Submit Answer
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
                onClick={handleNextQuestion}
                className="flex items-center bg-green-600 hover:bg-green-700"
              >
                <Target className="h-4 w-4 mr-1" />
                Next Question
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
