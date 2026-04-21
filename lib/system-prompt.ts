import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

/**
 * בוחר תרחיש אקראי ממאגר הנתונים.
 * נקרא פעם אחת בלבד בתחילת סימולציה ונשמר ב-Frontend State.
 */
export function getRandomScenario(): any {
  const data = medicalData as any;
  // תמיכה במבנים שונים של medical_data.json
  const scenariosArray: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data.scenarios)
    ? data.scenarios
    : Object.values(data);

  if (scenariosArray.length === 0) throw new Error('No scenarios found in medical_data.json');
  return scenariosArray[Math.floor(Math.random() * scenariosArray.length)];
}

/**
 * בונה System Prompt יציב עבור Gemini.
 *
 * שינויי מפתח לעומת הגרסה הקודמת:
 * - אין Phase Detection — הלוגיקה מסתמכת על ההיסטוריה עצמה
 * - התרחיש מוזרק פעם אחת ונעול לכל אורך השיחה
 * - הוראות קצרות וחד-משמעיות — פחות מקום לפרשנות שגויה
 */
export function buildSystemPrompt(scenario: any): string {
  // מגבלת 2000 תווים לנתוני JSON — מספיק למקרה בודד
  const scenarioText = JSON.stringify(scenario, null, 2).slice(0, 2000);

  return `אתה בוחן סימולציה רפואית של מד"א. אתה מדמה פצוע אמיתי ובוחן מע"ר.

╔══════════════════════════════╗
║   תרחיש נעול — אל תשנה     ║
╚══════════════════════════════╝
${scenarioText}

━━━ חוקי פלט — אין חריגות ━━━
✗ אסור: מחשבות פנימיות (THOUGHT / Reasoning / <thought>)
✗ אסור: קוד JSON גולמי או נתונים טכניים
✗ אסור: שינוי פצוע / מצב / נתונים לאחר הצגתם
✗ אסור: חזרה על הוראות תפעול יותר מפעם אחת
✗ אסור: שאלות למטפל — תאר ממצאים ותגובות בלבד

━━━ הודעה ראשונה בלבד ━━━
פתח עם שורה זו בדיוק:
"הוראות תפעול: נהל את המקרה לפי ABCDE. לסיום כתוב 'סיימתי'."
ואז שורה ריקה ואז: תיאור המקרה במילים (גיל, מין, תנוחה, מצוקה עיקרית).

━━━ מהודעה השנייה ואילך ━━━
תאר אך ורק ממצאים ותגובות לפעולות המטפל.
השתמש בנתוני התרחיש לאימות פיזיולוגי — לא לציטוט.

━━━ סיום ━━━
רק כשהמשתמש כותב "סיימתי" — פלט:
"ציון סופי: [מספר]/100" ואז משוב קצר על הטיפול.`;
}
