"use client";
import { useState, useEffect, useRef } from 'react';

export default function MdaSimulator() {
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<{ date: string, score: number, scenario: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // טעינה מהזיכרון כשהדף עולה
  useEffect(() => {
    const savedHistory = localStorage.getItem('mda_simulator_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
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

  // --- פונקציית עזר לחילוץ ציון ושמירה (התוספת הקריטית) ---
  const extractAndSaveScore = (text: string) => {
    const scoreMatch = text.match(/ציון:\s*(\d+)/) || text.match(/ציון\s*(\d+)/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      const newEntry = {
        date: new Date().toLocaleDateString('he-IL'),
        score: score,
        scenario: "תרחיש מע\"ר"
      };
      
      const updatedHistory = [newEntry, ...history].slice(0, 5);
      setHistory(updatedHistory);
      localStorage.setItem('mda_simulator_history', JSON.stringify(updatedHistory));
      setIsActive(false); // עוצר את הטיימר כשיש ציון
    }
  };

  const startScenario = () => {
    setMessages([]);
    setSeconds(0);
    setIsActive(true);
    sendMessage("התחל תרחיש");
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
      if (done) {
        // --- כאן אנחנו בודקים אם הגיע ציון בסוף הסטרימינג ---
        extractAndSaveScore(assistantText);
        break;
      }
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
      
      {/* לוח הישגים - תצוגה של ההיסטוריה (חדש!) */}
      {history.length > 0 && (
        <div className="w-full max-w-2xl mb-4 flex gap-2 overflow-x-auto py-2 no-scrollbar">
          {history.map((item, index) => (
            <div key={index} className="bg-white border border-blue-100 p-2 rounded-lg shadow-sm min-w-[100px] text-center border-b-2 border-b-blue-500">
              <div className="text-[9px] text-slate-400 font-bold">{item.date}</div>
              <div className="text-lg font-black text-blue-700">{item.score}</div>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-2xl bg-white shadow-sm border border-slate-200 rounded-xl p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-blue-700 underline decoration-red-500">סימולטור מע"ר מד"א</h1>
          <div className="text-xl font-mono font-bold bg-slate-100 px-3 py-1 rounded border border-slate-200">
            {formatTime(seconds)}
          </div>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          ברוכים הבאים לסימולטור קורס 60. עליכם לנהל תרחיש רפואי לפי סכימת ה-ABC. 
          הבוחן יספק מידע רק אם תשאלו עליו. בסיום, תקבלו ציון ומשוב מפורט.
        </p>
        {!isActive && (
          <button onClick={startScenario} className="w-full mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md active:scale-95">
            התחל תרחיש חדש 🚑
          </button>
        )}
      </div>

      <div className="w-full max-w-2xl flex-1 bg-white shadow-inner border border-slate-200 rounded-xl overflow-hidden flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                <div className="text-[10px] font-bold opacity-70 mb-1">{m.role === 'user' ? 'מע"ר' : 'בוחן AI'}</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {isActive && (
          <div className="p-2 border-t border-slate-100 flex gap-2 overflow-x-auto bg-slate-100/50">
            {['בדיקת בטיחות', 'בדיקת הכרה', 'התרשמות כללית', 'מה הדופק?', 'מה לחץ הדם?', 'סיימתי טיפול'].map(action => (
              <button key={action} onClick={() => sendMessage(action)} className="whitespace-nowrap bg-white border border-slate-300 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:bg-blue-50 transition active:scale-90">
                {action}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-slate-200">
          <div className="flex gap-2">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="כתוב פעולה או שאלה..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => sendMessage(input)} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-900 transition">שלח</button>
          </div>
        </div>
      </div>
    </div>
  );
}
