// ... (חלקי ה-Import נשארים אותו דבר)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, scenario } = body;
    
    const activeScenario = scenario || getRandomScenario();
    const systemPrompt = buildSystemPrompt(activeScenario);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash', // המודל הזה הכי יציב לסימולציות כאלו
      systemInstruction: systemPrompt,
      generationConfig: { 
        temperature: 0.1, // טמפרטורה נמוכה מונעת מהמודל "להמציא" שאלות של המשתמש
        topP: 0.1 
      } as any
    });

    // וידוא שההודעה האחרונה באמת מגיעה מהמשתמש
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
       throw new Error("ההודעה האחרונה חייבת להיות של המשתמש");
    }

    // בניית היסטוריה נקייה - ללא ההודעה האחרונה
    const history = messages.slice(0, -1).map((m: any) => ({
      role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // אתחול הצאט עם ההיסטוריה
    const chat = model.startChat({ 
      history: history.length > 0 ? history : [] 
    });
    
    const result = await chat.sendMessageStream(lastMessage.content);

    // ... (שאר לוגיקת ה-Streaming וה-Sanitize)
