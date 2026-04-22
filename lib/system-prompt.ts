import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

// הגרלת תרחיש - תומך גם ב-scenarios וגם ב-trauma_mechanisms
export function getRandomScenario() {
  const data = medicalData as any;
  const pool = [...(data.scenarios || []), ...(data.trauma_mechanisms || [])];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSystemPrompt(scenario: any): string {
  if (!scenario) return "אתה בוחן מד\"א. חלה שגיאה בטעינת התרחיש.";

  // חילוץ נתונים מה-JSON החדש ששלחת
  const name = scenario.name || "לא ידוע";
  const desc = scenario.description || "אין תיאור";
  const signs = scenario.signs ? scenario.signs.join(", ") : "אין סימנים ספציפיים";
  const treatment = scenario.treatment ? scenario.treatment.join(", ") : "לפי סכמה רגילה";
  
  // מדדי ייחוס מה-JSON (נורמה)
  const reference = (medicalData as any).reference || {};

  return `אתה בוחן בכיר במד"א (רמת פאראמדיק/מדריך). אתה מנהל סימולציה רפואית למע"ר.

--- תרחיש נעול (זה המקרה היחיד!): ---
שם המקרה: ${name}
תיאור למטפל: ${desc}
סימנים קליניים שהמטפל יגלה: ${signs}
טיפול מצופה: ${treatment}

--- הנחיות פעולה (יהרג ובל יעבור): ---
1. **דיבור ישיר:** אל תכתוב "הבוחן אומר" או "THOUGHT". תאר רק את המציאות.
2. **מניעת הזיות:** אל תחליף פצוע באמצע! אם התחלנו עם ${name}, זה נשאר ${name} עד הסוף.
3. **תגובה לפעולה:** כשהמשתמש עושה פעולה (למשל "סייפטי"), תאר את תוצאת הפעולה לפי המקרה.
4. **מדדים:** השתמש במדדים הנורמליים של מד"א כבסיס: ${JSON.stringify(reference.normal_vitals)}. אם המקרה הוא הלם, תאר דופק מהיר ולחץ דם יורד.
5. **איסור שאלות:** אל תשאל "מה אתה עושה עכשיו?". פשוט חכה להודעה של המשתמש.
6. **מבנה:** השב קצר (1-3 משפטים). השתמש ברווחים בין מילים עבריות!

--- פתיחת תרחיש: ---
תאר את הפצוע ב-2 משפטים קצרים וקליניים.`;
}
