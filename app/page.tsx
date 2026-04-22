"use client";
import { useState, useEffect, useRef } from 'react';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<{ date: string, score: number }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mda_vfinal_stable');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startScenario = async () => {
    setMessages([]);
    setIsActive(true);
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'התחל תרחיש' }], mode: 'א' }),
    });
    if (!res.ok) {
       setMessages([{ role: 'assistant', content: 'שגיאה בהתחברות לשרת. וודא שה-API Key תקין ב-Vercel.' }]);
       return;
    }
    handleStream(res);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: updated, mode: 'א' }),
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
        if (done) break;
        assistantText += new TextDecoder().decode(value);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: assistantText }];
        });
      }
      // בדיקת ציון בסיום
      const scoreMatch = assistantText.match(/(?:ציון סופי):\s*(\d+)/i);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        const updatedHistory = [{ date: new Date().toLocaleDateString(), score }, ...history].slice(0, 5);
        setHistory(updatedHistory);
        localStorage.setItem('mda_vfinal_stable', JSON.stringify(updatedHistory));
        setIsActive(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-white shadow-md rounded-2xl p-6 mb-4">
        <h1 className="text-2xl font-bold mb-4">✚ סימולטור מע"ר - גרסה יציבה</h1>
        {!isActive && (
          <button onClick={startScenario} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">התחל תרחיש חדש</button>
        )}
      </div>

      <div className="w-full max-w-2xl flex-1 bg-white shadow-md rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(input)} placeholder="תאר פעולה..." className="flex-1 border rounded-xl px-4 py-2" />
          <button onClick={() => sendMessage(input)} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold">שלח</button>
        </div>
      </div>
    </div>
  );
}
