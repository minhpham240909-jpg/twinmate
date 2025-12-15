'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Activity,
  DollarSign,
  Zap,
  AlertTriangle,
  Clock,
  Database,
  TrendingUp,
  Users,
  RefreshCw,
  BarChart3,
  Cpu,
  Route,
  Sparkles,
  PiggyBank,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface MonitoringData {
  period: string
  realTimeStats: {
    totalRequests: number
    totalTokens: number
    totalErrors: number
    avgLatency: number
    requestsPerMinute: number
  }
  stats: {
    totalRequests: number
    totalTokens: number
    totalCost: number
    avgLatencyMs: number
    errorCount: number
    errorRate: number
    cacheEntries: number
    cacheHits: number
  }
  smartRouting?: {
    enabled: boolean
    cacheEnabled: boolean
    totalRequests: number
    cachedRequests: number
    cacheHitRate: number
    miniModelRequests: number
    fullModelRequests: number
    miniModelPercentage: number
    fullModelPercentage: number
    estimatedSavings: number
    routingEfficiency: number
  }
  operationStats: Array<{
    operation: string
    count: number
    totalTokens: number
    totalCost: number
    avgLatencyMs: number
  }>
  modelStats: Array<{
    model: string
    count: number
    totalTokens: number
    totalCost: number
  }>
  dailySummaries: Array<{
    date: string
    requests: number
    tokens: number
    cost: number
    avgLatencyMs: number
  }>
  topUsers: Array<{
    userId: string
    requestCount: number
    totalTokens: number
    totalCost: number
    user: { id: string; name: string | null; email: string | null; avatarUrl: string | null } | null
  }>
}

export default function AIMonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/ai-monitoring?period=${period}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`
  const formatNumber = (num: number) => num.toLocaleString()

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Monitoring Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track usage, costs, and performance metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    period === p
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="text-sm">Auto</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={fetchData}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {data && (
          <>
            {/* Real-time Stats Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5" />
                <span className="font-medium">Real-time Stats (In Memory)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-purple-200 text-xs">Requests</p>
                  <p className="text-2xl font-bold">{formatNumber(data.realTimeStats.totalRequests)}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs">Tokens</p>
                  <p className="text-2xl font-bold">{formatNumber(data.realTimeStats.totalTokens)}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs">Errors</p>
                  <p className="text-2xl font-bold">{data.realTimeStats.totalErrors}</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs">Avg Latency</p>
                  <p className="text-2xl font-bold">{Math.round(data.realTimeStats.avgLatency)}ms</p>
                </div>
                <div>
                  <p className="text-purple-200 text-xs">Req/min</p>
                  <p className="text-2xl font-bold">{data.realTimeStats.requestsPerMinute.toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Total Requests</span>
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(data.stats.totalRequests)}
                </p>
                <p className="text-xs text-gray-500">This {period}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Total Cost</span>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCost(data.stats.totalCost)}
                </p>
                <p className="text-xs text-gray-500">{formatNumber(data.stats.totalTokens)} tokens</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Avg Latency</span>
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.stats.avgLatencyMs}ms
                </p>
                <p className="text-xs text-gray-500">Response time</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Error Rate</span>
                  <AlertTriangle className={`w-5 h-5 ${data.stats.errorRate > 5 ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <p className={`text-2xl font-bold ${data.stats.errorRate > 5 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                  {data.stats.errorRate}%
                </p>
                <p className="text-xs text-gray-500">{data.stats.errorCount} errors</p>
              </div>
            </div>

            {/* Cache Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-purple-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Cache Performance</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Cached Responses</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{data.stats.cacheEntries}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Cache Hits</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(data.stats.cacheHits)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Hit Rate</p>
                  <p className="text-xl font-bold text-green-500">
                    {data.stats.totalRequests > 0
                      ? ((data.stats.cacheHits / (data.stats.totalRequests + data.stats.cacheHits)) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Est. Savings</p>
                  <p className="text-xl font-bold text-green-500">
                    {formatCost(data.stats.cacheHits * 0.0001)}
                  </p>
                </div>
              </div>
            </div>

            {/* Smart Routing Section */}
            {data.smartRouting && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Route className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">Smart Routing v2.0</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      data.smartRouting.enabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {data.smartRouting.enabled ? (
                        <><CheckCircle2 className="w-3 h-3" /> Routing ON</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Routing OFF</>
                      )}
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      data.smartRouting.cacheEnabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {data.smartRouting.cacheEnabled ? (
                        <><CheckCircle2 className="w-3 h-3" /> Cache ON</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Cache OFF</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Routing Efficiency */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <p className="text-gray-500 dark:text-gray-400 text-xs">Efficiency</p>
                    </div>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {data.smartRouting.routingEfficiency}%
                    </p>
                    <p className="text-xs text-gray-500">cost-optimized</p>
                  </div>

                  {/* Mini Model Usage */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">GPT-4o-mini</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatNumber(data.smartRouting.miniModelRequests)}
                    </p>
                    <p className="text-xs text-green-600">{data.smartRouting.miniModelPercentage}% of queries</p>
                  </div>

                  {/* Full Model Usage */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">GPT-4o (Full)</p>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {formatNumber(data.smartRouting.fullModelRequests)}
                    </p>
                    <p className="text-xs text-orange-600">{data.smartRouting.fullModelPercentage}% of queries</p>
                  </div>

                  {/* Cached Requests */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Cache Hits</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {formatNumber(data.smartRouting.cachedRequests)}
                    </p>
                    <p className="text-xs text-purple-600">{data.smartRouting.cacheHitRate}% hit rate</p>
                  </div>

                  {/* Estimated Savings */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <PiggyBank className="w-4 h-4 text-green-500" />
                      <p className="text-gray-500 dark:text-gray-400 text-xs">Est. Savings</p>
                    </div>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCost(data.smartRouting.estimatedSavings)}
                    </p>
                    <p className="text-xs text-gray-500">this {period}</p>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">Model Distribution</p>
                    <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                      {data.smartRouting.cachedRequests > 0 && (
                        <div
                          className="bg-purple-500 transition-all"
                          style={{ width: `${data.smartRouting.cacheHitRate}%` }}
                          title={`Cached: ${data.smartRouting.cacheHitRate}%`}
                        />
                      )}
                      <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${data.smartRouting.miniModelPercentage * (100 - data.smartRouting.cacheHitRate) / 100}%` }}
                        title={`Mini: ${data.smartRouting.miniModelPercentage}%`}
                      />
                      <div
                        className="bg-orange-500 transition-all"
                        style={{ width: `${data.smartRouting.fullModelPercentage * (100 - data.smartRouting.cacheHitRate) / 100}%` }}
                        title={`Full: ${data.smartRouting.fullModelPercentage}%`}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="text-purple-600">Cache</span>
                      <span className="text-green-600">Mini</span>
                      <span className="text-orange-600">Full</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Operation Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">By Operation</h2>
                </div>
                <div className="space-y-3">
                  {data.operationStats.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No data for this period</p>
                  ) : (
                    data.operationStats.map((op) => (
                      <div key={op.operation} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{op.operation}</p>
                          <p className="text-xs text-gray-500">{op.count} calls | {op.avgLatencyMs}ms avg</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{formatCost(op.totalCost)}</p>
                          <p className="text-xs text-gray-500">{formatNumber(op.totalTokens)} tokens</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Model Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-5 h-5 text-green-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">By Model</h2>
                </div>
                <div className="space-y-3">
                  {data.modelStats.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No data for this period</p>
                  ) : (
                    data.modelStats.map((m) => (
                      <div key={m.model} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{m.model}</p>
                          <p className="text-xs text-gray-500">{m.count} calls</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{formatCost(m.totalCost)}</p>
                          <p className="text-xs text-gray-500">{formatNumber(m.totalTokens)} tokens</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Top Users */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Top Users by Usage</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                      <th className="pb-2">User</th>
                      <th className="pb-2">Requests</th>
                      <th className="pb-2">Tokens</th>
                      <th className="pb-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.topUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No user data for this period
                        </td>
                      </tr>
                    ) : (
                      data.topUsers.map((u, idx) => (
                        <tr key={u.userId || idx}>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              {u.user?.avatarUrl ? (
                                <img src={u.user.avatarUrl} className="w-6 h-6 rounded-full" alt="" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                  <span className="text-xs text-purple-600">
                                    {u.user?.name?.charAt(0) || '?'}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm text-gray-900 dark:text-white">
                                {u.user?.name || u.user?.email || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                            {formatNumber(u.requestCount)}
                          </td>
                          <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                            {formatNumber(u.totalTokens)}
                          </td>
                          <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                            {formatCost(u.totalCost)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Trend */}
            {data.dailySummaries.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Daily Trend</h2>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    {data.dailySummaries.map((day) => (
                      <div
                        key={day.date}
                        className="flex-1 min-w-[100px] p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center"
                      >
                        <p className="text-xs text-gray-500 mb-1">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="font-bold text-gray-900 dark:text-white">{day.requests}</p>
                        <p className="text-xs text-gray-500">{formatCost(day.cost)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
