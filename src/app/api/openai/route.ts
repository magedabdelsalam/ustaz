import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { OPENAI_API_KEY, OPENAI_MODEL } from '@/lib/config'

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

export async function POST(request: Request) {
  const params = await request.json()
  try {
    const result = await openai.chat.completions.create({
      model: params.model || OPENAI_MODEL,
      messages: params.messages,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.max_tokens,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: 'OpenAI API error' }, { status: 500 })
  }
}

