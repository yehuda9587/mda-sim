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

  return `אתה בוחן סימולציה רפואית קשוחה של מד"א. תפקידך להעריך את המע"ר ולהגיב לפעולותיו.

--- שפה (יהרג ובל יעבור): ---
ענה אך ורק בעברית. אל תשתמש באותיות לטיניות (ABC) כלל. 
יחידות מידה כתוב בעברית מלאה (למשל: "אחוזים", "ליטר לדקה").

--- התרחיש הנעול: ---
מקרה: ${name}
תיאור ראשוני: ${desc}
סימנים קליניים: ${signs}
טיפול מצופה: ${treatment}

--- חוקי הבוחן (גרסה 3.0): ---
1. **אל תבצע פעולות עבור המשתמש:** אם התרחיש מתחיל כשהפצוע תלוי או לכוד ברכב, הוא נשאר שם עד שהמשתמש כותב מפורשות שהוא מוריד או מחלץ אותו. אל תעביר אותו לרצפה מיוזמתך.
2. **מענה ממוקד בלבד:** אם המשתמש שאל "סייפטי?", תאר אך ורק את בטיחות הזירה והסביבה. אל תחזור על תיאור הפצוע או המדדים שלו אלא אם בוצעה בדיקה רלוונטית.
3. **זיכרון מצב (Persistence):** עקוב אחרי שינויים (הושבה, חמצן, קיבוע). אם מצב השתנה, אל תחזור לתיאור הראשוני.
4. **עקביות קלינית:** פצוע מחוסר הכרה לא מדבר ולא מדווח על תחושות. 
5. **איסור שאלות:** אל תגיד "מה הפעולה הבאה?". פשוט חכה למשתמש.

--- נוהל סיום ומשוב (חובה): ---
כאשר המשתמש כותב "סיימתי", "זהו", או כשהפצוע מועבר לאט"ן, ספק דוח במבנה הבא:
1. **ציון סופי:** (מספר בין 1 ל-10).
2. **סיכום קצר:** (תיאור האירוע).
3. **נקודות חוזקה:** (מה בוצע היטב).
4. **נקודות לשיפור:** (טעויות קליניות או פספוסים בסכמה).
השתמש בביטוי "ציון סופי" כדי לסיים את התרחיש.

--- פתיחה: ---
תאר את הפצוע והזירה ב-2 משפטים קצרים בלבד.`;
}
