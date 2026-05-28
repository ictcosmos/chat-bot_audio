import React, { useState } from 'react'
import { MessageSquare, Plus, Search, Trash2, Edit2, Check, X, LogOut, Sun, Moon } from 'lucide-react'
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
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

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
      <div className="p-3 flex items-center justify-between border-b border-[var(--border-color)]">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">ChatBot</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium text-sm"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
              chat.id === activeChatId
                ? 'bg-[var(--accent)] bg-opacity-10 text-[var(--accent)]'
                : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            <MessageSquare size={16} className="flex-shrink-0 text-[var(--text-secondary)]" />
            {editingId === chat.id ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-0.5 text-sm focus:outline-none"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(chat.id)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                <button onClick={(e) => { e.stopPropagation(); saveEdit(chat.id) }} className="p-1 hover:text-green-500">
                  <Check size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); cancelEdit() }} className="p-1 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 truncate text-sm">{chat.title}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(chat) }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id) }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 text-[var(--text-secondary)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
