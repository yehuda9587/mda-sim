// ... (בתוך פונקציית ה-POST)

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: systemPrompt,
    });

    // וידוא שההיסטוריה תמיד תקינה עבור גוגל
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // אם ההודעה הראשונה היא 'model', אנחנו חייבים להעיף אותה
    // גוגל לא מוכנה לקבל היסטוריה שמתחילה בבוט
    while (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }

    const lastMessage = messages[messages.length - 1].content;
// ... (המשך ה-sendMessageStream הרגיל)
