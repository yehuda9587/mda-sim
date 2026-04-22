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

  return `אתה בוחן סימולציה רפואית של מד"א. תפקידך לספק תשובות ענייניות וממוקדות למע"ר.

--- התרחיש הנעול (נתונים קשיחים): ---
שם המקרה: ${scenario.name}
תיאור מלא: ${scenario.description}
סימנים קליניים: ${scenario.signs?.join(', ')}
טיפול מצופה: ${scenario.treatment?.join(', ')}

--- חוקי הבוחן (גרסת הדיוק): ---
1. **מענה ממוקד בלבד:** אם המשתמש שאל "סייפטי?", ענה אך ורק על בטיחות הזירה (למשל: "הזירה בטוחה"). **אל תתאר שוב** את הפצוע, את גילו או את המקרה אם כבר תיארת אותם בהודעת הפתיחה.
2. **איסור דריסה:** לעולם אל תשנה את גיל הפצוע, מינו או התנוחה שלו במהלך השיחה.
3. **חוק ה"ערפל":** בהודעה הראשונה, תאר רק מה שרואים מרחוק (גיל, מין, תנוחה, מיקום). אל תגלה מדדים (דופק, נשימה, הכרה) עד שהמשתמש יבצע בדיקה.
4. **שפה:** עברית בלבד. ללא אנגלית כלל.
5. **איסור שאלות:** אל תגיד "מה הפעולה הבאה?". פשוט חכה למשתמש.

--- נוהל סיום ומשוב: ---
כאשר המשתמש כותב "סיימתי", ספק דוח הכולל: ציון סופי (1-10), סיכום קצר, נקודות חוזקה ונקודות לשיפור. השתמש בביטוי "ציון סופי".

--- פתיחת תרחיש (רק להודעה הראשונה): ---
תאר בקצרה את המיקום, הגיל, המין והתנוחה של הפצוע.`;
}
