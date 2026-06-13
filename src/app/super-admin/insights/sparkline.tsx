// Sparkline SVG minimal — sin dependencias.
// Para gráficos compactos en dashboard / insights del super-admin.

export function Sparkline({
  values,
  labels,
  height = 80,
  className = "",
  prefix = "",
  suffix = "",
  fill = "currentColor",
  stroke = "currentColor",
}: {
  values: number[];
  labels?: string[];
  height?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  fill?: string;
  stroke?: string;
}) {
  if (values.length === 0) return null;
  const w = 600;
  const h = height;
  const pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = (w - 2 * pad) / Math.max(1, values.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");
  const fillPath = `${linePath} L ${points[points.length - 1][0]} ${h - pad} L ${points[0][0]} ${h - pad} Z`;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <path d={fillPath} fill={fill} opacity={0.15} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={stroke}>
            <title>{(labels?.[i] ?? "") + " — " + prefix + values[i].toLocaleString("es-MX") + suffix}</title>
          </circle>
        ))}
      </svg>
      {labels && (
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
          {labels.map((l) => (
            <span key={l} className="tabular-nums">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
