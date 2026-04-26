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
    const initMsg: ChatMessage = { role: 'user', content: 'התחל תרחיש' };
    setMessages([initMsg]);
    setSeconds(0);
    setTimerRunning(true);
    setPaused(false);
    setLoading(true);
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאה בחיבור לשרת' }]);
    } finally { setLoading(false); }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || paused) return;
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאה בשליחה' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 h-dynamic bg-slate-950 text-slate-100 flex flex-col overflow-hidden shadow-2xl">
      <header className="shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">✚ סימולטור מע"ר</h1>
          <p className="text-[10px] text-slate-500 uppercase">בוחן סימולציה - מד"א</p>
        </div>
        <div className={`text-lg font-mono font-bold px-4 py-1 rounded-xl border ${paused ? 'text-amber-400 border-amber-800' : 'text-blue-400 border-slate-700'}`}>
          {fmt(seconds)}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar scroll-smooth bg-slate-950/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tl-none' : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none'}`}>
              <div className="text-[10px] font-bold opacity-30 mb-1">{m.role === 'user' ? 'מע"ר' : 'בוחן'}</div>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} className="h-8" />
      </main>

      <footer className="shrink-0 p-4 bg-slate-900 border-t border-slate-800 pb-safe">
        {!isActive ? (
          <button onClick={startScenario} disabled={loading} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all">
            {loading ? 'מכין פצוע...' : 'התחל תרחיש חדש 🚑'}
          </button>
        ) : (
          <div className="flex gap-2">
            <input 
              ref={inputRef} value={input} disabled={paused || loading}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="תאר פעולה (ABCDE)..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className="bg-blue-600 px-6 rounded-xl font-bold">שלח</button>
          </div>
        )}
      </footer>
    </div>
  );
}
