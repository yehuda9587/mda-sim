import medicalData from './medical_data.json'

interface NormalVitals {
  respiration_rate: { age: string; range: string }[]
  pulse_rate: { age: string; range: string }[]
  blood_pressure: { age: string; systolic: string; diastolic: string }[]
  sugar_mg: string
  spO2_percent: string
  temperature_celsius: string
  pulse_pressure: string
  capillary_refill_seconds: number
}

interface DifferentialSign { condition: string; signs: string[] }

interface Scenario {
  name: string
  description: string
  category: string
  signs: string[]
  treatment: string[]
  extra?: Record<string, unknown>
}

interface Protocol { name: string; description: string; steps: string[] }

interface SpecialPop {
  name: string
  category: string
  signs: string[]
  treatment: string[]
  description?: string
}

interface MedicalData {
  reference: {
    normal_vitals: NormalVitals
    differential_signs: DifferentialSign[]
    medications?: Record<string, unknown>
  }
  scenarios: Scenario[]
  special_populations?: SpecialPop[]
  trauma_mechanisms?: unknown[]
  protocols: Protocol[]
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const data = medicalData as MedicalData

// ── Layer 1: always included, compact (~400 tokens) ───────────────────────────

function buildReferenceBlock(): string {
  const v = data.reference.normal_vitals
  const ar = v.respiration_rate.find(r => r.age === 'מבוגר')?.range
  const ap = v.pulse_rate.find(r => r.age === 'מבוגר')?.range
  const ab = v.blood_pressure.find(r => r.age === 'מבוגר')
  const cr = v.respiration_rate.find(r => r.age === 'גיל 8')?.range
  const cp = v.pulse_rate.find(r => r.age === 'ילד')?.range

  const diffs = data.reference.differential_signs
    .map(d => `${d.condition}: ${d.signs.join(', ')}`)
    .join('\n')

  return `## מדדים תקינים:
מבוגר – נשימה: ${ar}/דקה | דופק: ${ap}/דקה | ל"ד: ${ab?.systolic}/${ab?.diastolic}
ילד   – נשימה: ${cr}/דקה | דופק: ${cp}/דקה
סוכר: ${v.sugar_mg} | SpO2: ${v.spO2_percent}% | חום: ${v.temperature_celsius}°C | Cap refill: ≤${v.capillary_refill_seconds}s | לחץ דופק: ${v.pulse_pressure}

## סימנים מבדלים:
${diffs}`
}

// ── Layer 2: keyword → category → relevant scenarios only ────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cardiac:            ['לב', 'כאב חזה', 'אוטם', 'תעוקה', 'ספיקת לב', 'בצקת ריאות', 'טמפונדה', 'דיסקציה', 'אאורטה', 'קרדיו'],
  respiratory:        ['נשימה', 'ריאות', 'אסתמה', 'copd', 'ברונכיטיס', 'נפחת', 'קוצר', 'צפצופ', 'שאיפה', 'עשן', 'גזים', 'אוורור'],
  metabolic:          ['סוכר', 'סכרת', 'גלוקוז', 'אינסולין', 'אצטון'],
  neurological:       ['הכרה', 'שבץ', 'פרכוס', 'עילפון', 'מוח', 'אישונ', 'דיבור', 'שיתוק'],
  shock:              ['הלם', 'שוק', 'היפוולמי', 'ספטי', 'קרדיוגני', 'נוירוגני', 'אנפילקטי'],
  allergy:            ['אלרגיה', 'אנפי', 'פריחה', 'אפיפן', 'היסטמין'],
  trauma:             ['טראומה', 'שבר', 'פצע', 'כוויה', 'בטן', 'קינמטיקה', 'פיצוץ', 'ירי', 'דקירה', 'נפילה', 'תאונה'],
  environmental:      ['חום', 'קור', 'התייבשות', 'היפותרמיה', 'מכת חום', 'טביעה', 'התחשמלות'],
  airway:             ['חנק', 'נתיב אוויר', 'גוף זר', 'חסימה'],
  arrest:             ['החייאה', 'דום לב', 'cpr', 'דפיברילטור', 'אין דופק'],
  toxicology:         ['הרעלה', 'רעל', 'פחמן חד', 'בליעה'],
  envenomation:       ['נחש', 'עקרב', 'עקיצה', 'הכשה'],
  special_population: ['ילד', 'תינוק', 'הריון', 'קשיש', 'יולדת'],
}

function stripPrefixes(text: string): string {
  return text.toLowerCase().replace(/(?<=[^א-ת]|^)[בוהלמשכ](?=[א-ת])/g, '')
}

function detectCategories(text: string): Set<string> {
  const norm = stripPrefixes(text)
  const found = new Set<string>()
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => norm.includes(stripPrefixes(kw)))) found.add(cat)
  }
  return found
}

function buildScenariosBlock(cats: Set<string>): string {
  if (cats.size === 0) {
    // First message / no context: just show scenario names as a menu
    return `## מצבים זמינים (בחר שילוב לתרחיש):\n` +
      data.scenarios.map(s => `- ${s.name} (${s.category})`).join('\n')
  }

  const items: (Scenario | SpecialPop)[] = [
    ...data.scenarios.filter(s => cats.has(s.category)),
    ...((data.special_populations ?? []).filter(s =>
      cats.has(s.category) || cats.has('special_population')
    )),
  ]

  if (items.length === 0) {
    return `## מצבים זמינים:\n` +
      data.scenarios.map(s => `- ${s.name} (${s.category})`).join('\n')
  }

  return `## מצבים רלוונטיים:\n` +
    items.map(s =>
      `### ${s.name}\nתיאור: ${s.description}\nסימנים: ${s.signs.join(' | ')}\nטיפול: ${s.treatment.join(' → ')}`
    ).join('\n\n')
}

function buildProtocolsBlock(cats: Set<string>): string {
  const relevant = data.protocols.filter(p =>
    p.name.includes('SABCDE') ||
    p.name.includes('דום לב') ||
    (cats.has('trauma') && /קינמטיקה|לוח גב|ראשוני|פינוי/.test(p.name))
  )
  if (!relevant.length) {
    const sabcde = data.protocols.find(p => p.name.includes('SABCDE'))
    if (sabcde) relevant.push(sabcde)
  }
  return `## פרוטוקולים:\n` +
    relevant.map(p =>
      `### ${p.name}\n${p.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    ).join('\n\n')
}

// ── Public export ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(mode: 'א' | 'ב', messages: Message[] = []): string {
  const context = messages.slice(-6).map(m => m.content).join(' ')
  const cats = detectCategories(context)

  const prompt = `אתה סימולטור רפואי לאימון חובשים ברמת BLS במד״א בלבד.

חוקים מחייבים:
1. פועל אך ורק לפי חומר הקורס הרשום. אין ידע ALS, אין תרופות מחוץ לסמכות חובש.
2. אסור לחשוף אבחנה, לרמוז, להוביל, לתקן תוך כדי סימולציה.
3. מדדים כמותיים – מספרים בלבד, ללא פרשנות.
4. אסור להשתמש במונחים אבחנתיים (טכיפניאה, היפוקסיה, שוק) בתיאור מקרה.
5. אסור לייזום מידע שלא נשאל.
6. פתיחת וריד – רק לפי הנחיות הקורס.

## יצירת תרחיש:
בחר שילוב אקראי של 2-3 מצבים, הוסף פרטים דמוגרפיים ריאליים, ודא סימנים מבדלים ברורים.

${buildReferenceBlock()}

${buildScenariosBlock(cats)}

${buildProtocolsBlock(cats)}

${mode === 'א' ? `## מצב א – אבחנה וטיפול:
1. פתח: "בהגיעך למקום אתה רואה…"
2. ענה רק על מה שנשאל.
3. לאחר אבחנה + תוכנית טיפול: ציטוט מהלך נכון → 4 חלקים (נכון/חסר/שגוי/סדר) → ציון.`
  : `## מצב ב – ניהול מקרה שלב-שלב:
1. פתח: "בהגיעך למקום אתה רואה…"
2. ענה רק על מה שנשאל/בוצע. אין משוב עד סיום.
3. בהתרשמות כללית: מראה, תנוחה, מצוקה, צבע עור, דופק רדיאלי (מילים בלבד), פרפוזיה. ללא מספרים.
4. כשהמשתמש כותב "סיימתי" + אבחנה + טיפול → משוב כמצב א.`}
`
  return prompt
}
