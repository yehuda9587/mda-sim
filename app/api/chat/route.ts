import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות חשיבה ──────────────────────────────────────────────────────
const LEAK_PATTERNS = [
  /THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi,
  /Reasoning:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g
];

function sanitize(text: string): string {
  let cleaned = text;
  LEAK_PATTERNS.forEach(re => {
    cleaned = cleaned.replace(re, ' '); 
  });
  return cleaned.replace(/\s+/g, ' ').trim();
}

function stripInjected(text: string): string {
  return text.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim();
}

function extractCaseDescription(raw: string): string {
  const lines = raw.split('\n').filter(l => {
    const t = l.trim();
    return t.length > 0 && !/^(Role|Scenario|Constraint|Sentence|Draft|Age|Gender|Position|Main|Detail|Treatment|Wait|Two|Note|Check)/i.test(t);
  });
  return lines.length > 0 ? lines.slice(-2).join('\n').trim() : raw.trim();
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
    const scenario = body.scenario ?? getRandomScenario();
    
    const systemPrompt = buildSystemPrompt(scenario) + 
      "\nCRITICAL: Use spaces between words. Do not merge Hebrew words together. Hebrew output only.";
    
    const history = buildGeminiHistory(messages);
    const isFirstMessage = messages.length === 1;
    const geminiPrompt = isFirstMessage 
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה. שני משפטים קצרים.' 
      : messages[messages.length - 1].content;

    // ─── מודלים עם שמות מעודכנים למניעת 404 ──────────────────────────────────
    const MODELS = [
      { 
        name: 'gemini-2.0-flash-thinking-exp', // שם המודל היציב יותר ל-Thinking
        config: { thinkingConfig: { includeThinkingProcess: false, thinkingBudget: 16000 } } 
      },
      { name: 'gemini-2.0-flash', config: {} }
    ];

    let streamResult: any = null;
    let lastErr = null;

    for (const { name: modelName, config } of MODELS) {
      try {
        const m = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt,
          generationConfig: config as any 
        });
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        console.log(`[MDA] Handled by ${modelName}`);
        break;
      } catch (e: any) { 
        console.warn(`[MDA] ${modelName} failed: ${e.message}`);
        lastErr = e;
      }
    }

    if (!streamResult) throw lastErr || new Error("Connection failed");

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            let buffer = ""; 
            for await (const chunk of streamResult.stream) {
              buffer += chunk.text();
              if (buffer.includes('\n') || buffer.length > 60) {
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
                const out = isFirstMessage ? extractCaseDescription(final) : final;
                controller.enqueue(encoder.encode(isFirstMessage ? INJECTED_PREFIX + out : out));
              }
            }
            controller.close();
          } catch (e) { controller.error(e); }
        }
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  } catch (err: any) {
    console.error('[MDA API ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
