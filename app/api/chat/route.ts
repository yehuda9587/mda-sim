import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function sanitize(text: string): string {
  return text
    .replace(/THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    // שליפת התרחיש - אם אין, מגרילים אחד (אבל רק פעם אחת בתחילת השיחה)
    const scenario = body.scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);
    
    const MODELS = [
      { name: 'gemini-2.5-flash', config: { temperature: 0.1 } },
      { name: 'gemini-2.0-flash', config: { temperature: 0.1 } },
      { name: 'gemini-1.5-flash', config: { temperature: 0.1 } }
    ];

    let streamResult: any = null;
    for (const modelInfo of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelInfo.name, 
          systemInstruction: systemPrompt,
          generationConfig: modelInfo.config as any
        });
        
        const history = messages.slice(0, -1).map((m: any) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const chat = model.startChat({ 
            history: history.length > 0 && history[0].role === 'user' ? history : [] 
        });
        
        streamResult = await chat.sendMessageStream(messages[messages.length - 1].content);
        break;
      } catch (e) {
        console.warn(`[MDA] Fallback from ${modelInfo.name}`);
        continue;
      }
    }

    if (!streamResult) throw new Error("Connection Error");

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
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
            if (buffer) controller.enqueue(encoder.encode(sanitize(buffer)));
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
