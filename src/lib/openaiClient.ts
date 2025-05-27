import { OPENAI_MODEL } from '@/lib/config'

export async function chatCompletion(params: {
  messages: unknown
  model?: string
  temperature?: number
  max_tokens?: number
}): Promise<any> {
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

