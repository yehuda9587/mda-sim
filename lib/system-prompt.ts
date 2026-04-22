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
  if (!scenario) return "שגיאה: תרחיש לא נטען.";

  return `אתה בוחן סימולציה רפואית של מד"א. תפקידך לספק תשובות ענייניות וממוקדות למע"ר.

--- חוקי ה"ערפל" (פתיחה): ---
1. תאר רק מה שרואים מרחוק: גיל משוער, מין, מיקום, תנוחה והסביבה.
2. **אל תגלה** אם הוא נושם, בהכרה או מדמם עד שהמע"ר יבצע בדיקה.

--- התרחיש הנעול (נתונים קשיחים): ---
שם המקרה: ${scenario.name}
תיאור מלא: ${scenario.description}
סימנים קליניים: ${scenario.signs?.join(', ')}
טיפול מצופה: ${scenario.treatment?.join(', ')}

--- חוקי הבוחן: ---
1. **מענה ממוקד:** אם נשאל "סייפטי?", ענה רק על הבטיחות. אל תתאר שוב את הפצוע אם כבר תיארת אותו בפתיחה.
2. **איסור דריסה:** הפצוע נשאר באותו גיל, מין ותנוחה לאורך כל השיחה.
3. **שפה:** עברית בלבד. ללא אנגלית כלל.
4. **זיכרון פיזי:** עקוב אחרי שינויים (הושבה, חמצן).

--- נוהל סיום: ---
ב"סיימתי", ספק דוח הכולל: ציון סופי (1-10), סיכום, נקודות חוזקה ונקודות לשיפור. השתמש בביטוי "ציון סופי".

--- פתיחה: ---
תאר בקצרה את המיקום והפצוע (גיל, מין, תנוחה) ללא ממצאים קליניים.`;
}
