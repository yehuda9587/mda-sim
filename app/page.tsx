"use client";
import { useState, useEffect, useRef } from 'react';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startScenario = async () => {
    setMessages([]);
    setIsActive(true); // זה יעלים את הכפתור ויציג את ה-input
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'התחל תרחיש' }] }),
    });
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
      body: JSON.stringify({ messages: updated }),
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
      // אם התקבל ציון סופי, מאפשרים להתחיל תרחיש חדש
      if (assistantText.includes("ציון סופי")) setIsActive(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-[#1e293b] shadow-2xl rounded-2xl p-6 mb-4 border border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-blue-500">✚</span> סימולטור מע"ר
        </h1>
      </div>

      <div className="w-full max-w-2xl flex-1 bg-[#1e293b] shadow-2xl rounded-2xl overflow-hidden flex flex-col border border-slate-700">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#334155] text-slate-100 rounded-tl-none border border-slate-600'}`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 bg-[#0f172a]/50 border-t border-slate-700">
          {!isActive ? (
            <button onClick={startScenario} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-lg transition-all active:scale-95">
              התחל תרחיש חדש 🚑
            </button>
          ) : (
            <div className="flex gap-2">
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)} 
                placeholder="..." 
                className="flex-1 bg-[#334155] border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => sendMessage(input)} className="bg-blue-600 px-6 py-3 rounded-xl font-bold">שלח</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
