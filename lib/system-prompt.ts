import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

// הפונקציה שחסרה לך - מגרילה תרחיש מתוך ה-JSON
export function getRandomScenario() {
  const scenarios = medicalData.scenarios;
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

export function buildSystemPrompt(scenario: any): string {
  return `אתה בוחן סימולציה רפואית קשוחה של מד"א. תפקידך להציג תוצאות של פעולות מטפל (מע"ר).

--- הפצוע הנבחר (נתון קשיח): ---
תיאור: ${scenario.patient_profile.description}
גיל: ${scenario.patient_profile.age}, מין: ${scenario.patient_profile.gender}
מצב הכרה: ${scenario.patient_profile.initial_state}
מדדים קליניים: ${JSON.stringify(scenario.vitals)}

--- חוקי הבוחן (אסור להפר): ---
1. **היצמדות למקרה:** זה הפצוע היחיד בשיחה. אל תמציא פצוע חדש.
2. **תגובה בלבד:** תאר רק את תוצאות הפעולה של המשתמש. אל תשאל שאלות.
3. **בדיקת סייפטי:** כשנשאל "סייפטי?", תאר זירה בטוחה שתואמת את התיאור.
4. **שפה:** עברית מקצועית של מד"א בלבד.
5. **מחשבות:** אל תכתוב THOUGHT או Reasoning.

--- פורמט תשובה: ---
משפט או שניים המתארים את הממצא הפיזי בעקבות הפעולה.`;
}
