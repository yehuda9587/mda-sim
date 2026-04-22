import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export function getRandomScenario() {
  const data = medicalData as any;
  // איחוד תרחישים רפואיים ומנגנוני טראומה למאגר אחד
  const pool = [...(data.scenarios || []), ...(data.trauma_mechanisms || [])];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSystemPrompt(scenario: any): string {
  if (!scenario) return "שגיאה: תרחיש לא נטען.";

  const name = scenario.name || "פצוע לא ידוע";
  const desc = scenario.description || "אין תיאור זמין";
  const signs = scenario.signs?.join(', ') || "מדדים בטווח הנורמה";
  const treatment = scenario.treatment?.join(', ') || "סכמת ABCDE סטנדרטית";

  return `אתה בוחן סימולציה רפואית של מד"א למע"ר. 

--- תרחיש נעול לסימולציה (אל תשנה!): ---
שם המקרה: ${name}
תיאור: ${desc}
סימנים קליניים: ${signs}
טיפול מצופה מהחובש: ${treatment}

--- חוקי הבוחן (יהרג ובל יעבור): ---
1. **נאמנות למקרה:** זהו הפצוע היחיד בשיחה. אסור להחליף אותו או להמציא פצוע אחר.
2. **מניעת סתירות:** אם הפצוע "מחוסר הכרה", הוא לא מדבר ולא מתאר תחושות (כמו שחור בעיניים). תאר רק ממצאים פיזיים (דופק, נשימה, צבע עור).
3. **תגובה לפעולה:** המשתמש יכתוב פעולות (כמו "סייפטי" או "בדיקת דופק"). תאר אך ורק את התוצאה הפיזית לפי המקרה.
4. **סייפטי:** כשנשאל "סייפטי?", תאר זירה בטוחה שתואמת לתיאור המקרה.
5. **איסור שאלות:** אל תשאל "מה הפעולה הבאה?". פשוט תן תיאור מצב וחכה למשתמש.
6. **מחשבות:** אל תכתוב THOUGHT או Reasoning. השב בעברית מקצועית בלבד.
7. **רווחים:** הקפד על רווחים תקינים בין מילים בעברית.
8. **שפה:** תענה אך ורק בעברית, ללא כל מילה באנגלית.

--- פתיחת תרחיש (רק פעם אחת): ---
תאר את הפצוע ב-2 משפטים קצרים וקליניים בלבד.`;
}
