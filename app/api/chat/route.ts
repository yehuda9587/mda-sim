import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message, sanitize } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, scenario } = body;
    
    const activeScenario = scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(activeScenario);
    
    const MODELS = [
      { name: 'gemini-2.0-flash' },
      { name: 'gemini-2.5-flash' },
      { name: 'gemini-1.5-flash' }
    ];

    let streamResult: any = null;
    for (const modelInfo of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelInfo.name, 
          systemInstruction: systemPrompt,
          generationConfig: { temperature: 0.2 } as any
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
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(activeScenario));

    return new Response(new ReadableStream({
      async start(controller) {
        try {
          let buffer = "";
          let prefixSent = false;
          const isFirstMessage = messages.length === 1;

          // שליחת ה-Prefix מיד אם זו ההודעה הראשונה
          if (isFirstMessage) {
            controller.enqueue(encoder.encode(INJECTED_PREFIX));
            prefixSent = true;
          }

          for await (const chunk of streamResult.stream) {
            buffer += chunk.text();
            
            // שולחים צ'אנק רק כשיש רווח או ירידת שורה כדי לא לחתוך מילים
            if (buffer.includes(' ') || buffer.includes('\n')) {
              const clean = sanitize(buffer);
              if (clean) {
                controller.enqueue(encoder.encode(clean + " "));
              }
              buffer = "";
            }
          }
          
          if (buffer) {
            const final = sanitize(buffer);
            if (final) controller.enqueue(encoder.encode(final));
          }
          
          controller.close();
        } catch (e) { controller.error(e); }
      }
    }), { headers });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
