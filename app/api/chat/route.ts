import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "דגשים לסימולציה: זהו מגה-קוד של מד\"א. נהל לפי סכימת SABCDE, בצע בדיקות ותן טיפול. בסיום כתוב 'סיימתי'.\n\n";

const MODELS = [
  {
    name: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 1000, // הוגדל למניעת קטיעה בסוף
      thinkingConfig: { thinkingBudget: 0 },
    },
  },
  {
    name: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 1000,
    },
  },
] as const;

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

function extractCaseDescription(raw: string): string {
  const isMeta = (line: string): boolean => {
    const t = line.trim();
    if (!t || /^[\*\-•]\s/.test(t) || /^\(/.test(t)) return true;
    if (/^(Role|Scenario|Constraint|Sentence|Draft|Age|Gender|Position|Main|Detail|Treatment|Wait|Two|No |Yes|Let|Pick|Prompt|Here|Note|Check|Patient|First|Second)/i.test(t)) return true;
    if (/^[a-zA-Z0-9\s\:\.\,\!\?\-\/\(\)]+$/.test(t)) return true;
    return false;
  };
  const lines = raw.split('\n');
  const hebrewLines = lines.filter(l => !isMeta(l));
  if (hebrewLines.length === 0) return raw.trim();
  return hebrewLines.slice(-3).join('\n').trim();
}

function stripInjected(text: string): string {
  // תיקון הניקוי כך שיתאים ל-Prefix החדש
  return text.replace(/^דגשים לסימולציה:[^\n]*\n\n/, '').trim();
}

function buildGeminiHistory(messages: Message[]): Content[] {
  const raw: Content[] = messages
    .slice(0, -1)
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      const text = isModel ? stripInjected(m.content) : m.content;
      return { role: (isModel ? 'model' : 'user') as 'user' | 'model', text: text.trim() };
    })
    .filter(m => m.text.length > 0)
    .map(m => ({ role: m.role, parts: [{ text: m.text }] }));

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { messages: Message[]; scenario?: object | null };
    const { messages } = body;
    if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 });

    const isFirstMessage = messages.length === 1;
    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);
    const history = buildGeminiHistory(messages);

    // עדכון הפניה הראשונה שתכלול את הנעת המשתמש לפעולה
    const geminiPrompt = isFirstMessage
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה עיקרית. סיים בשאלה "כיצד תפעל?".'
      : messages[messages.length - 1].content;

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
        break;
      } catch (e) { continue; }
    }

    if (!streamResult) throw new Error('Models unavailable');

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            if (isFirstMessage) {
              let full = '';
              for await (const chunk of streamResult.stream) full += chunk.text();
              const caseText = extractCaseDescription(sanitize(full));
              controller.enqueue(encoder.encode(INJECTED_PREFIX + caseText));
            } else {
              let buffer = '';
              for await (const chunk of streamResult.stream) {
                buffer += chunk.text();
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                const clean = sanitize(lines.join('\n'));
                if (clean) controller.enqueue(encoder.encode(clean + '\n'));
              }
              if (buffer) controller.enqueue(encoder.encode(sanitize(buffer)));
            }
            controller.close();
          } catch (e) { controller.error(e); }
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Scenario': encodeURIComponent(JSON.stringify(scenario)) } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
