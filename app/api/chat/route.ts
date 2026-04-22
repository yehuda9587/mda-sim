import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    
    // שליחת 2 ארגומנטים כפי שהגדרנו ב-lib
    const systemPrompt = buildSystemPrompt(mode || 'א', messages);

    // ניסיון מודלים לפי סדר עדיפות
    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt 
        });

        let history = messages.slice(0, -1).map(m => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        while (history.length > 0 && history[0].role !== 'user') {
          history.shift();
        }

        const lastMessage = messages[messages.length - 1].content;
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(lastMessage);

        const encoder = new TextEncoder();
        return new Response(new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result.stream) {
                let text = chunk.text();
                // ניקוי "מחשבות" בצורה שלא קוטעת את הטקסט
                text = text.replace(/THOUGHT:?[\s\S]*?(?=\n\n|---|$)/gi, "");
                text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
                if (text) controller.enqueue(encoder.encode(text));
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

      } catch (err: any) {
        lastError = err;
        continue;
      }
    }
    throw lastError;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
