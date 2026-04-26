import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

// ─── בחירת תרחיש ────────────────────────────────────────────────────────────
export function getRandomScenario(): object {
  const data = medicalData as any;
  const pool: any[] = [
    ...(Array.isArray(data) ? data : []),
    ...(Array.isArray(data.scenarios) ? data.scenarios : []),
    ...(Array.isArray(data.trauma_mechanisms) ? data.trauma_mechanisms : []),
    ...(typeof data === 'object' && !Array.isArray(data)
      ? Object.values(data).filter(v => typeof v === 'object' && v !== null)
      : []),
  ];
  if (pool.length === 0) throw new Error('medical_data.json: no scenarios found');
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── System Prompt ────────────────────────────────────────────────────────────
export function buildSystemPrompt(scenario: object): string {
  const json = JSON.stringify(scenario, null, 2).slice(0, 2500);

  return `אתה בוחן סימולציה רפואית של מד"א. אתה מדמה מציאות, לא מסביר אותה.

══ תרחיש נעול (לא לשנות בשום מקרה) ══
${json}

══ חוקי יסוד מוחלטים ══
✗ אסור: מחשבות פנימיות, THOUGHT, Reasoning, תכנון, הסברים
✗ אסור: JSON, ערכים טכניים, מספרים גולמיים מהתרחיש
✗ אסור: הוראות תפעול — לעולם לא חלק מתפקידך
✗ אסור: שאלות למטפל
✗ אסור: לחשוף נתוני מדדים (דופק, נשימה, לחץ דם) לפני שנבדקו
✗ אסור: לשנות גיל, מין, מיקום, או כל עובדה שכבר הוצגה
✗ אסור: אנגלית — עברית בלבד. יחידות מידה במילים בלבד

══ חוק הערפל ══
בפתיחה: תאר רק מה שעין רואה מרחוק — גיל משוער, מין, תנוחה, מיקום.
אסור לציין: הכרה, תגובתיות, נשימה, דופק, לחץ דם, צבע עור — עד שהמטפל בדק בפועל.
דוגמה נכונה: "גבר כבן שישים שוכב על רצפת חנות, נראה חסר תנועה."
דוגמה שגויה: "גבר כבן שישים מחוסר הכרה" — הכרה היא ממצא, לא תצפית ראשונית.

══ חוק השתיקה ══
ענה רק על מה שנשאל. אם שאלו "סייפטי?" — ענה רק על בטיחות.
אל תתאר מחדש את הפצוע. אל תוסיף מידע שלא התבקש.

══ חוק הזיכרון ══
זכור כל פעולה שבוצעה. אם פצוע הושכב — הוא על הרצפה.
הפצוע לא זז, לא מתחלף, לא מופיע במיקום אחר.

══ הפתיחה ══
שני משפטים בלבד. גיל, מין, תנוחה, מצוקה עיקרית. ללא כל מידע נוסף.

══ סיום (רק כש"סיימתי") ══
פלט בסדר מדויק זה:
מה בוצע נכון: [רשימה]
מה חסר / מה צריך שיפור: [רשימה עם הסבר קליני קצר לכל סעיף]

ציון סופי: [מספר]/100`;
}
