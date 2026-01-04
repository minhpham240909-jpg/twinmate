'use client'

/**
 * Investigation Panel Component
 * Shows all investigation data for a report in a unified interface
 */

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  X,
  MessageSquare,
  AlertTriangle,
  Shield,
  Clock,
  User,
  Link as LinkIcon,
  FileText,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Ban,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'

interface InvestigationPanelProps {
  reportId: string
  reportType: string
  onClose: () => void
  onAction: (action: string, data?: any) => void
}

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
  fileUrl?: string
  fileName?: string
  sender: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
}

interface InvestigationData {
  report: any
  investigation: {
    conversation: {
      messages: Message[]
      stats: {
        totalMessages: number
        messagesByUser1: number
        messagesByUser2: number
        linksShared: number
        flaggedContent: any[]
      }
    } | null
    reportedUserHistory: {
      reportsAgainst: any[]
      currentBan: any
      warnings: any[]
      recentActivity: {
        messagesLast7Days: number
        groupMemberships: number
        studySessions: number
        partnerConnections: number
      } | null
    }
    reporterHistory: {
      reportsMade: any[]
      falseReportCount: number
    }
    relatedContent: any
    aiAnalysis: {
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      confidence: number
      findings: Array<{
        type: string
        description: string
        severity: 'info' | 'warning' | 'danger'
        evidence?: string
      }>
      recommendation: string
      automatedFlags: string[]
    }
  }
}

export default function InvestigationPanel({
  reportId,
  reportType,
  onClose,
  onAction,
}: InvestigationPanelProps) {
  const [data, setData] = useState<InvestigationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    aiAnalysis: true,
    conversation: true,
    reportedUserHistory: false,
    reporterHistory: false,
    relatedContent: false,
  })

  useEffect(() => {
    fetchInvestigationData()
  }, [reportId])

  const fetchInvestigationData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/reports/${reportId}/investigate`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load investigation data')
      }

      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500 text-white'
      case 'HIGH': return 'bg-orange-500 text-white'
      case 'MEDIUM': return 'bg-yellow-500 text-black'
      default: return 'bg-green-500 text-white'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'danger': return <AlertCircle className="w-4 h-4 text-red-400" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      default: return <CheckCircle className="w-4 h-4 text-blue-400" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-white">Loading investigation data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl p-8 max-w-md">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <span>Error loading data</span>
          </div>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const { report, investigation } = data
  const { aiAnalysis, conversation, reportedUserHistory, reporterHistory } = investigation

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-slate-900 rounded-xl w-full max-w-5xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Investigation Panel
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Report #{reportId.slice(0, 8)} - {reportType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* AI Analysis Section */}
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('aiAnalysis')}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-white">AI Analysis</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRiskLevelColor(aiAnalysis.riskLevel)}`}>
                  {aiAnalysis.riskLevel} RISK
                </span>
                <span className="text-sm text-gray-400">
                  ({aiAnalysis.confidence}% confidence)
                </span>
              </div>
              {expandedSections.aiAnalysis ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.aiAnalysis && (
              <div className="p-4 border-t border-slate-700 space-y-4">
                {/* Recommendation */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Recommendation:</p>
                  <p className="text-white">{aiAnalysis.recommendation}</p>
                </div>

                {/* Automated Flags */}
                {aiAnalysis.automatedFlags.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Automated Flags:</p>
                    <div className="flex flex-wrap gap-2">
                      {aiAnalysis.automatedFlags.map((flag, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Findings */}
                {aiAnalysis.findings.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Findings:</p>
                    <div className="space-y-2">
                      {aiAnalysis.findings.map((finding, i) => (
                        <div key={i} className="bg-slate-900 rounded-lg p-3 flex items-start gap-3">
                          {getSeverityIcon(finding.severity)}
                          <div>
                            <p className="text-sm font-medium text-white">{finding.type}</p>
                            <p className="text-sm text-gray-400">{finding.description}</p>
                            {finding.evidence && (
                              <p className="text-xs text-gray-500 mt-1">Evidence: {finding.evidence}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.findings.length === 0 && (
                  <p className="text-gray-400 text-sm">No specific findings detected.</p>
                )}
              </div>
            )}
          </div>

          {/* Conversation Section */}
          {conversation && (
            <div className="bg-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('conversation')}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-white">Conversation History</span>
                  <span className="text-sm text-gray-400">
                    ({conversation.stats.totalMessages} messages)
                  </span>
                </div>
                {expandedSections.conversation ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              {expandedSections.conversation && (
                <div className="border-t border-slate-700">
                  {/* Stats */}
                  <div className="p-4 bg-slate-900 grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{conversation.stats.totalMessages}</p>
                      <p className="text-xs text-gray-400">Total Messages</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">{conversation.stats.messagesByUser1}</p>
                      <p className="text-xs text-gray-400">By Reporter</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400">{conversation.stats.messagesByUser2}</p>
                      <p className="text-xs text-gray-400">By Reported User</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-400">{conversation.stats.linksShared}</p>
                      <p className="text-xs text-gray-400">Links Shared</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="p-4 max-h-96 overflow-y-auto space-y-3">
                    {conversation.messages.map((msg) => {
                      const isReporter = msg.senderId === report.reporterId
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isReporter ? 'flex-row' : 'flex-row-reverse'}`}
                        >
                          <div className="flex-shrink-0">
                            {msg.sender.avatarUrl ? (
                              <Image
                                src={msg.sender.avatarUrl}
                                alt=""
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${isReporter ? 'bg-blue-600' : 'bg-red-600'}`}>
                                {msg.sender.name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          <div className={`max-w-[70%] ${isReporter ? '' : 'text-right'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${isReporter ? 'text-blue-400' : 'text-red-400'}`}>
                                {msg.sender.name || 'Unknown'} {isReporter ? '(Reporter)' : '(Reported)'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(msg.createdAt)}
                              </span>
                            </div>
                            <div className={`p-3 rounded-lg ${isReporter ? 'bg-blue-900/30' : 'bg-red-900/30'}`}>
                              <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                              {msg.fileUrl && (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-400 mt-2 hover:underline"
                                >
                                  <FileText className="w-3 h-3" />
                                  {msg.fileName || 'Attachment'}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reported User History */}
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('reportedUserHistory')}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-red-400" />
                <span className="font-semibold text-white">Reported User History</span>
                {reportedUserHistory.currentBan && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    Currently Banned
                  </span>
                )}
                {reportedUserHistory.reportsAgainst && reportedUserHistory.reportsAgainst.length > 0 && (
                  <span className="text-sm text-gray-400">
                    ({reportedUserHistory.reportsAgainst.length} previous reports)
                  </span>
                )}
              </div>
              {expandedSections.reportedUserHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.reportedUserHistory && (
              <div className="p-4 border-t border-slate-700 space-y-4">
                {/* Activity Stats */}
                {reportedUserHistory.recentActivity && (
                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-3">Recent Activity:</p>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{reportedUserHistory.recentActivity.messagesLast7Days}</p>
                        <p className="text-xs text-gray-400">Messages (7d)</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{reportedUserHistory.recentActivity.groupMemberships}</p>
                        <p className="text-xs text-gray-400">Groups</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{reportedUserHistory.recentActivity.studySessions}</p>
                        <p className="text-xs text-gray-400">Sessions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{reportedUserHistory.recentActivity.partnerConnections}</p>
                        <p className="text-xs text-gray-400">Partners</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previous Reports */}
                {reportedUserHistory.reportsAgainst && reportedUserHistory.reportsAgainst.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Previous Reports Against This User:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {reportedUserHistory.reportsAgainst.map((r: any) => (
                        <div key={r.id} className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              r.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                              r.status === 'DISMISSED' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {r.status}
                            </span>
                            <span className="ml-2 text-sm text-white">{r.type}</span>
                          </div>
                          <span className="text-xs text-gray-500">{formatDate(r.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {reportedUserHistory.warnings && reportedUserHistory.warnings.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Warnings Issued:</p>
                    <div className="space-y-2">
                      {reportedUserHistory.warnings.map((w: any) => (
                        <div key={w.id} className="bg-yellow-500/10 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-yellow-400">Severity: {w.severity}/5</span>
                            <span className="text-xs text-gray-500">{formatDate(w.createdAt)}</span>
                          </div>
                          <p className="text-sm text-white mt-1">{w.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reporter History */}
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('reporterHistory')}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-white">Reporter History</span>
                {reporterHistory.falseReportCount > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                    {reporterHistory.falseReportCount} dismissed reports
                  </span>
                )}
              </div>
              {expandedSections.reporterHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.reporterHistory && (
              <div className="p-4 border-t border-slate-700">
                {reporterHistory.reportsMade && reporterHistory.reportsMade.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reporterHistory.reportsMade.map((r: any) => (
                      <div key={r.id} className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            r.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                            r.status === 'DISMISSED' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {r.status}
                          </span>
                          <span className="ml-2 text-sm text-white">{r.type}</span>
                          {r.reportedUser && (
                            <span className="ml-2 text-sm text-gray-400">
                              vs {r.reportedUser.name || r.reportedUser.email}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(r.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No previous reports filed by this user.</p>
                )}

                {reporterHistory.falseReportCount > 2 && (
                  <div className="mt-3 bg-yellow-500/10 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-yellow-400">
                        This reporter has {reporterHistory.falseReportCount} previously dismissed reports.
                        Consider if this might be a false report.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-4 flex items-center justify-between rounded-b-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Quick Actions:</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onAction('dismiss')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Dismiss
            </button>
            <button
              onClick={() => onAction('warn')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Warn User
            </button>
            <button
              onClick={() => onAction('ban')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Ban className="w-4 h-4" />
              Ban User
            </button>
            <button
              onClick={() => onAction('resolve')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Resolve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
