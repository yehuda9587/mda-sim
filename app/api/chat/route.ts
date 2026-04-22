import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'nodejs';
export const maxDuration = 60;

// רשימת המודלים עם הקונפיגורציה החדשה
const MODELS = [
  { 
    name: "gemini-2.0-flash-thinking-preview-01-21", 
    config: { thinkingConfig: { includeThinkingProcess: false, thinkingBudget: 16000 } } 
  },
  { name: "gemini-2.0-flash", config: {} },
  { name: "gemini-1.5-flash", config: {} }
];

function stripInjectedInstructions(text: string): string {
  return text.replace(/^הוראות תפעול:[\s\S]*?\n\n/, '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    const systemPrompt = buildSystemPrompt(mode || 'א', messages);

    let streamResult = null;
    let lastError = null;

    for (const { name: modelName, config } of MODELS) {
      try {
        // הוספת "as any" כאן פותרת את שגיאת ה-TypeScript ב-Build
        const model = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt,
          generationConfig: config as any 
        });

        let history = messages.slice(0, -1).map(m => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: stripInjectedInstructions(m.content) }],
        }));

        while (history.length > 0 && history[0].role !== 'user') {
          history.shift();
        }

        const lastMessage = messages[messages.length - 1].content;
        const chat = model.startChat({ history });
        streamResult = await chat.sendMessageStream(lastMessage);
        
        console.log(`[MDA] Success with model: ${modelName}`);
        break; // הצלחנו, יוצאים מהלולאה
      } catch (err: any) {
        console.warn(`[MDA] Model ${modelName} failed: ${err.message}`);
        lastError = err;
      }
    }

    if (!streamResult) throw lastError || new Error("All models failed");

    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            let text = chunk.text();
            // ניקוי שאריות אם המודל בכל זאת פולט מחשבות
            text = text.replace(/THOUGHT:?[\s\S]*?\n/gi, "").replace(/\{[\s\S]*?\}/g, ""); 
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (err: any) {
    console.error("Critical API Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
