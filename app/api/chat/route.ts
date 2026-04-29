import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "דגשים לסימולציה: נהל לפי SABCDE, בצע בדיקות, תן טיפול. לסיום כתוב 'סיימתי'.\n\n";

const MODELS = [
  {
    name: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 2000, // הגדלה משמעותית למניעת קטיעה
      thinkingConfig: { thinkingBudget: 0 },
    },
  },
  {
    name: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 2000,
    },
  },
] as const;

const LEAK_RES: RegExp[] = [
  /THOUGHT:[^\n]*/gi,
  /Reasoning:[^\n]*/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_RES.reduce((t, re) => t.replace(re, ''), text).trim();
}

function extractCaseDescription(raw: string): string {
  const lines = raw.split('\n').filter(l => {
    const t = l.trim();
    return t && !/^[\*\-•]\s/.test(t) && !/^[a-zA-Z]/.test(t) && !/^\(/.test(t);
  });
  return lines.length === 0 ? raw.trim() : lines.slice(-3).join('\n').trim();
}

function stripInjected(text: string): string {
  return text.replace(/^דגשים לסימולציה:[^\n]*\n\n/, '').trim();
}

function buildGeminiHistory(messages: Message[]): Content[] {
  const raw: Content[] = messages
    .slice(0, -1)
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      const text = isModel ? stripInjected(m.content) : m.content;
      return { role: (isModel ? 'model' : 'user') as 'user' | 'model', parts: [{ text: text.trim() }] };
    })
    .filter(m => m.parts[0].text.length > 0);

  while (raw.length > 0 && raw[0].role !== 'user') raw.shift();
  return raw;
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

   const geminiPrompt = isFirstMessage
      ? 'תאר רק מה שרואים מרחוק: גיל, מין, תנוחה ומיקום. אל תציין הכרה או נשימה. סיים ב"כיצד תפעל?".'
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
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isFirstMessage) {
            // בהודעה ראשונה צוברים הכל כדי להזריק את ה-Prefix בצורה נקייה
            let fullText = '';
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              if (text) fullText += text;
            }
            const clean = extractCaseDescription(sanitize(fullText));
            controller.enqueue(encoder.encode(INJECTED_PREFIX + clean));
          } else {
            // בשיחה שוטפת משתמשים בבאפר כדי למנוע קטיעה של Regex באמצע מילה
            let lineBuffer = '';
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              if (!text) continue;

              lineBuffer += text;

              if (lineBuffer.includes('\n')) {
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() ?? ''; // שומרים את השורה הלא גמורה
                const processed = sanitize(lines.join('\n'));
                if (processed) {
                  controller.enqueue(encoder.encode(processed + '\n'));
                }
              }
            }
            // שליחת שאריות בסיום
            if (lineBuffer) {
              const final = sanitize(lineBuffer);
              if (final) controller.enqueue(encoder.encode(final));
            }
          }
          controller.close();
        } catch (e: any) {
          console.error("Stream error:", e);
          // במקום לקרוס, שולחים הודעה למשתמש בתוך הסטרים
          controller.enqueue(encoder.encode(`\n\n[שגיאת הזרמה: ${e.message}]`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Scenario': encodeURIComponent(JSON.stringify(scenario))
      }
    });
  } catch (err: any) {
    console.error("Fatal API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
