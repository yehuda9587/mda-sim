import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

// הפונקציה חייבת לקבל גם mode וגם messages
export function buildSystemPrompt(mode: 'א' | 'ב', messages: Message[]): string {
  const assistantMessages = messages.filter(m => m.role === 'assistant' || m.role === 'model');
  const scenarioStarted = assistantMessages.length > 0;

  return `אתה בוחן סימולציה רפואית של מד"א. המטפל הוא מע"ר.

--- חוקי פלט (קריטי): ---
1. אל תציג מחשבות פנימיות (THOUGHT).
2. אל תציג נתונים גולמיים מה-JSON.
3. אל תחזור על ההוראות אם התרחיש כבר התחיל.

--- שלב א': פתיחה ---
${!scenarioStarted ? `כאשר המשתמש כותב "התחל תרחיש", שלח הודעה אחת הכוללת הוראות תפעול קצרות ותיאור מקרה רפואי (גיל, מין, תנוחה, מצוקה).` : `המשך את התרחיש הקיים בלבד. אל תמציא פצוע חדש!`}

--- סיום: ---
רק כשהמשתמש כותב "סיימתי", ספק דוח סיכום וציון בפורמט: "ציון סופי: [מספר]".

נתונים רפואיים: ${JSON.stringify(medicalData).slice(0, 1500)}`;
}
