import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function buildSystemPrompt(mode: 'א' | 'ב', messages: Message[]): string {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  
  // Select relevant protocols based on keywords
  const relevantKeys = Object.keys(medicalData)
    .filter(key => lastUserMessage.toLowerCase().includes(key.toLowerCase()))
    .slice(0, 2); 

  let contextData = relevantKeys.length > 0 
    ? relevantKeys.map(key => (medicalData as any)[key]).join('\n\n')
    : "פעל לפי פרוטוקולי מד\"א סטנדרטיים (BLS/ALS).";

  // Truncate to stay under Groq's 6,000 token limit
  if (contextData.length > 2500) {
    contextData = contextData.substring(0, 2500) + "... [המשך הפרוטוקול קוצר]";
  }

  return `אתה סימולטור רפואי של מד"א המיועד לחניכי קורס 60 (מע"רים/חובשים).
המטרה: אימון על סכימות ה-ABC ו-PHTLS.

חוקים בל יעברו (CRITICAL):
1. רמת ידע: BLS בלבד. אסור להשתמש במושגי נט"ן (ALS). 
2. איסור מוחלט על פענוח אק"ג: אל תציין "עליות ST" או "ST Elevation". במקום זאת, ציין רק "דופק מהיר/איטי" או "דופק לא סדיר".
3. איסור על תרופות ורידיות: המקסימום שאתה יכול להמליץ עליו זה חמצן או אספירין (לפי הפרוטוקול).
4. שפה: עברית מקצועית של מד"א. בלי "להקסס" ובלי "מגיעה שקופה".
5. מבנה תשובה:
   - תיאור מקרה (2 משפטים).
   - מדדים: דופק, ל"ד, נשימה, סטורציה, GCS.
   - שאלה: "מה הפעולה הבאה שלך?".

פרוטוקול עזר:
${contextData}`;
} // <--- THIS is the brace that was missing!
