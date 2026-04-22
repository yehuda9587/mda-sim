import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 60;

// פונקציית עזר לניקוי ההיסטוריה - תואמת לגרסאות Build ישנות וחדשות
function stripInjectedInstructions(text: string): string {
  return text.replace(/^הוראות תפעול:[\s\S]*?\n\n/, '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    const systemPrompt = buildSystemPrompt(mode || 'א', messages);

    // רשימת מודלים לניסיון לפי סדר עדיפות
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt 
        });

        // בניית היסטוריה תקינה
        let history = messages.slice(0, -1).map(m => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: stripInjectedInstructions(m.content) }],
        }));

        // וידוא שההיסטוריה מתחילה ב-User (חובה ב-API של גוגל)
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
                // ניקוי "מחשבות" וזליגות JSON
                text = text.replace(/THOUGHT:?[\s\S]*?\n/gi, "").replace(/\{[\s\S]*?\}/g, ""); 
                if (text) controller.enqueue(encoder.encode(text));
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        }), { 
          headers: { 
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Model-Used': modelName // הוספת כותרת כדי שתוכל לראות איזה מודל ענה בסוף
          } 
        });

      } catch (err: any) {
        console.warn(`Model ${modelName} failed, trying next... Error: ${err.message}`);
        lastError = err;
        continue; // עובר למודל הבא ברשימה
      }
    }

    // אם כל המודלים נכשלו
    throw lastError;

  } catch (err: any) {
    console.error("Critical API Error after all fallbacks:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
