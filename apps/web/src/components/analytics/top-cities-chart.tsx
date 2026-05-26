'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface TopCitiesChartProps {
  data: Array<{ city: string; count: number }>
}

export function TopCitiesChart({ data }: TopCitiesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data.slice(0, 8)}
        layout="vertical"
        margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="city"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            color: '#fafafa',
          }}
          formatter={(value: number) => [value.toLocaleString('uk-UA'), 'Об\'єктів']}
          cursor={{ fill: 'rgba(59,130,246,0.05)' }}
        />
        <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
