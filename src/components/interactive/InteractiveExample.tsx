'use client'

import { useState, memo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Activity } from 'lucide-react'
import { InteractiveComponentProps, ExampleContent, Control, DisplayElement } from '@/types'

export const InteractiveExample = memo(function InteractiveExample({ 
  onInteraction: _onInteraction, 
  content, 
  id: _id 
}: InteractiveComponentProps) {
  void _onInteraction // Intentionally unused - interface requirement
  void _id // Intentionally unused - interface requirement
  const [controlValues, setControlValues] = useState<Record<string, number | boolean>>({})
  const isPlaying = useState(false)[0]
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

  // Enhanced evaluation system that handles different domains
  const evaluateExpression = (expression: string): string => {
    try {
      let evaluatedExpression = expression
      
      // Replace control variables with their current values
      Object.entries(controlValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\$${key}`, 'g')
        evaluatedExpression = evaluatedExpression.replace(regex, String(value))
      })
      
      // Replace time variable if used
      evaluatedExpression = evaluatedExpression.replace(/\$time/g, String(animationFrame * 0.1))
      
      // Handle mathematical functions
      evaluatedExpression = evaluatedExpression.replace(/sin\(([^)]+)\)/g, (_, expr) => {
        const result = Math.sin(parseFloat(expr) || 0)
        return result.toFixed(3)
      })
      
      evaluatedExpression = evaluatedExpression.replace(/cos\(([^)]+)\)/g, (_, expr) => {
        const result = Math.cos(parseFloat(expr) || 0)
        return result.toFixed(3)
      })
      
      evaluatedExpression = evaluatedExpression.replace(/tan\(([^)]+)\)/g, (_, expr) => {
        const result = Math.tan(parseFloat(expr) || 0)
        return result.toFixed(3)
      })
      
      evaluatedExpression = evaluatedExpression.replace(/sqrt\(([^)]+)\)/g, (_, expr) => {
        const result = Math.sqrt(parseFloat(expr) || 0)
        return result.toFixed(3)
      })
      
      evaluatedExpression = evaluatedExpression.replace(/pow\(([^,]+),([^)]+)\)/g, (_, base, exp) => {
        const result = Math.pow(parseFloat(base) || 0, parseFloat(exp) || 0)
        return result.toFixed(3)
      })
      
      // Handle basic arithmetic
      if (/^[\d+\-*/.() ]+$/.test(evaluatedExpression)) {
        const result = eval(evaluatedExpression)
        return typeof result === 'number' ? result.toFixed(3) : String(result)
      }
      
      return evaluatedExpression
    } catch {
      return expression
    }
  }

  // Convert HSL to RGB
  const hslToRgb = (h: number, s: number, l: number) => {
    h = h / 360
    s = s / 100
    l = l / 100
    
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h * 6) % 2 - 1))
    const m = l - c / 2
    
    let r = 0, g = 0, b = 0
    
    if (0 <= h && h < 1/6) {
      r = c; g = x; b = 0
    } else if (1/6 <= h && h < 2/6) {
      r = x; g = c; b = 0
    } else if (2/6 <= h && h < 3/6) {
      r = 0; g = c; b = x
    } else if (3/6 <= h && h < 4/6) {
      r = 0; g = x; b = c
    } else if (4/6 <= h && h < 5/6) {
      r = x; g = 0; b = c
    } else if (5/6 <= h && h < 1) {
      r = c; g = 0; b = x
    }
    
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)
    
    return `rgb(${r}, ${g}, ${b})`
  }

  const renderControl = (control: Control) => {
    const value = controlValues[control.id]
    
    switch (control.type) {
      case 'slider':
        return (
          <div key={control.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">{control.label}</label>
              <span className="text-sm text-muted-foreground font-mono">{typeof value === 'number' ? value.toFixed(1) : value}</span>
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
            className="p-4 bg-gray-50 rounded-lg border"
            style={element.style}
          >
            <p className="text-sm leading-relaxed">{evaluatedContent}</p>
          </div>
        )
      
      case 'formula':
        return (
          <div 
            key={element.id}
            className="p-4 bg-blue-50 rounded-lg border border-blue-200"
            style={element.style}
          >
            <code className="text-lg font-mono text-blue-800 block text-center">{evaluatedContent}</code>
          </div>
        )
      
      case 'color':
        // Handle color display with HSL or RGB values
        const hue = Number(controlValues.hue || controlValues['Hue Adjustment'] || 0)
        const saturation = Number(controlValues.saturation || controlValues['Saturation Level'] || 50)
        const brightness = Number(controlValues.brightness || controlValues['Brightness Level'] || 50)
        const currentColor = hslToRgb(hue, saturation, brightness)
        
        return (
          <div key={element.id} className="space-y-4">
            <div className="text-center">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">The current color based on your adjustments</h4>
              <div 
                className="w-full h-32 rounded-lg border-2 border-input shadow-inner transition-all duration-300"
                style={{ backgroundColor: currentColor }}
              />
              <div className="mt-3 p-3 bg-muted/50 rounded text-sm space-y-1">
                <div className="flex justify-between">
                  <span>HSL:</span>
                  <span className="font-mono">hsl({hue.toFixed(0)}°, {saturation.toFixed(0)}%, {brightness.toFixed(0)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>RGB:</span>
                  <span className="font-mono">{currentColor}</span>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'shape':
        const size = Number(controlValues.size || controlValues.amplitude || 50)
        const rotation = isPlaying ? animationFrame * 2 : 0
        
        return (
          <div 
            key={element.id}
            className="flex justify-center items-center p-8"
            style={element.style}
          >
            <div
              className="transition-all duration-300 shadow-lg"
              style={{
                width: `${Math.max(size, 10)}px`,
                height: `${Math.max(size, 10)}px`,
                backgroundColor: controlValues.color ? 'var(--primary)' : 'var(--accent)',
                borderRadius: evaluatedContent.includes('circle') ? '50%' : '8px',
                transform: `rotate(${rotation}deg)`,
              }}
            />
          </div>
        )
      
      case 'graph':
        // Simple graph visualization
        const amplitude = Number(controlValues.amplitude || 5)
        const frequency = Number(controlValues.frequency || 1)
        const time = animationFrame * 0.1
        const points = []
        
        for (let i = 0; i < 100; i++) {
          const x = (i / 100) * 4 * Math.PI
          const y = amplitude * Math.sin(frequency * x + time)
          points.push(`${i * 2},${50 - y * 5}`)
        }
        
        return (
          <Card key={element.id} className="p-4">
            <svg width="200" height="100" className="border">
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                points={points.join(' ')}
              />
              <line x1="0" y1="50" x2="200" y2="50" stroke="#e5e7eb" strokeWidth="1" />
            </svg>
          </Card>
        )
      
      case 'visualization':
        // General purpose visualization based on content
        return (
          <div 
            key={element.id}
            className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border"
          >
            <div className="text-center space-y-2">
              <div className="text-lg font-semibold text-gray-800">
                {evaluatedContent}
              </div>
              <div className="text-sm text-muted-foreground">
                Adjust the sliders to see how changes affect the result.
              </div>
            </div>
          </div>
        )
      
      default:
        return (
          <div key={element.id} className="p-4 bg-gray-100 rounded-lg border">
            <span className="text-sm text-muted-foreground">{evaluatedContent}</span>
          </div>
        )
    }
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Lightbulb className="h-6 w-6 text-yellow-600 mr-2" />
            {exampleContent.title}
          </CardTitle>
          {exampleContent.category && (
            <Badge variant="outline" className="text-xs font-medium">
              {exampleContent.category}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-base leading-relaxed mt-1">{exampleContent.description}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            Controls
          </h4>
          <div className="grid gap-4 p-4 bg-gray-50 rounded-lg border">
            {exampleContent.controls.map(renderControl)}
          </div>
        </div>

        {/* Display Area */}
        <div className="space-y-4">
          <h4 className="font-medium">Interactive Display</h4>
          <Card className="min-h-[200px] p-4 space-y-4">
            {exampleContent.display.map(renderDisplayElement)}
          </Card>
        </div>

        {/* Explanation */}
        <Card className="bg-[--blue-50] border-[--blue-200]">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">How it works:</p>
            <p className="text-sm text-blue-700 leading-relaxed">{exampleContent.explanation}</p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}) 