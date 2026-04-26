import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── הוראות המערכת (הזרקה לסטרים) ──────────────────────────────────────────
// ─── הוראות המערכת (הזרקה לסטרים עם הפרדת פסקאות) ──────────────────────────
const INJECTED_PREFIX = "דגשים לסימולציה:\n" +
  "זהו \"מגה קוד\" של מד\"א. עליך לנהל את המקרה לפי סכימת SABCDE המלאה, " +
  "כולל ביצוע בדיקות, התרשמות קלינית ומתן טיפול. " +
  "בסיום הטיפול, ציין אבחנה משוערת וכתוב 'סיימתי'.\n\n";
// ─── מודלים עם fallback ───────────────────────────────────────────────────────
// 2.5-flash ראשי (thinking כבוי), 2.0-flash גיבוי
const MODELS = [
  {
    name: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 600,
      thinkingConfig: { thinkingBudget: 0 },
    },
  },
  {
    name: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 600,
    },
  },
] as const;

// ─── ניקוי דליפות ─────────────────────────────────────────────────────────────
// ללא דגל s — לא נתמך ב-ES2017 שבו Vercel בונה
const LEAK_RES: RegExp[] = [
  /THOUGHT:[^\n]*/gi,
  /Reasoning:[^\n]*/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
  /```[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_RES.reduce((t, re) => t.replace(re, ''), text).trim();
}

// ─── חילוץ תיאור מקרה מתגובת הודעה ראשונה ───────────────────────────────────
// מודלים לפעמים "חושבים בקול" לפני שהם נותנים תשובה.
// הפונקציה מסננת שורות מטא ומחלצת רק את התיאור הקליני הנקי.
function extractCaseDescription(raw: string): string {
  const isMeta = (line: string): boolean => {
    const t = line.trim();
    if (!t) return true;
    // שורות bullet/dash
    if (/^[\*\-•]\s/.test(t)) return true;
    // שורות שמתחילות במילת מפתח אנגלית
    if (/^(Role|Scenario|Constraint|Sentence|Draft|Age|Gender|Position|Main|Detail|Treatment|Wait|Two|No |Yes|Let|Pick|Prompt|Here|Note|Check|Patient|First|Second)/i.test(t)) return true;
    // סוגריים
    if (/^\(/.test(t)) return true;
    // שורות שכולן אנגלית
    if (/^[a-zA-Z0-9\s\:\.\,\!\?\-\/\(\)]+$/.test(t)) return true;
    return false;
  };

  const lines = raw.split('\n');
  const hebrewLines = lines.filter(l => !isMeta(l));

  if (hebrewLines.length === 0) return raw.trim();

  // gemma וחלק מהמודלים חוזרים על התשובה בסוף — מסירים כפילות
  const joined = hebrewLines.join('\n').trim();
  const mid = Math.floor(joined.length / 2);
  const first = joined.slice(0, mid).trim();
  const second = joined.slice(mid).trim();
  if (first && second.startsWith(first.slice(0, 20))) return first;

  // מחזיר לכל היותר 3 שורות
  return hebrewLines.slice(-3).join('\n').trim();
}

// ─── הסרת prefix מוזרק מהיסטוריה ────────────────────────────────────────────
function stripInjected(text: string): string {
  // מסיר "הוראות תפעול: ...\n\n" שהשרת הזריק
  return text.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim();
}

// ─── בניית היסטוריה תקינה לגמיני ─────────────────────────────────────────────
// דרישות Gemini API:
//   1. מתחיל ב-role:"user"
//   2. מתחלף user→model→user→model בדיוק
//   3. אין הודעות ריקות
function buildGeminiHistory(messages: Message[]): Content[] {
  // לא כולל את ההודעה האחרונה — תישלח כ-sendMessageStream
  const raw: Content[] = messages
    .slice(0, -1)
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      const text = isModel ? stripInjected(m.content) : m.content;
      return { role: (isModel ? 'model' : 'user') as 'user' | 'model', text: text.trim() };
    })
    .filter(m => m.text.length > 0)
    .map(m => ({ role: m.role, parts: [{ text: m.text }] }));

  // הסרת model messages מהתחלה
  while (raw.length > 0 && raw[0].role !== 'user') raw.shift();

  // מיזוג הודעות עוקבות מאותו role (edge case של bug ב-frontend)
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
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const isNewScenario = !body.scenario;
    const isFirstMessage = messages.length === 1;
    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);
    const history = buildGeminiHistory(messages);

    // הודעה ראשונה: בקשה נקייה לתיאור המקרה (ללא הוראות — השרת מזריק אותן)
    // הודעות הבאות: תוכן מלא של המשתמש
    const geminiPrompt = isFirstMessage
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה עיקרית. שני משפטים בלבד.'
      : messages[messages.length - 1].content;

    // ─── ניסיון מודלים עם fallback ─────────────────────────────────────────
    let streamResult: any = null;

    for (const { name, generationConfig } of MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: name,
          systemInstruction: systemPrompt,
          generationConfig: generationConfig as any,
        });
        const chat = model.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        console.log('[MDA] model:', name);
        break;
      } catch (e: any) {
        const msg = String(e?.status ?? e?.message ?? '');
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('404');
        if (!isTransient || name === MODELS[MODELS.length - 1].name) throw e;
        console.warn('[MDA]', name, 'unavailable →', msg, '→ trying backup');
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
              // ── הודעה ראשונה: אוספים הכל ומחלצים תיאור נקי ──────────────
              // מונע דליפת "חשיבה בקול" גם כשthinkingBudget לא עבד
              let full = '';
              for await (const chunk of streamResult.stream) full += chunk.text();
              const caseText = extractCaseDescription(sanitize(full));
              controller.enqueue(encoder.encode(INJECTED_PREFIX + caseText));
            } else {
              // ── הודעות המשך: סטרימינג שורה-שורה ────────────────────────
              // buffer מצטבר עד שורה מלאה כדי שה-sanitize לא יחתוך באמצע
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
    console.error('[MDA API]', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
