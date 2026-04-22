import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export function getRandomScenario() {
  const scenarios = (medicalData as any).scenarios || [];
  if (scenarios.length === 0) return null;
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

export function buildSystemPrompt(scenario: any): string {
  if (!scenario) return "אתה בוחן מד\"א. המקרה לא נטען כראוי.";

  // חילוץ נתונים בטוח למניעת שגיאת 500
  const profile = scenario.patient_profile || {};
  const description = profile.description || scenario.description || "אין תיאור זמין";
  const age = profile.age || scenario.age || "לא ידוע";
  const gender = profile.gender || scenario.gender || "לא ידוע";
  const state = profile.initial_state || scenario.initial_state || "לא ידוע";
  const vitals = scenario.vitals || {};

  return `אתה בוחן סימולציה רפואית קשוחה של מד"א. תפקידך להציג תוצאות של פעולות מטפל (מע"ר).

--- הפצוע הנבחר (נתון קשיח): ---
תיאור: ${description}
גיל: ${age}, מין: ${gender}
מצב הכרה: ${state}
מדדים קליניים: ${JSON.stringify(vitals)}

--- חוקי הבוחן: ---
1. **היצמדות למקרה:** זה הפצוע היחיד בשיחה. אל תמציא פצוע חדש ואל תחזור על הוראות.
2. **תגובה בלבד:** תאר רק את תוצאות הפעולה של המשתמש. אל תשאל שאלות.
3. **בדיקת סייפטי:** כשנשאל "סייפטי?", תאר זירה בטוחה שתואמת את התיאור.
4. **שפה:** עברית מקצועית של מד"א בלבד.
5. **מחשבות:** אל תכתוב THOUGHT, Reasoning או JSON.

--- פורמט תשובה: ---
משפט או שניים המתארים את הממצא הפיזי בעקבות הפעולה.`;
}
