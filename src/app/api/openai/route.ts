import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { OPENAI_API_KEY, OPENAI_MODEL } from '@/lib/config'

// Initialize OpenAI only if API key is available
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

export async function POST(request: Request) {
  const params = await request.json()
  
  // If no OpenAI API key, return simulated response
  if (!openai) {
    const simulatedResponse = {
      choices: [{
        message: {
          content: "This is a simulated response. Please add your OpenAI API key to .env.local to enable real AI responses.",
          role: "assistant"
        },
        finish_reason: "stop"
      }],
      model: OPENAI_MODEL,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    }
    return NextResponse.json(simulatedResponse)
  }

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

