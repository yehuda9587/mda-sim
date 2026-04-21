import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    const systemPrompt = buildSystemPrompt(mode || 'ב', messages);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // השתמש ב-1.5 ליציבות מקסימלית
      systemInstruction: systemPrompt,
    });

    // תיקון השגיאה: מסננים את ההיסטוריה כך שתתחיל תמיד ב-User
    let history = messages.slice(0, -1)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    // אם ההודעה הראשונה היא של המודל, אנחנו מורידים אותה מההיסטוריה הרשמית
    if (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) { controller.error(err); }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (err: any) {
    console.error('Gemini Error:', err);
    return NextResponse.json({ error: 'Connection error', details: err.message }, { status: 500 });
  }
}
