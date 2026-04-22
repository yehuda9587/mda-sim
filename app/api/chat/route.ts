import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות חשיבה ו-JSON ──────────────────────────────────────────────
const LEAK_PATTERNS: RegExp[] = [
  /THOUGHT:[^\n]*/gi,
  /Reasoning:[^\n]*/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_PATTERNS.reduce((t, re) => t.replace(re, ''), text).trim();
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
    const { messages } = body;

    if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 });

    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);
    const history = buildGeminiHistory(messages);
    const isFirstMessage = messages.length === 1;

    const geminiPrompt = isFirstMessage
      ? 'תאר את המקרה: גיל, מין, תנוחה, ומצוקה עיקרית. שני משפטים בלבד.'
      : messages[messages.length - 1].content;

    // ─── דירוג מודלים לפי הבקשה שלך (2026 Stack) ──────────────────────────────
    const MODELS = [
      { name: 'gemini-2.5-flash', config: {} },           // Main Logic
      { name: 'gemini-2.0-flash', config: {} },           // Fallback
      { name: 'gemini-2.5-flash-lite', config: {} },      // Heavy Load
      { name: 'gemma-4-31b-it', config: {} },             // Backup (Non-Gemini)
    ];

    let streamResult: any = null;
    let usedModel = "";

    for (const { name: modelName, config } of MODELS) {
      try {
        const m = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt,
          generationConfig: config as any 
        });
        
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        usedModel = modelName;
        console.log(`[MDA] Deployed: ${modelName}`);
        break;
      } catch (e: any) {
        console.warn(`[MDA] ${modelName} unavailable, cascading...`);
      }
    }

    if (!streamResult) throw new Error('System Overload: All medical AI nodes failed.');

    const encoder = new TextEncoder();
    const headers: HeadersInit = { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Used-Model': usedModel 
    };
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            if (isFirstMessage) {
              let full = '';
              for await (const chunk of streamResult.stream) { full += chunk.text(); }
              // ניקוי דליפות Gemma אם הגיבוי הופעל
              const cleanCase = sanitize(full).split('\n').slice(-2).join('\n');
              controller.enqueue(encoder.encode(INJECTED_PREFIX + cleanCase));
            } else {
              for await (const chunk of streamResult.stream) {
                const clean = sanitize(chunk.text());
                if (clean) controller.enqueue(encoder.encode(clean));
              }
            }
            controller.close();
          } catch (e) { controller.error(e); }
        },
      }),
      { headers }
    );

  } catch (err: any) {
    console.error('[MDA CRITICAL]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
