import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ChatSidebar from '../components/ChatSidebar'
import ChatWindow from '../components/ChatWindow'
import ChatInput from '../components/ChatInput'
import FileUpload from '../components/FileUpload'
import GoogleDrivePicker from '../components/GoogleDrivePicker'
import FileSelector from '../components/FileSelector'
import { chatAPI, authAPI } from '../services/api'

export default function Chat({ user }) {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(
    () => localStorage.getItem('activeChatId') || null
  )
  const [messages, setMessages] = useState([])
  const [selectedFileIds, setSelectedFileIds] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showDrivePicker, setShowDrivePicker] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true'
    }
    return false
  })
  const loadedChatRef = useRef(null)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  useEffect(() => {
    loadChats()
    verifyAuth()
  }, [])

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('activeChatId', activeChatId)
    } else {
      localStorage.removeItem('activeChatId')
    }
  }, [activeChatId])

  useEffect(() => {
    if (activeChatId && loadedChatRef.current !== activeChatId) {
      loadChat(activeChatId)
    }
  }, [activeChatId])

  const verifyAuth = async () => {
    try {
      await authAPI.verify()
    } catch (err) {
      console.error('Auth verification failed:', err)
    }
  }

  const loadChats = async () => {
    try {
      const response = await chatAPI.listChats()
      const fetchedChats = response.data.chats || []
      setChats(fetchedChats)

      if (!activeChatId && fetchedChats.length > 0) {
        setActiveChatId(fetchedChats[0].id)
      }
    } catch (err) {
      console.error('Failed to load chats:', err)
    }
  }

  const loadChat = async (chatId) => {
    loadedChatRef.current = chatId
    try {
      const response = await chatAPI.getChat(chatId)
      setMessages(response.data.messages || [])
      setActiveChatId(chatId)
    } catch (err) {
      console.error('Failed to load chat:', err)
      if (err.response?.status === 404) {
        setActiveChatId(null)
        setMessages([])
        localStorage.removeItem('activeChatId')
      }
    }
  }

  const handleNewChat = async () => {
    try {
      const response = await chatAPI.createChat({ title: 'New Chat' })
      setChats((prev) => [response.data.chat, ...prev])
      setActiveChatId(response.data.chat.id)
      setMessages([])
    } catch (err) {
      console.error('Failed to create chat:', err)
    }
  }

  const handleSelectChat = (chatId) => {
    loadedChatRef.current = null
    setActiveChatId(chatId)
  }

  const handleDeleteChat = async (chatId) => {
    const wasActive = activeChatId === chatId
    try {
      await chatAPI.deleteChat(chatId)
      setChats((prev) => prev.filter((c) => c.id !== chatId))
      if (wasActive) {
        setActiveChatId(null)
        setMessages([])
        localStorage.removeItem('activeChatId')
        loadChats()
      }
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  }

  const handleRenameChat = async (chatId, title) => {
    try {
      await chatAPI.updateChat(chatId, { title })
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title } : c))
      )
    } catch (err) {
      console.error('Failed to rename chat:', err)
    }
  }

  const handleSearch = async (query) => {
    try {
      const response = await chatAPI.searchChats(query)
      setChats(response.data.chats || [])
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  const handleSend = useCallback(async (message) => {
    let chatId = activeChatId

    if (!chatId) {
      try {
        const response = await chatAPI.createChat({ title: message.slice(0, 50) })
        chatId = response.data.chat.id
        setActiveChatId(chatId)
        setChats((prev) => [response.data.chat, ...prev])
      } catch (err) {
        console.error('Failed to create chat:', err)
        return
      }
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await chatAPI.send({
        chat_id: chatId,
        message,
        mode: 'auto',
        selected_file_ids: selectedFileIds,
      })

      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources || [],
        token_usage: response.data.token_usage || {},
        trace: response.data.trace || {},
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat failed:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
      loadChats()
    }
  }, [activeChatId, selectedFileIds])

  const handleFileUpload = () => {
    setShowFileUpload(false)
  }

  return (
    <div className="h-screen flex">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onSearch={handleSearch}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
      />

      <div className="flex-1 flex flex-col">
        {showFileUpload && (
          <FileUpload onFileUploaded={handleFileUpload} chatId={activeChatId} />
        )}

        {showDrivePicker && (
          <GoogleDrivePicker chatId={activeChatId} />
        )}

        <ChatWindow messages={messages} isLoading={isLoading} />

        <div className="flex items-center gap-2 px-4 py-1">
          <FileSelector
            selectedFileIds={selectedFileIds}
            onSelectionChange={setSelectedFileIds}
          />
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              showFileUpload
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {showFileUpload ? 'Close' : 'Upload'}
          </button>
          <button
            onClick={() => setShowDrivePicker(!showDrivePicker)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              showDrivePicker
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {showDrivePicker ? 'Close' : 'Drive'}
          </button>
        </div>

        <ChatInput
          onSend={handleSend}
          onFileClick={() => setShowFileUpload(!showFileUpload)}
          onVoiceClick={() => navigate('/voice')}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}
