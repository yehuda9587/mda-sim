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
    
    // נעילת תרחיש: אם הפרונטנד שלח תרחיש, משתמשים בו. אם לא (פעם ראשונה), מגרילים.
    const scenario = body.scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);
    
    // ההיררכיה שלך (2.5 -> 2.0 -> Lite -> Gemma)
    const MODELS = [
      { name: 'gemini-2.5-flash' },
      { name: 'gemini-2.0-flash' },
      { name: 'gemini-2.5-flash-lite' },
      { name: 'gemma-4-31b-it' }
    ];

    let streamResult: any = null;
    for (const modelInfo of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelInfo.name, 
          systemInstruction: systemPrompt,
          generationConfig: { temperature: 0.1 } as any // רובוטי ועקבי
        });
        
        const history = messages.slice(0, -1).map((m: any) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim() }]
        }));

        const chat = model.startChat({ 
          history: history.length > 0 && history[0].role === 'user' ? history : [] 
        });
        
        streamResult = await chat.sendMessageStream(messages[messages.length - 1].content);
        break;
      } catch (e) { continue; }
    }

    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };
    
    // שולחים את התרחיש חזרה לפרונטנד ב-Header בבקשה הראשונה
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));

    return new Response(new ReadableStream({
      async start(controller) {
        let buffer = "";
        for await (const chunk of streamResult.stream) {
          buffer += chunk.text();
          if (buffer.length > 60 || buffer.includes('\n')) {
            const clean = sanitize(buffer);
            if (clean) controller.enqueue(encoder.encode(clean + " "));
            buffer = "";
          }
        }
        if (buffer) controller.enqueue(encoder.encode(sanitize(buffer)));
        controller.close();
      }
    }), { headers });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
