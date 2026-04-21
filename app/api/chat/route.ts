import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ━━━ סינון דליפות ━━━
// רשימת תבניות שמסננות תוכן פנימי שנדלף — נפעל על הטקסט המלא לא על chunks
const LEAK_PATTERNS: RegExp[] = [
  /THOUGHT:?.*?(?=\n\n|\n[^\s]|$)/gis,
  /Reasoning:?.*?(?=\n\n|\n[^\s]|$)/gis,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_PATTERNS.reduce((t, pattern) => t.replace(pattern, ''), text).trim();
}

// ━━━ בניית היסטוריה לפורמט Gemini ━━━
/**
 * Gemini דורש:
 * 1. ההיסטוריה מתחילה תמיד ב-role: "user"
 * 2. תורות מתחלפות בדיוק: user → model → user → model ...
 * 3. הודעה ריקה תחסום — מסננים אותה
 *
 * הפונקציה מקבלת את כל המסרים פחות האחרון (שנשלח בנפרד כ-sendMessage).
 */
function buildGeminiHistory(messages: Message[]): Content[] {
  const history = messages.slice(0, -1); // ללא ההודעה האחרונה

  // שלב 1: המרת roles + סינון ריקים
  const contents: Content[] = history
    .filter(m => m.content?.trim())
    .map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content.trim() }],
    }));

  // שלב 2: הסר model messages מהתחלה
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  // שלב 3: מזג הודעות עוקבות מאותו role (במקרה של בעיות state בצד לקוח)
  const merged: Content[] = [];
  for (const item of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === item.role) {
      // חיבור הטקסטים במקום שבירת הרצף
      prev.parts = [...prev.parts, { text: '\n' }, ...item.parts];
    } else {
      merged.push({ role: item.role, parts: [...item.parts] });
    }
  }

  // שלב 4: אם ההיסטוריה לא מסתיימת ב-model (כלומר user אחרון ברצף) — תקין, כי ה-lastMessage הוא ה-user
  return merged;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Message[];
      scenario?: any; // תרחיש נעול שהגיע מה-Frontend
    };

    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    // ━━━ נעילת תרחיש ━━━
    // אם ה-Frontend שלח תרחיש — משתמשים בו (המשך סימולציה)
    // אחרת — בוחרים חדש ומחזירים אותו ב-Header
    const isNewScenario = !body.scenario;
    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    const history = buildGeminiHistory(messages);
    const lastMessage = messages[messages.length - 1]?.content || 'התחל תרחיש';

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    const responseHeaders: HeadersInit = {
      'Content-Type': 'text/plain; charset=utf-8',
    };

    // שולחים את התרחיש ב-Header רק כשנבחר לראשונה
    if (isNewScenario) {
      responseHeaders['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));
    }

    return new Response(
      new ReadableStream({
        async start(controller) {
          let buffer = '';
          for await (const chunk of result.stream) {
            buffer += chunk.text();

            // מנקים את ה-buffer רק כשיש גבול טבעי (שורה חדשה)
            // כך אנחנו לא מסננים ditd בתוך אמצע מילה
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? ''; // השורה האחרונה אולי חלקית

            const clean = sanitize(lines.join('\n'));
            if (clean) controller.enqueue(encoder.encode(clean + '\n'));
          }

          // שחרור מה-buffer הנותר
          if (buffer) {
            const clean = sanitize(buffer);
            if (clean) controller.enqueue(encoder.encode(clean));
          }

          controller.close();
        },
      }),
      { headers: responseHeaders }
    );
  } catch (err: any) {
    console.error('[MDA Simulator API Error]', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
