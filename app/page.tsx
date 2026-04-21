// ... (בתוך הקומפוננטה MdaSimulator)

const startScenario = async () => {
  setMessages([]); // מנקה הכל כדי למנוע שגיאות היסטוריה
  setSeconds(0);
  setIsActive(true);
  setIsPaused(false);

  // אנחנו שולחים את פקודת ההתחלה כ-User, מה שפותר את שגיאת ה-Role
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ 
      messages: [{ role: 'user', content: 'התחל תרחיש' }], 
      mode: 'א' 
    }),
  });

  handleStream(res);
};

// הפונקציה sendMessage נשארת כמעט אותו דבר, רק לוודא שאין הודעות UI ריקות
const sendMessage = async (text: string) => {
  if (!text.trim() || isPaused) return;
  const userMsg = { role: 'user', content: text };
  
  // אנחנו מסננים הודעות מערכת אם יש כאלו מההיסטוריה שנשלחת ל-API
  const filteredMessages = messages.filter(m => !m.content.startsWith("הוראות תפעול:"));
  const apiMessages = [...filteredMessages, userMsg];
  
  setMessages(prev => [...prev, userMsg]);
  setInput('');

  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: apiMessages, mode: 'א' }),
  });
  handleStream(res);
};
