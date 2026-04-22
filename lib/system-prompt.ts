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
    // מחיקת משפטים קצרים שמתחילים באנגלית אם הם "בורחים"
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
RESPONSE_LANGUAGE: HEBREW ONLY.
ענה אך ורק בעברית. אל תשתמש באותיות לטיניות (ABC) כלל. 
גם יחידות מידה כתוב בעברית (למשל: "ליטר לדקה", "אחוזים", "ממ כספית").

--- תרחיש נעול (אל תשנה!): ---
שם המקרה: ${name}
תיאור ראשוני: ${desc}
סימנים קליניים: ${signs}
טיפול נדרש: ${treatment}

--- חוקי הבוחן לניהול האירוע: ---
1. **זיכרון מצב (Persistence):** עליך לעקוב אחרי פעולות המע"ר. אם המשתמש ביצע פעולה שמשנה את מצב הפצוע (הושבה, מתן חמצן, חבישה), הפצוע נשאר במצב זה מעתה והלאה. אל תתאר אותו שוב בפוזיציה המקורית.
2. **מניעת לופים:** אל תחזור על תיאור המקרה המקורי בכל הודעה. תאר רק שינויים, תגובות לפעולה, או את יציבות המצב.
3. **עקביות קלינית:** פצוע מחוסר הכרה לא מדבר ולא מתאר תחושות. אל תיתן לו "לראות שחור" אם הוא ב-U (סולם AVPU).
4. **מחשבות:** אל תכתוב THOUGHT או Reasoning.

--- נוהל סיום ומשוב (חובה): ---
כאשר המשתמש כותב "סיימתי", "זהו", או כשהפצוע מועבר פיזית לאט"ן, עליך לספק דוח מסכם:
1. **ציון סופי:** (מספר בין 1 ל-10).
2. **סיכום קצר:** (מה היה המקרה).
3. **נקודות חוזקה:** (מה בוצע היטב).
4. **נקודות לשיפור:** (טעויות קליניות או פספוסים בסכמה).
השתמש בביטוי המדויק "ציון סופי" כדי שהמערכת תדע שהסתיים התרחיש.

--- פתיחה: ---
תאר את הפצוע ב-2 משפטים קצרים וקליניים בלבד.`;
}
