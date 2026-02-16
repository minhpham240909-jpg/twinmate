'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/browser'
import type { Lead } from '@/types/lead'

interface LeadsClientProps {
  userId: string
  initialLeads: Lead[]
  initialTotal: number
  initialTotalPages: number
  initialConnections: { slack: boolean; email: boolean }
}

export default function LeadsClient({
  userId,
  initialLeads,
  initialTotal,
  initialTotalPages,
  initialConnections,
}: LeadsClientProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [sourceFilter, setSourceFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [sendingReply, setSendingReply] = useState(false)
  const [sendReplyError, setSendReplyError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [replyUsage, setReplyUsage] = useState<{ used: number; limit: number } | null>(null)
  const [connections, setConnections] = useState(initialConnections)
  const [replyCopied, setReplyCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'selected' | 'all' | null>(null)
  const pageRef = useRef(page)
  const sourceFilterRef = useRef(sourceFilter)
  const labelFilterRef = useRef(labelFilter)

  // Keep refs in sync so the realtime callback reads current values
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { sourceFilterRef.current = sourceFilter }, [sourceFilter])
  useEffect(() => { labelFilterRef.current = labelFilter }, [labelFilter])

  const fetchLeads = useCallback(async (p: number, source: string, label: string) => {
    try {
      const params = new URLSearchParams({ page: p.toString() })
      if (source) params.set('source', source)
      if (label) params.set('label', label)

      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setLeads(data.leads ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
      if (data.connections) setConnections(data.connections)
    } catch {
      // Keep current state on failure
    }
  }, [])

  // Realtime subscription — new leads and updates appear instantly
  useEffect(() => {
    const supabase = createClient()
    let insertDebounceTimer: ReturnType<typeof setTimeout> | null = null
    let deleteDebounceTimer: ReturnType<typeof setTimeout> | null = null

    const debouncedRefetch = (timerRef: 'insert' | 'delete') => {
      if (timerRef === 'insert') {
        if (insertDebounceTimer) clearTimeout(insertDebounceTimer)
        insertDebounceTimer = setTimeout(() => {
          fetchLeads(pageRef.current, sourceFilterRef.current, labelFilterRef.current)
          insertDebounceTimer = null
        }, 300)
      } else {
        if (deleteDebounceTimer) clearTimeout(deleteDebounceTimer)
        deleteDebounceTimer = setTimeout(() => {
          fetchLeads(pageRef.current, sourceFilterRef.current, labelFilterRef.current)
          deleteDebounceTimer = null
        }, 300)
      }
    }

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedRefetch('insert')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Lead
          // Update the lead in the list without a full re-fetch
          setLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? updated : l))
          )
          // Also update the selected lead if it's open
          setSelectedLead((prev) =>
            prev && prev.id === updated.id ? updated : prev
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          debouncedRefetch('delete')
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[realtime] Channel error — will auto-reconnect')
        }
      })

    return () => {
      if (insertDebounceTimer) clearTimeout(insertDebounceTimer)
      if (deleteDebounceTimer) clearTimeout(deleteDebounceTimer)
      supabase.removeChannel(channel)
    }
  }, [userId, fetchLeads])

  function handleSourceFilter(value: string) {
    setSourceFilter(value)
    setPage(1)
    setSelectedIds(new Set())
    fetchLeads(1, value, labelFilter)
  }

  function handleLabelFilter(value: string) {
    setLabelFilter(value)
    setPage(1)
    setSelectedIds(new Set())
    fetchLeads(1, sourceFilter, value)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    setSelectedIds(new Set())
    fetchLeads(newPage, sourceFilter, labelFilter)
  }

  async function submitFeedback(leadId: string, feedback: 'positive' | 'negative') {
    try {
      const res = await fetch(`/api/leads/${leadId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
      if (!res.ok) return
      fetchLeads(page, sourceFilter, labelFilter)
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) =>
          prev ? { ...prev, feedback, feedback_at: new Date().toISOString() } : null
        )
      }
    } catch {
      // Silently fail — user can retry
    }
  }

  async function sendReply(leadId: string) {
    setSendingReply(true)
    setSendReplyError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/send-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.upgrade_required) {
          setReplyUsage(data.usage || null)
          setShowUpgradeModal(true)
        } else {
          setSendReplyError(data.error || 'Failed to send reply')
        }
        return
      }
      fetchLeads(page, sourceFilter, labelFilter)
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) =>
          prev ? { ...prev, reply_sent: true, reply_sent_at: data.reply_sent_at } : null
        )
      }
    } catch {
      setSendReplyError('Failed to send reply. Please try again.')
    } finally {
      setSendingReply(false)
    }
  }

  function toggleSelectLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)))
    }
  }

  async function deleteLeads(ids: string[]) {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) {
        setDeleteError('Failed to delete leads. Please try again.')
        return
      }
      // Close modal if deleted lead was open
      if (selectedLead && ids.includes(selectedLead.id)) {
        setSelectedLead(null)
      }
      setSelectedIds(new Set())
      const newPage = ids.length >= leads.length && page > 1 ? page - 1 : page
      setPage(newPage)
      fetchLeads(newPage, sourceFilter, labelFilter)
    } catch {
      setDeleteError('Failed to delete leads. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    }
  }

  async function deleteAllLeads() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          all: true,
          ...(sourceFilter && { source: sourceFilter }),
          ...(labelFilter && { label: labelFilter }),
        }),
      })
      if (!res.ok) {
        setDeleteError('Failed to delete leads. Please try again.')
        return
      }
      setSelectedLead(null)
      setSelectedIds(new Set())
      setPage(1)
      fetchLeads(1, sourceFilter, labelFilter)
    } catch {
      setDeleteError('Failed to delete leads. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    }
  }

  function intentBadge(label: string | null) {
    if (label === 'high')
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          HIGH
        </span>
      )
    if (label === 'medium')
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          MEDIUM
        </span>
      )
    if (label === 'low')
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          LOW
        </span>
      )
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400">
        —
      </span>
    )
  }

  return (
    <div>
      {deleteError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-md p-2.5 mb-3">
          {deleteError}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {leads.length > 0 && (
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={leads.length > 0 && selectedIds.size === leads.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
          )}
          <h1 className="text-lg font-semibold text-gray-900">
            Leads{' '}
            <span className="text-gray-400 font-normal text-sm">({total})</span>
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          {selectedIds.size > 0 && (
            <button
              onClick={() => { setDeleteTarget('selected'); setShowDeleteConfirm(true) }}
              disabled={deleting}
              className="text-sm px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50"
            >
              Delete {selectedIds.size} selected
            </button>
          )}
          {total > 0 && (
            <button
              onClick={() => { setDeleteTarget('all'); setShowDeleteConfirm(true) }}
              disabled={deleting}
              className="text-sm px-3 py-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            >
              Clear all
            </button>
          )}
          <select
            value={sourceFilter}
            onChange={(e) => handleSourceFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value="">All sources</option>
            <option value="slack">Slack</option>
            <option value="email">Email</option>
          </select>
          <select
            value={labelFilter}
            onChange={(e) => handleLabelFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value="">All scores</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {leads.length === 0 ? (
        connections.slack || connections.email ? (
          /* Connected but no leads yet — professional waiting state */
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              You&apos;re all set
            </h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
              Adecis is listening{connections.slack && connections.email ? ' on Slack and email' : connections.slack ? ' on Slack' : ' on email'}.
              New leads will appear here as soon as they come in.
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
              {connections.slack && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Slack connected
                </span>
              )}
              {connections.email && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Email configured
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Not connected — tutorial with mock card */
          <div className="py-8">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                We&apos;ll triage your inbound messages in real time.
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                When a Slack or email message comes in, Adecis scores buying
                intent and tells you what to do next — in seconds.
              </p>
            </div>

            {/* Mock lead card showing what it looks like */}
            <div className="bg-white rounded-lg shadow-sm border max-w-xl mx-auto opacity-75">
              <div className="px-4 py-3 border-b border-dashed border-gray-200">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 text-center">
                  Example — here&apos;s what a scored lead looks like
                </p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      HIGH
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                      $2-10k
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      Sarah from Maple Bakery
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Slack</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-orange-500 mb-1.5">
                  <span>{'\u26A1'}</span>
                  <span>Respond today</span>
                  <span className="font-normal text-gray-400">— High close probability, budget and timeline confirmed</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-0.5 mb-2">
                  <li className="flex items-start gap-1.5"><span className="text-blue-400">{'\u{1F4B0}'}</span> Budget confirmed: $3-5k</li>
                  <li className="flex items-start gap-1.5"><span className="text-blue-400">{'\u{23F3}'}</span> Timeline: launch by March</li>
                  <li className="flex items-start gap-1.5"><span className="text-blue-400">{'\u{1F50D}'}</span> Full website redesign needed</li>
                </ul>
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">Budget confirmed</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">Timeline defined</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">91% confidence</span>
                </div>
                <div className="bg-gray-50 rounded-md p-2 text-sm text-gray-500 italic">
                  &quot;Hi Sarah — a redesign makes sense if your current site
                  is from 2019. I&apos;ve done similar projects for local businesses
                  and your budget works well for what you need...&quot;
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3 mt-6">
              <a
                href="/dashboard/settings"
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Connect Slack or Email
              </a>
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">
              Go to Settings to connect Slack or set up email forwarding.
            </p>
          </div>
        )
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            Showing messages that need your attention.
          </p>
          <div className="space-y-2">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-start gap-2">
                <label
                  className="flex items-center pt-3.5 pl-1 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleSelectLead(lead.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <button
                  onClick={() => { setSendReplyError(null); setReplyCopied(false); setSelectedLead(lead) }}
                  className={`flex-1 text-left bg-white rounded-lg shadow-sm border px-4 py-3 hover:bg-gray-50 transition-colors ${
                    lead.intent_label === 'high'
                      ? 'border-l-4 border-l-green-500'
                      : lead.intent_label === 'medium'
                        ? 'border-l-4 border-l-yellow-400'
                        : lead.intent_label === 'low'
                          ? 'border-l-4 border-l-gray-200'
                          : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {intentBadge(lead.intent_label)}
                      {lead.deal_tier && lead.deal_tier !== 'unknown' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium uppercase">
                          {lead.deal_tier === 'enterprise' ? '$50k+' : lead.deal_tier === 'mid-high' ? '$10-50k' : lead.deal_tier === 'mid' ? '$2-10k' : '<$2k'}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {lead.sender_name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">
                        {lead.source === 'slack' ? 'Slack' : 'Email'}
                      </span>
                      <span className="text-xs text-gray-300">
                        {lead.created_at?.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                  {lead.response_priority && lead.response_priority !== 'no_rush' && (
                    <div className={`flex items-center gap-1.5 mt-1 text-[11px] font-medium ${
                      lead.response_priority === 'urgent'
                        ? 'text-red-600'
                        : lead.response_priority === 'same_day'
                          ? 'text-orange-500'
                          : 'text-blue-400'
                    }`}>
                      <span>{lead.response_priority === 'urgent' ? '\u{1F525}' : lead.response_priority === 'same_day' ? '\u26A1' : '\u{1F4C5}'}</span>
                      <span>
                        {lead.response_priority === 'urgent'
                          ? 'Respond within 2 hours'
                          : lead.response_priority === 'same_day'
                            ? 'Respond today'
                            : 'Respond this week'}
                      </span>
                      {lead.priority_reason && (
                        <span className="font-normal text-gray-400">— {lead.priority_reason}</span>
                      )}
                    </div>
                  )}
                  {lead.summary_bullets && lead.summary_bullets.length > 0 && (
                    <ul className="text-xs text-gray-500 space-y-0.5 mt-1">
                      {lead.summary_bullets.map((b, i) => (
                        <li key={i}>• {b}</li>
                      ))}
                    </ul>
                  )}
                  {!lead.summary_bullets?.length && lead.raw_message && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {lead.raw_message.substring(0, 100)}
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1 border rounded-md disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500 px-2 py-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="text-sm px-3 py-1 border rounded-md disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Lead from {selectedLead.sender_name || 'Unknown'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedIds(new Set([selectedLead.id]))
                    setDeleteTarget('selected')
                    setShowDeleteConfirm(true)
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete this lead"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 mb-3">
              {intentBadge(selectedLead.intent_label)}
              {selectedLead.intent_score != null && (
                <span className="text-sm text-gray-500">
                  Score: {Math.round(selectedLead.intent_score * 100)}/100
                </span>
              )}
              {selectedLead.confidence != null && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {selectedLead.confidence}% confidence
                </span>
              )}
              {selectedLead.deal_tier && selectedLead.deal_tier !== 'unknown' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                  {selectedLead.deal_tier === 'enterprise' ? '$50k+' : selectedLead.deal_tier === 'mid-high' ? '$10-50k' : selectedLead.deal_tier === 'mid' ? '$2-10k' : '<$2k'}
                </span>
              )}
              <span className="text-xs text-gray-400">
                via {selectedLead.source}
              </span>
            </div>

            {selectedLead.response_priority && (
              <div className={`mb-4 rounded-md px-3 py-2.5 ${
                selectedLead.response_priority === 'urgent'
                  ? 'bg-red-50 border border-red-100'
                  : selectedLead.response_priority === 'same_day'
                    ? 'bg-orange-50 border border-orange-100'
                    : selectedLead.response_priority === 'this_week'
                      ? 'bg-blue-50 border border-blue-100'
                      : 'bg-gray-50 border border-gray-100'
              }`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${
                  selectedLead.response_priority === 'urgent'
                    ? 'text-red-700'
                    : selectedLead.response_priority === 'same_day'
                      ? 'text-orange-600'
                      : selectedLead.response_priority === 'this_week'
                        ? 'text-blue-600'
                        : 'text-gray-500'
                }`}>
                  <span>{selectedLead.response_priority === 'urgent' ? '\u{1F525}' : selectedLead.response_priority === 'same_day' ? '\u26A1' : selectedLead.response_priority === 'this_week' ? '\u{1F4C5}' : '\u{1F44D}'}</span>
                  <span>
                    {selectedLead.response_priority === 'urgent'
                      ? 'Respond within 2 hours'
                      : selectedLead.response_priority === 'same_day'
                        ? 'Respond within 12 hours'
                        : selectedLead.response_priority === 'this_week'
                          ? 'Respond this week'
                          : 'No rush'}
                  </span>
                </div>
                {selectedLead.priority_reason && (
                  <p className={`text-xs mt-1 ${
                    selectedLead.response_priority === 'urgent'
                      ? 'text-red-500'
                      : selectedLead.response_priority === 'same_day'
                        ? 'text-orange-400'
                        : selectedLead.response_priority === 'this_week'
                          ? 'text-blue-400'
                          : 'text-gray-400'
                  }`}>
                    {selectedLead.priority_reason}
                  </p>
                )}
              </div>
            )}

            {selectedLead.scoring_reasons && selectedLead.scoring_reasons.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase mb-1.5">
                  Why this score
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.scoring_reasons.map((reason, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-100"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedLead.summary_bullets && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">
                  Signals Detected
                </h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedLead.summary_bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5">
                        {b.toLowerCase().includes('budget') ? '\u{1F4B0}' : b.toLowerCase().includes('timeline') || b.toLowerCase().includes('deadline') ? '\u{23F3}' : b.toLowerCase().includes('decision') || b.toLowerCase().includes('ceo') || b.toLowerCase().includes('head') || b.toLowerCase().includes('cto') || b.toLowerCase().includes('founder') ? '\u{1F9D1}\u200D\u{1F4BC}' : b.toLowerCase().includes('competi') || b.toLowerCase().includes('agencies') || b.toLowerCase().includes('evaluating') ? '\u26A0\uFE0F' : b.toLowerCase().includes('call') || b.toLowerCase().includes('meeting') || b.toLowerCase().includes('urgency') || b.toLowerCase().includes('asap') ? '\u{1F4C5}' : '\u{1F50D}'}
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedLead.suggested_reply && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">
                  Suggested Reply
                </h3>
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700">
                  {selectedLead.suggested_reply}
                </div>
                {sendReplyError && (
                  <p className="text-xs text-red-500 mt-1">{sendReplyError}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {!selectedLead.reply_sent &&
                    ((selectedLead.source === 'slack' && selectedLead.slack_thread_ts) ||
                      selectedLead.source === 'email') && (
                      <button
                        onClick={() => sendReply(selectedLead.id)}
                        disabled={sendingReply}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {sendingReply ? 'Sending...' : `Send Reply via ${selectedLead.source === 'slack' ? 'Slack' : 'Email'}`}
                      </button>
                    )}
                  {selectedLead.reply_sent && (
                    <span className="text-xs text-green-600">
                      Reply sent via {selectedLead.source === 'slack' ? 'Slack' : 'email'}
                      {selectedLead.reply_sent_at && (
                        <span className="text-gray-400 ml-1">
                          {selectedLead.reply_sent_at.slice(0, 16).replace('T', ' ')}
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selectedLead.suggested_reply || ''
                      )
                      setReplyCopied(true)
                      setTimeout(() => setReplyCopied(false), 2000)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {replyCopied ? 'Copied!' : 'Copy reply'}
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">
                Original Message
              </h3>
              <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-600 whitespace-pre-wrap">
                {selectedLead.raw_message}
              </div>
            </div>

            {!selectedLead.feedback && (
              <div className="flex gap-2">
                <button
                  onClick={() => submitFeedback(selectedLead.id, 'positive')}
                  className="text-sm px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100"
                >
                  Helpful
                </button>
                <button
                  onClick={() => submitFeedback(selectedLead.id, 'negative')}
                  className="text-sm px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Not helpful
                </button>
              </div>
            )}
            {selectedLead.feedback && (
              <p className="text-xs text-gray-400">
                Feedback: {selectedLead.feedback === 'positive' ? 'Helpful' : 'Not helpful'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4"
          onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-gray-900 text-lg mb-2">
              {deleteTarget === 'all'
                ? 'Delete all leads?'
                : `Delete ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''}?`}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This cannot be undone.{' '}
              {deleteTarget === 'all'
                ? `All ${total} lead${total !== 1 ? 's' : ''}${sourceFilter || labelFilter ? ' matching your current filters' : ''} will be permanently removed.`
                : `${selectedIds.size} selected lead${selectedIds.size !== 1 ? 's' : ''} will be permanently removed.`}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
                className="text-sm px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteTarget === 'all') deleteAllLeads()
                  else deleteLeads(Array.from(selectedIds))
                }}
                disabled={deleting}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-gray-900 text-lg mb-2">
              Reply limit reached
            </h2>
            <p className="text-sm text-gray-600 mb-1">
              You&apos;ve used all {replyUsage?.limit || 5} free replies this month.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Upgrade to Pro for unlimited replies, 500 leads/month, and more.
            </p>
            <div className="space-y-2">
              <a
                href="/dashboard/billing"
                className="block w-full bg-blue-600 text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-blue-700"
              >
                Upgrade to Pro — $19/mo
              </a>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
