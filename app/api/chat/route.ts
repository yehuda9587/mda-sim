// ... (בתוך פונקציית ה-POST)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', // או המודל הראשון ברשימה שלך
      systemInstruction: systemPrompt,
      generationConfig: { 
        temperature: 0, 
        topP: 0.1,
        maxOutputTokens: 150 // הגבלה קשיחה כדי למנוע ממנו לחפור ולחזור על עצמו
      } as any
    });
// ...
