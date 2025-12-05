'use client'

import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

interface DataPoint {
  date?: string
  label?: string
  value: number
}

interface MiniAreaChartProps {
  data: DataPoint[]
  color?: string
  height?: number
  showTooltip?: boolean
}

export default function MiniAreaChart({
  data,
  color = '#3b82f6',
  height = 60,
  showTooltip = true,
}: MiniAreaChartProps) {
  const gradientId = `mini-gradient-${color.replace('#', '')}`

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                padding: '4px 8px',
              }}
              labelStyle={{ display: 'none' }}
              formatter={(value: number) => [value.toLocaleString(), '']}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
