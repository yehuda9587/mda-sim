import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { buildSystemPrompt, Message } from '@/lib/system-prompt'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 })
    }

    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' }
    const systemPrompt = buildSystemPrompt(mode || 'ב', messages)

    // Buffered (non-streaming) response — required for Vercel Free Tier
    const completion = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      stream: false,
    })

    const text = completion.choices[0]?.message?.content ?? ''

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
