'use client'

import React from 'react'
import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Brain, RotateCcw, Target, Loader2 } from 'lucide-react'
import { InteractiveComponentProps } from './index'
import type { MultipleChoiceContent } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

  // Defensive: If choices is missing or not an array, render a fallback
  if (!Array.isArray(mcContent.choices) || mcContent.choices.length === 0) {
    return (
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">{mcContent.title || 'Multiple Choice'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600">No choices available for this question.</div>
        </CardContent>
      </Card>
    )
  }

  // Find the index of the correct answer
  const correctIndex = mcContent.choices.findIndex(choice => choice.isCorrect)

  const handleSubmit = async () => {
    if (selectedOption === null) return
    
    setButtonLoadingStates(prev => ({ ...prev, submit: true }))
    try {
      setShowResult(true)
      const isCorrect = selectedOption === correctIndex
      
      onInteraction('answer_submitted', {
        componentId: id,
        selected: selectedOption,
        correct: isCorrect,
        question: mcContent.question,
        score: isCorrect ? 1 : 0
      })
      showFeedback(isCorrect)
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

  const isCorrect = showResult && selectedOption === correctIndex

  // Show feedback with animation and toast
  const showFeedback = (isCorrect: boolean) => {
    toast[isCorrect ? 'success' : 'error'](isCorrect ? 'Correct!' : 'Try again!')
    setShowResult(true)
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-foreground">
            {mcContent.title}
          </CardTitle>
        </div>
        <p className="text-muted-foreground text-base leading-relaxed mt-1">{mcContent.question}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Options */}
        <div className="space-y-3">
          <h4 className="text-base font-semibold mb-3">Choose your answer:</h4>
          {mcContent.choices.map((choice, index) => (
            <button
              key={choice.id}
              onClick={() => !showResult && setSelectedOption(index)}
              disabled={showResult}
              className={cn(
                "w-full p-5 text-left rounded-lg border-2 transition-all duration-200",
                selectedOption === index
                  ? showResult
                    ? index === correctIndex
                      ? "bg-destructive/10 border-destructive shadow-lg transform scale-[1.01]"
                      : "bg-destructive/10 border-destructive shadow-lg"
                  : "bg-accent border-accent shadow-md"
                : showResult && index === correctIndex
                ? "bg-destructive/10 border-destructive shadow-lg"
                : "bg-background border-input hover:border-input/80 hover:shadow-sm"
              )}
            >
              <div className="flex items-center space-x-4">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                  selectedOption === index
                    ? showResult
                      ? index === correctIndex
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-destructive text-destructive-foreground"
                      : "bg-accent text-accent-foreground"
                    : showResult && index === correctIndex
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="flex-1">{choice.text}</span>
                <span className="flex-shrink-0">
                  {index === correctIndex ? (
                    <CheckCircle className="h-6 w-6 text-destructive" />
                  ) : selectedOption === index ? (
                    <XCircle className="h-6 w-6 text-destructive" />
                  ) : null}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Result */}
        {showResult && (
          <div className={cn(
            "p-5 rounded-lg border-2",
            isCorrect ? "bg-destructive/10 border-destructive" : "bg-destructive/10 border-destructive"
          )}>
            <div className="flex items-center mb-4">
              {isCorrect ? (
                <CheckCircle className="h-7 w-7 text-destructive mr-3" />
              ) : (
                <XCircle className="h-7 w-7 text-destructive mr-3" />
              )}
              <h4 className={cn(
                "font-bold text-lg",
                isCorrect ? "text-destructive" : "text-destructive"
              )}>
                {isCorrect ? '🎉 Correct!' : '❌ Not quite right'}
              </h4>
            </div>
            {mcContent.explanation && (
              <div className="bg-background p-4 rounded-md border shadow-sm">
                <h5 className="text-base font-semibold mb-2">Explanation:</h5>
                <p className="text-muted-foreground text-base leading-relaxed">{mcContent.explanation}</p>
              </div>
            )}
          </div>
        )}

        {/* Show explanation for the selected choice if available */}
        {showResult && selectedOption !== null && mcContent.choices[selectedOption]?.explanation && (
          <div className="bg-background p-4 rounded-md border shadow-sm mt-2">
            <h5 className="text-base font-semibold mb-2">Choice Explanation:</h5>
            <p className="text-muted-foreground text-base leading-relaxed">{mcContent.choices[selectedOption].explanation}</p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "mt-4 text-center font-semibold",
            isCorrect ? "text-destructive" : "text-destructive"
          )}
        >
          {isCorrect ? 'Correct!' : 'Try again!'}
        </motion.div>
      </CardContent>
    </Card>
  )
})
