import React, { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

export default function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && !isLoading && (
        <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-secondary)]">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">How can I help you today?</h2>
          <p className="text-sm max-w-md">
            Ask me anything! I can help with coding, research, document analysis, and more.
          </p>
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
  )
}
