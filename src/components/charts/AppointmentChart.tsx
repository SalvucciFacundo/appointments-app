"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts"

interface StatsData {
  total: Record<string, number>
  attendanceRate: number
  peakHour: number | null
  peakHourCount: number
  repeatCustomers: number
  todayCount: number
}

interface AppointmentChartProps {
  stats: StatsData
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  CONFIRMED: "#3b82f6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
}

export function StatusBarChart({ stats }: AppointmentChartProps) {
  const data = Object.entries(stats.total).map(([status, count]) => ({
    name: status.charAt(0) + status.slice(1).toLowerCase(),
    value: count,
    fill: STATUS_COLORS[status] ?? "#6b7280",
  }))

  if (data.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        Appointments by Status
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
