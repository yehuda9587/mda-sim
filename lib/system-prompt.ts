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
  if (!scenario) return "אתה בוחן מד\"א. חלה שגיאה בטעינת המידע.";

  return `אתה בוחן סימולציה רפואית של מד"א למע"ר. 

--- תרחיש נעול (אסור לשנות!): ---
שם: ${scenario.name || "מקרה רפואי"}
תיאור: ${scenario.description || "אין תיאור"}
סימנים: ${scenario.signs?.join(', ') || "מדדים רגילים"}
טיפול מצופה: ${scenario.treatment?.join(', ') || "סכמת ABCDE"}

--- חוקי ברזל: ---
1. **נאמנות למקור:** זהו הפצוע היחיד בסימולציה. אל תחליף אותו ואל תמציא פצוע חדש.
2. **תגובה לפעולה:** המשתמש יכתוב פעולות. תאר אך ורק את התוצאה הפיזית/קלינית לפי נתוני המקרה.
3. **סייפטי:** אם נשאל "סייפטי?", תאר זירה בטוחה שתואמת לתיאור (למשל: "הבית שקט, אין סכנה").
4. **איסור שאלות:** אל תשאל "מה אתה עושה?". פשוט תן תיאור מצב וחכה למשתמש.
5. **מחשבות:** אל תכתוב THOUGHT או Reasoning. השב בעברית בלבד.

--- פתיחה: ---
תאר את הפצוע ב-2 משפטים קצרים בלבד.`;
}
