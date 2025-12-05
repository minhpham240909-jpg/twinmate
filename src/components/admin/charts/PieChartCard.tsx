'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface PieChartCardProps {
  title: string
  subtitle?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<{ name: string; value: number; fill?: string; [key: string]: any }>
  colors?: string[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  valueFormatter?: (value: number) => string
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function PieChartCard({
  title,
  subtitle,
  data,
  colors = DEFAULT_COLORS,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  valueFormatter = (v) => v.toLocaleString(),
}: PieChartCardProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
    if (!percent || percent < 0.05) return null // Don't show labels for small slices
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{valueFormatter(total)}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill || colors[index % colors.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: number, name: string) => [valueFormatter(value), name]}
            />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stats below chart */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-700">
        {data.slice(0, 4).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.fill || colors[index % colors.length] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400 truncate">{item.name}</p>
              <p className="text-white font-medium">{valueFormatter(item.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
