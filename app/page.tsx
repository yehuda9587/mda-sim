"use client";
import { useState, useEffect, useRef } from 'react';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<{ date: string, score: number }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // טעינת היסטוריה
  useEffect(() => {
    const saved = localStorage.getItem('mda_history_v2');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // טיימר
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // חילוץ ציון ושמירה
  const extractAndSaveScore = (text: string) => {
    const scoreMatch = text.match(/(?:ציון סופי|ציון|הציון הוא):\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      const newEntry = { date: new Date().toLocaleDateString('he-IL'), score };
      
      setHistory(prev => {
        const updated = [newEntry, ...prev].slice(0, 5);
        localStorage.setItem('mda_history_v2', JSON.stringify(updated));
        return updated;
      });
      setIsActive(false);
    }
  };

  const startScenario = () => {
    setMessages([]);
    setSeconds(0);
    setIsActive(true);
    sendMessage("התחל תרחיש. תאר לי מה אני רואה בזירה.");
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: newMessages, mode: 'א' }),
      });

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
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 flex flex-col items-center">
      
      {/* לוח היסטוריה */}
      <div className="w-full max-w-2xl mb-4 flex gap-3 overflow-x-auto py-2 no-scrollbar">
        {history.map((h, i) => (
          <div key={i} className="bg-white border-b-4 border-b-blue-600 border border-slate-200 p-3 rounded-xl shadow-sm min-w-[100px] text-center">
            <div className="text-[10px] text-slate-400 font-bold">{h.date}</div>
            <div className="text-xl font-black text-blue-700">{h.score}</div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl bg-white shadow-sm border border-slate-200 rounded-2xl p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-red-600">✚</span> סימולטור מע"ר
          </h1>
          <div className="text-xl font-mono font-bold bg-blue-50 text-blue-700 px-4 py-1 rounded-full border border-blue-100">
            {formatTime(seconds)}
          </div>
        </div>
        {!isActive && (
          <button onClick={startScenario} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg">
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
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            </div>
          ))}
        </div>

        {isActive && (
          <div className="p-2 border-t border-slate-100 flex gap-2 overflow-x-auto bg-slate-50">
            {['בדיקת בטיחות', 'בדיקת הכרה', 'התרשמות כללית', 'מה הדופק?', 'סיימתי טיפול'].map(a => (
              <button key={a} onClick={() => sendMessage(a)} className="whitespace-nowrap bg-white border border-slate-200 px-4 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-blue-600 shadow-sm">
                {a}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="תאר פעולה..."
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => sendMessage(input)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold">שלח</button>
          </div>
        </div>
      </div>
    </div>
  );
}
