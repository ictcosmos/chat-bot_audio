import React, { useEffect, useState } from 'react'
import {
  FileText,
  CheckSquare,
  Square,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { fileAPI } from '../services/api'

export default function FileSelector({
  selectedFileIds = [],
  onSelectionChange,
  refreshKey = 0,
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const loadFiles = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fileAPI.list()
      setFiles(response.data.files || [])
    } catch (err) {
      console.error('Failed to load files', err)
      setError(err.response?.data?.detail || 'Failed to load files.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [refreshKey])

  const toggleFile = (fileId) => {
    const current = selectedFileIds || []

    const updated = current.includes(fileId)
      ? current.filter((id) => id !== fileId)
      : [...current, fileId]

    if (typeof onSelectionChange === 'function') {
      onSelectionChange(updated)
    }
  }

  const indexedFiles = files.filter((file) => file.indexed)
  const failedFiles = files.filter((file) => !file.indexed)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
      >
        <FileText size={16} />
        Files ({selectedFileIds?.length || 0} selected)
      </button>

      {show && (
        <div className="absolute bottom-full mb-2 left-0 z-30 w-80 max-h-96 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
              Select Documents
            </h4>

            <button
              type="button"
              onClick={loadFiles}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
              title="Refresh files"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-3">
              <Loader2 size={16} className="animate-spin" />
              Loading files...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : indexedFiles.length === 0 ? (
            <div className="text-sm text-[var(--text-secondary)] py-3">
              No indexed documents yet. Upload a file first.
            </div>
          ) : (
            <div className="space-y-1">
              {indexedFiles.map((file) => {
                const isSelected = selectedFileIds.includes(file.id)

                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => toggleFile(file.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                  >
                    {isSelected ? (
                      <CheckSquare
                        size={16}
                        className="text-[var(--accent)] flex-shrink-0"
                      />
                    ) : (
                      <Square
                        size={16}
                        className="text-[var(--text-secondary)] flex-shrink-0"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-[var(--text-primary)]">
                        {file.file_name}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {file.file_type || 'file'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {failedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
              <p className="text-xs font-semibold text-red-500 mb-2">
                Files uploaded but not indexed
              </p>

              <div className="space-y-1">
                {failedFiles.slice(0, 5).map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-xs text-red-500"
                  >
                    <AlertCircle size={14} />
                    <span className="truncate">{file.file_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}