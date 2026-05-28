import React, { useState } from 'react'
import { ExternalLink, FileText, Download, Loader2, CheckCircle } from 'lucide-react'
import { driveAPI } from '../services/api'

export default function GoogleDrivePicker({ chatId }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem('drive_access_token') || '')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(null)
  const [imported, setImported] = useState([])
  const [error, setError] = useState('')

  const handleAuth = async () => {
    try {
      const response = await driveAPI.getAuthUrl()
      window.open(response.data.auth_url, '_blank', 'width=600,height=700')
    } catch (err) {
      setError('Failed to get auth URL')
    }
  }

  const handleListFiles = async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const response = await driveAPI.listFiles(accessToken)
      setFiles(response.data.files || [])
    } catch (err) {
      setError('Failed to list files. Re-authenticate.')
      setAccessToken('')
      localStorage.removeItem('drive_access_token')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (file) => {
    setImporting(file.id)
    setError('')
    try {
      const response = await driveAPI.importFile({
        file_id: file.id,
        chat_id: chatId || '',
        access_token: accessToken,
      })
      setImported((prev) => [...prev, file.id])
    } catch (err) {
      setError(`Import failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setImporting(null)
    }
  }

  const saveToken = (token) => {
    setAccessToken(token)
    localStorage.setItem('drive_access_token', token)
  }

  return (
    <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Google Drive Import</h3>

      {!accessToken ? (
        <button
          onClick={handleAuth}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <ExternalLink size={16} />
          Connect Google Drive
        </button>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="password"
              value={accessToken}
              onChange={(e) => saveToken(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm"
              placeholder="Access token"
            />
            <button
              onClick={() => { setAccessToken(''); localStorage.removeItem('drive_access_token') }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Clear
            </button>
          </div>
          <button
            onClick={handleListFiles}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            List Drive Files
          </button>

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

          {files.length > 0 && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] rounded-lg text-sm"
                >
                  <FileText size={16} className="text-[var(--text-secondary)] flex-shrink-0" />
                  <span className="flex-1 truncate text-[var(--text-primary)]">{file.name}</span>
                  {imported.includes(file.id) ? (
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <button
                      onClick={() => handleImport(file)}
                      disabled={importing === file.id}
                      className="text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-50"
                    >
                      {importing === file.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
