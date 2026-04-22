import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות (Regex תואם לכל גרסאות ה-Build) ───────────────────────────
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

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    const scenario = body.scenario ?? getRandomScenario();
    
    // הזרקת ההוראות למערכת
    const systemPrompt = buildSystemPrompt(scenario) + 
      "\nCRITICAL: Use spaces between words. Do not merge Hebrew words together.";
    
    const history = buildGeminiHistory(messages);
    const isFirstMessage = messages.length === 1;
    const userPrompt = isFirstMessage 
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה בולטת. שני משפטים קצרים.' 
      : messages[messages.length - 1].content;

    // ─── היררכיית המודלים המדויקת שלך ───────────────────────────────────────
    const MODELS = [
      { name: 'gemini-2.5-flash', config: {} },           // Main logic
      { name: 'gemini-2.0-flash', config: {} },           // Fallback
      { name: 'gemini-2.5-flash-lite', config: {} },      // Heavy load
      { name: 'gemma-4-31b-it', config: {} },             // Backup
    ];

    let streamResult: any = null;
    let lastError = null;

    for (const { name: modelName, config } of MODELS) {
      try {
        // as any כאן מונע את קריסת ה-Build ב-Vercel
        const m = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt,
          generationConfig: config as any 
        });
        
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(userPrompt);
        console.log(`[MDA] Success with: ${modelName}`);
        break; 
      } catch (e: any) {
        console.warn(`[MDA] ${modelName} failed or not found, moving to next.`);
        lastError = e;
      }
    }

    if (!streamResult) throw lastError || new Error("כל צמתים של הבינה המלאכותית כשלו.");

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            let buffer = ""; 
            for await (const chunk of streamResult.stream) {
              buffer += chunk.text();
              
              // צבירת באפר למניעת חיתוך מילים ודליפת מחשבות
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
                controller.enqueue(encoder.encode(isFirstMessage ? INJECTED_PREFIX + final : final));
              }
            }
            controller.close();
          } catch (e) { controller.error(e); }
        }
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
