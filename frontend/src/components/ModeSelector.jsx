import React from 'react'
import { MessageSquare, Search, FileText, GitBranch, Mic } from 'lucide-react'

const modes = [
  { id: 'groq_chat', label: 'Groq Chat', icon: MessageSquare, description: 'General chat & reasoning' },
  { id: 'gemini_search', label: 'Gemini Search', icon: Search, description: 'Latest info with search' },
  { id: 'document', label: 'Document Only', icon: FileText, description: 'Answer from documents' },
  { id: 'hybrid', label: 'Hybrid', icon: GitBranch, description: 'Documents + AI search' },
  { id: 'voice', label: 'Voice', icon: Mic, description: 'Nepali-English voice chat' },
]

export default function ModeSelector({ currentMode, onModeChange }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] overflow-x-auto">
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = currentMode === mode.id
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            }`}
            title={mode.description}
          >
            <Icon size={14} />
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
