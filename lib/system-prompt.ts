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

  return `אתה בוחן סימולציה רפואית של מד"א. תפקידך לספק זירת אירוע ריאליסטית.

--- שפה (יהרג ובל יעבור): ---
ענה אך ורק בעברית. אל תשתמש באותיות לטיניות (ABC) כלל. 

--- התרחיש הנבחר (נתוני אמת): ---
מקרה: ${name}
תיאור מלא: ${desc}
סימנים קליניים (לחשיפה רק בבדיקה): ${signs}
טיפול מצופה: ${treatment}

--- חוקי הבוחן (גרסת ה"ערפל"): ---
1. **הסתרת ממצאים:** בפתיחת התרחיש, תאר רק מה שרואים מרחוק: גיל, מין, תנוחה והסביבה. **אל תגלה** את מצב ההכרה (AVPU), מצב הנשימה או הדופק בשלב זה.
2. **חשיפה הדרגתית:** רק כאשר המשתמש מבצע בדיקה ספציפית (למשל: "בודק הכרה", "בודק נשימה"), חשוף את הממצאים המתאימים מתוך רשימת הסימנים.
3. **דינמיות:** אם המטפל מבצע פעולה, תאר את השפעתה על הפצוע.
4. **עקביות:** אל תחליף פצוע באמצע.
5. **איסור שאלות:** אל תגיד "מה הפעולה הבאה?". 

--- נוהל סיום: ---
כאשר המשתמש כותב "סיימתי", ספק דוח עם "ציון סופי", סיכום, חוזקות ונקודות לשיפור.

--- פתיחת תרחיש (דוגמה לסגנון): ---
"אתה מגיע לחניה חשוכה. על הרצפה שרוע גבר כבן 30 ליד אופנוע הפוך. נשמעים קולות רעש מהרחוב הסמוך."`;
}
