"use client";
import { useState, useEffect, useRef } from 'react';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [history, setHistory] = useState<{ date: string, score: number }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mda_history_vfinal');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isActive && !isPaused) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const extractAndSaveScore = (text: string) => {
    const scoreMatch = text.match(/(?:ציון סופי|ציון):\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      setHistory(prev => {
        const updated = [{ date: new Date().toLocaleDateString('he-IL'), score }, ...prev].slice(0, 5);
        localStorage.setItem('mda_history_vfinal', JSON.stringify(updated));
        return updated;
      });
      setIsActive(false);
    }
  };

  const startScenario = async () => {
    setMessages([]); // מנקה הכל להתחלה נקייה
    setSeconds(0);
    setIsActive(true);
    setIsPaused(false);

    // שליחה שקטה ל-AI שיחזיר מיד הוראות ומקרה
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        messages: [{ role: 'user', content: 'התחל תרחיש' }], 
        mode: 'א' 
      }),
    });
    handleStream(res);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isPaused) return;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: newMessages, mode: 'א' }),
    });
    handleStream(res);
  };

  const handleStream = async (res: Response) => {
    const reader = res.body?.getReader();
    let assistantText = "";
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          extractAndSaveScore(assistantText);
          break;
        }
        assistantText += new TextDecoder().decode(value);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: assistantText }];
        });
      }
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mb-4 flex gap-3 overflow-x-auto py-2 no-scrollbar">
        {history.map((h, i) => (
          <div key={i} className="bg-white border-b-4 border-b-blue-600 border border-slate-200 p-3 rounded-xl shadow-sm min-w-[100px] text-center shadow-md">
            <div className="text-[10px] text-slate-400 font-bold">{h.date}</div>
            <div className="text-xl font-black text-blue-700">{h.score}</div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl bg-white shadow-sm border border-slate-200 rounded-2xl p-6 mb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">✚ סימולטור מע"ר</h1>
          <div className="flex items-center gap-3">
            {isActive && (
              <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-500 hover:bg-slate-200 transition">
                {isPaused ? 'המשך ▶' : 'עצור ⏸'}
              </button>
            )}
            <div className={`text-xl font-mono font-bold px-4 py-1 rounded-full border shadow-sm transition-all ${isPaused ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
              {formatTime(seconds)}
            </div>
          </div>
        </div>
        {!isActive && (
          <button onClick={startScenario} className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg text-lg active:scale-95">
            התחל תרחיש חדש 🚑
          </button>
        )}
      </div>

      <div className="w-full max-w-2xl flex-1 bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                <div className="text-[10px] font-bold opacity-50 mb-1">{m.role === 'user' ? 'מע"ר' : 'בוחן סימולציה'}</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <input 
              value={input} 
              disabled={isPaused || !isActive}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder={isPaused ? "הסימולציה בעצירה..." : "תאר פעולה או בקש מדד..."}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg shadow-inner disabled:bg-slate-50"
            />
            <button 
              onClick={() => sendMessage(input)} 
              disabled={isPaused || !isActive}
              className="bg-slate-900 text-white px-8 py-2 rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 transition-all shadow-md active:scale-95"
            >
              שלח
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
