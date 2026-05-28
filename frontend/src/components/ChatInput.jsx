import React, { useState, useRef } from 'react'
import { Send, Paperclip, Mic } from 'lucide-react'

export default function ChatInput({
  onSend,
  onFileClick,
  onVoiceClick,
  disabled,
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)]"
    >
      <button
        type="button"
        onClick={onFileClick}
        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        title="Upload file"
      >
        <Paperclip size={20} />
      </button>

      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-48"
          style={{ minHeight: '42px' }}
          disabled={disabled}
        />
      </div>

      <button
        type="button"
        onClick={onVoiceClick}
        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-white transition-colors"
        title="Voice chat"
      >
        <Mic size={20} />
      </button>

      <button
        type="submit"
        disabled={!input.trim() || disabled}
        className="p-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={20} />
      </button>
    </form>
  )
}
