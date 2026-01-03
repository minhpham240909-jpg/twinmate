'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface BarChartCardProps {
  title: string
  subtitle?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<{ name: string; value?: number; members?: number; fill?: string; [key: string]: any }>
  dataKey?: string
  color?: string
  colors?: string[]
  height?: number
  horizontal?: boolean
  showGrid?: boolean
  valueFormatter?: (value: number) => string
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

function BarChartCard({
  title,
  subtitle,
  data,
  dataKey = 'value',
  color = '#3b82f6',
  colors,
  height = 300,
  horizontal = false,
  showGrid = true,
  valueFormatter = (v) => v.toLocaleString(),
}: BarChartCardProps) {
  // Error state: Handle empty or invalid data
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-gray-400">No data available</p>
        </div>
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    value: d[dataKey] as number || d.value || d.members || 0,
  }))

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {horizontal ? (
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
            >
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />}
              <XAxis
                type="number"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={valueFormatter}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number) => [valueFormatter(value), 'Count']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors ? colors[index % colors.length] : color}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />}
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={valueFormatter}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number) => [valueFormatter(value), 'Count']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors ? colors[index % colors.length] : COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// PERF: Memoize component to prevent unnecessary re-renders
export default React.memo(BarChartCard)
