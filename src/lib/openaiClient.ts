import { OPENAI_MODEL } from '@/lib/config'
import { ChatCompletionResponse } from '@/types'

export async function chatCompletion(params: {
  messages: unknown
  model?: string
  temperature?: number
  max_tokens?: number
}): Promise<ChatCompletionResponse> {
  // Create an AbortController for timeout handling
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
  
  try {
    const res = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_MODEL, ...params }),
      signal: controller.signal // Add the abort signal
    })
    
    // Clear the timeout if request completes successfully
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      throw new Error(`OpenAI request failed with status ${res.status}`)
    }
    return res.json()
  } catch (error) {
    // Clear the timeout on any error
    clearTimeout(timeoutId)
    
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI request timed out after 30 seconds')
    }
    
    // Re-throw other errors
    throw error
  }
}

