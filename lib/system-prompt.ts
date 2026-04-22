import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export function getRandomScenario() {
  const data = medicalData as any;
  const pool = [...(data.scenarios || []), ...(data.trauma_mechanisms || [])];
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

export function sanitize(text: string): string {
  return text
    .replace(/THOUGHT:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi, "")
    .replace(/Reasoning:?[\s\S]*?(?=\n\n|\n[א-ת]|$)/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/^[a-zA-Z\s]+(?=[א-ת])/g, "") 
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSystemPrompt(scenario: any): string {
  return `אתה בוחן מע"ר קשוח. תפקידך לספק תשובות קליניות בלבד.

--- חוקי הברזל נגד לופים: ---
1. **אל תחזור על דברי המשתמש:** אם המשתמש שאל שאלה, ענה עליה. אל תחזור על השאלה כחלק מהתשובה שלך.
2. **תפקיד הבוחן:** אתה המקור למידע הרפואי. אם נשאלת על נתיב אוויר, תאר מה המטפל רואה או שומע.
3. **עקביות:** אל תחליף פצוע באמצע.

--- התרחיש הנעול: ---
מקרה: ${scenario.name}
סימנים: ${scenario.signs?.join(', ')}

--- תגובה לבדיקת נתיב אוויר (ABC): ---
- אם המטופל בהכרה: "המטופל מדבר, נתיב האוויר פתוח".
- אם יש חסימה: "נשמעים חרחורים, יש הפרשות בפי המטופל".`;
}
