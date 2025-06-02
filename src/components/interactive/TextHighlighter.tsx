'use client'

import { useState, memo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Highlighter, RotateCcw, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface HighlighterContent {
  title: string
  description: string
  text: string
  categories: HighlightCategory[]
  instructions?: string
  targets?: HighlightTarget[]
  showFeedback?: boolean
  explanation?: string
  category?: string
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
  const [showTargets, setShowTargets] = useState(false)
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
    if (!highlighterContent.targets) return null

    const correctHighlights: string[] = []
    const incorrectHighlights: string[] = []
    const missedTargets: HighlightTarget[] = []

    // Check user highlights against targets
    userHighlights.forEach(userHighlight => {
      const matchingTarget = highlighterContent.targets?.find(target => 
        target.startIndex === userHighlight.startIndex &&
        target.endIndex === userHighlight.endIndex &&
        target.categoryId === userHighlight.categoryId
      )

      if (matchingTarget) {
        correctHighlights.push(userHighlight.id)
      } else {
        incorrectHighlights.push(userHighlight.id)
      }
    })

    // Find missed targets
    highlighterContent.targets.forEach(target => {
      const wasHighlighted = userHighlights.some(userHighlight =>
        target.startIndex === userHighlight.startIndex &&
        target.endIndex === userHighlight.endIndex &&
        target.categoryId === userHighlight.categoryId
      )

      if (!wasHighlighted) {
        missedTargets.push(target)
      }
    })

    const totalTargets = highlighterContent.targets.length
    const score = totalTargets > 0 ? (correctHighlights.length / totalTargets) * 100 : 0

    return {
      correctHighlights,
      incorrectHighlights,
      missedTargets,
      score,
      totalTargets
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
      ...(showTargets && highlighterContent.targets ? highlighterContent.targets.map(t => ({ ...t, type: 'target' as const })) : [])
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
      } else {
        segments.push({
          text: text.substring(highlight.startIndex, highlight.endIndex),
          target: highlight as HighlightTarget,
          isTarget: true
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

      if (segment.isTarget && segment.target) {
        const category = highlighterContent.categories.find(c => c.id === segment.target!.categoryId)
        return (
          <span
            key={index}
            className="border-2 border-dashed rounded px-1"
            style={{ borderColor: category?.color }}
          >
            {segment.text}
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
    const results = calculateResults()
    if (!results) return null

    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            results.score >= 80 ? 'bg-green-100' : results.score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            <span className={`text-2xl font-bold ${
              results.score >= 80 ? 'text-green-600' : results.score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.round(results.score)}%
            </span>
          </div>
          <p className="text-gray-600">
            You correctly identified {results.correctHighlights.length} out of {results.totalTargets} targets
          </p>
        </div>

        {results.missedTargets.length > 0 && (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h5 className="font-medium text-yellow-800 mb-2">Missed Highlights:</h5>
            <ul className="text-sm text-yellow-700 space-y-1">
              {results.missedTargets.map(target => {
                const category = highlighterContent.categories.find(c => c.id === target.categoryId)
                return (
                  <li key={target.id}>
                    &quot;{target.text}&quot; should be highlighted as <strong>{category?.name}</strong>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Highlighter className="h-6 w-6 text-indigo-600 mr-2" />
            {highlighterContent.title}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {highlighterContent.category && (
              <Badge variant="outline" className="text-xs font-medium">
                {highlighterContent.category}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTargets(!showTargets)}
              disabled={showResults || !highlighterContent.targets}
            >
              {showTargets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-gray-600 text-base leading-relaxed mt-1">{highlighterContent.description}</p>
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
                className="h-auto p-2"
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  backgroundColor: selectedCategory === category.id ? category.color : 'transparent',
                  borderColor: category.color,
                  color: selectedCategory === category.id ? 'white' : category.color
                }}
              >
                <div className="text-center">
                  <div className="font-medium">{category.name}</div>
                  {category.shortcut && (
                    <div className="text-xs opacity-75">{category.shortcut}</div>
                  )}
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
            className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 select-text leading-relaxed text-gray-800"
            onMouseUp={handleTextSelection}
            style={{ userSelect: 'text' }}
          >
            {renderTextWithHighlights()}
          </div>
          <p className="text-xs text-gray-500">
            Select text above to highlight it with the chosen category. Click on highlighted text to remove it.
          </p>
        </div>

        {/* Action buttons */}
        {highlighterContent.targets && !showResults && (
          <div className="flex justify-center">
            <Button 
              onClick={handleCheckAnswers}
              disabled={userHighlights.length === 0}
            >
              Check My Highlights
            </Button>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div className="space-y-4">
            {renderResults()}
            <div className="flex space-x-3 justify-center">
              <Button onClick={handleNewText} className="flex-1 max-w-48">
                New Text
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1 max-w-48">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Explanation */}
        {highlighterContent.explanation && (
          <div className="bg-pink-50 p-4 rounded-lg">
            <p className="text-sm text-pink-800 font-medium mb-2">Analysis Guide:</p>
            <p className="text-sm text-pink-700">{highlighterContent.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}) 