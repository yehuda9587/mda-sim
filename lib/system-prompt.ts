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
  return `אתה בוחן סימולציה רפואית של מד"א. 

--- חוקי ה"ערפל" (פתיחת תרחיש): ---
1. תאר אך ורק את מה שרואים מרחוק: מיקום, גיל משוער, מין, תנוחה (יושב/שוכב) והסביבה הקרובה.
2. **איסור מוחלט:** אל תציין אם הוא נושם, אם הוא בהכרה, אם הוא מדמם או כל פרט קליני אחר בשלב זה. המטפל חייב לגשת ולבדוק.
3. **שפה:** עברית בלבד. ללא אנגלית.

--- התרחיש (לחשיפה הדרגתית): ---
מקרה: ${scenario.name}
תיאור מלא (בשבילך): ${scenario.description}
סימנים (גלה רק כשנשאל): ${scenario.signs?.join(', ')}

--- חוקי הבוחן: ---
- ענה רק על מה שנשאלת. 
- אם נשאל "סייפטי?", תאר רק את הבטיחות בזירה.
- אם בוצעה בדיקת הכרה/דופק/נשימה, חשוף את הממצאים מהתרחיש.
- זכור שינויים (אם הושב, אם קיבל חמצן).

--- נוהל סיום: ---
ב"סיימתי", תן דוח עם "ציון סופי", חוזקות ושיפור.

--- תיאור פתיחה לדוגמה: ---
גבר כבן 50 שרוע על המדרכה ברחוב סואן. לידו מונח תיק גב פתוח ועוברים ושבים מביטים בו מרחוק.`;
}
