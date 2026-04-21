import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json() as { messages: Message[]; mode: 'א' | 'ב' };
    const chatMessages = messages.filter(m => !m.content.startsWith("הוראות תפעול:"));
    const systemPrompt = buildSystemPrompt(mode || 'א', chatMessages);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: systemPrompt 
    });

    let history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    const lastMessage = chatMessages[chatMessages.length - 1]?.content || "התחל תרחיש";
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          let text = chunk.text();
          // סינון אגרסיבי של בלוקי מחשבה אם הם דולפים
          text = text.replace(/THOUGHT:?[\s\S]*?\n\n/gi, "");
          text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
          
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
