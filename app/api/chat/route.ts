import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות חשיבה ו-JSON ──────────────────────────────────────────────
const LEAK_PATTERNS = [
  /THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi,
  /Reasoning:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g
];

function sanitize(text: string): string {
  let cleaned = text;
  LEAK_PATTERNS.forEach(re => {
    cleaned = cleaned.replace(re, ' '); // החלפה ברווח למניעת הידבקות מילים
  });
  return cleaned.replace(/\s+/g, ' ').trim();
}

function stripInjected(text: string): string {
  return text.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim();
}

/**
 * מחלץ את תיאור המקרה בלבד (לשימוש בהודעה הראשונה)
 */
function extractCaseDescription(raw: string): string {
  const lines = raw.split('\n').filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !/^(Role|Scenario|Constraint|Sentence|Draft|Age|Gender|Position|Main|Detail|Treatment|Wait|Two|Note|Check)/i.test(trimmed);
  });
  return lines.length > 0 ? lines.slice(-2).join('\n').trim() : raw.trim();
}

/**
 * בניית היסטוריית שיחה תקינה עבור גוגל
 */
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

// ─── Handler הראשי ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    const scenario = body.scenario ?? getRandomScenario();
    
    // הוראה קשיחה למניעת הידבקות מילים בעברית
    const systemPrompt = buildSystemPrompt(scenario) + 
      "\nCRITICAL: Use spaces between words. Do not merge Hebrew words together. Response in Hebrew only.";
    
    const history = buildGeminiHistory(messages);
    const isFirstMessage = messages.length === 1;
    const geminiPrompt = isFirstMessage 
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה בולטת. שני משפטים קצרים.' 
      : messages[messages.length - 1].content;

    const MODELS = [
      { 
        name: 'gemini-2.0-flash-thinking-preview-01-21', 
        config: { thinkingConfig: { includeThinkingProcess: false, thinkingBudget: 16000 } } 
      },
      { name: 'gemini-2.0-flash', config: {} }
    ];

    let streamResult: any = null;
    for (const { name: modelName, config } of MODELS) {
      try {
        const m = genAI.getGenerativeModel({ 
          model: modelName, 
          systemInstruction: systemPrompt, 
          generationConfig: config as any 
        });
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        break;
      } catch (e) { 
        console.warn(`[MDA] Fallback from ${modelName}`);
        continue; 
      }
    }

    if (!streamResult) throw new Error("All models failed");

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            let buffer = ""; 
            
            for await (const chunk of streamResult.stream) {
              buffer += chunk.text();
              
              // שולחים רק אם הצטבר מספיק טקסט כדי שה-Regex יוכל לעבוד על "מילים שלמות"
              if (buffer.includes('\n') || buffer.length > 60) {
                const clean = sanitize(buffer);
                if (clean) {
                  controller.enqueue(encoder.encode(clean + " "));
                  buffer = ""; 
                }
              }
            }
            
            if (buffer) {
              const finalClean = sanitize(buffer);
              if (finalClean) {
                // בהודעה ראשונה מחלצים רק את התיאור
                const output = isFirstMessage ? extractCaseDescription(finalClean) : finalClean;
                controller.enqueue(encoder.encode(isFirstMessage ? INJECTED_PREFIX + output : output));
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
