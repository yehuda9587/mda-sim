// ... (בתוך ה-component)

const startScenario = async () => {
  // 1. איפוס מלא של הממשק
  setMessages([]);
  setSeconds(0);
  setIsActive(true);
  setIsPaused(false);

  // 2. שליחת פקודת התחלה ל-API
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ 
      messages: [{ role: 'user', content: 'התחל תרחיש' }], 
      mode: 'א' 
    }),
  });

  // 3. הזרמת התשובה (שתכיל הוראות + מקרה)
  handleStream(res);
};

// הפונקציה sendMessage נשארת רגילה לגמרי
const sendMessage = async (text: string) => {
  if (!text.trim() || isPaused) return;
  const userMsg = { role: 'user', content: text };
  const newMessages = [...messages, userMsg];
  
  setMessages(newMessages);
  setInput('');

  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: newMessages, mode: 'א' }),
  });
  handleStream(res);
};
