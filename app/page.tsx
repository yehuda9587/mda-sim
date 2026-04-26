"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ScoreEntry {
  date: string;
  score: number;
}

const STORAGE_KEY = 'mda_sim_v5';
const SCORE_RE = /ציון\s+סופי:\s*(\d+)/i;

export default function MdaSimulator() {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [input, setInput]               = useState('');
  const [seconds, setSeconds]           = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [paused, setPaused]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);

  // ─── lockedScenario — לב הפתרון ──────────────────────────────────────────
  // נבחר בשרת בהודעה הראשונה → מוחזר ב-X-Scenario header → נשלח בכל request.
  // ערובה לכך שאותו system-prompt (= אותו פצוע) נבנה לאורך כל השיחה.
  const [lockedScenario, setLockedScenario] = useState<object | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const isActive = lockedScenario !== null || loading;

  // ─── Side effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setScoreHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!timerRunning || paused) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning, paused]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isActive && !paused && !loading) inputRef.current?.focus();
  }, [isActive, paused, loading, messages.length]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const saveScore = useCallback((score: number) => {
    setScoreHistory(prev => {
      const updated = [
        { date: new Date().toLocaleDateString('he-IL'), score },
        ...prev,
      ].slice(0, 5);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // ─── Streaming ────────────────────────────────────────────────────────────
  const handleStream = useCallback(async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) return;

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    let full = '';
    const dec = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += dec.decode(value, { stream: true });
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: full }]);
    }

    // זיהוי ציון → סיום סימולציה
    const m = full.match(SCORE_RE);
    if (m) {
      saveScore(parseInt(m[1], 10));
      setLockedScenario(null);
      setTimerRunning(false);
      setPaused(false);
    }
  }, [saveScore]);

  // ─── Start ────────────────────────────────────────────────────────────────
  // חשוב: setMessages([initMsg]) — לא setMessages([]) — כדי שה-history לא יתחיל מ-model
  const startScenario = async () => {
    if (loading) return;

    const initMsg: ChatMessage = { role: 'user', content: 'התחל תרחיש' };
    setMessages([initMsg]);
    setSeconds(0);
    setTimerRunning(true);
    setPaused(false);
    setLockedScenario(null);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [initMsg], scenario: null }),
      });

      if (!res.ok) throw new Error(`שגיאת שרת ${res.status}`);

      // שמירת התרחיש מיד לאחר קבלת הheaders (לפני body)
      const raw = res.headers.get('X-Scenario');
      if (raw) {
        try { setLockedScenario(JSON.parse(decodeURIComponent(raw))); }
        catch { console.warn('Failed to parse X-Scenario'); }
      }

      await handleStream(res);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `שגיאה: ${err.message}` }]);
      setLockedScenario(null);
      setTimerRunning(false);
    } finally {
      setLoading(false);
    }
  };

  // ─── Send ─────────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || paused || loading || !isActive) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, scenario: lockedScenario }),
      });
      if (!res.ok) throw new Error(`שגיאת שרת ${res.status}`);
      await handleStream(res);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `שגיאה: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 p-4 flex flex-col items-center font-sans">

      {/* היסטוריית ציונים */}
      {scoreHistory.length > 0 && (
        <div className="w-full max-w-2xl mb-3 flex gap-2 overflow-x-auto py-1">
          {scoreHistory.map((h, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 min-w-[78px] text-center flex-shrink-0">
              <div className="text-[10px] text-slate-500 mb-1">{h.date}</div>
              <div className={`text-xl font-black ${
                h.score >= 80 ? 'text-emerald-400' : h.score >= 60 ? 'text-amber-400' : 'text-rose-400'
              }`}>{h.score}</div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 mb-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">✚ סימולטור מע"ר</h1>
          <p className="text-xs text-slate-500 mt-0.5">בוחן סימולציה — מד"א</p>
        </div>
        <div className="flex items-center gap-2">
          {timerRunning && (
            <button
              onClick={() => setPaused(p => !p)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold transition-colors"
            >
              {paused ? '▶ המשך' : '⏸ עצור'}
            </button>
          )}
          <div className={`text-lg font-mono font-bold px-4 py-1.5 rounded-xl border ${
            paused
              ? 'bg-amber-950 border-amber-700 text-amber-400 animate-pulse'
              : 'bg-slate-800 border-slate-600 text-blue-400'
          }`}>
            {fmt(seconds)}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col mb-3"
        style={{ minHeight: 420, maxHeight: '65vh' }}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              לחץ על "התחל תרחיש" כדי להתחיל
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tl-none'
                  : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none'
              }`}>
                <div className="text-[10px] font-bold opacity-40 mb-1">
                  {m.role === 'user' ? 'מע"ר' : 'בוחן'}
                </div>
                {m.content || (
                  <span className="inline-flex gap-1 py-0.5">
                    {[0, 150, 300].map(d => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-700">
          {!isActive ? (
            <button
              onClick={startScenario}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-900/30"
            >
              {loading ? 'טוען תרחיש...' : 'התחל תרחיש חדש 🚑'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                disabled={paused || loading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={
                  paused   ? 'הסימולציה מושהית' :
                  loading  ? 'ממתין לתשובה...'  :
                             'תאר פעולה (סכימת ABCDE)...'
                }
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40 text-sm placeholder:text-slate-500"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={paused || loading || !input.trim()}
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
