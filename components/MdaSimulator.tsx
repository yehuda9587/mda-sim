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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = lockedScenario !== null || loading;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    scrollRef.current?.scrollIntoView({ behavior });
  }, []);

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

  // גלילה למטה כשמתקבלת הודעה חדשה
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // כשלוחצים על האינפוט - גלילה קלה כדי שההודעה האחרונה לא תתחבא
  const handleFocus = () => {
    setTimeout(() => scrollToBottom('smooth'), 300);
  };

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
      const raw = res.headers.get('X-Scenario');
      if (raw) setLockedScenario(JSON.parse(decodeURIComponent(raw)));
      await handleStream(res);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `שגיאה: ${err.message}` }]);
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
      await handleStream(res);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `שגיאה: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dynamic w-full flex flex-col bg-slate-950 relative overflow-hidden">
      
      {/* Header - תמיד למעלה */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800 p-4 z-20">
        <div className="max-w-2xl mx-auto flex justify-between items-center w-full">
          <div>
            <h1 className="text-lg font-black text-white leading-none">✚ סימולטור מע"ר</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">בוחן אקטיבי v5</p>
          </div>
          <div className="flex items-center gap-2">
            {timerRunning && (
              <button onClick={() => setPaused(!paused)} className="text-xs bg-slate-800 px-2 py-1.5 rounded border border-slate-700 text-white">
                {paused ? '▶ המשך' : '⏸ עצור'}
              </button>
            )}
            <div className={`font-mono font-bold px-3 py-1.5 rounded-lg border text-sm ${
              paused ? 'bg-amber-900/20 border-amber-700 text-amber-500' : 'bg-slate-800 border-slate-700 text-blue-400'
            }`}>
              {fmt(seconds)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area - האזור היחיד שנגלל */}
      <main className="chat-container p-4 no-scrollbar bg-slate-950">
        <div className="max-w-2xl mx-auto w-full flex flex-col space-y-4">
          {messages.length === 0 && (
            <div className="h-[40vh] flex flex-col items-center justify-center text-slate-700 opacity-40">
              <span className="text-5xl mb-4">🚑</span>
              <p className="text-sm">הבוחן ממתין לפעולה שלך</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tl-none font-medium'
                  : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={scrollRef} className="h-2" />
        </div>
      </main>

      {/* Footer / Input - נשאר יציב מעל המקלדת */}
      <footer className="shrink-0 p-4 bg-slate-900 border-t border-slate-800 pb-safe z-20">
        <div className="max-w-2xl mx-auto w-full">
          {!isActive ? (
            <button
              onClick={startScenario}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black text-xl transition-all shadow-xl"
            >
              {loading ? 'טוען...' : 'התחל תרחיש חדש 🚑'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                disabled={paused || loading}
                onChange={e => setInput(e.target.value)}
                onFocus={handleFocus}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={paused ? "מושהה" : "תאר פעולה..."}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base text-white"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={paused || loading || !input.trim()}
                className="bg-blue-600 px-6 rounded-xl font-bold text-white active:scale-95 transition-all"
              >
                שלח
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
