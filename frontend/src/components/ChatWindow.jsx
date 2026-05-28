import React, { useEffect, useRef } from 'react'
import { Sparkles, FileText, Search, Code } from 'lucide-react'
import MessageBubble from './MessageBubble'

const suggestions = [
  { icon: Code, text: 'Help me debug a piece of code' },
  { icon: Search, text: 'Find the latest information on a topic' },
  { icon: FileText, text: 'Summarize an uploaded document' },
  { icon: Sparkles, text: 'Brainstorm ideas for a project' },
]

export default function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {isEmpty && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-5">
              <Sparkles className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
              How can I help you today?
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mb-8">
              Ask me anything. I can help with coding, research, document analysis, and more.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {suggestions.map((s, i) => {
                const Icon = s.icon
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-left text-sm text-[var(--text-secondary)]"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--accent)]">
                      <Icon size={16} />
                    </span>
                    <span>{s.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={msg.id || idx} message={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start mb-4 message-animate">
            <div className="bg-[var(--assistant-bubble)] rounded-2xl rounded-bl-md px-4 py-3 border border-[var(--border-color)]">
              <div className="flex items-center gap-1.5">
                <span className="typing-dot w-2 h-2 bg-[var(--text-secondary)] rounded-full" />
                <span className="typing-dot w-2 h-2 bg-[var(--text-secondary)] rounded-full" />
                <span className="typing-dot w-2 h-2 bg-[var(--text-secondary)] rounded-full" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}