import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    const systemPrompt = buildSystemPrompt(mode || 'א', messages);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: systemPrompt,
    });

    // הפיכת ההודעות לפורמט של גוגל (user/model)
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // תיקון קריטי: אם ההיסטוריה לא מתחילה ב-user, ננקה אותה עד ה-user הראשון
    // זה מונע את שגיאת ה-"First content should be with role 'user'"
    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    const lastMessage = messages[messages.length - 1].content;
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
