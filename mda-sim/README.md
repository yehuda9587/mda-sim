# סימולטור חובשים BLS – מד״א

סימולטור אינטראקטיבי לאימון חובשים ברמת BLS, מבוסס על חומר הקורס הרשמי של מד״א.

## מבנה הפרויקט

```
mda-sim/
├── app/
│   ├── api/chat/route.ts   # API endpoint (streaming)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # UI ראשי
├── lib/
│   ├── medical_data.json   # כל החומר הרפואי
│   └── system-prompt.ts    # בונה system prompt מהJSON
├── .env.example
└── package.json
```

## פריסה ב-Vercel

### שלב 1 – העלאה ל-GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/mda-sim.git
git push -u origin main
```

### שלב 2 – פריסה ב-Vercel
1. היכנס ל-[vercel.com](https://vercel.com)
2. לחץ **Add New Project**
3. בחר את ה-repository
4. תחת **Environment Variables** הוסף:
   - `ANTHROPIC_API_KEY` = המפתח שלך מ-[console.anthropic.com](https://console.anthropic.com)
5. לחץ **Deploy**

### הרצה מקומית
```bash
npm install
cp .env.example .env.local
# הוסף ANTHROPIC_API_KEY ב-.env.local
npm run dev
```

## מצבי סימולציה

**מצב א** – אבחנה וטיפול: תרחיש מוצג, המשתמש שואל שאלות ומגיש אבחנה + תוכנית טיפול מלאה, ומקבל ציון ומשוב.

**מצב ב** – ניהול מקרה: הסימולציה מתנהלת שלב-שלב. המשתמש מנהל את האירוע, ורק בסוף מקבל משוב.

## חשוב
- כל התרחישים נוצרים דינמית מ-`medical_data.json`
- הבוט מחויב אך ורק לחומר הקורס (BLS בלבד)
- אין ידע ALS, אין תרופות מחוץ לסמכות חובש
