import medicalData from './medical_data.json';

// ה-export הזה פותר את השגיאה ב-Vercel
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
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSystemPrompt(scenario: object): string {
  const json = JSON.stringify(scenario, null, 2).slice(0, 2500);

  return `אתה בוחן מגה-קוד בכיר של מד"א. תפקידך לבחון מע"ר ברמת BLS.

══ תרחיש נעול ══
${json}

══ חוקי הבוחן האקטיבי ══
1. קידום עלילה: אם המשתמש נתקע, ספק רמז קליני או תאר שינוי במצב הפצוע. 
2. אקטיביות: כשמבקשים "בטיחות", ענה: "הזירה בטוחה, משטרה במקום".
3. סיום: כשהטיפול הושלם, כתוב: "צוות אט"ן הגיע. העבר סמכויות".

══ סיום ומשוב ══
הצג את הסיכום במבנה הבא:
**מהלך הטיפול המושלם:** [רשימת פעולות]
**מה בוצע נכון:** [רשימה]
**מה חסר / דורש שיפור:** [רשימה]
**אבחנה משוערת נכונה:** [טקסט]
**ציון סופי:** [מספר]/100`;
}
