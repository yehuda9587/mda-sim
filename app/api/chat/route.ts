import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── הוראות קבועות — השרת כותב, גמיני לא ───────────────────────────────────
const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

// ─── ניקוי דליפות — ללא דגל s (לא נתמך ב-ES2017) ───────────────────────────
// כל pattern עובד שורה-שורה או עם [\s\S] במקום .
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

// ─── הסרת ה-prefix שהשרת הזריק לפני שגמיני רואה את ההיסטוריה ───────────────
// חשוב: אל תשתמש בדגל s — השורה נגמרת ב-\n\n ישיר
function stripInjected(text: string): string {
  // "הוראות תפעול: ...\n\n" — כל התוכן עד השורה הריקה הכפולה
  return text.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim();
}

// ─── בניית היסטוריה תקינה לגמיני ───────────────────────────────────────────
/**
 * דרישות גמיני:
 * 1. מתחיל תמיד ב-role:"user"
 * 2. מתחלף user→model→user→model בדיוק
 * 3. אין הודעות ריקות
 *
 * בנוסף: מסיר את ה-INJECTED_PREFIX מהודעות model כדי שגמיני לא יחקה אותן.
 */
function buildGeminiHistory(messages: Message[]): Content[] {
  // לא כולל את ההודעה האחרונה — היא תישלח כ-sendMessage
  const slice = messages.slice(0, -1);

  // שלב א: המרה + ניקוי prefix + סינון ריקים
  const raw: Content[] = slice
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      const text = isModel ? stripInjected(m.content) : m.content;
      return { role: isModel ? 'model' : 'user', text: text.trim() };
    })
    .filter(m => m.text.length > 0)
    .map(m => ({ role: m.role as 'user' | 'model', parts: [{ text: m.text }] }));

  // שלב ב: הסרת model messages מהתחלה
  while (raw.length > 0 && raw[0].role !== 'user') raw.shift();

  // שלב ג: מיזוג הודעות עוקבות מאותו role
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

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Message[];
      scenario?: object | null;
    };

    const { messages } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    // נעילת תרחיש: אם Frontend שלח תרחיש — משתמשים בו; אחרת בוחרים חדש
    const isNewScenario = !body.scenario;
    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    // הודעה ראשונה: messages = [{role:'user', content:'התחל תרחיש'}]
    const isFirstMessage = messages.length === 1;

    const history = buildGeminiHistory(messages);
    const lastContent = messages[messages.length - 1].content;

    // גמיני מקבל בקשה נקייה בהודעה ראשונה — ללא הוראות
    const geminiPrompt = isFirstMessage
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה עיקרית. שני משפטים בלבד.'
      : lastContent;

    const chat = model.startChat({ history });
    const streamResult = await chat.sendMessageStream(geminiPrompt);

    // ─── Streaming ───────────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };

    // מחזירים את התרחיש ב-header רק בפעם הראשונה
    if (isNewScenario) {
      headers['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));
    }

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // הוראות קבועות — מוזרקות על ידי השרת, לפני תגובת גמיני
            if (isFirstMessage) {
              controller.enqueue(encoder.encode(INJECTED_PREFIX));
            }

            // בניית buffer שורה-שורה למניעת ניקוי ditd באמצע מילה
            let buffer = '';
            for await (const chunk of streamResult.stream) {
              buffer += chunk.text();
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              const clean = sanitize(lines.join('\n'));
              if (clean) controller.enqueue(encoder.encode(clean + '\n'));
            }
            // שחרור שארית buffer
            if (buffer) {
              const clean = sanitize(buffer);
              if (clean) controller.enqueue(encoder.encode(clean));
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
