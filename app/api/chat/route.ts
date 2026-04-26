import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, getRandomScenario, sanitize } from '@/lib/system-prompt';

// הגדרות כלליות מחוץ ל-Handler
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const INJECTED_PREFIX = "הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'.\n\n";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, scenario } = body;
    
    // נעילת תרחיש: שימוש בקיים או הגרלת חדש
    const activeScenario = scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(activeScenario);
    
    // היררכיית המודלים שלך
    const MODELS = [
      { name: 'gemini-2.5-flash' },
      { name: 'gemini-2.0-flash' },
      { name: 'gemini-2.5-flash-lite' },
      { name: 'gemma-4-31b-it' }
    ];

    let streamResult: any = null;

    // לולאת הניסיונות (Fallback) - חייבת להיות בתוך ה-POST
    for (const modelInfo of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelInfo.name, 
          systemInstruction: systemPrompt,
          generationConfig: { 
            temperature: 0, // יציבות מקסימלית למניעת החלפת פצוע
            topP: 0.1 
          } as any
        });
        
        // בניית היסטוריית שיחה נקייה
        const history = messages.slice(0, -1).map((m: any) => ({
          role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
          parts: [{ text: m.content.replace(/^הוראות תפעול:[^\n]*\n\n/, '').trim() }]
        }));

        const chat = model.startChat({ 
          history: history.length > 0 && history[0].role === 'user' ? history : [] 
        });
        
        const lastMessageContent = messages[messages.length - 1].content;
        
        // כאן ה-await שהיה גורם לשגיאה - עכשיו הוא בתוך פונקציית ה-POST
        streamResult = await chat.sendMessageStream(lastMessageContent);
        break; // אם הצלחנו, יוצאים מהלולאה
      } catch (e) {
        console.warn(`[MDA] Fallback from ${modelInfo.name}`);
        continue;
      }
    }

    if (!streamResult) throw new Error("כל ערוצי ה-AI נכשלו בטעינה.");

    const encoder = new TextEncoder();
    const headers: HeadersInit = { 'Content-Type': 'text/plain; charset=utf-8' };
    
    // שליחת התרחיש חזרה ב-Header בבקשה הראשונה
    if (!body.scenario) headers['X-Scenario'] = encodeURIComponent(JSON.stringify(activeScenario));

    return new Response(new ReadableStream({
      async start(controller) {
        try {
          if (messages.length === 1) controller.enqueue(encoder.encode(INJECTED_PREFIX));
          
          let buffer = "";
          for await (const chunk of streamResult.stream) {
            buffer += chunk.text();
            if (buffer.includes(' ') || buffer.includes('\n')) {
              const clean = sanitize(buffer);
              if (clean) controller.enqueue(encoder.encode(clean + " "));
              buffer = "";
            }
          }
          if (buffer) controller.enqueue(encoder.encode(sanitize(buffer)));
          controller.close();
        } catch (e) { 
          controller.error(e); 
        }
      }
    }), { headers });

  } catch (err: any) {
    console.error('[MDA API ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
