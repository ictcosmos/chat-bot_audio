import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, Database, HardDrive, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import ChatInput from '../components/ChatInput'
import ChatSidebar from '../components/ChatSidebar'
import ChatWindow from '../components/ChatWindow'
import FileSelector from '../components/FileSelector'
import FileUpload from '../components/FileUpload'
import GoogleDrivePicker from '../components/GoogleDrivePicker'
import { authAPI, chatAPI } from '../services/api'

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
  const [fileRefreshKey, setFileRefreshKey] = useState(0)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true'
    }

    return false
  })

  const activeChatIdRef = useRef(activeChatId)
  const loadedChatRef = useRef(null)
  const creatingChatRef = useRef(false)

  useEffect(() => {
    activeChatIdRef.current = activeChatId

    if (activeChatId) {
      localStorage.setItem('activeChatId', activeChatId)
    } else {
      localStorage.removeItem('activeChatId')
    }
  }, [activeChatId])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  useEffect(() => {
    verifyAuth()
    loadChats()
  }, [])

  useEffect(() => {
    if (!activeChatId) return
    if (loadedChatRef.current === activeChatId) return
    if (creatingChatRef.current) return

    loadChat(activeChatId)
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

      const storedChatId = localStorage.getItem('activeChatId')
      const storedExists = fetchedChats.some((chat) => chat.id === storedChatId)

      if (!activeChatIdRef.current && fetchedChats.length > 0) {
        setActiveChatId(fetchedChats[0].id)
      } else if (storedChatId && !storedExists) {
        localStorage.removeItem('activeChatId')
        setActiveChatId(fetchedChats[0]?.id || null)
      }
    } catch (err) {
      console.error('Failed to load chats:', err)
    }
  }

  const loadChat = async (chatId) => {
    if (!chatId) return

    try {
      const response = await chatAPI.getChat(chatId)

      loadedChatRef.current = chatId
      activeChatIdRef.current = chatId

      setMessages(response.data.messages || [])
      setActiveChatId(chatId)

      if (response.data.chat) {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId ? { ...chat, ...response.data.chat } : chat
          )
        )
      }
    } catch (err) {
      console.error('Failed to load chat:', err)

      if (err.response?.status === 404) {
        loadedChatRef.current = null
        activeChatIdRef.current = null
        setActiveChatId(null)
        setMessages([])
        localStorage.removeItem('activeChatId')
      }
    }
  }

  const ensureChatExists = useCallback(async (title = 'New Chat') => {
    if (activeChatIdRef.current) {
      return activeChatIdRef.current
    }

    if (creatingChatRef.current) {
      return activeChatIdRef.current
    }

    creatingChatRef.current = true

    try {
      const response = await chatAPI.createChat({ title })
      const newChat = response.data.chat

      loadedChatRef.current = newChat.id
      activeChatIdRef.current = newChat.id

      setActiveChatId(newChat.id)
      setMessages([])
      setChats((prev) => {
        if (prev.some((chat) => chat.id === newChat.id)) return prev
        return [newChat, ...prev]
      })

      return newChat.id
    } catch (err) {
      console.error('Failed to create chat:', err)
      return null
    } finally {
      creatingChatRef.current = false
    }
  }, [])

  const handleNewChat = async () => {
    creatingChatRef.current = true

    try {
      const response = await chatAPI.createChat({ title: 'New Chat' })
      const newChat = response.data.chat

      loadedChatRef.current = newChat.id
      activeChatIdRef.current = newChat.id

      setChats((prev) => [newChat, ...prev])
      setActiveChatId(newChat.id)
      setMessages([])
      setSelectedFileIds([])
      setShowFileUpload(false)
      setShowDrivePicker(false)
      setSidebarOpen(false)
    } catch (err) {
      console.error('Failed to create chat:', err)
    } finally {
      creatingChatRef.current = false
    }
  }

  const handleSelectChat = (chatId) => {
    loadedChatRef.current = null
    activeChatIdRef.current = chatId

    setActiveChatId(chatId)
    setSelectedFileIds([])
    setShowFileUpload(false)
    setShowDrivePicker(false)
    setSidebarOpen(false)
  }

  const handleDeleteChat = async (chatId) => {
    const wasActive = activeChatIdRef.current === chatId

    try {
      await chatAPI.deleteChat(chatId)

      setChats((prev) => prev.filter((chat) => chat.id !== chatId))

      if (wasActive) {
        loadedChatRef.current = null
        activeChatIdRef.current = null
        setActiveChatId(null)
        setMessages([])
        setSelectedFileIds([])
        localStorage.removeItem('activeChatId')
      }

      await loadChats()
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  }

  const handleRenameChat = async (chatId, title) => {
    try {
      const response = await chatAPI.updateChat(chatId, { title })
      const updatedChat = response.data.chat || { id: chatId, title }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, ...updatedChat, title } : chat
        )
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

  const handleSend = useCallback(
    async (message) => {
      let chatId = activeChatIdRef.current

      if (!chatId) {
        chatId = await ensureChatExists(message.slice(0, 50) || 'New Chat')
        if (!chatId) return
      }

      loadedChatRef.current = chatId

      const now = Date.now()

      const userMessage = {
        id: `local_user_${now}`,
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

        const returnedChatId = response.data.chat_id || chatId

        if (returnedChatId !== activeChatIdRef.current) {
          activeChatIdRef.current = returnedChatId
          setActiveChatId(returnedChatId)
        }

        loadedChatRef.current = returnedChatId

        if (response.data.chat) {
          setChats((prev) => {
            const exists = prev.some((chat) => chat.id === response.data.chat.id)

            if (exists) {
              return prev.map((chat) =>
                chat.id === response.data.chat.id
                  ? { ...chat, ...response.data.chat }
                  : chat
              )
            }

            return [response.data.chat, ...prev]
          })
        }

        const assistantMessage = {
          id: `local_assistant_${now + 1}`,
          role: 'assistant',
          content: response.data.answer || '',
          sources: response.data.sources || [],
          token_usage: response.data.token_usage || {},
          trace: response.data.trace || {},
        }

        setMessages((prev) => [...prev, assistantMessage])

        await loadChats()

        try {
          const saved = await chatAPI.getChat(returnedChatId)
          setMessages(saved.data.messages || [])
          loadedChatRef.current = returnedChatId

          if (saved.data.chat) {
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === returnedChatId ? { ...chat, ...saved.data.chat } : chat
              )
            )
          }
        } catch (historyErr) {
          console.warn('Could not refresh saved messages:', historyErr)
        }
      } catch (err) {
        console.error('Chat failed:', err)

        const backendDetail = err.response?.data?.detail
        const backendMessage = err.response?.data?.message
        const statusCode = err.response?.status

        let errorText = 'Sorry, something went wrong. Please try again.'

        if (typeof backendDetail === 'string') {
          errorText = backendDetail
        } else if (backendDetail) {
          errorText = JSON.stringify(backendDetail, null, 2)
        } else if (backendMessage) {
          errorText = backendMessage
        } else if (err.message) {
          errorText = err.message
        }

        if (statusCode) {
          errorText = `Error ${statusCode}: ${errorText}`
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `local_error_${Date.now()}`,
            role: 'assistant',
            content: errorText,
            isError: true,
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [ensureChatExists, selectedFileIds]
  )

  const handleFileUpload = (uploadedFile) => {
    setFileRefreshKey((prev) => prev + 1)

    const fileId = uploadedFile?.file_id || uploadedFile?.id

    if (uploadedFile?.indexed && fileId) {
      setSelectedFileIds((prev) => [...new Set([...prev, fileId])])
    }
  }

  const handleDriveImported = (importedFile) => {
    setFileRefreshKey((prev) => prev + 1)

    const fileId = importedFile?.file_id || importedFile?.id

    if (fileId) {
      setSelectedFileIds((prev) => [...new Set([...prev, fileId])])
    }
  }

  const activeChatTitle =
    chats.find((chat) => chat.id === activeChatId)?.title || 'New Chat'

  const attachmentPanelOpen = showFileUpload || showDrivePicker

  return (
    <div className="h-screen flex bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-out md:static md:z-auto md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onSearch={handleSearch}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode((prev) => !prev)}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {activeChatTitle}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              Ask normally, use current search, or attach documents for RAG.
            </p>
          </div>

          {selectedFileIds.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium whitespace-nowrap">
              <FileText size={12} />
              {selectedFileIds.length} doc{selectedFileIds.length > 1 ? 's' : ''}
            </span>
          )}
        </header>

        <ChatWindow messages={messages} isLoading={isLoading} />

        {/* Composer area */}
        <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 sm:px-4 py-3">
          <div className="mx-auto w-full max-w-3xl">
            {/* Attachment panel */}
            <div
              className={`grid transition-all duration-300 ease-out ${attachmentPanelOpen
                  ? 'grid-rows-[1fr] opacity-100 mb-3'
                  : 'grid-rows-[0fr] opacity-0'
                }`}
            >
              <div className="overflow-hidden">
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Attach documents
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Upload local files or import from Drive, then select them for document chat.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowFileUpload(false)
                        setShowDrivePicker(false)
                      }}
                      className="p-2 -mt-1 -mr-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      title="Close attachment panel"
                      aria-label="Close attachment panel"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFileUpload(true)
                        setShowDrivePicker(false)
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${showFileUpload
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      <HardDrive size={16} />
                      Local Upload
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowDrivePicker(true)
                        setShowFileUpload(false)
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${showDrivePicker
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      <Database size={16} />
                      Google Drive
                    </button>
                  </div>

                  {showFileUpload && (
                    <FileUpload
                      chatId={activeChatId}
                      ensureChat={ensureChatExists}
                      onFileUploaded={handleFileUpload}
                    />
                  )}

                  {showDrivePicker && (
                    <GoogleDrivePicker
                      chatId={activeChatId}
                      onFileImported={handleDriveImported}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Quick actions row */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowFileUpload((prev) => !prev)
                  setShowDrivePicker(false)
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${showFileUpload
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                <Upload size={16} />
                Attach
              </button>

              <FileSelector
                selectedFileIds={selectedFileIds}
                onSelectionChange={setSelectedFileIds}
                refreshKey={fileRefreshKey}
              />

              {selectedFileIds.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium">
                  <FileText size={12} />
                  {selectedFileIds.length} document{selectedFileIds.length > 1 ? 's' : ''} selected
                </span>
              )}

              {selectedFileIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFileIds([])}
                  className="text-xs px-2.5 py-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  Clear
                </button>
              )}
            </div>

            <ChatInput
              onSend={handleSend}
              onFileClick={() => {
                setShowFileUpload((prev) => !prev)
                setShowDrivePicker(false)
              }}
              onVoiceClick={() => navigate('/voice')}
              disabled={isLoading}
            />
          </div>
        </div>
      </main>
    </div>
  )
}