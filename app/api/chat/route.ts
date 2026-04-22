import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, Message } from '@/lib/system-prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

//Regex משופר שתופס בלוקים שלמים של מחשבה גם אם הם בכמה שורות
const LEAK_PATTERNS = [
  /THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi,
  /Reasoning:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /```json[\s\S]*?```/g
];

function sanitize(text: string): string {
  let cleaned = text;
  // מחליף את המחשבות ברווח בודד כדי למנוע הידבקות מילים
  LEAK_PATTERNS.forEach(re => {
    cleaned = cleaned.replace(re, ' ');
  });
  // מנקה רווחים כפולים שנוצרו
  return cleaned.replace(/\s+/g, ' ').trim();
}

// ... שאר פונקציות העזר (extractCaseDescription, buildGeminiHistory) נשארות כפי שהן ...

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    const scenario = body.scenario ?? getRandomScenario();
    
    // הוספת הוראה לדיוק ברווחים בעברית
    const systemPrompt = buildSystemPrompt(scenario) + "\nCRITICAL: Use spaces between words. Do not merge Hebrew words together.";
    
    const history = buildGeminiHistory(messages);
    const isFirstMessage = messages.length === 1;
    const geminiPrompt = isFirstMessage 
      ? 'תאר את המקרה: גיל, מין, תנוחה, מצוקה. שני משפטים קצרים.' 
      : messages[messages.length - 1].content;

    const MODELS = [
      { name: 'gemini-2.0-flash-thinking-preview-01-21', config: { thinkingConfig: { includeThinkingProcess: false, thinkingBudget: 16000 } } },
      { name: 'gemini-2.0-flash', config: {} }
    ];

    let streamResult: any = null;
    for (const { name: modelName, config } of MODELS) {
      try {
        const m = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt, generationConfig: config as any });
        const chat = m.startChat({ history });
        streamResult = await chat.sendMessageStream(geminiPrompt);
        break;
      } catch (e) { continue; }
    }

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            let buffer = ""; // באפר לצבירת טקסט לפני ניקוי
            
            for await (const chunk of streamResult.stream) {
              buffer += chunk.text();
              
              // אם הצטבר מספיק טקסט או שיש סוף משפט, ננקה ונשלח
              if (buffer.includes('\n') || buffer.length > 50) {
                const clean = sanitize(buffer);
                if (clean) {
                  controller.enqueue(encoder.encode(clean + " "));
                  buffer = ""; // מאפסים את הבאפר
                }
              }
            }
            
            // שליחת שאריות
            if (buffer) {
              const finalClean = sanitize(buffer);
              if (finalClean) controller.enqueue(encoder.encode(finalClean));
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
