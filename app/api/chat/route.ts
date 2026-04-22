import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות (ללא דגל s) ────────────────────────────────────────────────
const LEAK_PATTERNS: RegExp[] = [
  /THOUGHT:[^\n]*/gi,
  /Reasoning:[^\n]*/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
  /```[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_PATTERNS.reduce((t, re) => t.replace(re, ''), text).trim();
}

/**
 * חילוץ תיאור המקרה מתגובה שעשויה להכיל "חשיבה בקול".
 *
 * מודלים כמו gemma ו-gemini-2.5-flash (כשה-thinking דלף) מוציאים:
 *   * Role: ...
 *   * Sentence 1: ...
 *   גבר בן 65, יושב על כיסא. הוא סובל מקשיי נשימה.
 *
 * האלגוריתם: מסנן שורות שהן "מטא" ומחזיר רק את השורות הנקיות.
 * אם לא נמצא כלום — מחזיר את הטקסט המקורי כ-fallback.
 */
function extractCaseDescription(raw: string): string {
  const META_LINE = /^\s*(\*|\-|•)\s+/;           // שורות bullet
  const META_WORD = /^(Role|Scenario|Constraint|Sentence|Draft|Age|Gender|Position|Main|Detail|Treatment|Wait|Two|No\s|Yes|Let|Pick|Prompt|Here|Note|Check)/i;
  const PARENS    = /^\s*\(/;                       // שורות שמתחילות ב-(
  const EMPTY     = /^\s*$/;

  // ביטול כפילויות — gemma לפעמים חוזר על התשובה
  // מחפש את הפסקה האחרונה של שורות נקיות
  const lines = raw.split('\n');
  const clean = lines.filter(l =>
    !EMPTY.test(l) &&
    !META_LINE.test(l) &&
    !META_WORD.test(l.trim()) &&
    !PARENS.test(l)
  );

  if (clean.length === 0) return raw.trim();

  // מחזיר את 2-3 השורות האחרונות (התיאור עצמו)
  const lastChunk = clean.slice(-3).join('\n').trim();

  // ביטול כפילות מדויקת (gemma חוזר על המשפטים)
  const half = Math.floor(lastChunk.length / 2);
  const firstHalf = lastChunk.slice(0, half).trim();
  const secondHalf = lastChunk.slice(half).trim();
  if (firstHalf && secondHalf.startsWith(firstHalf)) return firstHalf;

  return lastChunk;
}

// ─── הסרת prefix מוזרק מהיסטוריה ────────────────────────────────────────────
function stripInjected(text: string): string {
  return text.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim();
}

// ─── בניית היסטוריה תקינה לגמיני ────────────────────────────────────────────
function buildGeminiHistory(messages: Message[]): Content[] {
  const slice = messages.slice(0, -1);

  const raw: Content[] = slice
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      const text = isModel ? stripInjected(m.content) : m.content;
      return { role: isModel ? 'model' : 'user', text: text.trim() };
    })
    .filter(m => m.text.length > 0)
    .map(m => ({ role: m.role as 'user' | 'model', parts: [{ text: m.text }] }));

  while (raw.length > 0 && raw[0].role !== 'user') raw.shift();

  const merged: Content[] = [];
  for (const item of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts.push({ text: '\n' + item.parts[0].text });
    } else {
      merged.push({ role: item.role, parts: [...item.parts] });
    }
  }
  return merged;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { messages: Message[]; scenario?: object | null };
    const { messages } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    const isNewScenario = !body.scenario;
    const isFirstMessage = messages.length === 1;
    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);

    const history = buildGeminiHistory(messages);
    const geminiPrompt = isFirstMessage
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה עיקרית. שני משפטים בלבד.'
      : messages[messages.length - 1].content;

    // ─── בחירת מודל עם fallback ──────────────────────────────────────────────
    const MODELS = [
      { name: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 0 } } },
      { name: 'gemma-4-31b-it',   generationConfig: {} },
    ];

    let streamResult: any = null;
    for (const { name: modelName, generationConfig } of MODELS) {
      try {
        const m = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt, generationConfig });
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        console.log('[MDA] using', modelName);
        break;
      } catch (e: any) {
        const code = String(e?.status ?? e?.message ?? '');
        const isTransient = code.includes('503') || code.includes('429') || code.includes('404');
        if (!isTransient || modelName === MODELS[MODELS.length - 1].name) throw e;
        console.warn('[MDA]', modelName, 'unavailable, trying backup');
      }
    }
    if (!streamResult) throw new Error('All models unavailable');

    // ─── Response ────────────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (isNewScenario) {
      headers['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));
    }

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            if (isFirstMessage) {
              // ─── הודעה ראשונה: אוספים הכל ואז מחלצים את התיאור הנקי ───
              // מונע דליפת "חשיבה בקול" מכל מודל, ללא תלות בהגדרות
              let full = '';
              for await (const chunk of streamResult.stream) {
                full += chunk.text();
              }
              const caseText = extractCaseDescription(sanitize(full));
              controller.enqueue(encoder.encode(INJECTED_PREFIX + caseText));
            } else {
              // ─── הודעות המשך: סטרימינג רגיל ────────────────────────────
              let buffer = '';
              for await (const chunk of streamResult.stream) {
                buffer += chunk.text();
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                const clean = sanitize(lines.join('\n'));
                if (clean) controller.enqueue(encoder.encode(clean + '\n'));
              }
              if (buffer) {
                const clean = sanitize(buffer);
                if (clean) controller.enqueue(encoder.encode(clean));
              }
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      }),
      { headers }
    );

  } catch (err: any) {
    console.error('[MDA API ERROR]', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
