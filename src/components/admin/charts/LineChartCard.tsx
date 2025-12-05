'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface DataPoint {
  date?: string
  label: string
  [key: string]: string | number | undefined
}

interface LineConfig {
  dataKey: string
  name: string
  color: string
  strokeWidth?: number
  dot?: boolean
}

interface LineChartCardProps {
  title: string
  subtitle?: string
  data: DataPoint[]
  lines: LineConfig[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  valueFormatter?: (value: number) => string
}

export default function LineChartCard({
  title,
  subtitle,
  data,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
  valueFormatter = (v) => v.toLocaleString(),
}: LineChartCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis
              dataKey="label"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
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
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: number, name: string) => [valueFormatter(value), name]}
            />
            {showLegend && (
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
              />
            )}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={line.strokeWidth || 2}
                dot={line.dot !== false}
                activeDot={{ r: 6, stroke: line.color, strokeWidth: 2, fill: '#1f2937' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
