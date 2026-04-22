import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות חשיבה ──────────────────────────────────────────────────────
const LEAK_PATTERNS: RegExp[] = [
  /THOUGHT:[^\n]*/gi,
  /Reasoning:[^\n]*/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_PATTERNS.reduce((t, re) => t.replace(re, ''), text).trim();
}

/**
 * חילוץ תיאור המקרה בלבד מהודעה שעלולה להכיל מטא-דאטה של המודל
 */
function extractCaseDescription(raw: string): string {
  const lines = raw.split('\n').filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !/^(Role|Scenario|Constraint|Sentence|Draft|Age|Gender|Position|Main|Detail|Treatment|Wait|Two|Note|Check)/i.test(trimmed);
  });
  
  if (lines.length === 0) return raw.trim();
  // מחזיר את החלק האחרון של הטקסט שלרוב מכיל את התיאור הפיזי
  return lines.slice(-3).join('\n').trim();
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
      ? 'תאר את המקרה הרפואי: גיל, מין, תנוחה, ומצוקה בולטת. שני משפטים קצרים בלבד.'
      : messages[messages.length - 1].content;

    // ─── רשימת מודלים 2.0 בלבד ──────────────────────────────────────────────
    const MODELS = [
      { 
        name: 'gemini-2.0-flash-thinking-preview-01-21', 
        config: { thinkingConfig: { includeThinkingProcess: false, thinkingBudget: 16000 } } 
      },
      { name: 'gemini-2.0-flash', config: {} },
      { name: 'gemini-2.0-flash-exp', config: {} },
    ];

    let streamResult: any = null;
    let errors: string[] = [];

    for (const { name: modelName, config } of MODELS) {
      try {
        const m = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt,
          generationConfig: config as any // עקיפת Type Error ב-Build
        });
        
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        console.log(`[MDA] Handled by: ${modelName}`);
        break;
      } catch (e: any) {
        errors.push(`${modelName}: ${e.message}`);
        console.warn(`[MDA] ${modelName} failed, switching...`);
      }
    }

    if (!streamResult) {
      throw new Error(`כל המודלים נכשלו. פירוט: ${errors.join(' | ')}`);
    }

    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            if (isFirstMessage) {
              let full = '';
              for await (const chunk of streamResult.stream) { full += chunk.text(); }
              const finalCase = extractCaseDescription(sanitize(full));
              controller.enqueue(encoder.encode(INJECTED_PREFIX + finalCase));
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
    console.error('[MDA API ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
