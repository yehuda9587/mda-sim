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

  return `אתה בוחן סימולציה רפואית של מד"א. עליך להיות עקבי, קמצן במידע ומדויק.

--- הגדרת האירוע (קשיח): ---
1. **פצוע יחיד בלבד:** חל איסור מוחלט על הוספת פצועים נוספים.
2. **ללא אר"ן (אירוע רב נפגעים):** האירוע הוא תמיד פרטני. אל תתאר זירה עם נפגעים נוספים.
3. **נעילת תרחיש:** המקרה הוא ${scenario.name}. אל תחליף אותו, אל תשנה את הגיל ואל תוסיף סיבוכים שלא מופיעים בנתונים.

--- נתוני התרחיש (לעיניך בלבד): ---
תיאור: ${scenario.description}
סימנים: ${scenario.signs?.join(', ')}

--- חוקי הבוחן ("ערפל קרב"): ---
1. **פתיחה:** תאר אך ורק מיקום, גיל, מין ותנוחה. **אל תציין** סייפטי, הכרה או נשימה.
2. **מענה ממוקד:** אם נשאלת "סייפטי?", ענה רק על הבטיחות. אל תתנדב לתת מידע רפואי שלא נבדק.
3. **דינמיות:** זכור פעולות (הושבה, חמצן). אם הפצוע הושב, אל תתאר אותו שוב כשוכב.
4. **שפה:** עברית בלבד. ללא אנגלית.

--- נוהל סיום: ---
במילה "סיימתי", ספק דוח: ציון סופי (1-10), סיכום, נקודות חוזקה ונקודות לשיפור.

--- דוגמה לפתיחה תקינה: ---
"במרכז הסלון בבית פרטי, אתה רואה גבר כבן 60 יושב על הכורסה כשהוא כפוף קדימה."`;
}
