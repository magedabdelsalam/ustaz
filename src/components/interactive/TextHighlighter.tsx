'use client'

import React from 'react'
import { useState, memo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Highlighter, RotateCcw, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'
import type { HighlighterContent } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface HighlightCategory {
  id: string
  name: string
  color: string
  description?: string
  shortcut?: string
}

interface HighlightTarget {
  id: string
  text: string
  categoryId: string
  startIndex: number
  endIndex: number
}

interface UserHighlight {
  id: string
  text: string
  categoryId: string
  startIndex: number
  endIndex: number
  timestamp: number
}

export const TextHighlighter = memo(function TextHighlighter({ 
  onInteraction, 
  content, 
  id 
}: InteractiveComponentProps) {
  const [userHighlights, setUserHighlights] = useState<UserHighlight[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showResults, setShowResults] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)
  
  const highlighterContent = content as HighlighterContent

  useEffect(() => {
    if (highlighterContent.categories.length > 0) {
      setSelectedCategory(highlighterContent.categories[0].id)
    }
  }, [highlighterContent.categories])

  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !selectedCategory) return

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString().trim()
    
    if (selectedText.length === 0) return

    // Calculate indices relative to the full text
    const textElement = textRef.current
    if (!textElement) return

    const fullText = textElement.textContent || ''
    const beforeSelection = range.startContainer.textContent?.substring(0, range.startOffset) || ''
    const startIndex = fullText.indexOf(beforeSelection) + beforeSelection.length
    const endIndex = startIndex + selectedText.length

    // Check for overlapping highlights
    const hasOverlap = userHighlights.some(highlight => 
      (startIndex < highlight.endIndex && endIndex > highlight.startIndex)
    )

    if (hasOverlap) {
      selection.removeAllRanges()
      return
    }

    const newHighlight: UserHighlight = {
      id: `highlight_${Date.now()}_${Math.random()}`,
      text: selectedText,
      categoryId: selectedCategory,
      startIndex,
      endIndex,
      timestamp: Date.now()
    }

    setUserHighlights(prev => [...prev, newHighlight])
    selection.removeAllRanges()
  }

  const removeHighlight = (highlightId: string) => {
    setUserHighlights(prev => prev.filter(h => h.id !== highlightId))
  }

  const handleReset = () => {
    setUserHighlights([])
    setSelectedCategory(highlighterContent.categories[0]?.id || '')
    setShowResults(false)
  }

  const handleNewText = () => {
    onInteraction('next_exercise', {
      componentId: id,
      requestType: 'new_highlighting',
      previousScore: showResults ? calculateResults()?.score : 0
    })
  }

  const handleCheckAnswers = () => {
    const results = calculateResults()
    setShowResults(true)
    
    onInteraction('highlights_checked', {
      componentId: id,
      userHighlights,
      results,
      timestamp: Date.now()
    })
  }

  const calculateResults = () => {
    // TODO: Add support for grading if targets are provided via props or context
    return {
      score: 0,
      correctHighlights: [] as string[],
      incorrectHighlights: [] as string[]
    }
  }

  const renderTextWithHighlights = () => {
    const text = highlighterContent.text
    const segments: Array<{
      text: string
      highlight?: UserHighlight
      target?: HighlightTarget
      isTarget?: boolean
    }> = []

    // Collect all highlights and targets
    const allHighlights = [
      ...userHighlights.map(h => ({ ...h, type: 'user' as const })),
    ].sort((a, b) => a.startIndex - b.startIndex)

    let currentIndex = 0

    allHighlights.forEach(highlight => {
      // Add unhighlighted text before this highlight
      if (currentIndex < highlight.startIndex) {
        segments.push({
          text: text.substring(currentIndex, highlight.startIndex)
        })
      }

      // Add the highlighted segment
      if (highlight.type === 'user') {
        segments.push({
          text: text.substring(highlight.startIndex, highlight.endIndex),
          highlight: highlight as UserHighlight
        })
      }

      currentIndex = Math.max(currentIndex, highlight.endIndex)
    })

    // Add remaining text
    if (currentIndex < text.length) {
      segments.push({
        text: text.substring(currentIndex)
      })
    }

    return segments.map((segment, index) => {
      if (segment.highlight) {
        const category = highlighterContent.categories.find(c => c.id === segment.highlight!.categoryId)
        const results = showResults ? calculateResults() : null
        
        let statusIcon = null
        if (results) {
          if (results.correctHighlights.includes(segment.highlight.id)) {
            statusIcon = <CheckCircle className="h-3 w-3 text-green-600 ml-1" />
          } else if (results.incorrectHighlights.includes(segment.highlight.id)) {
            statusIcon = <XCircle className="h-3 w-3 text-red-600 ml-1" />
          }
        }

        return (
          <span
            key={index}
            className="relative inline-block cursor-pointer group"
            style={{ backgroundColor: category?.color + '40' }}
            onClick={() => removeHighlight(segment.highlight!.id)}
          >
            {segment.text}
            {statusIcon}
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {category?.name} - Click to remove
            </span>
          </span>
        )
      }

      return <span key={index}>{segment.text}</span>
    })
  }

  const getCategoryStats = () => {
    return highlighterContent.categories.map(category => {
      const count = userHighlights.filter(h => h.categoryId === category.id).length
      return { category, count }
    })
  }

  const renderResults = () => {
    // Grading is not available for this exercise
    return <div className="text-gray-500 text-center">No grading available for this exercise.</div>
  }

  // Show feedback with animation and toast (if applicable)
  const showFeedback = (isCorrect: boolean) => {
    toast[isCorrect ? 'success' : 'error'](isCorrect ? 'Correct!' : 'Try again!')
    setShowResults(true)
  }

  return (
    <Card className="w-full mb-6" role="form" aria-label={`Text highlighter: ${highlighterContent.title}`} tabIndex={0}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Highlighter className="h-6 w-6 text-indigo-600 mr-2" />
            {highlighterContent.title}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {/* Removed highlighterContent.category badge as it does not exist on type */}
          </div>
        </div>
        <p className="text-gray-600 text-base leading-relaxed mt-1">{highlighterContent.description}</p>
        <span className="sr-only">Select text and press a category to highlight. Click a highlight to remove it.</span>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Categories */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Highlight Categories</h4>
          <div className="flex flex-wrap gap-2">
            {highlighterContent.categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                className="h-auto p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  backgroundColor: selectedCategory === category.id ? category.color : 'transparent',
                  borderColor: category.color,
                  color: selectedCategory === category.id ? 'white' : category.color
                }}
                aria-label={`Select category ${category.name}`}
              >
                <div className="text-center">
                  <div className="font-medium">{category.name}</div>
                  {/* Removed shortcut display as shortcut is not in type */}
                </div>
              </Button>
            ))}
          </div>
          
          {/* Category stats */}
          <div className="flex flex-wrap gap-2">
            {getCategoryStats().map(({ category, count }) => (
              <Badge key={category.id} variant="secondary" className="text-xs">
                {category.name}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {/* Text to highlight */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Text to Analyze</h4>
          <div 
            ref={textRef}
            className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 select-text leading-relaxed text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            onMouseUp={handleTextSelection}
            style={{ userSelect: 'text' }}
            tabIndex={0}
            aria-label="Highlightable text"
          >
            {renderTextWithHighlights()}
          </div>
          <p className="text-xs text-gray-500">
            Select text above to highlight it with the chosen category. Click on highlighted text to remove it.
          </p>
        </div>

        {/* Action buttons */}
        {showResults && (
          <div className="flex space-x-3 justify-center">
            <Button onClick={handleNewText} className="flex-1 max-w-48 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2" aria-label="New text">
              New Text
            </Button>
            <Button onClick={handleReset} variant="outline" className="flex-1 max-w-48 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2" aria-label="Try again">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div className="space-y-4" aria-live="polite" role="status">
            {renderResults()}
          </div>
        )}

        {/* Explanation */}
        {highlighterContent.explanation && (
          <div className="bg-pink-50 p-4 rounded-lg">
            <p className="text-sm text-pink-800 font-medium mb-2">Analysis Guide:</p>
            <p className="text-sm text-pink-700">{highlighterContent.explanation}</p>
          </div>
        )}

        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="mt-4 text-center font-semibold text-gray-600"
            >
              No grading available for this exercise.
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}) 