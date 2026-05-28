import React, { useState, useRef } from 'react'
import { Upload, X, FileText, CheckCircle, Loader2 } from 'lucide-react'
import { fileAPI } from '../services/api'

export default function FileUpload({ onFileUploaded, chatId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploading(true)
    setError('')

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chat_id', chatId)

      try {
        const response = await fileAPI.upload(formData)
        setUploadedFiles((prev) => [...prev, response.data])
        if (onFileUploaded) onFileUploaded(response.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Upload failed')
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getFileIcon = (type) => {
    return <FileText size={20} />
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
      >
        <Upload size={16} />
        Upload Files
      </button>
    )
  }

  return (
    <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Upload Documents</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--accent)] transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-[var(--text-secondary)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          PDF, DOCX, TXT, MD, CSV, XLSX (max 20MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.xlsx"
        />
      </div>

      {uploading && (
        <div className="flex items-center gap-2 mt-3 text-sm text-[var(--text-secondary)]">
          <Loader2 size={16} className="animate-spin" />
          Uploading...
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              {getFileIcon(file.file_type)}
              <span className="flex-1 truncate">{file.file_name}</span>
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-xs text-[var(--text-secondary)]">
                {file.pages}p / {file.chunks}c
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
