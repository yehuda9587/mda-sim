import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    
    // סינון הודעות UI שלא צריכות לעבור למודל
    const chatMessages = messages.filter(m => !m.content.startsWith("הוראות תפעול:"));

    const systemPrompt = buildSystemPrompt(mode || 'א', chatMessages);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // המודל היציב ביותר לסטרימינג כרגע
      systemInstruction: systemPrompt,
    });

    // גוגל דורשת להתחיל ב-User. אנחנו לוקחים את ההיסטוריה ללא ההודעה האחרונה.
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // וידוא שההיסטוריה מתחילה ב-User (אם יש כזו)
    if (history.length > 0 && history[0].role === 'model') history.shift();

    const lastMessage = chatMessages[chatMessages.length - 1].content;
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
