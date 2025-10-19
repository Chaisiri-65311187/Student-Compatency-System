import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/* ------------------------- helper: color → rgba ------------------------- */
function toRgba(color, alpha = 1) {
  try {
    const c = (color || "").trim();
    const m = c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/i);
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, +x)));
      return `rgba(${r},${g},${b},${alpha})`;
    }
    if (c.startsWith("#")) {
      const hex = c.slice(1);
      const full = hex.length === 3 ? hex.split("").map((h) => h + h).join("") : hex.padEnd(6, "0");
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(99,102,241,${alpha})`; // fallback indigo
  } catch {
    return `rgba(99,102,241,${alpha})`;
  }
}

/* ----------------------- plugin: ring background ------------------------ */
const ringBackgroundPlugin = {
  id: "ringBackground",
  beforeDraw(chart, _args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.r) return;
    const rScale = scales.r;
    const rings = opts?.rings ?? 4;
    const base = opts?.baseColor ?? "#000";
    ctx.save();
    ctx.translate(rScale.xCenter, rScale.yCenter);

    const maxRadius = rScale.drawingArea;
    for (let i = rings; i >= 1; i--) {
      const radius = (i / rings) * maxRadius;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      const alpha = i % 2 === 0 ? 0.06 : 0.03;
      ctx.fillStyle = toRgba(base, alpha);
      ctx.fill();
    }
    ctx.restore();
  },
};

/* --------------------- plugin: point value callouts --------------------- */
const pointValuePlugin = {
  id: "pointValue",
  afterDatasetsDraw(chart, _args, opts) {
    const ds = chart.data.datasets?.[0];
    const meta = chart.getDatasetMeta(0);
    if (!ds || !meta?.data) return;
    const rScale = chart.scales.r;
    const show = opts?.show ?? true;
    if (!show) return;

    const bg = opts?.badgeBg ?? "rgba(255,255,255,.9)";
    const fg = opts?.badgeFg ?? "#111";
    const padX = 6, padY = 2, radius = 6;

    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 11px ui-sans-serif, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial";
    ctx.textBaseline = "middle";

    meta.data.forEach((pt, i) => {
      const { x, y } = pt.getProps(["x", "y"], true);
      const val = ds.data?.[i] ?? 0;

      const text = `${Math.round(val)}${rScale.max === 100 ? "%" : ""}`;
      const w = ctx.measureText(text).width + padX * 2;
      const h = 18;

      // bubble bg
      ctx.beginPath();
      ctx.fillStyle = bg;
      ctx.strokeStyle = "rgba(0,0,0,.08)";
      ctx.lineWidth = 1;
      const bx = x + (x < rScale.xCenter ? -w - 8 : 8);
      const by = y - h / 2;
      const r = radius;
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + w, by, bx + w, by + h, r);
      ctx.arcTo(bx + w, by + h, bx, by + h, r);
      ctx.arcTo(bx, by + h, bx, by, r);
      ctx.arcTo(bx, by, bx + w, by, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // text
      ctx.fillStyle = fg;
      ctx.fillText(text, bx + padX, by + h / 2);
    });
    ctx.restore();
  },
};

/* ---------------------- plugin: soft line shadow ----------------------- */
const softLineShadow = {
  id: "softLineShadow",
  beforeDatasetsDraw(chart, _args, opts) {
    const meta = chart.getDatasetMeta(0);
    const ctx = chart.ctx;
    if (!meta?.dataset) return;
    ctx.save();
    ctx.shadowColor = toRgba(opts?.color || "#000", opts?.alpha ?? 0.18);
    ctx.shadowBlur = opts?.blur ?? 12;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

ChartJS.register(ringBackgroundPlugin, pointValuePlugin, softLineShadow);

/* ================================ Component ================================ */
export default function Radar5({
  labels = ["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "สื่อสาร"],
  values = [0, 0, 0, 0, 0],
  maxValues = [100, 100, 100, 100, 100],
  height = 420,
  baseColor = "rgba(99,102,241,1)", // indigo-500
  theme = "light",
  showPercent: showPercentProp,
}) {
  const L = Math.min(labels.length, values.length, maxValues.length);
  const _labels = labels.slice(0, L);
  const _maxValues = maxValues.slice(0, L).map((m) => (Number(m) || 100));

  const processed = useMemo(() => {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(+v) ? +v : 0));
    return _labels.map((_, i) => clamp(values[i], 0, _maxValues[i] ?? 100));
  }, [values, _labels, _maxValues]);

  const scaleMax = useMemo(() => Math.max(..._maxValues, 10), [_maxValues]);
  const showPercent = showPercentProp ?? scaleMax === 100;

  // gradient fill + line color
  const backgroundColor = useMemo(() => {
    return (ctx) => {
      const { chart } = ctx;
      const area = chart?.chartArea;
      const c = chart?.ctx;
      if (!area || !c) return toRgba(baseColor, 0.15);
      const g = c.createLinearGradient(area.left, area.top, area.right, area.bottom);
      g.addColorStop(0, toRgba(baseColor, 0.3));
      g.addColorStop(1, toRgba(baseColor, 0.08));
      return g;
    };
  }, [baseColor]);
  const borderColor = toRgba(baseColor, 1);
  const pointColor = borderColor;

  // ช่วงระยะ tick ที่อ่านง่าย
  const step = useMemo(() => {
    const rough = scaleMax / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    return Math.max(1, Math.ceil(rough / pow) * pow);
  }, [scaleMax]);

  const gridColor = theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
  const angleColor = theme === "dark" ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  const labelColor = theme === "dark" ? "#f1f3f5" : "#3b3b3b";

  const data = useMemo(
    () => ({
      labels: _labels,
      datasets: [
        {
          label: "คะแนน",
          data: processed,
          fill: true,
          backgroundColor,
          borderColor,
          borderWidth: 2.2,
          pointBackgroundColor: pointColor,
          pointBorderColor: "#fff",
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointHoverBorderColor: pointColor,
        },
      ],
    }),
    [_labels, processed, backgroundColor, borderColor, pointColor]
  );

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 12 },
      animation: { duration: prefersReduced ? 0 : 700, easing: "easeOutQuart" },
      scales: {
        r: {
          beginAtZero: true,
          max: scaleMax,
          ticks: {
            stepSize: step,
            backdropColor: "transparent",
            color: theme === "dark" ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.65)",
            font: { size: 11, weight: 600 },
            callback: (v) => (showPercent ? `${v}%` : v),
          },
          grid: { circular: true, color: gridColor, lineWidth: 1 },
          angleLines: { color: angleColor, lineWidth: 1 },
          pointLabels: { font: { size: 12, weight: 700 }, color: labelColor, centerPointLabels: true },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          backgroundColor: theme === "dark" ? "rgba(15,15,20,.92)" : "rgba(255,255,255,.95)",
          titleColor: theme === "dark" ? "#e9ecef" : "#111",
          bodyColor: theme === "dark" ? "#e9ecef" : "#111",
          borderWidth: 1,
          borderColor: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)",
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const cap = _maxValues[i] ?? scaleMax;
              const raw = Math.min(values[i] ?? 0, cap);
              return showPercent ? `${_labels[i]}: ${Math.round(ctx.raw)}%` : `${_labels[i]}: ${raw} / ${cap}`;
            },
            title: () => "รายละเอียด",
          },
        },
        ringBackground: { rings: 5, baseColor: theme === "dark" ? "#fff" : "#000" },
        pointValue: { show: true, badgeBg: "rgba(255,255,255,.92)", badgeFg: "#111" },
        softLineShadow: { color: "#000", alpha: 0.16, blur: 10 },
      },
      elements: { line: { tension: 0.28 } },
    }),
    [prefersReduced, scaleMax, step, theme, showPercent, _maxValues, values, _labels, gridColor, angleColor, labelColor]
  );

  return (
    <div
      style={{
        height,
        aspectRatio: "1 / 1",
        maxWidth: height,
        margin: "0 auto",
      }}
      role="img"
      aria-label={`กราฟเรดาร์แบบสวยงาม ${showPercent ? "หน่วยเปอร์เซ็นต์" : "หน่วยคะแนนจริง"}`}
    >
      <Radar data={data} options={options} />
    </div>
  );
}
