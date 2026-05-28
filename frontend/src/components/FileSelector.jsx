import React, { useState, useEffect } from 'react'
import { FileText, CheckSquare, Square, Loader2 } from 'lucide-react'
import { fileAPI } from '../services/api'

export default function FileSelector({ selectedFileIds, onSelectionChange }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const response = await fileAPI.list()
      setFiles(response.data.files || [])
    } catch (err) {
      console.error('Failed to load files', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFile = (fileId) => {
    const current = selectedFileIds || []
    const updated = current.includes(fileId)
      ? current.filter((id) => id !== fileId)
      : [...current, fileId]
    if (onSelectionChange) onSelectionChange(updated)
  }

  const indexedFiles = files.filter((f) => f.indexed)

  return (
    <div>
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
      >
        <FileText size={16} />
        Files ({selectedFileIds?.length || 0} selected)
      </button>

      {show && (
        <div className="absolute top-full left-4 mt-1 w-72 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-[var(--border-color)]">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">Select Documents</h4>
          </div>
          {loading ? (
            <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
              <Loader2 size={16} className="animate-spin mx-auto mb-1" />
              Loading files...
            </div>
          ) : indexedFiles.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
              No indexed documents yet. Upload a file first.
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {indexedFiles.map((file) => {
                const isSelected = (selectedFileIds || []).includes(file.id)
                return (
                  <button
                    key={file.id}
                    onClick={() => toggleFile(file.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-[var(--accent)] flex-shrink-0" />
                    ) : (
                      <Square size={16} className="text-[var(--text-secondary)] flex-shrink-0" />
                    )}
                    <span className="text-sm text-[var(--text-primary)] truncate">
                      {file.file_name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
