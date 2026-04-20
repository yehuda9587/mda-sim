'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Mode = 'א' | 'ב'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--accent)] opacity-70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser
            ? 'bg-[var(--user-bg)] text-[var(--text)] rounded-tr-sm'
            : 'bg-[var(--ai-bg)] border border-[var(--border)] text-[var(--text)] rounded-tl-sm'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
            <span className="text-xs text-[var(--text-dim)] font-medium">חובש-AI</span>
          </div>
        )}
        {msg.content}
      </div>
    </div>
  )
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('ב')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return
      const userMsg: Message = { role: 'user', content: content.trim() }
      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      setInput('')
      setLoading(true)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages, mode }),
        })

        if (!res.ok) throw new Error('Server error')

        const text = await res.text()
        setLoading(false)
        setMessages(prev => [...prev, { role: 'assistant', content: text }])
      } catch {
        setLoading(false)
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '⚠️ שגיאה בחיבור לשרת. נסה שוב.' },
        ])
      }
    },
    [messages, mode, loading]
  )

  const startSimulation = useCallback(() => {
    setStarted(true)
    setMessages([])
    sendMessage(`מצב ${mode}`)
  }, [mode, sendMessage])

  const reset = () => {
    setMessages([])
    setStarted(false)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickActions = [
    'האם יש סייפטי?',
    'אני מבצע התרשמות כללית',
    'מה רמת ההכרה?',
    'מה ה-SpO2?',
    'מה הדופק?',
    'מה לחץ הדם?',
    'מה קצב הנשימה?',
    'מה רמת הסוכר?',
    'אני מתחיל ABC',
    'סיימתי',
  ]

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <span className="text-white text-base font-bold">✚</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text)]">סימולטור BLS מד״א</h1>
            <p className="text-xs text-[var(--text-dim)]">הכשרת חובשים</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {started && (
            <button
              onClick={reset}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              תרחיש חדש
            </button>
          )}
        </div>
      </header>

      {/* Mode selector / Welcome */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-600/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚑</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">בחר מצב סימולציה</h2>
            <p className="text-sm text-[var(--text-dim)] max-w-sm">
              התרחיש נוצר אוטומטית על-ידי AI בשילוב מצבים מחומר הקורס הרשמי של מד״א
            </p>
          </div>

          <div className="flex gap-4 w-full max-w-md">
            {(['א', 'ב'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-2xl border-2 p-5 text-center transition-all ${
                  mode === m
                    ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'
                }`}
              >
                <div className="text-2xl mb-2">{m === 'א' ? '🎯' : '🩺'}</div>
                <div className="font-bold text-[var(--text)] mb-1">מצב {m}</div>
                <div className="text-xs text-[var(--text-dim)]">
                  {m === 'א' ? 'אבחנה וטיפול' : 'ניהול מקרה שלב-שלב'}
                </div>
              </button>
            ))}
          </div>

          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--text-dim)]">
            <div className="font-semibold text-[var(--text)] mb-2">
              {mode === 'א' ? '📋 מצב א – אבחנה וטיפול' : '🔄 מצב ב – ניהול שלב-שלב'}
            </div>
            {mode === 'א' ? (
              <p>תרחיש יוצג, תוכל לשאול שאלות, ובסוף תגיש אבחנה ותוכנית טיפול מלאה. תקבל ציון ומשוב מפורט.</p>
            ) : (
              <p>תנהל את המקרה צעד אחר צעד. כתוב כל פעולה בנפרד. כשתסיים כתוב &quot;סיימתי&quot; עם אבחנה ותוכנית טיפול.</p>
            )}
          </div>

          <button
            onClick={startSimulation}
            className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base transition-colors shadow-lg shadow-red-900/30"
          >
            התחל תרחיש
          </button>
        </div>
      ) : (
        <>
          {/* Mode badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
            <span className="text-xs text-[var(--text-dim)]">
              מצב {mode} – {mode === 'א' ? 'אבחנה וטיפול' : 'ניהול מקרה'}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && (
              <div className="flex justify-end mb-3">
                <div className="bg-[var(--ai-bg)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          {mode === 'ב' && messages.length > 0 && (
            <div className="px-3 py-2 flex gap-2 overflow-x-auto scrollbar-thin shrink-0">
              {quickActions.map(action => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  disabled={loading}
                  className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]/50 disabled:opacity-40 transition-colors shrink-0"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-1 shrink-0">
            <div className="flex items-end gap-2 bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-3 py-2 focus-within:border-[var(--accent)]/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  autoResize()
                }}
                onKeyDown={handleKeyDown}
                placeholder="כתוב פעולה, שאלה, או אבחנה…"
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent text-[var(--text)] text-sm resize-none outline-none placeholder:text-[var(--text-dim)] leading-relaxed disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '160px' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="shrink-0 w-8 h-8 rounded-xl bg-[var(--accent)] disabled:bg-[var(--border)] disabled:text-[var(--text-dim)] text-white flex items-center justify-center transition-colors hover:bg-blue-400"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[var(--text-dim)] text-center mt-1.5 opacity-60">
              Enter לשליחה · Shift+Enter לשורה חדשה
            </p>
          </div>
        </>
      )}
    </div>
  )
}
