"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e6e5e0",
  boxShadow: "0 10px 30px -12px rgba(24,24,27,.25)",
  fontSize: 12,
  color: "#1b1b1f",
  padding: "8px 10px",
};

export function BookingVolumeChart({ data }: { data: Array<{ label: string; bookings: number }> }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
              <stop offset="60%" stopColor="#14b8a6" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ecebe7" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#71717a" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#71717a" }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 600 }} />
          <Area
            type="monotone"
            dataKey="bookings"
            name="Bookings"
            stroke="#0f766e"
            strokeWidth={2}
            fill="url(#bookingFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OutcomeDonut({
  data,
}: {
  data: Array<{ name: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-muted">
        No published results in this period.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[190px] w-[220px] shrink-0">
        <PieChart width={220} height={190}>
          <Pie
            data={data.filter((entry) => entry.value > 0)}
            dataKey="value"
            nameKey="name"
            innerRadius={54}
            outerRadius={78}
            paddingAngle={2}
            stroke="none"
          >
            {data
              .filter((entry) => entry.value > 0)
              .map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-semibold tracking-tight tabular">{total}</span>
          <span className="text-[11px] uppercase tracking-wide text-muted">results</span>
        </div>
      </div>
      <ul className="w-full space-y-2 sm:w-auto sm:flex-1">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-6 text-[13px]">
            <span className="flex items-center gap-2 text-ink-soft">
              <span className="size-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="tabular font-medium">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkloadChart({
  data,
}: {
  data: Array<{ name: string; upcoming: number; pending: number }>;
}) {
  return (
    <div className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap={22}>
          <CartesianGrid stroke="#ecebe7" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickFormatter={(value: string) => value.split(" ")[0] ?? value}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#71717a" }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,70,229,.06)" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#71717a" }}
          />
          <Bar dataKey="upcoming" name="Upcoming" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="pending" name="Awaiting publication" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
