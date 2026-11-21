"use client";

import React, { useState } from "react";
import { formatPowerBiNumber } from "@/lib/powerbi/csvEngine";
import { POWERBI_SERIES_PALETTE } from "@/lib/powerbi/palette";
import type {
  CrossFilterSelection,
  DataRow,
  GroupedAggregationResult,
  PowerBiVisual,
} from "@/lib/powerbi/types";
import { Tooltip } from "./Tooltip";

interface SvgChartsProps {
  visual: PowerBiVisual;
  grouped: GroupedAggregationResult;
  rawRows: DataRow[];
  crossFilter: CrossFilterSelection | null;
  onSelectCategory: (category: string) => void;
}

interface HoverState {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}

const EMPTY_HOVER: HoverState = { visible: false, x: 0, y: 0, title: "", rows: [] };

function shortenLabel(val: string, max = 13): string {
  if (val.length <= max) return val;
  return `${val.slice(0, max - 1)}…`;
}

/** Crisp Power BI SVG chart renderer with official dotted gridlines, palette, labels, and cross-filtering. */
export function PowerBiSvgCharts({
  visual,
  grouped,
  rawRows,
  crossFilter,
  onSelectCategory,
}: SvgChartsProps) {
  const [hover, setHover] = useState<HoverState>(EMPTY_HOVER);

  const w = Math.max(260, visual.layout.w - 22);
  const h = Math.max(150, visual.layout.h - 40);
  const activeCross =
    crossFilter && crossFilter.column === visual.xAxis ? crossFilter.value : null;

  const isDimmed = (cat: string) => Boolean(activeCross && activeCross !== cat);

  const renderLegend = (items: Array<{ label: string; color: string }>) => {
    if (!visual.format.showLegend || items.length === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px 12px",
          fontSize: 10.5,
          color: "#605e5c",
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        {items.slice(0, 6).map((item) => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: item.color,
                display: "inline-block",
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    );
  };

  if (grouped.categories.length === 0 || (visual.yAxis.length === 0 && visual.type !== "scatter")) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          color: "#797775",
          fontSize: 12,
          textAlign: "center",
          padding: 12,
        }}
      >
        Select fields in the Data pane or field wells to render this visual.
      </div>
    );
  }

  // ---------- PIE / DONUT ----------
  if (visual.type === "pie" || visual.type === "donut") {
    const primaryField = visual.yAxis[0];
    const sliceRows = grouped.rows.slice(0, 7);
    const total = sliceRows.reduce((s, r) => s + Math.max(0, r.values[primaryField] ?? 0), 0) || 1;
    const cx = w * 0.38;
    const cy = (h - 24) * 0.52;
    const outerR = Math.max(36, Math.min(cx - 14, cy - 12));
    const innerR = visual.type === "donut" ? outerR * 0.56 : 0;

    let cumAngle = -Math.PI / 2;
    const paths = sliceRows.map((row, idx) => {
      const val = Math.max(0, row.values[primaryField] ?? 0);
      const frac = val / total;
      const startAngle = cumAngle;
      const endAngle = startAngle + frac * Math.PI * 2;
      cumAngle = endAngle;

      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);

      const d =
        innerR > 0
          ? [
              `M ${x1} ${y1}`,
              `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
              `L ${cx + innerR * Math.cos(endAngle)} ${cy + innerR * Math.sin(endAngle)}`,
              `A ${innerR} ${innerR} 0 ${largeArc} 0 ${cx + innerR * Math.cos(startAngle)} ${cy + innerR * Math.sin(startAngle)}`,
              "Z",
            ].join(" ")
          : `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const color = POWERBI_SERIES_PALETTE[idx % POWERBI_SERIES_PALETTE.length];
      return { row, val, frac, d, color };
    });

    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
          {paths.map(({ row, val, frac, d, color }) => (
            <path
              key={row.category}
              d={d}
              fill={color}
              fillOpacity={isDimmed(row.category) ? 0.3 : 0.94}
              stroke="#ffffff"
              strokeWidth={1.5}
              style={{ cursor: "pointer", transition: "fill-opacity 0.15s ease" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCategory(row.category);
              }}
              onMouseMove={(e) =>
                setHover({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  title: row.category,
                  rows: [
                    {
                      label: primaryField,
                      value: `${formatPowerBiNumber(val, primaryField)} (${(frac * 100).toFixed(1)}%)`,
                      color,
                    },
                  ],
                })
              }
              onMouseLeave={() => setHover(EMPTY_HOVER)}
            />
          ))}
          {visual.type === "donut" ? (
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill="#252423"
            >
              {formatPowerBiNumber(total, primaryField)}
            </text>
          ) : null}

          {visual.format.showLegend
            ? paths.map(({ row, frac, color }, idx) => (
                <g
                  key={`leg-${row.category}`}
                  transform={`translate(${cx + outerR + 18}, ${20 + idx * 20})`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCategory(row.category);
                  }}
                >
                  <circle cx={4} cy={5} r={4} fill={color} opacity={isDimmed(row.category) ? 0.35 : 1} />
                  <text x={13} y={9} fontSize={10.5} fill="#252423">
                    {shortenLabel(row.category, 14)} ({(frac * 100).toFixed(1)}%)
                  </text>
                </g>
              ))
            : null}
        </svg>
        <Tooltip {...hover} />
      </div>
    );
  }

  // ---------- GAUGE ----------
  if (visual.type === "gauge") {
    const field = visual.yAxis[0];
    const total = grouped.rows.reduce((s, r) => s + (r.values[field] ?? 0), 0);
    const val = grouped.rows.length ? total : 0;
    const goal = val > 0 ? val * 1.25 : 100;
    const pct = Math.min(1, Math.max(0, val / goal));
    const cx = w / 2;
    const cy = h * 0.72;
    const r = Math.max(46, Math.min(w * 0.34, h * 0.56));
    const endX = cx + r * Math.cos(Math.PI - pct * Math.PI);
    const endY = cy - r * Math.sin(Math.PI - pct * Math.PI);

    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }}>
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#eaeaea"
            strokeWidth={18}
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
            fill="none"
            stroke={visual.format.accentColor || "#118DFF"}
            strokeWidth={18}
          />
          <text x={cx} y={cy - 10} textAnchor="middle" fontSize={22} fontWeight={600} fill="#252423">
            {formatPowerBiNumber(val, field)}
          </text>
          <text x={cx - r} y={cy + 16} textAnchor="middle" fontSize={10} fill="#605e5c">
            0
          </text>
          <text x={cx + r} y={cy + 16} textAnchor="middle" fontSize={10} fill="#605e5c">
            {formatPowerBiNumber(goal, field)}
          </text>
        </svg>
      </div>
    );
  }

  // ---------- FUNNEL ----------
  if (visual.type === "funnel") {
    const field = visual.yAxis[0];
    const rows = grouped.rows.slice(0, 6);
    const maxV = Math.max(1, ...rows.map((r) => r.values[field] ?? 0));
    const rowH = Math.max(22, (h - 20) / Math.max(1, rows.length) - 6);
    const maxBarW = Math.max(80, w - 150);

    return (
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }}>
          {rows.map((r, i) => {
            const val = r.values[field] ?? 0;
            const bw = Math.max(18, (val / maxV) * maxBarW);
            const x = 90 + (maxBarW - bw) / 2;
            const y = 10 + i * (rowH + 6);
            return (
              <g
                key={r.category}
                style={{ cursor: "pointer" }}
                opacity={isDimmed(r.category) ? 0.32 : 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(r.category);
                }}
              >
                <text x={82} y={y + rowH / 2 + 4} textAnchor="end" fontSize={10.5} fill="#252423">
                  {shortenLabel(r.category, 12)}
                </text>
                <rect
                  x={x}
                  y={y}
                  width={bw}
                  height={rowH}
                  rx={2}
                  fill={visual.format.accentColor || "#118DFF"}
                  fillOpacity={Math.max(0.45, 1 - i * 0.1)}
                />
                {visual.format.showDataLabels ? (
                  <text x={x + bw + 6} y={y + rowH / 2 + 4} fontSize={10.5} fontWeight={600} fill="#252423">
                    {formatPowerBiNumber(val, field)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // ---------- TREEMAP ----------
  if (visual.type === "treemap") {
    const field = visual.yAxis[0];
    const items = grouped.rows.slice(0, 6);
    const total = items.reduce((s, r) => s + Math.max(0, r.values[field] ?? 0), 0) || 1;
    let cursorX = 0;

    return (
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }}>
          {items.map((r, idx) => {
            const val = Math.max(0, r.values[field] ?? 0);
            const bw = (val / total) * w;
            const x = cursorX;
            cursorX += bw;
            const color = POWERBI_SERIES_PALETTE[idx % POWERBI_SERIES_PALETTE.length];
            return (
              <g
                key={r.category}
                style={{ cursor: "pointer" }}
                opacity={isDimmed(r.category) ? 0.32 : 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(r.category);
                }}
              >
                <rect x={x} y={4} width={Math.max(2, bw - 2)} height={h - 10} fill={color} />
                {bw > 52 ? (
                  <text x={x + 8} y={22} fontSize={11} fontWeight={600} fill="#ffffff">
                    {shortenLabel(r.category, 14)}
                  </text>
                ) : null}
                {bw > 52 && visual.format.showDataLabels ? (
                  <text x={x + 8} y={38} fontSize={10.5} fill="#ffffff" opacity={0.9}>
                    {formatPowerBiNumber(val, field)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // ---------- SCATTER ----------
  if (visual.type === "scatter") {
    const xField = visual.yAxis[0] || visual.xAxis;
    const yField = visual.yAxis[1] || visual.yAxis[0];
    const points = rawRows.slice(0, 60);
    const xs = points.map((r) => Number(r[xField || ""]) || 0);
    const ys = points.map((r) => Number(r[yField || ""]) || 0);
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 1);
    const padL = 44;
    const padB = 24;
    const plotW = w - padL - 12;
    const plotH = h - padB - 14;

    return (
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }}>
          {[0, 0.5, 1].map((t) => {
            const y = 10 + (1 - t) * plotH;
            return (
              <line
                key={t}
                x1={padL}
                y1={y}
                x2={w - 8}
                y2={y}
                stroke="#e1dfdd"
                strokeDasharray="2 3"
              />
            );
          })}
          {points.map((r, i) => {
            const xv = Number(r[xField || ""]) || 0;
            const yv = Number(r[yField || ""]) || 0;
            const px = padL + ((xv - minX) / Math.max(1, maxX - minX)) * plotW;
            const py = 10 + (1 - (yv - minY) / Math.max(1, maxY - minY)) * plotH;
            return (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={4.2}
                fill={POWERBI_SERIES_PALETTE[i % POWERBI_SERIES_PALETTE.length]}
                fillOpacity={0.78}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  // ---------- CLUSTERED / STACKED HORIZONTAL BAR ----------
  if (visual.type === "clusteredBar" || visual.type === "stackedBar") {
    const rows = grouped.rows.slice(0, 8);
    const isStacked = visual.type === "stackedBar";
    const maxV = Math.max(
      1,
      ...rows.map((r) =>
        isStacked
          ? r.total
          : Math.max(...grouped.series.map((s) => r.values[s.key] ?? 0)),
      ),
    );
    const padL = 86;
    const padR = 46;
    const plotW = Math.max(80, w - padL - padR);
    const rowSlot = Math.max(22, (h - 28) / Math.max(1, rows.length));

    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {renderLegend(grouped.series)}
        <svg viewBox={`0 0 ${w} ${h - 22}`} style={{ width: "100%", flex: 1 }}>
          {[0, 0.5, 1].map((t) => {
            const x = padL + t * plotW;
            return (
              <line
                key={t}
                x1={x}
                y1={4}
                x2={x}
                y2={rows.length * rowSlot}
                stroke="#e1dfdd"
                strokeDasharray="2 3"
              />
            );
          })}

          {rows.map((row, rIdx) => {
            const topY = rIdx * rowSlot + 4;
            const barH = isStacked
              ? Math.min(20, rowSlot - 7)
              : Math.max(6, (rowSlot - 8) / grouped.series.length);
            let stackOffset = 0;

            return (
              <g
                key={row.category}
                opacity={isDimmed(row.category) ? 0.28 : 1}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(row.category);
                }}
              >
                <text
                  x={padL - 8}
                  y={topY + (rowSlot - 8) / 2 + 3}
                  textAnchor="end"
                  fontSize={10.5}
                  fill="#252423"
                >
                  {shortenLabel(row.category, 12)}
                </text>

                {grouped.series.map((s, sIdx) => {
                  const val = row.values[s.key] ?? 0;
                  const bw = Math.max(2, (val / maxV) * plotW);
                  const bx = padL + (isStacked ? stackOffset : 0);
                  const by = isStacked ? topY : topY + sIdx * barH;
                  if (isStacked) stackOffset += bw;

                  return (
                    <g key={s.key}>
                      <rect
                        x={bx}
                        y={by}
                        width={bw}
                        height={Math.max(4, barH - 2)}
                        fill={s.color}
                        onMouseMove={(e) =>
                          setHover({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            title: row.category,
                            rows: [{ label: s.label, value: formatPowerBiNumber(val, s.key), color: s.color }],
                          })
                        }
                        onMouseLeave={() => setHover(EMPTY_HOVER)}
                      />
                      {visual.format.showDataLabels && (!isStacked || sIdx === grouped.series.length - 1) ? (
                        <text
                          x={bx + bw + 5}
                          y={by + Math.max(4, barH - 2) / 2 + 3.5}
                          fontSize={10}
                          fill="#252423"
                        >
                          {formatPowerBiNumber(isStacked ? row.total : val, s.key)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <Tooltip {...hover} />
      </div>
    );
  }

  // ---------- LINE / AREA ----------
  if (visual.type === "line" || visual.type === "area") {
    const rows = grouped.rows.slice(0, 60);
    const padL = 46;
    const padR = 16;
    const padB = 22;
    const padT = 10;
    const plotW = Math.max(120, w - padL - padR);
    const svgH = Math.max(110, h - (visual.format.showLegend ? 24 : 4));
    const plotH = Math.max(60, svgH - padT - padB);
    const maxV = Math.max(1, grouped.maxVal * 1.12);
    const isArea = visual.type === "area";

    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {renderLegend(grouped.series)}
        <svg viewBox={`0 0 ${w} ${svgH}`} style={{ width: "100%", flex: 1 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + (1 - t) * plotH;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e1dfdd" strokeDasharray="2 3" />
                <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={9.5} fill="#605e5c">
                  {formatPowerBiNumber(t * maxV, grouped.series[0]?.key)}
                </text>
              </g>
            );
          })}

          {grouped.series.map((s) => {
            const coords = rows.map((r, i) => {
              const x = padL + (rows.length <= 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
              const val = r.values[s.key] ?? 0;
              const y = padT + (1 - val / maxV) * plotH;
              return { x, y, val, cat: r.category };
            });

            const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
            const areaPoints = `${padL},${padT + plotH} ${polylinePoints} ${coords[coords.length - 1]?.x.toFixed(1) || padL},${padT + plotH}`;

            return (
              <g key={s.key}>
                {isArea ? (
                  <polygon points={areaPoints} fill={s.color} fillOpacity={0.22} />
                ) : null}
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {coords
                  .filter((_, idx) => rows.length <= 18 || idx % Math.ceil(rows.length / 18) === 0 || idx === rows.length - 1)
                  .map((c) => (
                    <circle
                      key={c.cat}
                      cx={c.x}
                      cy={c.y}
                      r={3}
                      fill={s.color}
                      style={{ cursor: "pointer" }}
                      onMouseMove={(e) =>
                        setHover({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          title: c.cat,
                          rows: [{ label: s.label, value: formatPowerBiNumber(c.val, s.key), color: s.color }],
                        })
                      }
                      onMouseLeave={() => setHover(EMPTY_HOVER)}
                    />
                  ))}
                {visual.format.showDataLabels
                  ? coords
                      .filter((_, idx) => rows.length <= 18 || idx % Math.ceil(rows.length / 18) === 0 || idx === rows.length - 1)
                      .map((c) => (
                        <text key={"lbl-" + c.cat} x={c.x} y={c.y - 7} textAnchor="middle" fontSize={9} fill="#252423">
                          {formatPowerBiNumber(c.val, s.key)}
                        </text>
                      ))
                  : null}
              </g>
            );
          })}

          {/* X axis ticks: every category when there are few, otherwise first / middle / last */}
          {rows
            .map((r, i) => ({ r, i }))
            .filter(({ i }) => rows.length <= 8 || i === 0 || i === Math.floor(rows.length / 2) || i === rows.length - 1)
            .map(({ r, i }) => {
              const x = padL + (rows.length <= 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
              const anchor =
                rows.length <= 1 ? "middle" : i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle";
              return (
                <text key={r.category} x={x} y={svgH - 4} textAnchor={anchor} fontSize={9.5} fill="#605e5c">
                  {shortenLabel(r.category, 11)}
                </text>
              );
            })}
        </svg>
        <Tooltip {...hover} />
      </div>
    );
  }

  // ---------- DEFAULT: CLUSTERED / STACKED VERTICAL COLUMN ----------
  const rows = grouped.rows.slice(0, 10);
  const isStacked = visual.type === "stackedColumn";
  const maxV = Math.max(
    1,
    1.12 *
      Math.max(
        1,
        ...rows.map((r) =>
          isStacked
            ? r.total
            : Math.max(...grouped.series.map((s) => r.values[s.key] ?? 0)),
        ),
      ),
  );
  const padL = 46;
  const padB = 26;
  const padT = 14;
  const svgH = Math.max(120, h - (visual.format.showLegend ? 24 : 4));
  const plotW = Math.max(120, w - padL - 10);
  const plotH = Math.max(60, svgH - padT - padB);
  const groupSlot = plotW / Math.max(1, rows.length);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {renderLegend(grouped.series)}
      <svg viewBox={`0 0 ${w} ${svgH}`} style={{ width: "100%", flex: 1 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + (1 - t) * plotH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - 8} y2={y} stroke="#e1dfdd" strokeDasharray="2 3" />
              <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={9.5} fill="#605e5c">
                {formatPowerBiNumber(t * maxV, grouped.series[0]?.key)}
              </text>
            </g>
          );
        })}

        {rows.map((row, rIdx) => {
          const gx = padL + rIdx * groupSlot;
          const innerW = Math.min(groupSlot * 0.72, isStacked ? 48 : 76);
          const barW = isStacked ? innerW : Math.max(8, (innerW - (grouped.series.length - 1) * 3) / grouped.series.length);
          const startX = gx + (groupSlot - innerW) / 2;
          let stackedHeight = 0;

          return (
            <g
              key={row.category}
              opacity={isDimmed(row.category) ? 0.28 : 1}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCategory(row.category);
              }}
            >
              {grouped.series.map((s, sIdx) => {
                const val = row.values[s.key] ?? 0;
                const bh = Math.max(2, (val / maxV) * plotH);
                const bx = isStacked ? startX : startX + sIdx * (barW + 3);
                const by = isStacked
                  ? padT + plotH - stackedHeight - bh
                  : padT + plotH - bh;
                if (isStacked) stackedHeight += bh;

                return (
                  <g key={s.key}>
                    <rect
                      x={bx}
                      y={by}
                      width={barW}
                      height={bh}
                      fill={s.color}
                      onMouseMove={(e) =>
                        setHover({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          title: row.category,
                          rows: grouped.series.map((ser) => ({
                            label: ser.label,
                            value: formatPowerBiNumber(row.values[ser.key] ?? 0, ser.key),
                            color: ser.color,
                          })),
                        })
                      }
                      onMouseLeave={() => setHover(EMPTY_HOVER)}
                    />
                    {visual.format.showDataLabels && (!isStacked || sIdx === grouped.series.length - 1) ? (
                      <text
                        x={bx + barW / 2}
                        y={by - 3}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#252423"
                      >
                        {formatPowerBiNumber(isStacked ? row.total : val, s.key)}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              <text
                x={gx + groupSlot / 2}
                y={padT + plotH + 15}
                textAnchor="middle"
                fontSize={10}
                fill="#252423"
              >
                {shortenLabel(row.category, 10)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip {...hover} />
    </div>
  );
}
