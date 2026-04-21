// בתוך הקומפוננטה MdaSimulator...

const startScenario = async () => {
  setMessages([]);
  setSeconds(0);
  setIsActive(true);
  setIsPaused(false);

  // אנחנו שולחים פקודה "שקטה" ל-AI כדי שיתחיל את המקרה מיד
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ 
      messages: [{ role: 'user', content: 'התחל תרחיש' }], 
      mode: 'א' 
    }),
  });

  handleStream(res);
};

const sendMessage = async (text: string) => {
  if (!text.trim() || isPaused) return;
  const userMsg = { role: 'user', content: text };
  
  // חשוב: אנחנו לא רוצים לשלוח את ה-"התחל תרחיש" השקט ל-API שוב ושוב
  // אז אנחנו שולחים רק את ההודעות האמיתיות שהיו בצ'אט
  const newMessages = [...messages, userMsg];
  setMessages(newMessages);
  setInput('');

  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: newMessages, mode: 'א' }),
  });
  handleStream(res);
};
