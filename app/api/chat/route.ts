import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

// אתחול ה-SDK של גוגל עם המפתח מה-Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // בדיקה שהמפתח קיים
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing in Vercel' }, { status: 500 });
    }

    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    
    // בניית ה-System Prompt (הפרוטוקולים הרפואיים)
    const systemPrompt = buildSystemPrompt(mode || 'ב', messages);

    // הגדרת המודל - משתמשים ב-2.5 Flash כפי שמצאנו ב-cURL
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    /**
     * תיקון קריטי: גוגל לא מכירה את התפקיד 'assistant'. 
     * היא דורשת שהתגובות של ה-AI יתויגו כ-'model'.
     */
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    // התחלת שיחה עם ההיסטוריה המומרת
    const chat = model.startChat({
      history: history,
    });

    // שליחת ההודעה האחרונה בסטרימינג
    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          console.error('Streaming error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (err: any) {
    console.error('Gemini API Error:', err);
    return NextResponse.json({ 
      error: 'שגיאה בחיבור לשרת גוגל', 
      details: err.message 
    }, { status: 500 });
  }
}
