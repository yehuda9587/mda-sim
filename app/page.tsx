"use client";
import { useState, useEffect, useRef } from 'react';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const startScenario = () => {
    setMessages([{ role: 'assistant', content: 'הגעת לזירה, מה ההתרשמות הראשונית שלך?' }]);
    setSeconds(0);
    setIsActive(true);
  };

  const sendMessage = async (text: string) => {
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: newMessages, mode: 'א' }),
    });
    
    const reader = res.body?.getReader();
    let assistantText = "";
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      assistantText += new TextDecoder().decode(value);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: assistantText }];
      });
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 flex flex-col items-center">
      {/* Header & Explanation */}
      <div className="w-full max-w-2xl bg-white shadow-sm border border-slate-200 rounded-xl p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-blue-700">סימולטור מע"ר מד"א</h1>
          <div className="text-xl font-mono font-bold bg-slate-100 px-3 py-1 rounded">{formatTime(seconds)}</div>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          ברוכים הבאים לסימולטור קורס 60. עליכם לנהל תרחיש רפואי לפי סכימת ה-ABC. 
          הבוחן יספק מידע רק אם תשאלו עליו. בסיום, תקבלו ציון ומשוב מפורט.
        </p>
        {!isActive && (
          <button onClick={startScenario} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
            התחל תרחיש חדש
          </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="w-full max-w-2xl flex-1 bg-white shadow-inner border border-slate-200 rounded-xl overflow-hidden flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 border border-slate-200'}`}>
                <div className="text-xs opacity-70 mb-1">{m.role === 'user' ? 'מע"ר' : 'בוחן AI'}</div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Quick Actions */}
        {isActive && (
          <div className="p-2 border-t border-slate-100 flex gap-2 overflow-x-auto bg-slate-50">
            {['בדיקת בטיחות', 'בדיקת הכרה', 'התרשמות כללית', 'מה הדופק?', 'מה לחץ הדם?', 'סיימתי טיפול'].map(action => (
              <button key={action} onClick={() => sendMessage(action)} className="whitespace-nowrap bg-white border border-slate-300 px-3 py-1 rounded-full text-xs hover:bg-blue-50 transition">
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex gap-2">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="כתוב פעולה או שאלה..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => sendMessage(input)} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900">שלח</button>
          </div>
        </div>
      </div>
      
      {/* Account Option Placeholder */}
      <div className="text-slate-400 text-xs mt-2">
        <button className="underline">התחבר לשמירת היסטוריה וציונים</button>
      </div>
    </div>
  );
}
