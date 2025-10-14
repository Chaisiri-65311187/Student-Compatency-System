import React, { useMemo } from "react";
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/**
 * props:
 *  - labels: string[] (5 แกน)
 *  - values: number[] (คะแนนที่ได้ในแต่ละแกน)
 *  - maxValues: number[] (ค่าสูงสุดของแต่ละแกน เช่น [40,20,20,10,10])
 */
export default function Radar5({ labels, values, maxValues }){
  const max = useMemo(()=> Math.max(...(maxValues || [40,20,20,10,10])), [maxValues]);

  const data = useMemo(()=>({
    labels,
    datasets: [
      {
        label: "คะแนน",
        data: values,
        fill: true,
        // อย่าระบุสีแบบตายตัวมากนัก ถ้าต้องการธีมค่อยปรับ
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        borderColor: "rgba(99, 102, 241, 1)",
        pointBackgroundColor: "rgba(99, 102, 241, 1)",
        pointBorderColor: "#fff",
        pointHoverBorderColor: "rgba(99, 102, 241, 1)",
      }
    ]
  }), [labels, values]);

  const options = useMemo(()=>({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        suggestedMax: max,
        ticks: { stepSize: Math.ceil(max/4) },
        grid: { circular: true },
        angleLines: { color: "rgba(0,0,0,.08)" },
        pointLabels: { font: { size: 12 } }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const i = ctx.dataIndex;
            const v = ctx.raw;
            const cap = maxValues?.[i] ?? max;
            return `${labels[i]}: ${v} / ${cap}`;
          }
        }
      }
    }
  }), [labels, max, maxValues]);

  return (
    <div style={{ height: 420 }}>
      <Radar data={data} options={options} />
    </div>
  );
}
