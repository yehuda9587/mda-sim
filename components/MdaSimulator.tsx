// ... (כל ה-Imports וה-Interfaces נשארים אותו דבר)

export default function MdaSimulator() {
  // ... (כל ה-States וה-Logic נשארים אותו דבר)

  return (
    <div className="h-dynamic w-full max-w-2xl mx-auto bg-slate-950 shadow-2xl relative">
      
      {/* Header - גובה קבוע */}
      <header className="shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 z-20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-black text-white leading-none">✚ סימולטור מע"ר</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Proactive Examiner v5</p>
          </div>
          
          <div className="flex items-center gap-2">
            {timerRunning && (
              <button onClick={() => setPaused(!paused)} className="text-xs bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                {paused ? '▶' : '⏸'}
              </button>
            )}
            <div className={`font-mono font-bold px-3 py-1 rounded-lg border text-sm ${
              paused ? 'bg-amber-900/20 border-amber-700 text-amber-500' : 'bg-slate-800 border-slate-700 text-blue-400'
            }`}>
              {fmt(seconds)}
            </div>
          </div>
        </div>
        
        {/* היסטוריית ציונים קטנה בתוך ה-Header כדי לחסוך מקום */}
        {scoreHistory.length > 0 && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {scoreHistory.map((h, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 px-2 py-1 rounded-md text-[10px] whitespace-nowrap">
                <span className="text-slate-500">{h.date}:</span> <span className="font-bold">{h.score}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* אזור הצ'אט - גמיש ונגלל */}
      <main className="chat-container p-4 space-y-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-4">
             <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">🚑</div>
             <p className="text-sm">מוכן לסימולציית מגה-קוד?<br/>הבוחן ימתין לפעולה הראשונה שלך.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tl-none font-medium'
                : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} className="h-4" />
      </main>

      {/* Footer - תמיד בתחתית, לא קופץ */}
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
          <div className="flex gap-2 w-full">
            <input
              ref={inputRef}
              value={input}
              disabled={paused || loading}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="מה הפעולה הבאה שלך?"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition-all placeholder:text-slate-600"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={paused || loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 rounded-xl font-bold transition-all active:scale-95"
            >
              שלח
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
