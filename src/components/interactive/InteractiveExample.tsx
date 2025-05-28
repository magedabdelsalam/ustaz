'use client'

import { useState, memo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Play, Pause, RotateCcw, Lightbulb, Activity } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface ExampleContent {
  title: string
  description: string
  category?: string
  controls: Control[]
  display: DisplayElement[]
  explanation: string
  initialValues?: Record<string, number | boolean>
}

interface Control {
  id: string
  type: 'slider' | 'toggle' | 'button'
  label: string
  min?: number
  max?: number
  step?: number
  defaultValue?: number | boolean
}

interface DisplayElement {
  id: string
  type: 'text' | 'shape' | 'chart' | 'formula'
  content: string
  style?: Record<string, string | number>
  dependsOn?: string[]
}

export const InteractiveExample = memo(function InteractiveExample({ 
  onInteraction: _onInteraction, 
  content, 
  id: _id 
}: InteractiveComponentProps) {
  void _onInteraction // Intentionally unused - interface requirement
  void _id // Intentionally unused - interface requirement
  const [controlValues, setControlValues] = useState<Record<string, number | boolean>>({})
  const [isPlaying, setIsPlaying] = useState(false)
  const [animationFrame, setAnimationFrame] = useState(0)
  
  const exampleContent = content as ExampleContent

  // Initialize control values
  useEffect(() => {
    const initialValues: Record<string, number | boolean> = {}
    
    exampleContent.controls.forEach(control => {
      if (exampleContent.initialValues?.[control.id] !== undefined) {
        initialValues[control.id] = exampleContent.initialValues[control.id]
      } else {
        initialValues[control.id] = control.defaultValue ?? (control.type === 'toggle' ? false : control.min ?? 0)
      }
    })
    
    setControlValues(initialValues)
  }, [exampleContent])

  // Animation loop
  useEffect(() => {
    let animationId: number
    
    if (isPlaying) {
      const animate = () => {
        setAnimationFrame(prev => prev + 1)
        animationId = requestAnimationFrame(animate)
      }
      animationId = requestAnimationFrame(animate)
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isPlaying])

  const handleControlChange = (controlId: string, value: number | boolean) => {
    setControlValues(prev => ({
      ...prev,
      [controlId]: value
    }))
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleReset = () => {
    const resetValues: Record<string, number | boolean> = {}
    
    exampleContent.controls.forEach(control => {
      resetValues[control.id] = control.defaultValue ?? (control.type === 'toggle' ? false : control.min ?? 0)
    })
    
    setControlValues(resetValues)
    setIsPlaying(false)
    setAnimationFrame(0)
  }

  const evaluateExpression = (expression: string): string => {
    try {
      // Replace control variables with their current values
      let evaluatedExpression = expression
      
      Object.entries(controlValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\$${key}`, 'g')
        evaluatedExpression = evaluatedExpression.replace(regex, String(value))
      })
      
      // Replace time variable if used
      evaluatedExpression = evaluatedExpression.replace(/\$time/g, String(animationFrame * 0.1))
      
      // Simple evaluation (for display purposes only)
      if (evaluatedExpression.includes('sin')) {
        evaluatedExpression = evaluatedExpression.replace(/sin\(([^)]+)\)/g, (_, expr) => {
          const result = Math.sin(eval(expr))
          return result.toFixed(2)
        })
      }
      
      if (evaluatedExpression.includes('cos')) {
        evaluatedExpression = evaluatedExpression.replace(/cos\(([^)]+)\)/g, (_, expr) => {
          const result = Math.cos(eval(expr))
          return result.toFixed(2)
        })
      }
      
      // Handle basic arithmetic
      if (/^[\d+\-*/.() ]+$/.test(evaluatedExpression)) {
        const result = eval(evaluatedExpression)
        return typeof result === 'number' ? result.toFixed(2) : String(result)
      }
      
      return evaluatedExpression
    } catch {
      return expression
    }
  }

  const renderControl = (control: Control) => {
    const value = controlValues[control.id]
    
    switch (control.type) {
      case 'slider':
        return (
          <div key={control.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">{control.label}</label>
              <span className="text-sm text-gray-600">{value}</span>
            </div>
            <Slider
              value={[value as number]}
              onValueChange={(values: number[]) => handleControlChange(control.id, values[0])}
              min={control.min ?? 0}
              max={control.max ?? 100}
              step={control.step ?? 1}
              className="w-full"
            />
          </div>
        )
      
      case 'toggle':
        return (
          <div key={control.id} className="flex items-center justify-between">
            <label className="text-sm font-medium">{control.label}</label>
            <Switch
              checked={value as boolean}
              onCheckedChange={(checked: boolean) => handleControlChange(control.id, checked)}
            />
          </div>
        )
      
      case 'button':
        return (
          <Button
            key={control.id}
            variant="outline"
            size="sm"
            onClick={() => handleControlChange(control.id, !(value as boolean))}
            className="w-full"
          >
            {control.label}
          </Button>
        )
      
      default:
        return null
    }
  }

  const renderDisplayElement = (element: DisplayElement) => {
    const evaluatedContent = evaluateExpression(element.content)
    
    switch (element.type) {
      case 'text':
        return (
          <div 
            key={element.id}
            className="p-3 bg-gray-50 rounded-lg"
            style={element.style}
          >
            <p className="text-sm">{evaluatedContent}</p>
          </div>
        )
      
      case 'formula':
        return (
          <div 
            key={element.id}
            className="p-4 bg-blue-50 rounded-lg border border-blue-200"
            style={element.style}
          >
            <code className="text-lg font-mono text-blue-800">{evaluatedContent}</code>
          </div>
        )
      
      case 'shape':
        const size = Number(controlValues.size) || 50
        const color = controlValues.color ? '#10b981' : '#3b82f6'
        
        return (
          <div 
            key={element.id}
            className="flex justify-center p-4"
            style={element.style}
          >
            <div
              style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: color,
                borderRadius: evaluatedContent.includes('circle') ? '50%' : '4px',
                transform: `rotate(${animationFrame * 2}deg)`,
                transition: isPlaying ? 'none' : 'all 0.3s ease'
              }}
            />
          </div>
        )
      
      default:
        return (
          <div key={element.id} className="p-3 bg-gray-100 rounded">
            <span className="text-sm text-gray-600">{evaluatedContent}</span>
          </div>
        )
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Lightbulb className="h-5 w-5 text-yellow-600 mr-2" />
            {exampleContent.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePlayPause}
              className="flex items-center gap-1"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-yellow-900 text-sm">{exampleContent.description}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            Controls
          </h4>
          <div className="grid gap-4 p-4 bg-gray-50 rounded-lg">
            {exampleContent.controls.map(renderControl)}
          </div>
        </div>

        {/* Display Area */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Interactive Display</h4>
          <div className="min-h-[200px] p-4 bg-white border rounded-lg space-y-4">
            {exampleContent.display.map(renderDisplayElement)}
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">How it works:</p>
          <p className="text-sm text-blue-700">{exampleContent.explanation}</p>
        </div>
      </CardContent>
    </Card>
  )
}) 