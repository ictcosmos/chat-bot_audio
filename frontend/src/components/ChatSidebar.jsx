import React, { useState } from 'react'
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react'
import { auth } from '../services/firebase'

export default function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onSearch,
  darkMode,
  toggleDarkMode,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const handleSearch = (e) => {
    const q = e.target.value
    setSearchQuery(q)
    onSearch(q)
  }

  const startEditing = (chat) => {
    setEditingId(chat.id)
    setEditTitle(chat.title)
  }

  const saveEdit = (chatId) => {
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const handleLogout = () => {
    auth.signOut()
  }

  return (
    <div className="w-72 h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-color)]">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <MessageSquare size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">ChatBot</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>

          {/* Close button (mobile drawer only) */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* New chat */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] transition-colors font-medium text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-10 text-[var(--text-secondary)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
              <MessageSquare size={22} />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No chats yet
            </p>
            <p className="text-xs mt-1">
              {searchQuery
                ? 'No chats match your search.'
                : 'Start a new conversation to see it here.'}
            </p>
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId
            const isEditing = editingId === chat.id

            return (
              <div
                key={chat.id}
                className={`group relative flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 border ${isActive
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                    : 'border-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  }`}
                onClick={() => !isEditing && onSelectChat(chat.id)}
              >
                {isActive && !isEditing && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[var(--accent)]" />
                )}

                <MessageSquare
                  size={16}
                  className={`flex-shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                    }`}
                />

                {isEditing ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-0.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(chat.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        saveEdit(chat.id)
                      }}
                      className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-green-500"
                      title="Save"
                      aria-label="Save title"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        cancelEdit()
                      }}
                      className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-red-500"
                      title="Cancel"
                      aria-label="Cancel editing"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : confirmDeleteId === chat.id ? (
                  <div className="flex-1 flex items-center justify-between gap-1">
                    <span className="text-xs text-[var(--text-secondary)] truncate">
                      Delete chat?
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteChat(chat.id)
                          setConfirmDeleteId(null)
                        }}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                        title="Confirm delete"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(null)
                        }}
                        className="px-2 py-0.5 rounded text-xs font-medium hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                        title="Cancel delete"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{chat.title}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(chat)
                        }}
                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        title="Rename chat"
                        aria-label="Rename chat"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(chat.id)
                        }}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-[var(--border-color)]">
        <p className="text-[11px] text-[var(--text-secondary)] text-center">
          {chats.length} conversation{chats.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}