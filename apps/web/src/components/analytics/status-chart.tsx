'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ObjectStatus } from '@/types'
import { STATUS_LABELS } from '@/lib/utils/format'

const STATUS_CHART_COLORS: Record<ObjectStatus, string> = {
  planned: '#3b82f6',
  approved: '#a855f7',
  under_construction: '#eab308',
  completed: '#22c55e',
  suspended: '#f97316',
  cancelled: '#ef4444',
}

interface StatusChartProps {
  data: Record<ObjectStatus, number>
}

export function StatusChart({ data }: StatusChartProps) {
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status as ObjectStatus],
      value: count,
      color: STATUS_CHART_COLORS[status as ObjectStatus],
    }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            color: '#fafafa',
          }}
          formatter={(value) => [Number(value).toLocaleString('uk-UA'), '']}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
