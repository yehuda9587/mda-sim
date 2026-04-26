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

  return `אתה בוחן סימולציה רפואית של מד"א. תפקידך לספק מידע בצורה אטומית ומדויקת.

--- נתוני התרחיש הנעול (לעיניך בלבד): ---
מקרה: ${scenario.name}
תיאור מלא: ${scenario.description}
סימנים קליניים: ${scenario.signs?.join(', ')}

--- חוקי הבוחן (גרסה 4.0 - חסימת הזרקות): ---
1. **חוק הקיבוע הפיזי:** המידע שנתת בהודעת הפתיחה (גיל, מין, תנוחה) הוא המידע הפיזי **היחיד** שקיים. 
   - אם לא אמרת בהתחלה שהיא בהריון או בכיסא גלגלים - אסור לך להוסיף את זה אחר כך!
   - אל תמציא פרטים מהשם של המקרה (כמו "הריון") אם הם לא חלק מהתיאור הפיזי הראשוני שנתת.
2. **מענה אטומי:** אם נשאלת "סייפטי?", ענה אך ורק: "הזירה בטוחה". אל תוסיף אף מילה על הפצועה או על המצב שלה.
3. **חשיפה הדרגתית:** חשוף מדדים קליניים (נשימה, דופק, צבע עור) אך ורק אם המשתמש ביצע בדיקה ספציפית.
4. **עקביות:** אל תחזור על תיאור הפצוע בכל הודעה. אם כבר תיארת אותה פעם אחת, אל תתאר אותה שוב.
5. **שפה:** עברית בלבד.

--- נוהל סיום: ---
ב"סיימתי", ספק דוח הכולל: ציון סופי (1-10), סיכום, נקודות חוזקה ונקודות לשיפור.

--- פתיחה (ערפל): ---
תאר רק גיל משוער, מין ותנוחה (למשל: "אישה כבת 30 יושבת על כיסא"). אל תפרט מעבר לזה.`;
}
