export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    // שליפת התרחיש מהכותרת או מהבקשה המקורית
    // וודא שהפרונטנד שולח את ה-scenario שנבחר בהתחלה בכל בקשה!
    const scenario = body.scenario || getRandomScenario(); 
    
    const systemPrompt = buildSystemPrompt(scenario);
    
    // היררכיית מודלים עם "נעילת מטרה"
    const MODELS = [
      { name: 'gemini-2.0-flash', config: { temperature: 0.1 } }, // טמפרטורה נמוכה מונעת הזיות
      { name: 'gemini-2.5-flash', config: { temperature: 0.1 } }
    ];

    let streamResult: any = null;
    for (const modelInfo of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelInfo.name, 
          systemInstruction: systemPrompt,
          generationConfig: modelInfo.config as any
        });
        
        // היסטוריה נקייה: מסירים הודעות מערכת מזויפות
        const history = messages.slice(0, -1).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const chat = model.startChat({ history });
        streamResult = await chat.sendMessageStream(messages[messages.length - 1].content);
        break;
      } catch (e) { continue; }
    }

    // ... סטרימינג וניקוי THOUGHT (כמו קודם) ...
