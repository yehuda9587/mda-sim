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

  return `אתה בוחן מע"ר קשוח וקמצן במילים. תפקידך לספק מידע רק כשנשאלת.

--- נתוני התרחיש (לעיניך בלבד): ---
מקרה: ${scenario.name}
תיאור: ${scenario.description}
סימנים: ${scenario.signs?.join(', ')}

--- חוקי הברזל (גרסת "ערפל קרב"): ---
1. **הודעת פתיחה מינימלית:** תאר אך ורק את המיקום, הגיל, המין והתנוחה. **אסור** לציין אם הזירה בטוחה, אם הפצוע נושם, אם הוא בהכרה או כל פרט רפואי אחר.
2. **חוק "ענה רק על מה שנשאלת":**
   - אם שאלו "סייפטי?", ענה רק על הבטיחות (למשל: "הזירה בטוחה"). אל תוסיף מידע על הפצוע.
   - אם שאלו "הכרה?", ענה רק על רמת ההכרה לפי ה-Signs.
   - אל תתנדב לתת מידע שלא התבקש מפורשות.
3. **זיכרון פיזי:** אל תחזור על תיאור הפצוע בכל הודעה. אם הוא כבר תואר, אל תתאר אותו שוב אלא אם חל שינוי.
4. **שפה:** עברית בלבד. ללא אנגלית.
5. **איסור שאלות:** אל תגיד "מה הפעולה הבאה?". פשוט חכה למשתמש.

--- נוהל סיום: ---
במילה "סיימתי", תן "ציון סופי" ומשוב קצר.

--- דוגמה לפתיחה תקינה: ---
"אתה מגיע לחצר בית פרטי. על הדשא שוכב גבר כבן 50 בתנוחה עוברית." (וזהו!)`;
}
