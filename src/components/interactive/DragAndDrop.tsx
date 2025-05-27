'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, RotateCcw, Move } from 'lucide-react'
import { InteractiveComponentProps } from './index'

interface DragAndDropContent {
  question: string
  instructions: string
  items: DragItem[]
  targets: DropTarget[]
  explanation: string
  category?: string
}

interface DragItem {
  id: string
  content: string
  correctTargetId: string
}

interface DropTarget {
  id: string
  label: string
  placeholder: string
}

export function DragAndDrop({ onInteraction, content, id }: InteractiveComponentProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  
  const dragContent = content as DragAndDropContent

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // If category is provided and meaningful, use it
    if (dragContent.category && dragContent.category !== 'Drag and Drop') {
      return dragContent.category
    }

    // Extract topic from question and instructions
    const questionLower = dragContent.question.toLowerCase()
    const instructionsLower = dragContent.instructions.toLowerCase()
    const allText = `${questionLower} ${instructionsLower}`
    
    // Look for key educational terms or concepts
    const educationalKeywords = [
      'equation', 'formula', 'theorem', 'principle', 'concept', 'definition',
      'history', 'biology', 'chemistry', 'physics', 'mathematics', 'science',
      'literature', 'grammar', 'vocabulary', 'sentence', 'paragraph',
      'function', 'variable', 'coefficient', 'derivative', 'integral',
      'cell', 'organism', 'ecosystem', 'evolution', 'genetics',
      'atom', 'molecule', 'reaction', 'element', 'compound',
      'force', 'energy', 'motion', 'wave', 'light', 'sound'
    ]

    // Check for educational keywords
    const foundKeywords = educationalKeywords.filter(keyword => 
      allText.includes(keyword.toLowerCase())
    )
    
    if (foundKeywords.length > 0) {
      const primaryKeyword = foundKeywords[0]
      return `${primaryKeyword.charAt(0).toUpperCase()}${primaryKeyword.slice(1)} Matching`
    }

    // Subject-specific patterns
    if (allText.includes('match') || allText.includes('pair') || allText.includes('connect')) {
      if (allText.includes('math') || allText.includes('number') || allText.includes('equation')) {
        return 'Math Matching'
      }
      if (allText.includes('science') || allText.includes('experiment')) {
        return 'Science Matching'
      }
      if (allText.includes('history') || allText.includes('historical')) {
        return 'History Matching'
      }
      if (allText.includes('language') || allText.includes('word') || allText.includes('vocabulary')) {
        return 'Language Matching'
      }
    }

    // Look at the items and targets for context
    if (dragContent.items && dragContent.targets) {
      const allItemsText = dragContent.items.map(item => item.content).join(' ').toLowerCase()
      const allTargetsText = dragContent.targets.map(target => target.label).join(' ').toLowerCase()
      const itemsAndTargets = `${allItemsText} ${allTargetsText}`
      
      // Check content for subject clues
      if (/\d+/.test(itemsAndTargets) || itemsAndTargets.includes('=') || itemsAndTargets.includes('+')) {
        return 'Math Matching'
      }
      if (itemsAndTargets.includes('cell') || itemsAndTargets.includes('dna') || itemsAndTargets.includes('protein')) {
        return 'Biology Matching'
      }
      if (itemsAndTargets.includes('element') || itemsAndTargets.includes('atom') || itemsAndTargets.includes('molecule')) {
        return 'Chemistry Matching'
      }
    }

    // Extract meaningful words from question (excluding common words)
    const commonWords = ['match', 'drag', 'drop', 'connect', 'pair', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    const questionWords = dragContent.question.split(' ')
      .filter(word => word.length > 3 && !commonWords.includes(word.toLowerCase()))
      .slice(0, 2)
    
    if (questionWords.length > 0) {
      return `${questionWords.join(' ')} Matching`
    }

    // Default based on activity type
    if (allText.includes('category') || allText.includes('group') || allText.includes('classify')) {
      return 'Category Matching'
    }
    if (allText.includes('definition') || allText.includes('term')) {
      return 'Definition Matching'
    }
    if (allText.includes('sequence') || allText.includes('order')) {
      return 'Sequence Matching'
    }

    return 'Drag & Drop Exercise'
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (draggedItem) {
      setAssignments(prev => ({
        ...prev,
        [draggedItem]: targetId
      }))
      setDraggedItem(null)
      
      onInteraction('item_dropped', {
        componentId: id,
        itemId: draggedItem,
        targetId: targetId
      })
    }
  }

  const handleSubmit = () => {
    const newResults: Record<string, boolean> = {}
    
    dragContent.items.forEach(item => {
      const assignedTarget = assignments[item.id]
      newResults[item.id] = assignedTarget === item.correctTargetId
    })
    
    setResults(newResults)
    setShowResult(true)
    
    const score = Object.values(newResults).filter(Boolean).length
    const totalScore = dragContent.items.length
    
    onInteraction('drag_drop_submitted', {
      componentId: id,
      assignments,
      results: newResults,
      score,
      totalScore,
      allCorrect: score === totalScore
    })
  }

  const handleReset = () => {
    setAssignments({})
    setShowResult(false)
    setResults({})
    setDraggedItem(null)
    onInteraction('drag_drop_reset', { componentId: id })
  }

  const getUnassignedItems = () => {
    return dragContent.items.filter(item => !assignments[item.id])
  }

  const getAssignedItem = (targetId: string) => {
    const itemId = Object.keys(assignments).find(id => assignments[id] === targetId)
    return itemId ? dragContent.items.find(item => item.id === itemId) : null
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Move className="h-5 w-5 text-orange-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="text-orange-900 font-medium mb-2">{dragContent.question}</p>
          <p className="text-sm text-orange-700">{dragContent.instructions}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Items to drag */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Items to match:</h4>
          <div className="flex flex-wrap gap-2">
            {getUnassignedItems().map(item => (
              <div
                key={item.id}
                draggable={!showResult}
                onDragStart={(e) => handleDragStart(e, item.id)}
                className={`px-3 py-2 bg-blue-100 border border-blue-200 rounded-lg cursor-move select-none transition-colors ${
                  draggedItem === item.id ? 'opacity-50' : ''
                } ${
                  showResult
                    ? results[item.id]
                      ? 'bg-green-100 border-green-300'
                      : 'bg-red-100 border-red-300'
                    : 'hover:bg-blue-200'
                }`}
              >
                <span className="text-sm font-medium">{item.content}</span>
                {showResult && (
                  <span className="ml-2">
                    {results[item.id] ? (
                      <CheckCircle className="inline h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="inline h-4 w-4 text-red-600" />
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Drop targets */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Drop targets:</h4>
          <div className="grid gap-3">
            {dragContent.targets.map(target => {
              const assignedItem = getAssignedItem(target.id)
              
              return (
                <div
                  key={target.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, target.id)}
                  className={`min-h-[60px] p-3 border-2 border-dashed rounded-lg transition-colors ${
                    assignedItem
                      ? showResult
                        ? results[assignedItem.id]
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                        : 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {target.label}
                    </span>
                    {assignedItem && showResult && (
                      <span>
                        {results[assignedItem.id] ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </span>
                    )}
                  </div>
                  
                  {assignedItem ? (
                    <div className="mt-2 px-2 py-1 bg-white rounded border">
                      <span className="text-sm">{assignedItem.content}</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500 italic">
                      {target.placeholder}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Results explanation */}
        {showResult && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">Explanation:</p>
            <p className="text-sm text-blue-700">{dragContent.explanation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex space-x-2">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={Object.keys(assignments).length !== dragContent.items.length}
              className="flex-1"
            >
              Check Answers
            </Button>
          ) : (
            <Button onClick={handleReset} variant="outline" className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Placeholder components for future implementation
export function FormulaExplorer({ onInteraction, content, id }: InteractiveComponentProps) {
  return <div className="p-4 text-center text-gray-500">FormulaExplorer Component - Coming Soon</div>
}

export function InteractiveExample({ onInteraction, content, id }: InteractiveComponentProps) {
  return <div className="p-4 text-center text-gray-500">InteractiveExample Component - Coming Soon</div>
}

export function ProgressQuiz({ onInteraction, content, id }: InteractiveComponentProps) {
  return <div className="p-4 text-center text-gray-500">ProgressQuiz Component - Coming Soon</div>
}

export function GraphVisualizer({ onInteraction, content, id }: InteractiveComponentProps) {
  return <div className="p-4 text-center text-gray-500">GraphVisualizer Component - Coming Soon</div>
} 