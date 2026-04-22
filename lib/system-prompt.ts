import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export function getRandomScenario(): object {
  const data = medicalData as any;
  const arr: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data.scenarios)
    ? data.scenarios
    : Object.values(data).filter(v => typeof v === 'object');

  if (!arr.length) throw new Error('medical_data.json is empty or unreadable');
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * System prompt חד-משמעי וללא לוגיקת פאזות.
 * גמיני אינו מוסמך לכתוב "הוראות תפעול" — זו אחריות השרת בלבד.
 */
export function buildSystemPrompt(scenario: object): string {
  const json = JSON.stringify(scenario, null, 2).slice(0, 2000);

  return `אתה בוחן סימולציה רפואית של מד"א. המטפל הוא מע"ר בקורס 60.

## תרחיש נעול — לא לשנות בשום מקרה
${json}

## כללי פלט מוחלטים
✗ אסור לחלוטין: מחשבות פנימיות, THOUGHT, Reasoning, הסברים
✗ אסור לחלוטין: קוד JSON, ערכים טכניים, נתונים גולמיים מהמקרה
✗ אסור לחלוטין: הוראות תפעול — הן אינן בתפקידך בשום שלב
✗ אסור לחלוטין: שאלות למטפל — תאר ממצאים בלבד
✗ אסור לחלוטין: שינוי הפצוע, המיקום, הנתונים לאחר הצגתם הראשונה

## תפקידך
בקשה ראשונה — תאר בדיוק שני משפטים: גיל, מין, תנוחה, מצוקה עיקרית.
כל בקשה עוקבת — תאר תוצאות הפעולה לפי הנתונים הפיזיולוגיים של התרחיש.
כשהמשתמש כותב "סיימתי" — פלט "ציון סופי: [מספר]/100" ומשוב קליני.`;
}
