import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    
    // סינון הודעות UI כדי שהמודל יקבל היסטוריה רפואית נקייה
    const chatMessages = messages.filter(m => !m.content.startsWith("הוראות תפעול:"));

    const systemPrompt = buildSystemPrompt(mode || 'א', chatMessages);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: systemPrompt,
    });

    // המרה לפורמט של גוגל (user/model)
    let history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // תיקון Role: מוודאים שההיסטוריה תמיד מתחילה ב-user
    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    const lastMessage = chatMessages[chatMessages.length - 1]?.content || "התחל תרחיש";
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
    console.error("Gemini API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
