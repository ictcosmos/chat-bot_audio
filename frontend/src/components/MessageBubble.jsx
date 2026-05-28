import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  FileText,
  BarChart3,
  Activity,
  ChevronDown,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react'

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isError = Boolean(message.isError)
  const sources = message.sources || []
  const tokenUsage = message.token_usage || {}
  const trace = message.trace || {}

  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasMeta =
    sources.length > 0 ||
    tokenUsage.total_tokens !== undefined ||
    Boolean(trace.route)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5 message-animate`}
    >
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[80%]`}>
        {/* Bubble */}
        <div
          className={`group relative rounded-2xl px-4 py-3 break-words ${isUser
              ? 'bg-[var(--user-bubble)] text-white rounded-br-md'
              : isError
                ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-bl-md'
                : 'bg-[var(--assistant-bubble)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-color)]'
            }`}
        >
          {isError && (
            <div className="flex items-center gap-1.5 mb-1 text-xs font-medium">
              <AlertCircle size={13} />
              Error
            </div>
          )}

          <div
            className={`prose prose-sm max-w-none break-words ${isUser
                ? 'prose-invert prose-p:text-white prose-headings:text-white prose-strong:text-white prose-a:text-white prose-code:text-white'
                : 'dark:prose-invert'
              } prose-pre:bg-black/80 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none prose-p:my-1.5 prose-headings:my-2`}
          >
            <ReactMarkdown>{message.content || ''}</ReactMarkdown>
          </div>

          {/* Copy button for assistant (non-error) messages */}
          {!isUser && !isError && message.content && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:opacity-100"
              title={copied ? 'Copied' : 'Copy message'}
              aria-label="Copy message"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            </button>
          )}
        </div>

        {/* Meta: sources + collapsible details */}
        {!isUser && !isError && (sources.length > 0 || hasMeta) && (
          <div className="mt-2 w-full space-y-2">
            {/* Sources shown inline (always visible) */}
            {sources.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                <FileText size={12} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
                <div className="flex flex-wrap gap-1">
                  <span className="font-medium">Sources:</span>
                  {sources.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5"
                    >
                      {s.file_name}
                      {s.page_start !== undefined && s.page_start !== null
                        ? `, p.${s.page_start}`
                        : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible token usage + trace */}
            {(tokenUsage.total_tokens !== undefined || trace.route) && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
                  aria-expanded={showDetails}
                >
                  <Activity size={12} />
                  Details
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  />
                </button>

                {showDetails && (
                  <div className="mt-1.5 space-y-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2.5">
                    {tokenUsage.total_tokens !== undefined &&
                      tokenUsage.total_tokens !== null && (
                        <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                          <BarChart3 size={12} className="mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Token Usage: </span>
                            <span>
                              Input: {tokenUsage.input_tokens?.toLocaleString() || 'N/A'} |
                              Output: {tokenUsage.output_tokens?.toLocaleString() || 'N/A'} |
                              Total: {tokenUsage.total_tokens?.toLocaleString() || 'N/A'}
                              {tokenUsage.provider && ` | ${tokenUsage.provider}`}
                              {tokenUsage.model && ` | ${tokenUsage.model}`}
                            </span>
                          </div>
                        </div>
                      )}

                    {trace.route && (
                      <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                        <Activity size={12} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Trace: </span>
                          <span>
                            Route: {trace.route} | Provider: {trace.provider} | Model:{' '}
                            {trace.model || 'N/A'}
                            {trace.tools_used &&
                              ` | Tools: ${trace.tools_used.join(', ')}`}
                            {trace.top_similarity_score !== undefined &&
                              ` | Top Score: ${trace.top_similarity_score}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}