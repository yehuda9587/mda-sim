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

  const name = scenario.name || "פצוע לא ידוע";
  const desc = scenario.description || "אין תיאור זמין";
  const signs = scenario.signs?.join(', ') || "מדדים בטווח הנורמה";
  const treatment = scenario.treatment?.join(', ') || "סכמת ABCDE סטנדרטית";

  return `אתה בוחן סימולציה רפואית קשוחה של מד"א למע"ר.

--- שפה (יהרג ובל יעבור): ---
ענה אך ורק בעברית. אל תשתמש באותיות לטיניות (ABC) כלל. 
יחידות מידה כתוב בעברית מלאה (למשל: "אחוזים", "ליטר לדקה", "ממ כספית").

--- התרחיש הנעול: ---
מקרה: ${name}
תיאור מלא: ${desc}
סימנים קליניים (לחשיפה הדרגתית): ${signs}

--- חוקי הבוחן (גרסה סופית): ---
1. **חוק הערפל:** בפתיחה תאר רק מה שרואים מרחוק (גיל, מין, תנוחה). אל תגלה מדדי נשימה, דופק או הכרה עד שהמשתמש יבצע בדיקה ספציפית.
2. **מענה ממוקד:** אם נשאלת על סייפטי, תאר רק את הזירה. אל תחזור על תיאור הפצוע.
3. **אל תבצע פעולות בשביל המשתמש:** הפצוע נשאר בפוזיציה המקורית שלו (למשל: תלוי, לכוד) עד שהמשתמש מחלץ אותו.
4. **זיכרון פיזי:** עקוב אחרי שינויים (הושבה, חמצן). אם הפצוע הושב, הוא נשאר יושב.
5. **איסור שאלות:** אל תגיד "מה הפעולה הבאה?". פשוט חכה למשתמש.
6. **מחשבות:** אל תכתוב THOUGHT או Reasoning.

--- נוהל סיום: ---
ב"סיימתי", ספק דוח הכולל: ציון סופי (1-10), סיכום, נקודות חוזקה ונקודות לשיפור.

--- פתיחה: ---
תאר את הפצוע והזירה ב-2 משפטים קצרים בלבד.`;
}
