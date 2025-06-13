'use client'

import React, { useState, useCallback, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CheckCircle, Play, RotateCcw, Calculator, Brain, Target, Pause } from 'lucide-react'
import { InteractiveComponentProps } from './index'
import type { StepByStepContent } from '@/types'
import { cn } from '@/lib/utils'

interface StepData {
  id: string
  description: string
  formula?: string
  calculation?: string
  result: string
  explanation: string
}

export const StepByStepSolver = memo(function StepByStepSolver({ onInteraction, content, id }: InteractiveComponentProps) {
  const solverContent = content as StepByStepContent
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [playSpeed] = useState(2000) // milliseconds
  
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
    onInteraction('next_problem', {
      componentId: id,
      category: solverContent.category,
      difficulty: solverContent.difficulty,
      problemType: solverContent.problemType
    })
  }

  const getDifficultyVariant = (difficulty: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (difficulty) {
      case 'beginner': return 'secondary'
      case 'intermediate': return 'outline'
      case 'advanced': return 'destructive'
      default: return 'default'
    }
  }

  const currentStepData = solverContent.steps[currentStep]
  const isCompleted = currentStep >= solverContent.steps.length
  const progressPercent = Math.round((currentStep / solverContent.steps.length) * 100)

  return (
    <Card className={cn('w-full mb-6', content.className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Calculator className="h-6 w-6 text-blue-600 mr-2" />
            {solverContent.category || solverContent.problemType}
          </CardTitle>
          {solverContent.difficulty && (
            <Badge variant={getDifficultyVariant(solverContent.difficulty)}>
              <span className="capitalize tracking-wide">{solverContent.difficulty}</span>
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-base leading-relaxed mt-1">{solverContent.problem}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Enhanced Progress Indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">Progress:</span>
            <span className="text-base font-bold text-emerald-600">{progressPercent}% Complete</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-4 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-base text-muted-foreground font-semibold">{currentStep}/{solverContent.steps.length}</span>
          </div>
        </div>

        {/* Enhanced Steps List */}
        <div className="space-y-2">
          {solverContent.steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              className={cn(
                'w-full px-4 py-2 rounded-lg border-2 text-left transition-all duration-200',
                index === currentStep
                  ? 'bg-emerald-50 border-emerald-300 shadow-md transform scale-[1.01]'
                  : completedSteps.includes(index)
                  ? 'bg-green-50 border-green-300 shadow-sm'
                  : index < currentStep
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              )}
              disabled={index > completedSteps.length}
            >
              <div className="flex items-center space-x-4">
                <span className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-full text-base flex items-center justify-center font-bold transition-all',
                  completedSteps.includes(index)
                    ? 'bg-green-500 text-white shadow-lg'
                    : index === currentStep
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-gray-300 text-gray-600'
                )}>
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
          <Card className="bg-[--emerald-50] border-[--emerald-200]">
            <CardContent className="p-6 space-y-5">
              <h4 className="font-bold text-emerald-900 text-xl flex items-center">
                <span className="w-7 h-7 bg-emerald-500 text-white rounded-full text-base flex items-center justify-center mr-3">
                  {currentStep + 1}
                </span>
                {currentStepData.description}
              </h4>
              {currentStepData.formula && (
                <Card className="border-[--emerald-300]">
                  <CardContent className="p-5">
                    <h5 className="text-sm font-semibold text-emerald-600 mb-2 capitalize tracking-wide">Formula:</h5>
                    <p className="text-emerald-800 font-mono text-xl leading-relaxed">{currentStepData.formula}</p>
                  </CardContent>
                </Card>
              )}
              {currentStepData.calculation && (
                <Card className="border-[--emerald-300]">
                  <CardContent className="p-5">
                    <h5 className="text-sm font-semibold text-emerald-600 mb-2 capitalize tracking-wide">Calculation:</h5>
                    <p className="text-emerald-800 font-mono text-xl leading-relaxed">{currentStepData.calculation}</p>
                  </CardContent>
                </Card>
              )}
              <Card className="bg-gradient-to-r from-[--green-100] to-[--emerald-100] border-[--green-300]">
                <CardContent className="p-5">
                  <p className="text-green-800 font-bold text-lg">✓ Result: {currentStepData.result}</p>
                </CardContent>
              </Card>
              <Card className="bg-[--blue-50] border-[--blue-200]">
                <CardContent className="p-4">
                  <p className="text-blue-800 text-base leading-relaxed">{currentStepData.explanation}</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Final Answer */}
        {isCompleted && (
          <Card className="bg-gradient-to-r from-[--green-50] to-[--emerald-50] border-[--green-300]">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center">
                <CheckCircle className="h-10 w-10 text-green-600 mr-4" />
                <h4 className="font-bold text-green-900 text-2xl">🎉 Solution Complete!</h4>
              </div>
              <Card className="border-[--green-200]">
                <CardContent className="p-5">
                  <h5 className="text-green-800 text-xl font-semibold mb-2">Final Answer:</h5>
                  <p className="text-green-800 text-xl font-bold">{solverContent.finalAnswer}</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Control Buttons */}
        <div className="flex space-x-3 pt-2">
          {!isCompleted ? (
            <>
              <Button 
                onClick={handleNextStep} 
                disabled={isPlaying}
                className="flex-1 text-base font-medium h-12"
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
                className="text-base font-medium h-11"
              >
                <Target className="h-4 w-4 mr-2" />
                {solverContent.category ? `Next ${solverContent.category} Problem` : 'Next Problem'}
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
