'use client'

import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, RotateCcw, Move } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

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

export const DragAndDrop = memo(function DragAndDrop({ onInteraction, content, id }: InteractiveComponentProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  
  const dragContent = content as DragAndDropContent

  // Generate a meaningful title based on content
  const generateMeaningfulTitle = (): string => {
    // Priority 1: Use category if available
    if (dragContent.category && dragContent.category !== 'Drag and Drop') {
      return `${dragContent.category} Matching`
    }

    // Priority 2: Check for specific educational keywords and create contextual titles
    const questionLower = dragContent.question.toLowerCase()
    const instructionsLower = dragContent.instructions.toLowerCase()
    const allText = `${questionLower} ${instructionsLower}`
    
    const topicKeywords = [
      { words: ['photosynthesis', 'chlorophyll', 'plant'], title: 'Plant Biology Matching' },
      { words: ['equation', 'algebra', 'solve', 'variable'], title: 'Algebra Matching' },
      { words: ['shakespeare', 'hamlet', 'literature', 'author'], title: 'Literature Matching' },
      { words: ['world war', 'napoleon', 'revolution', 'treaty'], title: 'History Matching' },
      { words: ['atom', 'molecule', 'chemical', 'element'], title: 'Chemistry Matching' },
      { words: ['cell', 'dna', 'biology', 'organism'], title: 'Biology Matching' },
      { words: ['gravity', 'force', 'physics', 'motion'], title: 'Physics Matching' },
      { words: ['geography', 'continent', 'country', 'capital'], title: 'Geography Matching' },
      { words: ['grammar', 'verb', 'noun', 'sentence'], title: 'Language Arts Matching' },
      { words: ['programming', 'code', 'algorithm', 'computer'], title: 'Computer Science Matching' }
    ]

    for (const topic of topicKeywords) {
      if (topic.words.some(keyword => allText.includes(keyword))) {
        return topic.title
      }
    }

    // Priority 3: Subject-specific patterns
    if (allText.includes('match') || allText.includes('pair') || allText.includes('connect')) {
      if (allText.includes('math') || allText.includes('number') || allText.includes('equation') || /\d+/.test(allText)) {
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

    // Priority 4: Look at the items and targets for context
    if (dragContent.items && dragContent.targets) {
      const allItemsText = dragContent.items.map(item => item.content).join(' ').toLowerCase()
      const allTargetsText = dragContent.targets.map(target => target.label).join(' ').toLowerCase()
      const itemsAndTargets = `${allItemsText} ${allTargetsText}`
      
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

    // Priority 5: Extract key topic more intelligently
    const meaningfulWords = dragContent.question.split(' ')
      .filter(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
        return cleanWord.length > 3 && 
               !['match', 'drag', 'drop', 'connect', 'pair', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'very', 'can', 'will', 'just', 'should', 'now'].includes(cleanWord)
      })
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)

    if (meaningfulWords.length > 0) {
      const keyTopic = meaningfulWords[0]
      return `${keyTopic.charAt(0).toUpperCase()}${keyTopic.slice(1)} Matching`
    }

    // Priority 6: Activity type-based fallbacks
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

  const handleNewExercise = () => {
    onInteraction('next_exercise', {
      componentId: id,
      requestType: 'new_drag_drop',
      previousScore: {
        correct: Object.values(results).filter(Boolean).length,
        total: dragContent.items.length
      }
    })
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
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Move className="h-6 w-6 text-orange-600 mr-2" />
            {generateMeaningfulTitle()}
          </CardTitle>
        </div>
        <div className="bg-orange-50 p-5 rounded-lg border border-orange-200 mt-3">
          <h3 className="text-orange-900 font-semibold text-lg leading-relaxed mb-3">{dragContent.question}</h3>
          <p className="text-base text-orange-700 leading-relaxed">{dragContent.instructions}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Items to drag */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg text-gray-900">Items to match:</h4>
          <div className="flex flex-wrap gap-3">
            {getUnassignedItems().map(item => (
              <div
                key={item.id}
                draggable={!showResult}
                onDragStart={(e) => handleDragStart(e, item.id)}
                className={`px-4 py-3 bg-blue-100 border border-blue-200 rounded-lg cursor-move select-none transition-colors ${
                  draggedItem === item.id ? 'opacity-50' : ''
                } ${
                  showResult
                    ? results[item.id]
                      ? 'bg-green-100 border-green-300'
                      : 'bg-red-100 border-red-300'
                    : 'hover:bg-blue-200'
                }`}
              >
                <span className="text-base font-semibold">{item.content}</span>
                {showResult && (
                  <span className="ml-3">
                    {results[item.id] ? (
                      <CheckCircle className="inline h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="inline h-5 w-5 text-red-600" />
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Drop targets */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg text-gray-900">Drop targets:</h4>
          <div className="grid gap-4">
            {dragContent.targets.map(target => {
              const assignedItem = getAssignedItem(target.id)
              
              return (
                <div
                  key={target.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, target.id)}
                  className={`min-h-[80px] p-4 border-2 border-dashed rounded-lg transition-colors ${
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
                    <span className="text-base font-semibold text-gray-800">
                      {target.label}
                    </span>
                    {assignedItem && showResult && (
                      <span>
                        {results[assignedItem.id] ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-600" />
                        )}
                      </span>
                    )}
                  </div>
                  
                  {assignedItem ? (
                    <div className="mt-3 px-3 py-2 bg-white rounded-md border shadow-sm">
                      <span className="text-base font-medium">{assignedItem.content}</span>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-600 italic">
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
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
            <h4 className="text-base font-semibold text-blue-900 mb-3">Explanation:</h4>
            <p className="text-blue-800 text-base leading-relaxed">{dragContent.explanation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex space-x-3 pt-4">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={Object.keys(assignments).length !== dragContent.items.length}
              className="flex-1 text-base font-medium h-12"
            >
              Check Answers
            </Button>
          ) : (
            <div className="flex space-x-3 w-full">
              <Button onClick={handleNewExercise} className="flex-1 text-sm font-medium h-11">
                New Exercise
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1 text-sm font-medium h-11">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

// Placeholder components for future implementation
// These will be implemented in separate files when needed 