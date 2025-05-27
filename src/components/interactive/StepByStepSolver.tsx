'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CheckCircle, Play, RotateCcw, Calculator, Brain, Target, Pause } from 'lucide-react'
import { InteractiveComponentProps } from './index'

interface StepData {
  id: string
  description: string
  formula?: string
  calculation?: string
  result: string
  explanation: string
}

interface StepByStepContent {
  problem: string
  steps: StepData[]
  finalAnswer: string
  problemType: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  category?: string
}

export function StepByStepSolver({ onInteraction, content, id }: InteractiveComponentProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [playSpeed, setPlaySpeed] = useState(2000) // milliseconds
  
  const solverContent = content as StepByStepContent

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // If category is provided and meaningful, use it
    if (solverContent.category && solverContent.category !== 'Problem Solution') {
      return solverContent.category
    }

    // Use problemType if it's specific and meaningful
    if (solverContent.problemType && solverContent.problemType !== 'Problem Solution') {
      return solverContent.problemType
    }

    // Extract topic from problem text
    const problemLower = solverContent.problem.toLowerCase()
    
    // Look for key mathematical and scientific terms
    const mathKeywords = [
      'equation', 'algebra', 'calculus', 'geometry', 'trigonometry',
      'derivative', 'integral', 'function', 'polynomial', 'logarithm',
      'matrix', 'vector', 'probability', 'statistics', 'graph'
    ]

    const scienceKeywords = [
      'physics', 'chemistry', 'biology', 'force', 'energy', 'motion',
      'reaction', 'molecule', 'atom', 'cell', 'genetics'
    ]

    // Check for mathematical keywords in problem
    const foundMathKeywords = mathKeywords.filter(keyword => 
      problemLower.includes(keyword.toLowerCase())
    )
    
    if (foundMathKeywords.length > 0) {
      const primaryKeyword = foundMathKeywords[0]
      return `${primaryKeyword.charAt(0).toUpperCase()}${primaryKeyword.slice(1)} Problem`
    }

    // Check for science keywords in problem
    const foundScienceKeywords = scienceKeywords.filter(keyword => 
      problemLower.includes(keyword.toLowerCase())
    )
    
    if (foundScienceKeywords.length > 0) {
      const primaryKeyword = foundScienceKeywords[0]
      return `${primaryKeyword.charAt(0).toUpperCase()}${primaryKeyword.slice(1)} Problem`
    }

    // Subject-specific patterns based on problem content
    if (problemLower.includes('solve') || problemLower.includes('find') || problemLower.includes('calculate')) {
      if (problemLower.includes('x') || problemLower.includes('=') || /\d+/.test(problemLower)) {
        return 'Math Problem'
      }
    }

    if (problemLower.includes('prove') || problemLower.includes('theorem') || problemLower.includes('formula')) {
      return 'Mathematical Proof'
    }

    if (problemLower.includes('optimize') || problemLower.includes('maximum') || problemLower.includes('minimum')) {
      return 'Optimization Problem'
    }

    if (problemLower.includes('rate') || problemLower.includes('speed') || problemLower.includes('velocity')) {
      return 'Rate Problem'
    }

    if (problemLower.includes('area') || problemLower.includes('volume') || problemLower.includes('perimeter')) {
      return 'Geometry Problem'
    }

    // Look at the steps for context clues
    if (solverContent.steps && solverContent.steps.length > 0) {
      const allStepsText = solverContent.steps.map(step => step.description).join(' ').toLowerCase()
      
      if (allStepsText.includes('derivative') || allStepsText.includes('differentiate')) {
        return 'Calculus Problem'
      }
      if (allStepsText.includes('factor') || allStepsText.includes('expand')) {
        return 'Algebra Problem'
      }
      if (allStepsText.includes('triangle') || allStepsText.includes('angle')) {
        return 'Geometry Problem'
      }
    }

    // Extract meaningful words from problem (excluding common words)
    const commonWords = ['find', 'solve', 'calculate', 'determine', 'what', 'how', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    const problemWords = solverContent.problem.split(' ')
      .filter(word => word.length > 3 && !commonWords.includes(word.toLowerCase()))
      .slice(0, 2)
    
    if (problemWords.length > 0) {
      return `${problemWords.join(' ')} Problem`
    }

    // Default fallback based on number of steps
    if (solverContent.steps.length === 1) {
      return 'Single-Step Solution'
    } else if (solverContent.steps.length <= 3) {
      return 'Step-by-Step Solution'
    } else {
      return 'Multi-Step Problem'
    }
  }

  const handleNextStep = () => {
    if (currentStep < solverContent.steps.length) {
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      setCompletedSteps(prev => [...prev, currentStep])
      
      // Only send feedback when the entire problem is completed
      if (newStep === solverContent.steps.length) {
        onInteraction('answer_submitted', {
          componentId: id,
          correct: true, // Step-by-step problems are always "correct" when completed
          problem: solverContent.problem,
          finalAnswer: solverContent.finalAnswer,
          allStepsCompleted: true,
          totalSteps: solverContent.steps.length
        })
      }
      // No interaction for individual steps - just internal state update
    }
  }

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= completedSteps.length) {
      setCurrentStep(stepIndex)
      // No interaction for step review - just navigate to the step
    }
  }

  const handleReset = () => {
    setCurrentStep(0)
    setCompletedSteps([])
    setIsPlaying(false)
    onInteraction('solver_reset', { componentId: id })
  }

  const handleAutoPlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    
    setIsPlaying(true)
    onInteraction('auto_play_started', { componentId: id })
    
    const playSteps = () => {
      if (currentStep < solverContent.steps.length && isPlaying) {
        setTimeout(() => {
          handleNextStep()
          playSteps()
        }, playSpeed)
      } else {
        setIsPlaying(false)
      }
    }
    playSteps()
  }

  const handleExplainMore = () => {
    onInteraction('explain_more', {
      componentId: id,
      topic: solverContent.category || solverContent.problemType,
      problem: solverContent.problem
    })
  }

  const handleNextProblem = () => {
    console.log('🎯 StepByStepSolver: Next Problem button clicked!')
    console.log('📋 Calling onInteraction with:', {
      action: 'next_problem',
      data: {
        componentId: id,
        category: solverContent.category,
        difficulty: solverContent.difficulty,
        problemType: solverContent.problemType
      }
    })
    onInteraction('next_problem', {
      componentId: id,
      category: solverContent.category,
      difficulty: solverContent.difficulty,
      problemType: solverContent.problemType
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

  const currentStepData = solverContent.steps[currentStep]
  const isCompleted = currentStep >= solverContent.steps.length
  const progressPercent = Math.round((currentStep / solverContent.steps.length) * 100)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Calculator className="h-5 w-5 text-emerald-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {solverContent.category && (
              <Badge variant="outline" className="text-xs">
                {solverContent.category}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {solverContent.problemType}
            </Badge>
            {solverContent.difficulty && (
              <Badge className={getDifficultyColor(solverContent.difficulty)}>
                {solverContent.difficulty}
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <p className="font-medium text-emerald-900 mb-2">Problem:</p>
          <p className="text-emerald-800 text-lg">{solverContent.problem}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Enhanced Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Progress:</span>
            <span className="text-sm font-bold text-emerald-600">{progressPercent}% Complete</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 font-medium">{currentStep}/{solverContent.steps.length}</span>
          </div>
        </div>

        {/* Enhanced Steps List */}
        <div className="space-y-3">
          {solverContent.steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                index === currentStep
                  ? 'bg-emerald-50 border-emerald-300 shadow-md transform scale-[1.01]'
                  : completedSteps.includes(index)
                  ? 'bg-green-50 border-green-300 shadow-sm'
                  : index < currentStep
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
              disabled={index > completedSteps.length}
            >
              <div className="flex items-center space-x-3">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full text-sm flex items-center justify-center font-bold transition-all ${
                  completedSteps.includes(index)
                    ? 'bg-green-500 text-white shadow-lg'
                    : index === currentStep
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {completedSteps.includes(index) ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="flex-1 font-medium">{step.description}</span>
                {index === currentStep && !isCompleted && (
                  <ArrowRight className="h-5 w-5 text-emerald-600 animate-pulse" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Enhanced Current Step Details */}
        {currentStepData && !isCompleted && (
          <div className="bg-emerald-50 p-5 rounded-lg border-2 border-emerald-200 space-y-4">
            <h4 className="font-bold text-emerald-900 text-lg flex items-center">
              <span className="w-6 h-6 bg-emerald-500 text-white rounded-full text-sm flex items-center justify-center mr-2">
                {currentStep + 1}
              </span>
              {currentStepData.description}
            </h4>
            
            {currentStepData.formula && (
              <div className="bg-white p-4 rounded-lg border border-emerald-300 shadow-sm">
                <p className="text-xs text-emerald-600 font-medium mb-1">Formula:</p>
                <p className="text-emerald-800 font-mono text-lg">{currentStepData.formula}</p>
              </div>
            )}
            
            {currentStepData.calculation && (
              <div className="bg-white p-4 rounded-lg border border-emerald-300 shadow-sm">
                <p className="text-xs text-emerald-600 font-medium mb-1">Calculation:</p>
                <p className="text-emerald-800 font-mono text-lg">{currentStepData.calculation}</p>
              </div>
            )}
            
            <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-4 rounded-lg border border-green-300">
              <p className="text-green-800 font-bold">✓ Result: {currentStepData.result}</p>
            </div>
            
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-blue-800">{currentStepData.explanation}</p>
            </div>
          </div>
        )}

        {/* Enhanced Final Answer */}
        {isCompleted && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-lg border-2 border-green-300 space-y-3">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
              <h4 className="font-bold text-green-900 text-xl">🎉 Solution Complete!</h4>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
              <p className="text-green-800 text-lg"><strong>Final Answer:</strong> {solverContent.finalAnswer}</p>
            </div>
          </div>
        )}

        {/* Enhanced Control Buttons */}
        <div className="flex space-x-2 pt-2">
          {!isCompleted ? (
            <>
              <Button 
                onClick={handleNextStep} 
                disabled={isPlaying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Next Step
              </Button>
              <Button 
                onClick={handleAutoPlay} 
                variant="outline"
                className="flex items-center"
              >
                {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isPlaying ? 'Pause' : 'Auto Play'}
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleExplainMore} 
                variant="outline"
                className="flex items-center"
              >
                <Brain className="h-4 w-4 mr-1" />
                Explain More
              </Button>
              <Button 
                onClick={handleNextProblem}
                className="flex items-center bg-green-600 hover:bg-green-700"
              >
                <Target className="h-4 w-4 mr-1" />
                Next Problem
              </Button>
            </>
          )}
          <Button 
            onClick={handleReset} 
            variant="outline" 
            className="flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 