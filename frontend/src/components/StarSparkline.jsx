import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { getStarHistory } from '../api/api';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const StarSparkline = ({ stars, period }) => {
  const [history, setHistory] = useState(null);
  const { isDark } = useTheme();

  useEffect(() => {
    let cancelled = false;
    getStarHistory(stars, period)
      .then((res) => {
        if (!cancelled) setHistory(res.data);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      });
    return () => { cancelled = true; };
  }, [stars, period]);

  if (!history || history.length === 0) return null;

  const isUp = history[history.length - 1]?.stars >= history[0]?.stars;
  const lineColor = isUp ? '#52c41a' : '#ff4d4f';
  const bgColor = isUp ? 'rgba(82, 196, 26, 0.08)' : 'rgba(255, 77, 79, 0.08)';
  const tickColor = isDark ? '#aaa' : '#999';

  const labels = history.map((_, i) => i % 15 === 0 ? history[i].date.slice(5) : '');
  const data = history.map((d) => d.stars);

  const chartData = {
    labels,
    datasets: [
      {
        data,
        borderColor: lineColor,
        backgroundColor: bgColor,
        fill: true,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: lineColor,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        titleFont: { size: 10 },
        bodyFont: { size: 10 },
        callbacks: {
          title: (items) => history[items[0].dataIndex]?.date,
          label: (item) => `${item.raw.toLocaleString()} Stars`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        ticks: { maxTicksLimit: 4, font: { size: 8 }, color: tickColor },
        grid: { display: false },
      },
      y: {
        display: false,
      },
    },
  };

  return (
    <div style={{ height: 56, marginTop: 8, borderRadius: 8, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default StarSparkline;