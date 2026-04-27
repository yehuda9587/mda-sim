import medicalData from './medical_data.json';

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
1. קידום עלילה: אל תחזור על עצמך. אם המשתמש אומר "מחכה", תאר שינוי במצב המטופל (התדרדרות או שיפור) או רמז קליני חדש שיעזור לו לאבחן.
2. אקטיביות: כשמבקשים "בטיחות", ענה: "הזירה בטוחה, משטרה במקום". אל תחכה למשתמש.
3. סיום אוטומטי: כשהטיפול הסתיים או שהגיע אט"ן, כתוב: "צוות אט"ן הגיע. העבר סמכויות".
4. רמת BLS בלבד: אל תדרוש נוזלים או מושגי ALS.
5. לוגיקה קלינית: מטופל מדבר = A תקין ו-V/A. אל תוריד ניקוד על כך.

══ סיום (חובה להציג הכל) ══
הצג את הסיכום במבנה הבא בלבד:
**מהלך הטיפול המושלם:**
[רשימת פעולות קצרה בנקודות]

**מה בוצע נכון:**
[רשימה]

**מה חסר / דורש שיפור:**
[רשימה קלינית קצרה לרמת מע"ר]

**אבחנה משוערת נכונה:** [טקסט]
**ציון סופי:** [מספר]/100`;
}
