import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, sanitize } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, scenario } = body;
    
    // נעילת תרחיש: אם קיבלנו סנריו מהפרונטנד - משתמשים בו. אם לא - מגרילים.
    const activeScenario = scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(activeScenario);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash', 
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.1 } // טמפרטורה נמוכה מאוד למניעת "הזיות" ושינויי פצועים
    });

    const isFirstMessage = messages.length === 1;
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim() }]
    }));

    const chat = model.startChat({ history: history.length > 0 && history[0].role === 'user' ? history : [] });
    const result = await chat.sendMessageStream(messages[messages.length - 1].content);

    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(activeScenario));

    return new Response(new ReadableStream({
      async start(controller) {
        try {
          if (isFirstMessage) controller.enqueue(encoder.encode(INJECTED_PREFIX));
          
          let buffer = "";
          for await (const chunk of result.stream) {
            buffer += chunk.text();
            if (buffer.includes(' ') || buffer.includes('\n')) {
              const clean = sanitize(buffer);
              if (clean) controller.enqueue(encoder.encode(clean + " "));
              buffer = "";
            }
          }
          if (buffer) controller.enqueue(encoder.encode(sanitize(buffer)));
          controller.close();
        } catch (e) { controller.error(e); }
      }
    }), { headers });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
