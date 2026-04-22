import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ניקוי דליפות חשיבה ורווחים כפולים
function sanitize(text: string): string {
  return text
    .replace(/THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const scenario = getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario) + "\nCRITICAL: Use spaces between words.";
    
    // היררכיית המודלים שלך
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
          systemInstruction: systemPrompt 
        });
        
        // בניית היסטוריה בסיסית (מתחילה ב-user)
        const history = messages.slice(0, -1).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const chat = model.startChat({ history: history.length > 0 && history[0].role === 'user' ? history : [] });
        streamResult = await chat.sendMessageStream(messages[messages.length - 1].content);
        break; // הצלחנו, עוצרים
      } catch (e) {
        console.warn(`[MDA] ${modelInfo.name} failed, trying next...`);
      }
    }

    if (!streamResult) throw new Error("All AI nodes failed.");

    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      async start(controller) {
        let buffer = "";
        for await (const chunk of streamResult.stream) {
          buffer += chunk.text();
          if (buffer.length > 50 || buffer.includes('\n')) {
            const clean = sanitize(buffer);
            if (clean) controller.enqueue(encoder.encode(clean + " "));
            buffer = "";
          }
        }
        if (buffer) controller.enqueue(encoder.encode(sanitize(buffer)));
        controller.close();
      }
    }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
