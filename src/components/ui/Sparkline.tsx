'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
  fillOpacity?: number;
  showDots?: boolean;
  className?: string;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  color = '#D42B2B',
  fillOpacity = 0.1,
  showDots = false,
  className = '',
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} className={className} />;
  }

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  // Generate points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value };
  });

  // Create line path
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  // Create fill path (closed polygon)
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

  // Determine trend
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const trendColor = trend >= 0 ? color : '#ef4444';

  return (
    <svg
      width={width}
      height={height}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {/* Fill area */}
      <path
        d={fillPath}
        fill={trendColor}
        fillOpacity={fillOpacity}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={trendColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      {showDots && points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={2.5}
          fill={trendColor}
        />
      )}
    </svg>
  );
}

// Variant with trend indicator
export function SparklineWithTrend({
  data,
  label,
  className = '',
}: {
  data: number[];
  label?: string;
  className?: string;
}) {
  if (!data || data.length < 2) return null;

  const current = data[data.length - 1];
  const previous = data[0];
  const change = current - previous;
  const percentChange = previous > 0 ? ((change / previous) * 100).toFixed(0) : '0';
  const isPositive = change >= 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Sparkline
        data={data}
        width={60}
        height={20}
        color={isPositive ? '#10b981' : '#ef4444'}
        showDots
      />
      <div className="flex items-center gap-1">
        {isPositive ? (
          <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 8 8">
            <path d="M4 1L7 5H1L4 1Z" fill="currentColor" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-red-500" viewBox="0 0 8 8">
            <path d="M4 7L7 3H1L4 7Z" fill="currentColor" />
          </svg>
        )}
        <span className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{percentChange}%
        </span>
      </div>
      {label && <span className="text-xs text-ink-400">{label}</span>}
    </div>
  );
}
