'use client'

import { useState, memo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Calculator, RotateCcw, Eye, EyeOff, Zap } from 'lucide-react'
import { 
  InteractiveComponentProps, 
  FormulaContent
} from '@/types'

export const FormulaExplorer = memo(function FormulaExplorer({ 
  onInteraction, 
  content, 
  id 
}: InteractiveComponentProps) {
  void onInteraction // Intentionally unused - interface requirement
  void id // Intentionally unused - interface requirement
  const [variableValues, setVariableValues] = useState<Record<string, number>>({})
  const [showSteps, setShowSteps] = useState(false)
  const [selectedExample, setSelectedExample] = useState<string | null>(null)
  const [result, setResult] = useState<number | string>(0)
  
  const formulaContent = content as FormulaContent

  // Initialize variable values
  useEffect(() => {
    if (!formulaContent?.variables || formulaContent.variables.length === 0) {
      console.warn('No variables found in formula content')
      return
    }

    const initialValues: Record<string, number> = {}
    formulaContent.variables.forEach(variable => {
      if (typeof variable.defaultValue === 'number' && isFinite(variable.defaultValue)) {
        initialValues[variable.id] = variable.defaultValue
      } else {
        console.warn(`Invalid default value for variable ${variable.id}:`, variable.defaultValue)
        initialValues[variable.id] = 0
      }
    })
    setVariableValues(initialValues)
  }, [formulaContent?.variables])

  // Safe mathematical expression evaluator to replace dangerous eval()
  const safeEvaluate = useCallback((expression: string): number | string => {
    try {
      // Clean the expression first
      const safeExpression = expression
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log')
        .replace(/ln/g, 'Math.log')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/pi/g, 'Math.PI')
        .replace(/e(?![0-9])/g, 'Math.E')

      // Validate that expression only contains safe mathematical operations
      // Allow digits, operators, parentheses, Math functions, and whitespace
      const safePattern = /^[0-9+\-*/.()Math\s]+$/
      const cleanedForValidation = safeExpression.replace(/Math\.(sin|cos|tan|log|sqrt|abs|PI|E)/g, 'M')
      
      if (!safePattern.test(cleanedForValidation)) {
        console.warn('Invalid expression pattern:', safeExpression)
        return 'Error: Invalid expression'
      }

      // Use Function constructor for safer evaluation than eval
      const func = new Function('Math', `"use strict"; return (${safeExpression})`)
      const result = func(Math)
      
      if (typeof result === 'number') {
        return isFinite(result) ? Number(result.toFixed(4)) : 'Undefined'
      }
      
      return result
    } catch (error) {
      console.warn('Formula evaluation error:', error)
      return 'Error'
    }
  }, [])

  const calculateFormula = useCallback((): number | string => {
    if (!formulaContent?.formula || !formulaContent?.variables) {
      return 'Error: Missing formula or variables'
    }

    try {
      let expression = formulaContent.formula
      
      // Replace variable symbols with their current values
      formulaContent.variables.forEach(variable => {
        const regex = new RegExp(`\\b${variable.symbol}\\b`, 'g')
        expression = expression.replace(regex, String(variableValues[variable.id] || variable.defaultValue))
      })

      // Handle mathematical functions and constants
      expression = expression
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log')
        .replace(/ln/g, 'Math.log')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/pi/g, 'Math.PI')
        .replace(/e(?![0-9])/g, 'Math.E')

      return safeEvaluate(expression)
    } catch {
      return 'Error'
    }
  }, [formulaContent?.formula, formulaContent?.variables, variableValues, safeEvaluate])

  // Calculate result when variables change
  useEffect(() => {
    const calculatedResult = calculateFormula()
    setResult(calculatedResult)
  }, [calculateFormula])

  const handleVariableChange = (variableId: string, value: number) => {
    // Validate the input value
    if (typeof value !== 'number' || !isFinite(value)) {
      console.warn(`Invalid value for variable ${variableId}:`, value)
      return
    }

    setVariableValues(prev => ({
      ...prev,
      [variableId]: value
    }))
  }

  const calculateStep = (stepExpression: string): number | string => {
    if (!formulaContent?.variables) {
      return 'Error: Missing variables'
    }

    try {
      let expression = stepExpression
      
      formulaContent.variables.forEach(variable => {
        const regex = new RegExp(`\\b${variable.symbol}\\b`, 'g')
        expression = expression.replace(regex, String(variableValues[variable.id] || variable.defaultValue))
      })

      expression = expression
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log')
        .replace(/ln/g, 'Math.log')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/pi/g, 'Math.PI')
        .replace(/e(?![0-9])/g, 'Math.E')

      return safeEvaluate(expression)
    } catch {
      return 'Error'
    }
  }

  const handleExampleSelect = (exampleId: string) => {
    const example = formulaContent?.examples?.find(ex => ex.id === exampleId)
    if (example) {
      setVariableValues(example.values)
      setSelectedExample(exampleId)
    }
  }

  const handleReset = () => {
    if (!formulaContent?.variables) return
    
    const resetValues: Record<string, number> = {}
    formulaContent.variables.forEach(variable => {
      resetValues[variable.id] = variable.defaultValue
    })
    setVariableValues(resetValues)
    setSelectedExample(null)
    setShowSteps(false)
  }

  const renderFormula = (formula: string, large = false) => {
    if (!formulaContent?.variables) return null
    
    let displayFormula = formula
    
    // Replace variables with their symbols for display
    formulaContent.variables.forEach(variable => {
      const regex = new RegExp(`\\b${variable.id}\\b`, 'g')
      displayFormula = displayFormula.replace(regex, variable.symbol)
    })

    // Make mathematical notation more readable
    displayFormula = displayFormula
      .replace(/\*\*/g, '^')
      .replace(/\*/g, '·')
      .replace(/Math\.sin/g, 'sin')
      .replace(/Math\.cos/g, 'cos')
      .replace(/Math\.tan/g, 'tan')
      .replace(/Math\.log/g, 'log')
      .replace(/Math\.sqrt/g, '√')
      .replace(/Math\.PI/g, 'π')
      .replace(/Math\.E/g, 'e')

    return (
      <code className={`font-mono ${large ? 'text-xl' : 'text-base'} bg-gray-100 px-2 py-1 rounded`}>
        {displayFormula}
      </code>
    )
  }

  // Error boundary for invalid content - moved after all hooks
  if (!formulaContent || !formulaContent.formula || !formulaContent.variables) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p className="font-medium">Error: Invalid formula content</p>
            <p className="text-sm text-gray-600 mt-1">
              The formula content is missing required properties (formula, variables).
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Calculator className="h-6 w-6 text-purple-600 mr-2" />
            {formulaContent.title}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSteps(!showSteps)}
            >
              {showSteps ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showSteps ? 'Hide' : 'Show'} Steps
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-gray-600 text-base leading-relaxed mt-1">{formulaContent.description}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Examples */}
        {formulaContent.examples && formulaContent.examples.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Example Scenarios</h4>
            <div className="grid gap-2">
              {formulaContent.examples.map((example, index) => (
                <Button
                  key={example.id || `example-${index}`}
                  variant={selectedExample === example.id ? "default" : "outline"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => handleExampleSelect(example.id)}
                >
                  <div className="text-left">
                    <div className="font-medium">{example.name}</div>
                    {example.description && (
                      <div className="text-sm text-gray-600 mt-1">{example.description}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Variables */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Zap className="h-4 w-4 mr-2" />
            Variables
          </h4>
          <div className="grid gap-4 p-4 bg-gray-50 rounded-lg">
            {formulaContent.variables.map((variable, index) => (
              <div key={variable.id || `variable-${index}`} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-white px-2 py-1 rounded">
                      {variable.symbol}
                    </code>
                    <span className="text-sm font-medium">{variable.name}</span>
                    {variable.unit && (
                      <span className="text-xs text-gray-500">({variable.unit})</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600 font-mono">
                    {variableValues[variable.id]?.toFixed(2) || variable.defaultValue}
                  </span>
                </div>
                <Slider
                  value={[variableValues[variable.id] || variable.defaultValue]}
                  onValueChange={(values) => handleVariableChange(variable.id, values[0])}
                  min={variable.min}
                  max={variable.max}
                  step={variable.step}
                  className="w-full"
                />
                {variable.description && (
                  <p className="text-xs text-gray-600">{variable.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Result</h4>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-blue-800 mb-2">
                {typeof result === 'number' ? result.toFixed(4) : result}
              </div>
              <p className="text-sm text-blue-600">
                Current calculation result
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-step calculation */}
        {showSteps && formulaContent.steps && formulaContent.steps.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Step-by-step Calculation</h4>
            <div className="space-y-3">
              {formulaContent.steps.map((step, index) => (
                <div 
                  key={step.id || `step-${index}`} 
                  className={`p-3 rounded-lg border ${
                    step.highlight ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 mb-2">{step.description}</p>
                      <div className="flex items-center gap-3">
                        {renderFormula(step.expression)}
                        <span className="text-gray-400">=</span>
                        <span className="font-mono text-blue-600 font-medium">
                          {calculateStep(step.expression)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explanation */}
        {formulaContent.explanation && (
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">Understanding the Formula:</p>
            <p className="text-sm text-green-700">{formulaContent.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}) 