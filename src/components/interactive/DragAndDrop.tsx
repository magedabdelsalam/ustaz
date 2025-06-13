'use client'

import React from 'react'
import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, RotateCcw, Move, Loader2 } from 'lucide-react'
import type { DragAndDropContent } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
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
  const [submitting, setSubmitting] = useState(false)
  
  const dragContent = content as DragAndDropContent

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

  const handleSubmit = async () => {
    setSubmitting(true)
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

    // Show feedback with animation and toast
    const isCorrect = score === totalScore
    toast[isCorrect ? 'success' : 'error'](isCorrect ? 'Correct!' : 'Try again!')

    setSubmitting(false)
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

  // Defensive: If items or targets are missing or not arrays, render a fallback
  if (!Array.isArray(dragContent.items) || dragContent.items.length === 0 || !Array.isArray(dragContent.targets) || dragContent.targets.length === 0) {
    return (
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Move className="h-6 w-6 text-blue-600 mr-2" />
            Drag & Drop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600">No items or targets available for this exercise.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Move className="h-6 w-6 text-blue-600 mr-2" />
            {'Drag & Drop'}
          </CardTitle>
        </div>
        {/* No question property on DragAndDropContent; omit or add a placeholder if needed */}
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
                <span className="text-base font-semibold">{item.id}</span>
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
                      <span className="text-base font-medium">{assignedItem.id}</span>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-600 italic">
                      {'Drop item here'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Results explanation */}
        {showResult && (
          <Card className="bg-[--blue-50] border-[--blue-200]">
            <CardContent className="p-5">
              <h4 className="text-base font-semibold text-blue-900 mb-3">Explanation:</h4>
              <p className="text-muted-foreground text-base leading-relaxed mt-1">{dragContent.explanation}</p>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                className={`mt-4 text-center font-semibold ${results[Object.keys(results)[0]] ? 'text-green-600' : 'text-red-600'}`}
              >
                {results[Object.keys(results)[0]] ? 'Correct!' : 'Try again!'}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className=""
              aria-label="Submit answer"
            >
              {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Submit'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

// Placeholder components for future implementation
// These will be implemented in separate files when needed 