import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function buildSystemPrompt(mode: 'א' | 'ב', messages: Message[]): string {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  
  // שליפת מפתחות רלוונטיים וסינון כדי לא לעבור את מכסת ה-Tokens
  const relevantKeys = Object.keys(medicalData)
    .filter(key => lastUserMessage.toLowerCase().includes(key.toLowerCase()))
    .slice(0, 2); 

  let contextData = relevantKeys.length > 0 
    ? relevantKeys.map(key => (medicalData as any)[key]).join('\n\n')
    : "פעל לפי פרוטוקולי מד\"א סטנדרטיים (BLS/ALS).";

  // הגבלת אורך הטקסט כדי למנוע שגיאת 413 מול Groq
  if (contextData.length > 2500) {
    contextData = contextData.substring(0, 2500) + "... [המשך הפרוטוקול קוצר]";
  }

  return `אתה סימולטור רפואי מקצועי של מד"א. 
תפקידך: להציג מקרה רפואי ולנהל שיחה מקצועית עם החובש.

הנחיות קשיחות:
1. אל תשתמש במונחים באנגלית מתורגמת (כמו 'להקסס'). השתמש ב'להעריך' או 'לבצע הערכה'.
2. אל תציג רשימות של פעולות מערכת פנימיות (כמו תיוג, תקצור או עדכונים).
3. מבנה פלט קבוע: תיאור מקרה קצר, מדדים ברורים (דופק, ל"ד, נשימה, סטורציה, GCS) ושאל 'מה הטיפול שלך?'.
4. הקפד על עברית מקצועית של ספרי הלימוד של מד"א בלבד.

פרוטוקול רלוונטי מהמערכת:
${contextData}`;
}
