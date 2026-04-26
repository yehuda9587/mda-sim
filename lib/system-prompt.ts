import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

// ייצוא מפורש כדי שה-API יוכל להשתמש בזה
export function getRandomScenario() {
  const data = medicalData as any;
  const pool = [...(data.scenarios || []), ...(data.trauma_mechanisms || [])];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ייצוא מפורש לניקוי הטקסט
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

  return `אתה בוחן סימולציה רפואית של מד"א למע"ר.

--- שפה: ---
ענה אך ורק בעברית. ללא אנגלית כלל.

--- התרחיש הנעול (אל תשנה!): ---
מקרה: ${name}
תיאור: ${desc}
סימנים: ${signs}

--- חוקי הבוחן: ---
1. **חוק הערפל:** בפתיחה תאר רק מה שרואים מרחוק (גיל, מין, תנוחה). אל תגלה מדדים עד שהמשתמש יבצע בדיקה.
2. **מענה ממוקד:** אם נשאלת "סייפטי?", תאר רק את הזירה. אל תחזור על תיאור הפצוע.
3. **עקביות:** אל תבצע פעולות עבור המשתמש ואל תחליף פצוע באמצע.
4. **זיכרון פיזי:** זכור אם הפצוע הושב או קיבל חמצן.

--- נוהל סיום: ---
ב"סיימתי", ספק דוח הכולל: ציון סופי (1-10), סיכום, נקודות חוזקה ונקודות לשיפור.`;
}
