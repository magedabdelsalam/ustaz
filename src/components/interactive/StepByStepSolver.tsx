'use client'

import { useState, memo } from 'react'
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

export const StepByStepSolver = memo(function StepByStepSolver({ onInteraction, content, id }: InteractiveComponentProps) {
  const solverContent = content as StepByStepContent
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [playSpeed] = useState(2000) // milliseconds
  
  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // Priority 1: Use category if available
    if (solverContent.category && solverContent.category !== 'Problem Solution') {
      return `${solverContent.category} Problem`
    }

    // Priority 2: Use problemType if it's specific and meaningful
    if (solverContent.problemType && solverContent.problemType !== 'Problem Solution') {
      return solverContent.problemType
    }

    // Priority 3: Check for specific problem types and create contextual titles
    const problemLower = solverContent.problem.toLowerCase()
    
    const problemTypeKeywords = [
      { words: ['derivative', 'differentiate', 'rate of change'], title: 'Calculus Problem' },
      { words: ['integral', 'integrate', 'area under curve'], title: 'Integration Problem' },
      { words: ['quadratic', 'parabola', 'x²'], title: 'Quadratic Equation' },
      { words: ['linear equation', 'slope', 'y = mx + b'], title: 'Linear Equation' },
      { words: ['triangle', 'angle', 'pythagorean'], title: 'Geometry Problem' },
      { words: ['probability', 'chance', 'odds'], title: 'Probability Problem' },
      { words: ['logarithm', 'log', 'exponential'], title: 'Logarithmic Problem' },
      { words: ['matrix', 'determinant', 'eigenvalue'], title: 'Linear Algebra Problem' },
      { words: ['optimize', 'maximum', 'minimum'], title: 'Optimization Problem' },
      { words: ['physics', 'force', 'velocity', 'acceleration'], title: 'Physics Problem' }
    ]

    for (const problemType of problemTypeKeywords) {
      if (problemType.words.some(keyword => problemLower.includes(keyword))) {
        return problemType.title
      }
    }

    // Priority 4: Subject-specific patterns based on problem content
    if (problemLower.includes('solve') || problemLower.includes('find') || problemLower.includes('calculate')) {
      if (problemLower.includes('x') || problemLower.includes('=') || /\d+/.test(problemLower)) {
        return 'Math Problem'
      }
    }

    if (problemLower.includes('prove') || problemLower.includes('theorem') || problemLower.includes('formula')) {
      return 'Mathematical Proof'
    }

    if (problemLower.includes('rate') || problemLower.includes('speed') || problemLower.includes('velocity')) {
      return 'Rate Problem'
    }

    if (problemLower.includes('area') || problemLower.includes('volume') || problemLower.includes('perimeter')) {
      return 'Geometry Problem'
    }

    // Priority 5: Look at the steps for context clues
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

    // Priority 6: Extract key topic more intelligently
    const meaningfulWords = solverContent.problem.split(' ')
      .filter(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
        return cleanWord.length > 3 && 
               !['find', 'solve', 'calculate', 'determine', 'what', 'how', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'very', 'can', 'will', 'just', 'should', 'now'].includes(cleanWord)
      })
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)

    if (meaningfulWords.length > 0) {
      const keyTopic = meaningfulWords[0]
      return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Problem`
    }

    // Priority 7: Default fallback based on number of steps
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
      
      // No feedback needed when completing the problem - just update state
      // Removed onInteraction call that was triggering AI response
    }
  }

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= completedSteps.length) {
      setCurrentStep(stepIndex)
      // No interaction for step review - just navigate to the step
    }
  }

  const handleReset = async () => {
    setCurrentStep(0)
    setCompletedSteps([])
    setIsPlaying(false)
    onInteraction('solver_reset', { componentId: id })
  }

  const handleAutoPlay = async () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    
    setIsPlaying(true)
    
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

  const handleExplainMore = async () => {
    onInteraction('explain_more', {
      componentId: id,
      topic: solverContent.category || solverContent.problemType,
      problem: solverContent.problem
    })
  }

  const handleNextProblem = async () => {
    console.log('🎯 StepByStepSolver: Next Problem button clicked!')
    
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
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Calculator className="h-6 w-6 text-emerald-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {solverContent.category && (
              <Badge variant="outline" className="text-xs font-medium">
                {solverContent.category}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs font-medium">
              {solverContent.problemType}
            </Badge>
            {solverContent.difficulty && (
              <Badge className={getDifficultyColor(solverContent.difficulty)}>
                <span className="text-xs font-semibold capitalize tracking-wide">{solverContent.difficulty}</span>
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-200 mt-3">
          <h3 className="font-semibold text-emerald-900 mb-3 text-base">Problem:</h3>
          <p className="text-emerald-800 text-lg font-medium leading-relaxed">{solverContent.problem}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Enhanced Progress Indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-800">Progress:</span>
            <span className="text-base font-bold text-emerald-600">{progressPercent}% Complete</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-4 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-base text-gray-700 font-semibold">{currentStep}/{solverContent.steps.length}</span>
          </div>
        </div>

        {/* Enhanced Steps List */}
        <div className="space-y-2">
          {solverContent.steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              className={`w-full px-4 py-2 rounded-lg border-2 text-left transition-all duration-200 ${
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
              <div className="flex items-center space-x-4">
                <span className={`flex-shrink-0 w-10 h-10 rounded-full text-base flex items-center justify-center font-bold transition-all ${
                  completedSteps.includes(index)
                    ? 'bg-green-500 text-white shadow-lg'
                    : index === currentStep
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {completedSteps.includes(index) ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="flex-1 font-semibold text-base leading-relaxed">{step.description}</span>
                {index === currentStep && !isCompleted && (
                  <ArrowRight className="h-6 w-6 text-emerald-600 animate-pulse" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Enhanced Current Step Details */}
        {currentStepData && !isCompleted && (
          <div className="bg-emerald-50 p-6 rounded-lg border-2 border-emerald-200 space-y-5">
            <h4 className="font-bold text-emerald-900 text-xl flex items-center">
              <span className="w-7 h-7 bg-emerald-500 text-white rounded-full text-base flex items-center justify-center mr-3">
                {currentStep + 1}
              </span>
              {currentStepData.description}
            </h4>
            
            {currentStepData.formula && (
              <div className="bg-white p-5 rounded-lg border border-emerald-300 shadow-sm">
                <h5 className="text-sm font-semibold text-emerald-600 mb-2 capitalize tracking-wide">Formula:</h5>
                <p className="text-emerald-800 font-mono text-xl leading-relaxed">{currentStepData.formula}</p>
              </div>
            )}
            
            {currentStepData.calculation && (
              <div className="bg-white p-5 rounded-lg border border-emerald-300 shadow-sm">
                <h5 className="text-sm font-semibold text-emerald-600 mb-2 capitalize tracking-wide">Calculation:</h5>
                <p className="text-emerald-800 font-mono text-xl leading-relaxed">{currentStepData.calculation}</p>
              </div>
            )}
            
            <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-5 rounded-lg border border-green-300">
              <p className="text-green-800 font-bold text-lg">✓ Result: {currentStepData.result}</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-800 text-base leading-relaxed">{currentStepData.explanation}</p>
            </div>
          </div>
        )}

        {/* Enhanced Final Answer */}
        {isCompleted && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-300 space-y-4">
            <div className="flex items-center">
              <CheckCircle className="h-10 w-10 text-green-600 mr-4" />
              <h4 className="font-bold text-green-900 text-2xl">🎉 Solution Complete!</h4>
            </div>
            <div className="bg-white p-5 rounded-lg border border-green-200 shadow-sm">
              <h5 className="text-green-800 text-xl font-semibold mb-2">Final Answer:</h5>
              <p className="text-green-800 text-xl font-bold">{solverContent.finalAnswer}</p>
            </div>
          </div>
        )}

        {/* Enhanced Control Buttons */}
        <div className="flex space-x-3 pt-2">
          {!isCompleted ? (
            <>
              <Button 
                onClick={handleNextStep} 
                disabled={isPlaying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-base font-medium h-12"
              >
                Next Step
              </Button>
              <Button 
                onClick={handleAutoPlay} 
                variant="outline"
                className="flex items-center text-sm font-medium h-12 px-6"
              >
                {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isPlaying ? 'Pause' : 'Auto Play'}
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleExplainMore} 
                variant="outline"
                className="flex items-center text-sm font-medium h-11"
              >
                <Brain className="h-4 w-4 mr-2" />
                Explain More
              </Button>
              <Button 
                onClick={handleNextProblem}
                className="flex items-center bg-green-600 hover:bg-green-700 text-sm font-medium h-11"
              >
                <Target className="h-4 w-4 mr-2" />
                Next Problem
              </Button>
              <Button 
                onClick={handleReset} 
                variant="outline"
                className="flex items-center text-sm font-medium h-11"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
