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

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

/**
 * props:
 *  - labels: string[]         ชื่อแกน (5 แกน)
 *  - values: number[]         คะแนนที่ได้ต่อแกน (ความยาวควรเท่ากับ labels)
 *  - maxValues: number[]      ค่าสูงสุดต่อแกน เช่น [40,20,20,10,10]
 *  - normalize?: boolean      true = แปลงเป็น % ต่อแกน (default: false)
 *  - height?: number          ความสูงกราฟ (px) (default: 420)
 *  - baseColor?: string       สีหลัก (default: เทา-ม่วงโทนระบบ)
 */
export default function Radar5({
  labels = ["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "สื่อสาร"],
  values = [0, 0, 0, 0, 0],
  maxValues = [40, 20, 20, 10, 10],
  normalize = false,
  height = 420,
  baseColor = "rgba(99,102,241,1)", // indigo-500
}) {
  // ป้องกันความยาวไม่เท่ากัน
  const L = Math.min(labels.length, values.length, maxValues.length);
  const _labels = labels.slice(0, L);
  const _maxValues = maxValues.slice(0, L);

  // clamp + normalize (ถ้าตั้งค่า)
  const processed = useMemo(() => {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
    const arr = [];
    for (let i = 0; i < L; i++) {
      const cap = _maxValues[i] ?? 100;
      const raw = clamp(values[i], 0, cap);
      arr.push(normalize ? Math.round((raw / cap) * 100) : raw);
    }
    return arr;
  }, [values, _maxValues, normalize, L]);

  // max scale: ถ้า normalize ใช้ 100 เสมอ
  const scaleMax = useMemo(
    () => (normalize ? 100 : Math.max(..._maxValues, 10)),
    [_maxValues, normalize]
  );

  // คำนวณ step สวย ๆ 4–5 ช่อง
  const step = useMemo(() => {
    const rough = scaleMax / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const nice = Math.ceil(rough / pow) * pow;
    return nice;
  }, [scaleMax]);

  // สีไล่เฉดแบบ gradient (fill)
  const backgroundColor = useMemo(() => {
    // chart.js scriptable color: รับ context เพื่อสร้าง gradient ตาม chartArea
    return (ctx) => {
      const { chart } = ctx;
      const { ctx: c, chartArea } = chart;
      if (!chartArea) return "rgba(99,102,241,0.15)";
      const g = c.createLinearGradient(
        chartArea.left,
        chartArea.top,
        chartArea.right,
        chartArea.bottom
      );
      // โทน indigo -> transparent
      g.addColorStop(0, baseColor.replace("1)", "0.28)")); // 28% ณ ศูนย์กลาง
      g.addColorStop(1, baseColor.replace("1)", "0.06)")); // 6% ขอบนอก
      return g;
    };
  }, [baseColor]);

  const borderColor = baseColor;
  const pointColor = baseColor;

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
          borderWidth: 2,
          pointBackgroundColor: pointColor,
          pointBorderColor: "#fff",
          pointRadius: 3,
          pointHoverRadius: 5,
          pointHoverBorderColor: pointColor,
        },
      ],
    }),
    [_labels, processed, backgroundColor, borderColor, pointColor]
  );

  // ลดแอนิเมชันตาม user preference
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: prefersReduced ? 0 : 600 },
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: scaleMax,
          ticks: {
            stepSize: step,
            // ถ้า normalize โชว์เป็น % ชัด ๆ
            callback: (v) => (normalize ? `${v}%` : v),
          },
          grid: { circular: true, color: "rgba(0,0,0,.06)" },
          angleLines: { color: "rgba(0,0,0,.08)" },
          pointLabels: {
            font: { size: 12, weight: 600 },
            color: "#3b3b3b",
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const cap = _maxValues[i] ?? scaleMax;
              const raw = Math.min(values[i] ?? 0, cap);
              if (normalize) {
                const pct = ctx.raw; // 0..100
                return `${_labels[i]}: ${pct}%  (เดิม: ${raw} / ${cap})`;
              }
              return `${_labels[i]}: ${raw} / ${cap}`;
            },
            title: () => "รายละเอียด",
          },
        },
      },
      // ให้เรดาร์ดูนุ่มขึ้นเล็กน้อย
      elements: {
        line: { tension: 0.25 },
      },
    }),
    [
      prefersReduced,
      scaleMax,
      step,
      normalize,
      _maxValues,
      values,
      _labels,
    ]
  );

  return (
    <div
      style={{ height }}
      role="img"
      aria-label={`กราฟเรดาร์ ${normalize ? "แบบเปอร์เซ็นต์" : "ค่าคะแนนจริง"} ของสมรรถนะ 5 ด้าน`}
    >
      <Radar data={data} options={options} />
    </div>
  );
}
