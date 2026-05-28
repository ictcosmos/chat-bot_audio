import React from 'react'
import ReactMarkdown from 'react-markdown'
import { FileText, Info, BarChart3, Activity } from 'lucide-react'

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const sources = message.sources || []
  const tokenUsage = message.token_usage || {}
  const trace = message.trace || {}

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 message-animate`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[var(--user-bubble)] text-white rounded-br-md'
              : 'bg-[var(--assistant-bubble)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-color)]'
          }`}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content || ''}</ReactMarkdown>
          </div>
        </div>

        {!isUser && (sources.length > 0 || tokenUsage.total_tokens || trace.route) && (
          <div className="mt-2 space-y-1.5">
            {sources.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                <FileText size={12} className="mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Sources:</span>
                  {sources.map((s, i) => (
                    <span key={i} className="ml-1">
                      {s.file_name}, page {s.page_start}{i < sources.length - 1 ? ';' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tokenUsage.total_tokens !== undefined && tokenUsage.total_tokens !== null && (
              <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                <BarChart3 size={12} className="mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Token Usage:</span>
                  <span className="ml-1">
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
                  <span className="font-medium">Trace:</span>
                  <span className="ml-1">
                    Route: {trace.route} | Provider: {trace.provider} | Model: {trace.model || 'N/A'}
                    {trace.tools_used && ` | Tools: ${trace.tools_used.join(', ')}`}
                    {trace.top_similarity_score !== undefined && ` | Top Score: ${trace.top_similarity_score}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
