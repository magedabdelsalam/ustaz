'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { memo } from 'react'
import { Lightbulb, BookOpen, Brain, Target } from 'lucide-react'
import { InteractiveComponentProps, ConceptCardContent } from '@/types'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export const ConceptCard = memo(function ConceptCard({ onInteraction, content, id }: InteractiveComponentProps) {
  const conceptContent = content as ConceptCardContent

  const handleExplainFurther = () => {
    onInteraction('concept_expanded', {
      componentId: id,
      concept: conceptContent.title,
      needsMoreDetail: true
    })
  }

  const handleShowExamples = () => {
    onInteraction('examples_requested', {
      componentId: id,
      concept: conceptContent.title,
      requestType: 'examples'
    })
  }

  const handlePracticeThis = () => {
    onInteraction('ready_for_next', {
      componentId: id,
      concept: conceptContent.title,
      action: 'practice'
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.18 }}
    >
      <Card className="w-full" role="article" aria-label={`Concept: ${conceptContent.title}`} tabIndex={0}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-xl font-bold text-gray-900">{conceptContent.title}</CardTitle>
            </div>
            <Badge className={getDifficultyColor(conceptContent.difficulty)}>
              <span className="text-xs font-semibold capitalize tracking-wide">{conceptContent.difficulty}</span>
            </Badge>
          </div>
          <p className="text-gray-700 text-base leading-relaxed mt-2">{conceptContent.summary}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Always visible details */}
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 space-y-4">
            <p className="text-blue-900 text-base leading-relaxed">{conceptContent.details}</p>
            
            {conceptContent.keyPoints.length > 0 && (
              <div>
                <h4 className="text-base font-bold text-blue-900 mb-3 flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2" />
                  Key Points:
                </h4>
                <ul className="text-blue-800 space-y-2">
                  {conceptContent.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start text-base leading-relaxed">
                      <span className="flex-shrink-0 w-4 h-4 bg-blue-200 rounded-full text-xs flex items-center justify-center mr-2 mt-0.5">
                        {index + 1}
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Always visible examples */}
          {conceptContent.examples.length > 0 && (
            <div className="bg-green-50 p-5 rounded-lg border border-green-200">
              <h4 className="text-base font-bold text-green-900 mb-3 flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Examples:
              </h4>
              <div className="space-y-3">
                {conceptContent.examples.map((example, index) => (
                  <div key={index} className="bg-white p-4 rounded-md border border-green-200 shadow-sm">
                    <p className="text-green-800 text-base leading-relaxed">{example}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            <Button 
              onClick={handleExplainFurther} 
              variant="outline" 
              size="default" 
              className="flex items-center justify-center text-sm font-medium h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Explain further"
            >
              <Brain className="h-4 w-4 mr-2" />
              Explain Further
            </Button>
            <Button 
              onClick={handleShowExamples} 
              variant="outline" 
              size="default"
              className="flex items-center justify-center text-sm font-medium h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Show more examples"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              More Examples
            </Button>
            <Button 
              onClick={handlePracticeThis} 
              size="default" 
              className="flex items-center justify-center bg-green-700 hover:bg-green-800 text-sm font-medium h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              aria-label="Practice this concept"
            >
              <Target className="h-4 w-4 mr-2" />
              Practice This
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
