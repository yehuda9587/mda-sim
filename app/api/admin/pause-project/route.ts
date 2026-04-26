import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // 1. בדיקת אבטחה בסיסית (רק המפתח של Vercel מאפשר את זה)
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  const PROJECT_ID = process.env.VERCEL_PROJECT_ID; // מומלץ לשים ב-env
  const TEAM_ID = process.env.VERCEL_TEAM_ID;       // אם יש לך צוות

  if (!VERCEL_TOKEN || !PROJECT_ID) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
  }

  try {
    const route = `${PROJECT_ID}/pause${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;
    
    const res = await fetch(`https://api.vercel.com/v1/projects/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Failed to pause project');
    }

    return NextResponse.json({ message: 'Project paused successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
