'use client'

import { useState, memo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, RotateCcw, Trophy, Clock } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface QuizContent {
  title: string
  description: string
  timeLimit?: number // in seconds
  questions: QuizQuestion[]
  passingScore?: number // percentage
  allowRetry?: boolean
  showExplanations?: boolean
  category?: string
}

interface QuizQuestion {
  id: string
  question: string
  type: 'multiple-choice' | 'true-false' | 'fill-blank'
  options?: string[]
  correctAnswer: string | number
  explanation?: string
  points?: number
}

export const ProgressQuiz = memo(function ProgressQuiz({ 
  onInteraction, 
  content, 
  id 
}: InteractiveComponentProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [showResults, setShowResults] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [quizStarted, setQuizStarted] = useState(false)
  
  const quizContent = content as QuizContent
  const currentQuestion = quizContent.questions[currentQuestionIndex]
  const totalQuestions = quizContent.questions.length
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100

  // Initialize timer
  useEffect(() => {
    if (quizContent.timeLimit && quizStarted && !showResults) {
      setTimeRemaining(quizContent.timeLimit)
      setStartTime(Date.now())
    }
  }, [quizStarted, quizContent.timeLimit, showResults])

  // Timer countdown
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (timeRemaining !== null && timeRemaining > 0 && quizStarted && !showResults) {
      intervalId = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleSubmitQuiz()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [timeRemaining, quizStarted, showResults])

  const handleStartQuiz = () => {
    setQuizStarted(true)
    onInteraction('quiz_started', {
      componentId: id,
      timestamp: Date.now()
    })
  }

  const handleAnswerChange = (answer: string | number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }))

    onInteraction('answer_selected', {
      componentId: id,
      questionId: currentQuestion.id,
      answer,
      questionIndex: currentQuestionIndex
    })
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      handleSubmitQuiz()
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmitQuiz = () => {
    const results = calculateResults()
    setShowResults(true)
    
    const endTime = Date.now()
    const timeTaken = startTime ? (endTime - startTime) / 1000 : null

    onInteraction('quiz_submitted', {
      componentId: id,
      answers,
      results,
      timeTaken,
      timestamp: endTime
    })
  }

  const calculateResults = () => {
    let correctAnswers = 0
    let totalPoints = 0
    let earnedPoints = 0

    const questionResults = quizContent.questions.map(question => {
      const userAnswer = answers[question.id]
      const isCorrect = String(userAnswer) === String(question.correctAnswer)
      const points = question.points || 1
      
      totalPoints += points
      if (isCorrect) {
        correctAnswers++
        earnedPoints += points
      }

      return {
        questionId: question.id,
        isCorrect,
        userAnswer,
        correctAnswer: question.correctAnswer,
        points: isCorrect ? points : 0
      }
    })

    const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0
    const passingScore = quizContent.passingScore || 70
    const passed = percentage >= passingScore

    return {
      correctAnswers,
      totalQuestions,
      percentage,
      earnedPoints,
      totalPoints,
      passed,
      questionResults
    }
  }

  const handleReset = () => {
    setCurrentQuestionIndex(0)
    setAnswers({})
    setShowResults(false)
    setTimeRemaining(null)
    setStartTime(null)
    setQuizStarted(false)

    onInteraction('quiz_reset', { componentId: id })
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const renderQuestion = () => {
    const userAnswer = answers[currentQuestion.id]

    switch (currentQuestion.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option, index) => (
              <Button
                key={index}
                variant={userAnswer === option ? "default" : "outline"}
                className="w-full justify-start h-auto p-4 text-left"
                onClick={() => handleAnswerChange(option)}
              >
                <span className="mr-3 font-bold">{String.fromCharCode(65 + index)}.</span>
                {option}
              </Button>
            ))}
          </div>
        )

      case 'true-false':
        return (
          <div className="space-y-3">
            <Button
              variant={userAnswer === 'true' ? "default" : "outline"}
              className="w-full justify-start h-auto p-4"
              onClick={() => handleAnswerChange('true')}
            >
              True
            </Button>
            <Button
              variant={userAnswer === 'false' ? "default" : "outline"}
              className="w-full justify-start h-auto p-4"
              onClick={() => handleAnswerChange('false')}
            >
              False
            </Button>
          </div>
        )

      case 'fill-blank':
        return (
          <div className="space-y-3">
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Type your answer here..."
              value={userAnswer || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
            />
          </div>
        )

      default:
        return null
    }
  }

  const renderResults = () => {
    const results = calculateResults()
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            results.passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {results.passed ? (
              <Trophy className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <h3 className="text-xl font-bold mb-2">
            {results.passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h3>
          <p className="text-gray-600">
            You scored {results.correctAnswers} out of {results.totalQuestions} questions correctly
          </p>
          <div className="mt-4">
            <div className={`text-3xl font-bold ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
              {Math.round(results.percentage)}%
            </div>
            <p className="text-sm text-gray-500">
              {quizContent.passingScore && `Passing score: ${quizContent.passingScore}%`}
            </p>
          </div>
        </div>

        {quizContent.showExplanations && (
          <div className="space-y-4">
            <h4 className="font-medium">Review Your Answers:</h4>
            {quizContent.questions.map((question, index) => {
              const result = results.questionResults[index]
              return (
                <Card key={question.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {result.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium mb-2">{question.question}</p>
                      <p className="text-sm text-gray-600 mb-1">
                        Your answer: <span className="font-medium">{String(result.userAnswer || 'No answer')}</span>
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        Correct answer: <span className="font-medium text-green-600">{String(result.correctAnswer)}</span>
                      </p>
                      {question.explanation && (
                        <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                          {question.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (!quizStarted) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Trophy className="h-5 w-5 text-purple-600 mr-2" />
            {quizContent.title}
          </CardTitle>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-purple-900 text-sm mb-3">{quizContent.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Questions:</span> {totalQuestions}
              </div>
              {quizContent.timeLimit && (
                <div>
                  <span className="font-medium">Time Limit:</span> {formatTime(quizContent.timeLimit)}
                </div>
              )}
              {quizContent.passingScore && (
                <div>
                  <span className="font-medium">Passing Score:</span> {quizContent.passingScore}%
                </div>
              )}
              <div>
                <span className="font-medium">Retries:</span> {quizContent.allowRetry ? 'Allowed' : 'Not allowed'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStartQuiz} className="w-full">
            Start Quiz
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (showResults) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Trophy className="h-5 w-5 text-purple-600 mr-2" />
            Quiz Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderResults()}
          {quizContent.allowRetry && (
            <div className="mt-6">
              <Button onClick={handleReset} variant="outline" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake Quiz
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Trophy className="h-5 w-5 text-purple-600 mr-2" />
            {quizContent.title}
          </CardTitle>
          {timeRemaining !== null && (
            <div className="flex items-center text-sm">
              <Clock className="h-4 w-4 mr-1" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-4">{currentQuestion.question}</h3>
          {renderQuestion()}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <Button
            onClick={handleNextQuestion}
            disabled={!answers[currentQuestion.id]}
          >
            {currentQuestionIndex === totalQuestions - 1 ? 'Submit Quiz' : 'Next'}
            {currentQuestionIndex < totalQuestions - 1 && (
              <ArrowRight className="h-4 w-4 ml-2" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}) 