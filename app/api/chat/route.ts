// ... (בתוך פונקציית ה-POST)

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', 
      systemInstruction: systemPrompt,
      generationConfig: { 
        temperature: 0, // חובה! מונע מהמודל לשנות את המיקום או התרחיש
        topP: 0.1,
        maxOutputTokens: 250 // תשובות קצרות וממוקדות
      } as any
    });

    const isFirstMessage = messages.length === 1;
    
    // אם זו לא הודעה ראשונה, אנחנו "מזכירים" לו לא לחפור
    const userContent = messages[messages.length - 1].content;
    const finalPrompt = isFirstMessage 
      ? userContent 
      : `ענה בקצרה על הפעולה הבאה בלבד: ${userContent}`;

    const chat = model.startChat({ 
      history: messages.slice(0, -1).map((m: any) => ({
        role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    });
    
    const result = await chat.sendMessageStream(finalPrompt);
// ...
