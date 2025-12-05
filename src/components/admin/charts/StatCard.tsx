'use client'

import { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'pink' | 'indigo' | 'teal' | 'red' | 'gray'
  change?: number
  changeLabel?: string
  suffix?: string
  link?: string
  onClick?: () => void
  urgent?: boolean
}

const colorClasses = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-green-500' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: 'bg-yellow-500' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', icon: 'bg-pink-500' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', icon: 'bg-indigo-500' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: 'bg-teal-500' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'bg-red-500' },
  gray: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: 'bg-gray-500' },
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  color,
  change,
  changeLabel = 'vs last period',
  suffix,
  onClick,
  urgent,
}: StatCardProps) {
  const colors = colorClasses[color]

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M'
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K'
    return val.toString()
  }

  return (
    <div
      className={`relative p-6 rounded-xl ${colors.bg} border border-gray-700 ${
        onClick ? 'hover:border-gray-600 transition-colors cursor-pointer' : ''
      } ${urgent ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className={`text-3xl font-bold ${colors.text}`}>
              {formatValue(value)}
            </p>
            {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
          </div>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
                {change >= 0 ? '+' : ''}{change}%
              </span>
              <span className="text-xs text-gray-500">{changeLabel}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.icon}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}
