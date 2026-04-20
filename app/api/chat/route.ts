import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

// ודא שהמשתנה GEMINI_API_KEY מוגדר ב-Vercel!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // בדיקת בטיחות: האם המפתח קיים?
    if (!process.env.GEMINI_API_KEY) {
      console.error("CRITICAL: GEMINI_API_KEY is missing in Vercel!");
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    
    const systemPrompt = buildSystemPrompt(mode || 'ב', messages);

    // נשתמש בשם המודל המעודכן ביותר
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    // ג'ימיני מאפשר להכניס את ה-System Prompt כאן
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    // הוספת ה-System Prompt כהודעה ראשונה "בלתי נראית" במידת הצורך
    // או פשוט שליחת ההודעה עם ההנחיות
    const result = await model.generateContentStream({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...history,
        { role: 'user', parts: [{ text: lastMessage }] }
      ]
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) {
          console.error("Stream Error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (err: any) {
    console.error('Gemini API Detailed Error:', err);
    return NextResponse.json({ 
      error: 'שגיאה בחיבור לגוגל',
      details: err.message 
    }, { status: 500 });
  }
}
