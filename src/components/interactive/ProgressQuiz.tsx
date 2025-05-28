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
            // Time's up - submit the quiz
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

            const percentage = quizContent.questions.length > 0 ? (correctAnswers / quizContent.questions.length) * 100 : 0
            const passingScore = quizContent.passingScore || 70
            const passed = percentage >= passingScore

            const results = {
              correctAnswers,
              totalQuestions: quizContent.questions.length,
              percentage,
              earnedPoints,
              totalPoints,
              passed,
              questionResults
            }

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
  }, [timeRemaining, quizStarted, showResults, answers, startTime, onInteraction, id, quizContent.passingScore, quizContent.questions])

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
            <h4 className="text-base font-semibold text-gray-800 mb-3">Choose your answer:</h4>
            {currentQuestion.options?.map((option, index) => (
              <Button
                key={index}
                variant={userAnswer === option ? "default" : "outline"}
                className="w-full justify-start h-auto p-5 text-left text-base leading-relaxed"
                onClick={() => handleAnswerChange(option)}
              >
                <span className="mr-3 font-bold text-lg">{String.fromCharCode(65 + index)}.</span>
                <span className="font-medium">{option}</span>
              </Button>
            ))}
          </div>
        )

      case 'true-false':
        return (
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-gray-800 mb-3">Select true or false:</h4>
            <Button
              variant={userAnswer === 'true' ? "default" : "outline"}
              className="w-full justify-start h-auto p-5 text-base font-medium"
              onClick={() => handleAnswerChange('true')}
            >
              True
            </Button>
            <Button
              variant={userAnswer === 'false' ? "default" : "outline"}
              className="w-full justify-start h-auto p-5 text-base font-medium"
              onClick={() => handleAnswerChange('false')}
            >
              False
            </Button>
          </div>
        )

      case 'fill-blank':
        return (
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-gray-800 mb-3">Type your answer:</h4>
            <input
              type="text"
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
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
      <div className="space-y-8">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
            results.passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {results.passed ? (
              <Trophy className="h-10 w-10 text-green-600" />
            ) : (
              <XCircle className="h-10 w-10 text-red-600" />
            )}
          </div>
          <h3 className="text-2xl font-bold mb-3 text-gray-900">
            {results.passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h3>
          <p className="text-gray-700 text-lg leading-relaxed mb-6">
            You scored {results.correctAnswers} out of {results.totalQuestions} questions correctly
          </p>
          <div className="mt-6">
            <div className={`text-4xl font-bold mb-2 ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
              {Math.round(results.percentage)}%
            </div>
            <p className="text-base text-gray-600">
              {quizContent.passingScore && `Passing score: ${quizContent.passingScore}%`}
            </p>
          </div>
        </div>

        {quizContent.showExplanations && (
          <div className="space-y-5">
            <h4 className="text-xl font-bold text-gray-900">Review Your Answers:</h4>
            {quizContent.questions.map((question, index) => {
              const result = results.questionResults[index]
              return (
                <Card key={question.id} className="p-5 border-2">
                  <div className="flex items-start gap-4">
                    {result.isCorrect ? (
                      <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h5 className="font-semibold text-base mb-3 text-gray-900 leading-relaxed">{question.question}</h5>
                      <p className="text-base text-gray-700 mb-2">
                        <span className="font-medium">Your answer:</span> <span className="font-semibold">{String(result.userAnswer || 'No answer')}</span>
                      </p>
                      <p className="text-base text-gray-700 mb-3">
                        <span className="font-medium">Correct answer:</span> <span className="font-semibold text-green-600">{String(result.correctAnswer)}</span>
                      </p>
                      {question.explanation && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <p className="text-blue-800 text-base leading-relaxed">
                            {question.explanation}
                          </p>
                        </div>
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
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Trophy className="h-6 w-6 text-purple-600 mr-2" />
            {quizContent.title}
          </CardTitle>
          <div className="bg-purple-50 p-5 rounded-lg border border-purple-200 mt-3">
            <p className="text-purple-900 text-base leading-relaxed mb-4">{quizContent.description}</p>
            <div className="grid grid-cols-2 gap-6 text-base">
              <div>
                <span className="font-semibold text-gray-900">Questions:</span> <span className="text-gray-700">{totalQuestions}</span>
              </div>
              {quizContent.timeLimit && (
                <div>
                  <span className="font-semibold text-gray-900">Time Limit:</span> <span className="text-gray-700">{formatTime(quizContent.timeLimit)}</span>
                </div>
              )}
              {quizContent.passingScore && (
                <div>
                  <span className="font-semibold text-gray-900">Passing Score:</span> <span className="text-gray-700">{quizContent.passingScore}%</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-gray-900">Retries:</span> <span className="text-gray-700">{quizContent.allowRetry ? 'Allowed' : 'Not allowed'}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStartQuiz} className="w-full h-12 text-base font-medium">
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
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Trophy className="h-6 w-6 text-purple-600 mr-2" />
            Quiz Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderResults()}
          {quizContent.allowRetry && (
            <div className="mt-8">
              <Button onClick={handleReset} variant="outline" className="w-full h-12 text-base font-medium">
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
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Trophy className="h-6 w-6 text-purple-600 mr-2" />
            {quizContent.title}
          </CardTitle>
          {timeRemaining !== null && (
            <div className="flex items-center text-base font-medium text-gray-700">
              <Clock className="h-5 w-5 mr-2" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
        <div className="space-y-3 mt-4">
          <div className="flex justify-between text-base text-gray-700">
            <span className="font-medium">Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <span className="font-medium">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="w-full h-3" />
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-lg mb-6 text-gray-900 leading-relaxed">{currentQuestion.question}</h3>
          {renderQuestion()}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="h-11 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <Button
            onClick={handleNextQuestion}
            disabled={!answers[currentQuestion.id]}
            className="h-11 text-sm font-medium"
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