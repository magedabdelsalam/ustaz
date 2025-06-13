'use client'

import { useState, memo, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { BarChart3, LineChart, PieChart, Zap, RotateCcw } from 'lucide-react'
import { 
  InteractiveComponentProps, 
  DataPoint, 
  FunctionConfig,
  GraphContent
} from '@/types'

export const GraphVisualizer = memo(function GraphVisualizer({ 
  onInteraction, 
  content, 
  id 
}: InteractiveComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [controlValues, setControlValues] = useState<Record<string, number | boolean>>({})
  
  const graphContent = content as GraphContent

  // Initialize control values
  useEffect(() => {
    if (graphContent.controls) {
      const initialValues: Record<string, number | boolean> = {}
      graphContent.controls.forEach(control => {
        initialValues[control.id] = control.defaultValue
      })
      setControlValues(initialValues)
    }
  }, [graphContent.controls])

  // Redraw graph when controls change
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)

    const width = rect.width
    const height = rect.height
    const padding = 60

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Get data points
    const data = graphContent.type === 'function' 
      ? generateFunctionData()
      : (graphContent.data as DataPoint[])

    if (!data || data.length === 0) return

    // Calculate bounds
    const xValues = data.map(d => typeof d.x === 'number' ? d.x : 0)
    const yValues = data.map(d => d.y)
    
    const xMin = graphContent.xAxis.min ?? Math.min(...xValues)
    const xMax = graphContent.xAxis.max ?? Math.max(...xValues)
    const yMin = graphContent.yAxis.min ?? Math.min(...yValues)
    const yMax = graphContent.yAxis.max ?? Math.max(...yValues)

    const xRange = xMax - xMin
    const yRange = yMax - yMin

    // Helper functions for coordinate transformation
    const toCanvasX = (x: number) => padding + ((x - xMin) / xRange) * (width - 2 * padding)
    const toCanvasY = (y: number) => height - padding - ((y - yMin) / yRange) * (height - 2 * padding)

    // Draw axes
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    // X-axis
    ctx.moveTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    // Y-axis
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, height - padding)
    ctx.stroke()

    // Draw grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    const gridLines = 10

    for (let i = 0; i <= gridLines; i++) {
      const x = padding + (i / gridLines) * (width - 2 * padding)
      const y = padding + (i / gridLines) * (height - 2 * padding)
      
      // Vertical grid lines
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, height - padding)
      ctx.stroke()
      
      // Horizontal grid lines
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // Draw labels
    ctx.fillStyle = '#374151'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    
    // X-axis label
    ctx.fillText(graphContent.xAxis.label, width / 2, height - 10)
    
    // Y-axis label
    ctx.save()
    ctx.translate(15, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(graphContent.yAxis.label, 0, 0)
    ctx.restore()

    // Draw axis values
    for (let i = 0; i <= 5; i++) {
      const xValue = xMin + (i / 5) * xRange
      const yValue = yMin + (i / 5) * yRange
      
      ctx.fillText(
        xValue.toFixed(1), 
        padding + (i / 5) * (width - 2 * padding), 
        height - padding + 20
      )
      
      ctx.textAlign = 'right'
      ctx.fillText(
        yValue.toFixed(1), 
        padding - 10, 
        height - padding - (i / 5) * (height - 2 * padding) + 5
      )
      ctx.textAlign = 'center'
    }

    // Draw data based on graph type
    switch (graphContent.type) {
      case 'line':
      case 'function':
        drawLineGraph(ctx, data, toCanvasX, toCanvasY)
        break
      case 'bar':
        drawBarGraph(ctx, data, toCanvasX, toCanvasY, width, height, padding)
        break
      case 'scatter':
        drawScatterPlot(ctx, data, toCanvasX, toCanvasY)
        break
      case 'pie':
        drawPieChart(ctx, data, width, height)
        break
    }
  }, [controlValues, graphContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw graph when controls change
  useEffect(() => {
    drawGraph()
  }, [drawGraph])

  const handleControlChange = (controlId: string, value: number | boolean) => {
    setControlValues(prev => ({
      ...prev,
      [controlId]: value
    }))

    onInteraction('graph_control_changed', {
      componentId: id,
      controlId,
      value,
      allValues: { ...controlValues, [controlId]: value }
    })
  }

  const evaluateFunction = (expression: string, x: number): number => {
    try {
      // Replace variables with actual values
      let evaluatedExpression = expression
      
      // Replace control variables
      Object.entries(controlValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'g')
        evaluatedExpression = evaluatedExpression.replace(regex, String(value))
      })
      
      // Replace x variable
      evaluatedExpression = evaluatedExpression.replace(/\bx\b/g, String(x))
      
      // Handle common mathematical functions
      evaluatedExpression = evaluatedExpression
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/pi/g, 'Math.PI')
        .replace(/e(?![0-9])/g, 'Math.E')
      
      return eval(evaluatedExpression)
    } catch {
      return 0
    }
  }

  const generateFunctionData = (): DataPoint[] => {
    if (typeof graphContent.data !== 'object' || Array.isArray(graphContent.data)) {
      return []
    }

    const funcConfig = graphContent.data as FunctionConfig
    const [minX, maxX] = funcConfig.domain || [-10, 10]
    const resolution = funcConfig.resolution || 100
    const step = (maxX - minX) / resolution

    const points: DataPoint[] = []
    for (let x = minX; x <= maxX; x += step) {
      const y = evaluateFunction(funcConfig.expression, x)
      if (!isNaN(y) && isFinite(y)) {
        points.push({ x, y })
      }
    }

    return points
  }

  const drawLineGraph = (
    ctx: CanvasRenderingContext2D, 
    data: DataPoint[], 
    toCanvasX: (x: number) => number, 
    toCanvasY: (y: number) => number
  ) => {
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.beginPath()

    data.forEach((point, index) => {
      const x = typeof point.x === 'number' ? point.x : index
      const canvasX = toCanvasX(x)
      const canvasY = toCanvasY(point.y)

      if (index === 0) {
        ctx.moveTo(canvasX, canvasY)
      } else {
        ctx.lineTo(canvasX, canvasY)
      }
    })

    ctx.stroke()

    // Draw points
    ctx.fillStyle = '#3b82f6'
    data.forEach((point, index) => {
      const x = typeof point.x === 'number' ? point.x : index
      const canvasX = toCanvasX(x)
      const canvasY = toCanvasY(point.y)
      
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, 4, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  const drawBarGraph = (
    ctx: CanvasRenderingContext2D, 
    data: DataPoint[], 
    toCanvasX: (x: number) => number, 
    toCanvasY: (y: number) => number,
    width: number,
    height: number,
    padding: number
  ) => {
    const barWidth = (width - 2 * padding) / data.length * 0.8
    
    data.forEach((point, index) => {
      const x = typeof point.x === 'number' ? point.x : index
      const canvasX = toCanvasX(x) - barWidth / 2
      const canvasY = toCanvasY(point.y)
      const barHeight = (height - padding) - canvasY
      
      ctx.fillStyle = point.color || '#3b82f6'
      ctx.fillRect(canvasX, canvasY, barWidth, barHeight)
    })
  }

  const drawScatterPlot = (
    ctx: CanvasRenderingContext2D, 
    data: DataPoint[], 
    toCanvasX: (x: number) => number, 
    toCanvasY: (y: number) => number
  ) => {
    data.forEach((point) => {
      const x = typeof point.x === 'number' ? point.x : 0
      const canvasX = toCanvasX(x)
      const canvasY = toCanvasY(point.y)
      
      ctx.fillStyle = point.color || '#3b82f6'
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  const drawPieChart = (
    ctx: CanvasRenderingContext2D, 
    data: DataPoint[], 
    width: number, 
    height: number
  ) => {
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 3
    
    const total = data.reduce((sum, point) => sum + point.y, 0)
    let currentAngle = -Math.PI / 2
    
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
    
    data.forEach((point, index) => {
      const sliceAngle = (point.y / total) * 2 * Math.PI
      
      ctx.fillStyle = point.color || colors[index % colors.length]
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      ctx.closePath()
      ctx.fill()
      
      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2
      const labelX = centerX + Math.cos(labelAngle) * (radius + 20)
      const labelY = centerY + Math.sin(labelAngle) * (radius + 20)
      
      ctx.fillStyle = '#374151'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        point.label || `${((point.y / total) * 100).toFixed(1)}%`, 
        labelX, 
        labelY
      )
      
      currentAngle += sliceAngle
    })
  }

  const handleReset = () => {
    if (graphContent.controls) {
      const resetValues: Record<string, number | boolean> = {}
      graphContent.controls.forEach(control => {
        resetValues[control.id] = control.defaultValue
      })
      setControlValues(resetValues)
    }
    onInteraction('graph_reset', { componentId: id })
  }

  const getGraphIcon = () => {
    switch (graphContent.type) {
      case 'line':
      case 'function':
        return <LineChart className="h-5 w-5 text-blue-600 mr-2" />
      case 'bar':
        return <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
      case 'pie':
        return <PieChart className="h-5 w-5 text-blue-600 mr-2" />
      default:
        return <Zap className="h-5 w-5 text-blue-600 mr-2" />
    }
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            {getGraphIcon()}
            <span className="ml-2">{graphContent.title}</span>
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-base leading-relaxed mt-1">{graphContent.description}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Controls */}
        {graphContent.controls && graphContent.controls.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Parameters</h4>
            <div className="grid gap-4 p-4 bg-gray-50 rounded-lg">
              {graphContent.controls.map(control => (
                <div key={control.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{control.label}</label>
                    <span className="text-sm text-muted-foreground">
                      {controlValues[control.id]}
                    </span>
                  </div>
                  {control.type === 'slider' && (
                    <Slider
                      value={[controlValues[control.id] as number]}
                      onValueChange={(values) => handleControlChange(control.id, values[0])}
                      min={control.min || 0}
                      max={control.max || 100}
                      step={control.step || 1}
                      className="w-full"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Graph Canvas */}
        <div className="space-y-4">
          <h4 className="font-medium">Visualization</h4>
          <Card className="overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-96 block"
              style={{ width: '100%', height: '384px' }}
            />
          </Card>
        </div>

        {/* Explanation */}
        {graphContent.explanation && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">Analysis:</p>
            <p className="text-sm text-blue-700">{graphContent.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}) 