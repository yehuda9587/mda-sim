import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

// בחירת תרחיש רנדומלי מתוך המאגר המלא
export function getRandomScenario() {
  const data = medicalData as any;
  const pool = [...(data.scenarios || []), ...(data.trauma_mechanisms || [])];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSystemPrompt(scenario: any): string {
  return `אתה בוחן סימולציה רפואית קשוחה של מד"א. 

--- זהו הפצוע היחיד בסימולציה (נתון קשיח): ---
מצב: ${scenario.name}
תיאור פיזי: ${scenario.description}
סימנים קליניים: ${scenario.signs?.join(', ')}

--- חוקי הבוחן ---
1. **זיכרון פיזי:** אם המטפל מבצע פעולה (כמו "מיישב אותו"), תאר את הפצוע במצב החדש (יושב) מעתה והלאה.
2. **דינמיות:** אם המטפל נותן חמצן, תאר שיפור קל בנשימה או בסטורציה, אל תחזור על אותו תיאור בדיוק.
3. **מענה ללוגיסטיקה:** אם נשאלת על מרחק אמבולנס או אט"ן, תן תשובה הגיונית (למשל: "האט"ן בדרך, עוד 5 דקות אצלך").
4. **מניעת לופים:** אל תחזור על תיאור הבצקות והוורידים אם כבר תיארת אותם. תאר סימנים חדשים או את תגובת הפצוע למגע/דיבור.
5. **איסור שאלות:** אל תשאל "מה אתה עושה?". פשוט תן את מצב הפצוע.

--- פורמט תשובה ---
קצר, מקצועי, ללא "מחשבות" (THOUGHT).`;
}
