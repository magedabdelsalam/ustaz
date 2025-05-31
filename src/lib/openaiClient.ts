import { OPENAI_MODEL } from '@/lib/config'
import { ChatCompletionResponse } from '@/types'

export async function chatCompletion(params: {
  messages: unknown
  model?: string
  temperature?: number
  max_tokens?: number
}): Promise<ChatCompletionResponse> {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, ...params }),
  })
  if (!res.ok) {
    throw new Error('OpenAI request failed')
  }
  return res.json()
}

