import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function buildSystemPrompt(mode: 'א' | 'ב', messages: Message[]): string {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  
  // 1. Find matches but limit to the TOP 2 most relevant keys
  const relevantKeys = Object.keys(medicalData)
    .filter(key => lastUserMessage.toLowerCase().includes(key.toLowerCase()))
    .slice(0, 2); 

  // 2. Extract data and ensure it's not massive
  let contextData = relevantKeys.length > 0 
    ? relevantKeys.map(key => (medicalData as any)[key]).join('\n\n')
    : "Follow standard MDA BLS/ALS protocols.";

  // 3. HARD TRUNCATE: If the context is over 3000 characters, cut it off.
  // This ensures we stay well under the 6000 token limit.
  if (contextData.length > 3000) {
    contextData = contextData.substring(0, 3000) + "... [truncated]";
  }

return `אתה סימולטור רפואי של מד"א. 
תפקידך: להציג מקרה רפואי ולנהל שיחה מקצועית עם החובש.

הנחיות קשיחות:
1. אל תשתמש במונחים באנגלית מתורגמת (כמו 'להקסס'). השתמש ב'להעריך' או 'לבצע הערכה'.
2. אל תציג רשימות של פעולות מערכת (כמו תיוג, תקצור או עדכונים).
3. פלט: הצג תיאור מקרה קצר, מדדים (דופק, ל"ד, נשימה, סטורציה) ושאל את החובש 'מה הטיפול שלך?'.
4. שמור על עברית תקנית של ספרי הלימוד של מד"א.

פרוטוקול רלוונטי:
${contextData}`;
