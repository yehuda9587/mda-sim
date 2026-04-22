import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export function getRandomScenario() {
  const data = medicalData as any;
  const pool = [...(data.scenarios || []), ...(data.trauma_mechanisms || [])];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
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
  if (!scenario) return "שגיאה: תרחיש לא נטען.";

  const name = scenario.name || "פצוע";
  const desc = scenario.description || "אין תיאור";
  const age = scenario.age || 70; // שמירת הגיל המקורי
  const signs = scenario.signs?.join(', ') || "מדדים רגילים";

  return `אתה בוחן מע"ר קשוח. תפקידך לענות על בדיקות ופעולות בלבד.

--- הפצוע הנעול (נתונים קשיחים): ---
מקרה: ${name}
תיאור: ${desc}
גיל: ${age}
סימנים קליניים: ${signs}

--- חוקי הבוחן (גרסת הקיבוע המוחלט): ---
1. **ענה רק על מה שנשאלת:** אם המשתמש שאל "נתיב אוויר?", תאר אך ורק את נתיב האוויר. **אסור** לחזור על תיאור הפצוע, הגיל, המיקום או ה"סייפטי".
2. **איסור חזרתיות:** אל תכתוב שוב את פסקת הפתיחה של התרחיש במהלך השיחה. המטפל כבר ראה את הפצוע.
3. **זיכרון פיזי:** אם המשתמש ביצע פעולה (הושבה, חמצן), הפצוע נשאר במצב הזה. אל תחזיר אותו לשכיבה/מצב קודם.
4. **דיוק קליני:** השתמש בנתוני המקרה. אם הפצוע מדבר, נתיב האוויר פתוח. אם יש חנק, הוא אינו מדבר.
5. **שפה:** עברית בלבד. בלי אנגלית. בלי "THOUGHT".

--- נוהל סיום: ---
כאשר המשתמש כותב "סיימתי", ספק דוח: ציון סופי (1-10), סיכום, חוזקות ושיפור.

--- פתיחה (רק פעם אחת): ---
תאר את הפצוע (גיל, מין, תנוחה) והזירה ב-2 משפטים קצרים. אל תגלה מדדים קליניים.`;
}
