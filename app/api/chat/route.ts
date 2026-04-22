import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const LEAK_PATTERNS: RegExp[] = [
  /THOUGHT:?[\s\S]*?(?=\n\n|\n[^\s]|$)/gi,
  /Reasoning:?[\s\S]*?(?=\n\n|\n[^\s]|$)/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g,
];

function sanitize(text: string): string {
  return LEAK_PATTERNS.reduce((t, pattern) => t.replace(pattern, ''), text).trim();
}

function stripInjectedInstructions(text: string): string {
  // החלפנו את .*? בדגל /s ל-[\s\S]*? שעובד בכל גרסה
  return text.replace(/^הוראות תפעול:[\s\S]*?\n\n/, '').trim();
}

function buildGeminiHistory(messages: Message[]): Content[] {
  const history = messages.slice(0, -1);

  const contents: Content[] = history
    .filter(m => m.content?.trim())
    .map(m => {
      const isModel = m.role === 'assistant' || m.role === 'model';
      const text = isModel
        ? stripInjectedInstructions(m.content.trim())
        : m.content.trim();
      return {
        role: isModel ? 'model' : 'user',
        parts: [{ text }],
      };
    })
    .filter(m => m.parts[0].text.length > 0);

  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  const merged: Content[] = [];
  for (const item of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts = [...prev.parts, { text: '\n' }, ...item.parts];
    } else {
      merged.push({ role: item.role, parts: [...item.parts] });
    }
  }

  return merged;
}

// הוראות תפעול קבועות — מוזרקות על ידי השרת, לא על ידי המודל
const HARDCODED_INSTRUCTIONS = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Message[];
      scenario?: any;
    };

    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const isNewScenario = !body.scenario;
    const isFirstMessage = messages.length === 1;

    const scenario = body.scenario ?? getRandomScenario();
    const systemPrompt = buildSystemPrompt(scenario);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    const history = buildGeminiHistory(messages);

    // ━━━ הפרדת אחריות ━━━
    // הודעה ראשונה: גמיני מקבל בקשה לתיאור מקרה בלבד — ההוראות מוזרקות מהשרת
    // הודעות הבאות: הטקסט המלא של המשתמש
    const geminiPrompt = isFirstMessage
      ? 'תאר את המקרה הרפואי: גיל, מין, תנוחה ומצוקה עיקרית. שני משפטים בלבד. ללא הוראות.'
      : messages[messages.length - 1]?.content || '';

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(geminiPrompt);

    const encoder = new TextEncoder();
    const responseHeaders: HeadersInit = {
      'Content-Type': 'text/plain; charset=utf-8',
    };

    if (isNewScenario) {
      responseHeaders['X-Scenario'] = encodeURIComponent(JSON.stringify(scenario));
    }

    return new Response(
      new ReadableStream({
        async start(controller) {
          // הוראות קבועות — פעם אחת בלבד, מהשרת
          if (isFirstMessage) {
            controller.enqueue(encoder.encode(HARDCODED_INSTRUCTIONS));
          }

          let buffer = '';
          for await (const chunk of result.stream) {
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
