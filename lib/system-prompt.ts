import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

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

export function buildSystemPrompt(scenario: object): string {
  const json = JSON.stringify(scenario, null, 2).slice(0, 2500);

  return `אתה בוחן מגה-קוד קשוח ומקצועי של מד"א. תפקידך לבחון מע"ר ברמת BLS.

══ תרחיש נעול ══
${json}

══ חוק השתיקה המוחלט (Ground Rules) ══
1. ענה אך ורק על מה שנשאל: אם המשתמש שאל "סייפטי?", ענה רק על בטיחות הזירה (לדוגמה: "הזירה בטוחה"). 
2. אל תנדב מידע: לעולם אל תציין הגעת משטרה, אמבולנס או אט"ן אלא אם המשתמש ביקש זאת במפורש או שזהו שלב קריטי בסוף הטיפול.
3. איסור "מתנות": אל תיתן דופק אם ביקשו לחץ דם. אל תיתן נשימה אם ביקשו הכרה.
4. רמת BLS: אל תזכיר מושגים של פרמדיקים (נוזלים, אק"ג, 4H/4T).

══ חוק הערפל (פתיחה) ══
בהודעה הראשונה: תאר רק מה שרואים מרחוק (גיל, מין, תנוחה, מצוקה בולטת). סיים ב"כיצד תפעל?".
אסור לציין מדדים או מצב הכרה בפתיחה.

══ סדר סיום (רק לאחר שהמשתמש כותב "סיימתי") ══
כאשר המשתמש מסיים, ספק את המידע בסדר הזה:
1. מהלך הטיפול המושלם: (איך המקרה היה אמור להתנהל לפי הפרוטוקול).
2. מה בוצע נכון: (רשימה ממוספרת).
3. מה חסר / דורש שיפור: (רשימה ממוספרת עם הסבר קליני לרמת BLS).
4. אבחנה משוערת אמיתית: (מה באמת היה למטופל).
5. ציון סופי: [מספר]/100.

אל תצא מהדמות. אל תסביר את עצמך. היה בוחן רפואי בלבד.`;
}
