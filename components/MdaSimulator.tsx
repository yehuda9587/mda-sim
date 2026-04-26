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

const STORAGE_KEY = 'mda_sim_v6';
const SCORE_RE = /ציון\s+סופי:\s*(\d+)/i;

export default function MdaSimulator() {
  const [messages, setMessages]             = useState<ChatMessage[]>([]);
  const [input, setInput]                   = useState('');
  const [seconds, setSeconds]               = useState(0);
  const [timerRunning, setTimerRunning]     = useState(false);
  const [paused, setPaused]                 = useState(false);
  const [loading, setLoading]               = useState(false);
  const [scoreHistory, setScoreHistory]     = useState<ScoreEntry[]>([]);
  const [lockedScenario, setLockedScenario] = useState<object | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isActive  = lockedScenario !== null || loading;

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

  // גלילה אוטומטית — requestAnimationFrame מחכה לrender מלא
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  useEffect(() => {
    if (isActive && !paused && !loading) inputRef.current?.focus();
  }, [isActive, paused, loading, messages.length]);

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
    const m = full.match(SCORE_RE);
    if (m) {
      saveScore(parseInt(m[1], 10));
      setLockedScenario(null);
      setTimerRunning(false);
      setPaused(false);
    }
  }, [saveScore]);

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
      const raw = res.headers.get('X-Scenario');
      if (raw) {
        try { setLockedScenario(JSON.parse(decodeURIComponent(raw))); } catch {}
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

  return (
    <>
      {/* HEADER — shell-header: flex-shrink-0, לא מתכווץ */}
      <header className="shell-header bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-none">✚ סימולטור מע&quot;ר</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">מגה-קוד מד&quot;א · BLS</p>
          </div>
          <div className="flex items-center gap-2">
            {timerRunning && (
              <button
                onClick={() => setPaused(p => !p)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                {paused ? '▶ המשך' : '⏸ עצור'}
              </button>
            )}
            <div className={`font-mono text-sm font-bold px-3 py-1 rounded-lg border ${
              paused       ? 'bg-amber-950 border-amber-700 text-amber-400 animate-pulse' :
              timerRunning ? 'bg-slate-800 border-slate-700 text-blue-400' :
                             'bg-slate-900 border-slate-800 text-slate-600'
            }`}>
              {fmt(seconds)}
            </div>
          </div>
        </div>

        {scoreHistory.length > 0 && (
          <div className="max-w-2xl mx-auto mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {scoreHistory.map((h, i) => (
              <div key={i} className="flex-shrink-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-center min-w-[60px]">
                <div className="text-[9px] text-slate-500">{h.date}</div>
                <div className={`text-lg font-black leading-none mt-0.5 ${
                  h.score >= 80 ? 'text-emerald-400' : h.score >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>{h.score}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* CHAT — chat-area: flex-1, גולל בפנים */}
      <div className="chat-area px-3 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
              לחץ על &quot;התחל תרחיש&quot; כדי להתחיל
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tl-sm'
                  : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-sm'
              }`}>
                <div className="text-[9px] font-bold opacity-40 mb-1">
                  {m.role === 'user' ? 'מע"ר' : 'בוחן'}
                </div>
                {m.content || (
                  <span className="inline-flex gap-1 items-center h-4">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* FOOTER — shell-footer: flex-shrink-0 */}
      <footer className="shell-footer bg-slate-900 border-t border-slate-800 px-3 py-3">
        <div className="max-w-2xl mx-auto">
          {!isActive ? (
            <button
              onClick={startScenario}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
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
                placeholder={paused ? 'הסימולציה מושהית' : loading ? 'ממתין לתשובה...' : 'תאר פעולה (SABCDE)...'}
                enterKeyHint="send"
                inputMode="text"
                className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3
                           text-base placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:opacity-40 transition-opacity"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={paused || loading || !input.trim()}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white px-5 rounded-xl font-bold transition-colors"
              >
                שלח
              </button>
            </div>
          )}
        </div>
      </footer>
    </>
  );
}
