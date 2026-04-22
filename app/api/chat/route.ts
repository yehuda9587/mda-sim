import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

function sanitize(text: string): string {
  return text
    .replace(/THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi, "")
    .replace(/Reasoning:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInjected(text: string): string {
  return text.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim();
}

function buildGeminiHistory(messages: Message[]): Content[] {
  const raw = messages.slice(0, -1)
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      return { 
        role: (isModel ? 'model' : 'user') as 'user' | 'model', 
        parts: [{ text: isModel ? stripInjected(m.content) : m.content }] 
      };
    })
    .filter(m => m.parts[0].text.trim().length > 0);
  
  while (raw.length > 0 && raw[0].role !== 'user') raw.shift();
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, scenario } = body;
    
    // נעילת תרחיש: משתמשים בתרחיש הקיים או מגרילים חדש במידה וזו התחלה
    const activeScenario = scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(activeScenario);
    
    const MODELS = [
      { name: 'gemini-2.5-flash' },
      { name: 'gemini-2.0-flash' },
      { name: 'gemini-2.5-flash-lite' },
      { name: 'gemma-4-31b-it' }
    ];

    let streamResult: any = null;
    let usedModel = "";

    for (const modelInfo of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelInfo.name, 
          systemInstruction: systemPrompt,
          generationConfig: { temperature: 0.1 } as any // דיוק מקסימלי
        });
        
        const history = buildGeminiHistory(messages);
        const chat = model.startChat({ history });
        const lastMessage = messages[messages.length - 1].content;
        
        streamResult = await chat.sendMessageStream(lastMessage);
        usedModel = modelInfo.name;
        break; 
      } catch (e) {
        console.warn(`[MDA] Fallback from ${modelInfo.name}`);
        continue;
      }
    }

    if (!streamResult) throw new Error("All AI nodes failed.");

    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };
    
    // החזרת התרחיש לפרונטנד במידה והוא חדש
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(activeScenario));

    return new Response(new ReadableStream({
      async start(controller) {
        try {
          let buffer = "";
          for await (const chunk of streamResult.stream) {
            buffer += chunk.text();
            if (buffer.length > 60 || buffer.includes('\n')) {
              const clean = sanitize(buffer);
              if (clean) {
                controller.enqueue(encoder.encode(clean + " "));
                buffer = "";
              }
            }
          }
          if (buffer) {
            const final = sanitize(buffer);
            if (final) {
              const isFirst = messages.length === 1;
              controller.enqueue(encoder.encode(isFirst ? INJECTED_PREFIX + final : final));
            }
          }
          controller.close();
        } catch (e) { controller.error(e); }
      }
    }), { headers });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
