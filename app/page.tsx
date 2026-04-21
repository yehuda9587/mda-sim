"use client";
import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ScoreEntry {
  date: string;
  score: number;
}

const STORAGE_KEY = 'mda_simulator_v3';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [history, setHistory] = useState<ScoreEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ━━━ התרחיש הנעול — ליבת התיקון ━━━
  // נשמר ב-State ונשלח עם כל Request כדי שהשרת תמיד יבנה את אותו System Prompt
  const [lockedScenario, setLockedScenario] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // טעינת היסטוריית ציונים
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // localStorage לא זמין
    }
  }, []);

  // טיימר
  useEffect(() => {
    if (!isActive || isPaused) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  // גלילה אוטומטית
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // פוקוס על input אחרי כל הודעה
  useEffect(() => {
    if (isActive && !isPaused && !isLoading) {
      inputRef.current?.focus();
    }
  }, [isActive, isPaused, isLoading, messages.length]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ━━━ התחלת תרחיש חדש ━━━
  const startScenario = async () => {
    setMessages([]);
    setSeconds(0);
    setIsActive(true);
    setIsPaused(false);
    setLockedScenario(null); // איפוס תרחיש קודם
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'התחל תרחיש' }],
          scenario: null, // מבקש תרחיש חדש מהשרת
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      // ━━━ שמירת התרחיש הנבחר ━━━
      // השרת מחזיר אותו ב-Header X-Scenario רק בקריאה הראשונה
      const scenarioHeader = res.headers.get('X-Scenario');
      if (scenarioHeader) {
        try {
          const parsed = JSON.parse(decodeURIComponent(scenarioHeader));
          setLockedScenario(parsed);
        } catch {
          console.warn('Failed to parse scenario header');
        }
      }

      await handleStream(res);
    } catch (err: any) {
      setMessages([{
        role: 'assistant',
        content: `שגיאת התחברות: ${err.message}. נסה שוב.`,
      }]);
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ━━━ שליחת הודעה ━━━
  const sendMessage = async (text: string) => {
    if (!text.trim() || isPaused || isLoading || !isActive) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          scenario: lockedScenario, // ← שליחת התרחיש הנעול
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      await handleStream(res);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `שגיאה: ${err.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ━━━ טיפול ב-Streaming ━━━
  const handleStream = async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) return;

    // הוספת הודעת assistant ריקה שתתמלא בהדרגה
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fullText += new TextDecoder().decode(value);

      setMessages(prev => {
        const rest = prev.slice(0, -1);
        return [...rest, { role: 'assistant', content: fullText }];
      });
    }

    // בדיקת ציון סופי
    const scoreMatch = fullText.match(/ציון\s+סופי:\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      setHistory(prev => {
        const updated = [
          { date: new Date().toLocaleDateString('he-IL'), score },
          ...prev,
        ].slice(0, 5);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setIsActive(false);
      setLockedScenario(null);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 flex flex-col items-center"
    >
      {/* ━━━ היסטוריית ציונים ━━━ */}
      {history.length > 0 && (
        <div className="w-full max-w-2xl mb-4 flex gap-2 overflow-x-auto py-1 no-scrollbar">
          {history.map((h, i) => (
            <div
              key={i}
              className="bg-slate-800 border border-slate-700 p-3 rounded-xl min-w-[90px] text-center flex-shrink-0"
            >
              <div className="text-[10px] text-slate-500 font-semibold mb-1">{h.date}</div>
              <div className={`text-2xl font-black ${h.score >= 80 ? 'text-emerald-400' : h.score >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                {h.score}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ━━━ Header ━━━ */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 mb-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">✚ סימולטור מע"ר</h1>
          <p className="text-xs text-slate-500 mt-0.5">בוחן סימולציה — מד"א</p>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <button
              onClick={() => setIsPaused(p => !p)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold transition-colors"
            >
              {isPaused ? '▶ המשך' : '⏸ עצור'}
            </button>
          )}
          <div
            className={`text-lg font-mono font-bold px-4 py-1.5 rounded-xl border ${
              isPaused
                ? 'bg-amber-950 border-amber-700 text-amber-400 animate-pulse'
                : 'bg-slate-800 border-slate-600 text-blue-400'
            }`}
          >
            {formatTime(seconds)}
          </div>
        </div>
      </div>

      {/* ━━━ אזור שיחה ━━━ */}
      <div className="w-full max-w-2xl flex-1 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col mb-3">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[400px] max-h-[60vh]">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-600 text-sm">לחץ "התחל תרחיש" כדי להתחיל</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tl-none'
                    : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none'
                }`}
              >
                <div className="text-[10px] font-bold opacity-40 mb-1">
                  {m.role === 'user' ? 'מע"ר' : 'בוחן'}
                </div>
                {m.content || (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* ━━━ Input ━━━ */}
        <div className="p-3 border-t border-slate-700 bg-slate-900">
          {!isActive ? (
            <button
              onClick={startScenario}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-900/30"
            >
              {isLoading ? 'טוען תרחיש...' : 'התחל תרחיש חדש 🚑'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                disabled={isPaused || isLoading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={
                  isPaused
                    ? 'הסימולציה מושהית'
                    : isLoading
                    ? 'ממתין לתשובה...'
                    : 'תאר פעולה (סכימת ABCDE)...'
                }
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40 text-sm placeholder:text-slate-500"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isPaused || isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 rounded-xl font-bold transition-all active:scale-95"
              >
                שלח
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
