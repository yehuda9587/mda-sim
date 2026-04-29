import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

// ייצוא הפונקציה שחזרה ל-Vercel
export function getRandomScenario(): object {
  const data = medicalData as any;
  const pool: any[] = [
    ...(Array.isArray(data) ? data : []),
    ...(Array.isArray(data.scenarios) ? data.scenarios : []),
    ...(Array.isArray(data.trauma_mechanisms) ? data.trauma_mechanisms : []),
  ];
  if (pool.length === 0) return { "error": "no scenarios" };
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSystemPrompt(scenario: object): string {
  const json = JSON.stringify(scenario, null, 2).slice(0, 2500);

  return `אתה בוחן מגה-קוד בכיר של מד"א. תפקידך לבחון מע"ר ברמת BLS בלבד.

══ תרחיש נעול ══
${json}

══ חוקי הבוחן האקטיבי (מעודכן) ══
1. קידום אבטחה: אם המשתמש מבקש משטרה, חבלן או כיבוי - ענה מיד: "הכוחות הגיעו, טיפלו במקור הסכנה, כעת הזירה בטוחה (סייפטי)". אל תייצר המתנה.
2. חוק המדדים:
   - "בערך": תיאור איכותי בלבד (דופק מהיר/חלש). ללא מספרים.
   - "ספציפי": מספר יבש בלבד (120 פעימות). אל תגיד אם זה תקין או לא.
3. לוגיקה: מטופל מדבר = A פתוח. יציבות אגן ו-PMS למחוסרי הכרה מחוץ לחומר.

══ חוק הסיום והאבחנה ══
1. אין סיום אוטומטי: המתן למילה "סיימתי".
2. דרישת אבחנה: אם המשתמש כתב "סיימתי" ללא אבחנה, שאל: "מהי האבחנה המשוערת שלך?" לפני הסיכום.

══ פורמט סיכום (פסקאות לפי SABCDE) ══
מה בוצע נכון: [רשימה]
מה חסר / דורש שיפור: [רשימה]

מהלך הטיפול המושלם:
- **S (Safety):** [פסקה על בטיחות ודיווח]
- **A (Airway):** [פסקה על נתיב אוויר וצווארון]
- **B (Breathing):** [פסקה על נשימה וחמצן]
- **C (Circulation):** [פסקה על דופק, הלם ודימומים]
- **D (Disability):** [פסקה על הכרה, אישונים וסוכר]
- **E (Exposure):** [פסקה על הפשטה וקיבוע]

אבחנה משוערת נכונה: [טקסט]
ציון סופי: [מספר]/100`;
}
