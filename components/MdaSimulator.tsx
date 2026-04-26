"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

// ... (ה-Interfaces וה-Constants נשארים ללא שינוי)

export default function MdaSimulator() {
  // ... (כל ה-States וה-Logic נשארים בדיוק כפי שהיו)

  return (
    /* h-dynamic נועל את הגובה למסך המלא */
    <div className="h-dynamic w-full bg-slate-950 relative flex flex-col">
      
      {/* Header - נצמד למעלה */}
      <header className="shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-4 z-30">
        <div className="flex justify-between items-center w-full">
          <div>
            <h1 className="text-xl font-black text-white leading-none">✚ סימולטור מע"ר</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">בוחן אקטיבי v5</p>
          </div>
          <div className="flex items-center gap-2">
            {timerRunning && (
              <button onClick={() => setPaused(!paused)} className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                {paused ? '▶' : '⏸'}
              </button>
            )}
            <div className={`font-mono font-bold px-3 py-1.5 rounded-lg border ${
              paused ? 'bg-amber-900/20 border-amber-700 text-amber-500' : 'bg-slate-800 border-slate-700 text-blue-400'
            }`}>
              {fmt(seconds)}
            </div>
          </div>
        </div>
      </header>

      {/* Main - האזור היחיד שנגלל */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-950">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40">
             <span className="text-6xl mb-4">🚑</span>
             <p className="text-lg font-bold">הבוחן ממתין לפעולה שלך</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tl-none font-medium'
                : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none shadow-lg'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} className="h-4" />
      </main>

      {/* Footer - שורת הקלט, תמיד למטה */}
      <footer className="shrink-0 p-4 bg-slate-900 border-t border-slate-800 pb-safe z-30">
        {!isActive ? (
          <button
            onClick={startScenario}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xl transition-all active:scale-[0.98] shadow-xl"
          >
            {loading ? 'טוען...' : 'התחל תרחיש חדש 🚑'}
          </button>
        ) : (
          <div className="flex gap-2 w-full">
            <input
              ref={inputRef}
              value={input}
              disabled={paused || loading}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={paused ? "מושהה" : "תאר פעולה..."}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base text-white"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={paused || loading || !input.trim()}
              className="bg-blue-600 px-6 rounded-xl font-bold text-white transition-all active:scale-95 shadow-lg"
            >
              שלח
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
