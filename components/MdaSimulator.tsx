"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

interface ScoreEntry {
  date: string;
  score: number;
}

const STORAGE_KEY = 'mda_sim_v5';
const SCORE_RE = /ציון\s+סופי:\s*(\d+)/i;

export default function MdaSimulator() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);
  const [lockedScenario, setLockedScenario] = useState<object | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = lockedScenario !== null || loading;

  // טעינת היסטוריית ציונים
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setScoreHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // ניהול הטיימר
  useEffect(() => {
    if (!timerRunning || paused) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning, paused]);

  // גלילה אוטומטית לסוף הצ'אט
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const saveScore = useCallback((score: number) => {
    setScoreHistory(prev => {
      const updated = [{ date: new Date().toLocaleDateString('he-IL'), score }, ...prev].slice(0, 5);
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
    }
  }, [saveScore]);

  const startScenario = async () => {
    if (loading) return;
    const initMsg: ChatMessage = { role: 'user', content: 'התחל תרחיש' };
    setMessages([initMsg]);
    setSeconds(0);
    setTimerRunning(true);
    setPaused(false);
    setLoading(true);
    setLockedScenario(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [initMsg], scenario: null }),
      });
      
      const raw = res.headers.get('X-Scenario');
      if (raw) setLockedScenario(JSON.parse(decodeURIComponent(raw)));
      
      await handleStream(res);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאה בחיבור לשרת.' }]);
    } finally { setLoading(false); }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || paused || !isActive) return;
    
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
      await handleStream(res);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאה בשליחת ההודעה.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div dir="rtl" className="fixed inset-0 h-dynamic bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      
      {/* Header */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-20">
        <div>
          <h1 className="text-xl font-bold tracking-tight">✚ סימולטור מע"ר</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">בוחן סימולציה - מד"א</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-lg font-mono font-bold px-4 py-1.5 rounded-xl border transition-colors ${
            paused ? 'bg-amber-950/20 border-amber-800 text-amber-400' : 'bg-slate-800 border-slate-700 text-blue-400'
          }`}>
            {fmt(seconds)}
          </div>
          {timerRunning && (
            <button 
              onClick={() => setPaused(!paused)}
              className="p-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
            >
              {paused ? '▶' : '⏸'}
            </button>
          )}
        </div>
      </header>

      {/* Score Chips */}
      {scoreHistory.length > 0 && !isActive && (
        <div className="shrink-0 bg-slate-900/50 flex gap-2 overflow-x-auto p-2 no-scrollbar border-b border-slate-800/50">
          {scoreHistory.map((h, i) => (
            <div key={i} className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1 text-center shrink-0">
              <span className="text-[9px] text-slate-500 block mb-0.5">{h.date}</span>
              <span className="font-bold text-sm text-emerald-400">{h.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar scroll-smooth">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4 opacity-40">
            <div className="text-6xl">🚑</div>
            <p className="text-sm font-medium">לחץ על הכפתור למטה להתחלת המגה-קוד</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tl-none shadow-blue-900/20'
                : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none'
            }`}>
              <div className="text-[10px] font-black uppercase tracking-tighter opacity-30 mb-1">
                {m.role === 'user' ? 'מע"ר' : 'בוחן'}
              </div>
              {m.content || (
                <div className="flex gap-1 py-1">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} className="h-8" />
      </main>

      {/* Input / Action Area */}
      <footer className="shrink-0 p-4 bg-slate-900 border-t border-slate-800 pb-safe z-20">
        {!isActive ? (
          <button
            onClick={startScenario}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xl transition-all active:scale-[0.97] shadow-xl shadow-blue-900/40"
          >
            {loading ? 'טוען תרחיש...' : 'התחל תרחיש חדש 🚑'}
          </button>
        ) : (
          <div className="flex gap-2 max-w-4xl mx-auto w-full">
            <input
              ref={inputRef}
              value={input}
              disabled={paused || loading}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={paused ? 'הסימולציה מושהית' : 'תאר פעולה (ABCDE)...'}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition-all"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={paused || loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 rounded-xl font-bold transition-all active:scale-90"
            >
              שלח
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
