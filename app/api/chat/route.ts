// ... (חלקי היבוא וה-sanitize נשארים אותו דבר)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    // שליפת התרחיש: אם הפרונטנד לא שלח אחד, מגרילים. 
    // חשוב: הפרונטנד צריך לשמור את ה-scenario שקיבל בהתחלה ולשלוח אותו שוב.
    const scenario = body.scenario || getRandomScenario();
    
    if (!scenario) {
        return NextResponse.json({ error: "No scenario available" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(scenario);
    
    // שימוש בטמפרטורה נמוכה (0.1) כדי למנוע הזיות של פצועים חדשים
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash', 
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.1 } as any
    });

    // ... (שאר הלוגיקה של ה-chat.sendMessageStream)
