import React, { useEffect, useRef, useMemo } from 'react';
import { LiveReport, Employee } from '../types';
// Import Icons from constants to fix "Cannot find name 'Icons'" error
import { Icons } from '../constants';

interface LiveChartsProps {
  reports: LiveReport[];
  employees: Employee[];
}

declare global {
  interface Window {
    Chart: any;
  }
}

const LiveCharts: React.FC<LiveChartsProps> = ({ reports, employees }) => {
  const chart1Ref = useRef<HTMLCanvasElement>(null);
  const chart2Ref = useRef<HTMLCanvasElement>(null);
  const chart3Ref = useRef<HTMLCanvasElement>(null);
  const chartInstances = useRef<any[]>([]);

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => { map[e.id] = e.nama; });
    return map;
  }, [employees]);

  useEffect(() => {
    if (!window.Chart || reports.length === 0) return;

    // Bersihkan chart sebelumnya
    chartInstances.current.forEach(instance => instance.destroy());
    chartInstances.current = [];

    // --- DATA PROCESSING ---

    // 1. Performance Host di setiap Brand (Top Host by GMV per Brand)
    // Fix: Explicitly type brands as string[] to avoid 'unknown' index type errors
    // Use Array.from<string> to ensure correct type inference
    const brands: string[] = Array.from<string>(new Set(reports.map(r => r.brand)));
    const hostPerformancePerBrand: Record<string, Record<string, number>> = {};
    
    reports.forEach(r => {
      if (!hostPerformancePerBrand[r.brand]) hostPerformancePerBrand[r.brand] = {};
      const hostName = employeeMap[r.hostId] || 'Unknown';
      hostPerformancePerBrand[r.brand][hostName] = (hostPerformancePerBrand[r.brand][hostName] || 0) + (r.gmv || 0);
    });

    // 2. GMV Daily setiap Brand
    // Fix: Explicitly type dates as string[] to avoid 'unknown' property access errors like .split()
    // Use Array.from<string> to ensure correct type inference
    const dates: string[] = Array.from<string>(new Set(reports.map(r => r.tanggal))).sort();
    const dailyGMVByBrand: Record<string, number[]> = {};
    
    brands.forEach(brand => {
      dailyGMVByBrand[brand] = dates.map(date => {
        return reports
          .filter(r => r.brand === brand && r.tanggal === date)
          .reduce((sum, r) => sum + (r.gmv || 0), 0);
      });
    });

    // 3. Total GMV setiap Host (Overall)
    const hostTotalGMV: Record<string, number> = {};
    reports.forEach(r => {
      const hostName = employeeMap[r.hostId] || 'Unknown';
      hostTotalGMV[hostName] = (hostTotalGMV[hostName] || 0) + (r.gmv || 0);
    });
    const sortedHosts = Object.entries(hostTotalGMV)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // --- CHART INITIALIZATION ---

    // Chart 1: Host Performance per Brand (Stacked Bar)
    if (chart1Ref.current) {
      // Use Array.from<string> to ensure correct type inference
      const allHostsInReports = Array.from<string>(new Set(Object.values(hostPerformancePerBrand).flatMap(h => Object.keys(h))));
      const datasets = allHostsInReports.slice(0, 5).map((host, idx) => ({
        label: host,
        data: brands.map(brand => hostPerformancePerBrand[brand][host] || 0),
        backgroundColor: `hsla(${idx * 45}, 70%, 60%, 0.8)`,
        borderRadius: 8
      }));

      chartInstances.current.push(new window.Chart(chart1Ref.current, {
        type: 'bar',
        data: { labels: brands, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'TOP HOST PERFORMANCE BY BRAND (GMV)', font: { size: 14, weight: '900' }, padding: 20 },
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (val: any) => 'Rp ' + (val / 1000000).toFixed(1) + 'M' } }
          }
        }
      }));
    }

    // Chart 2: Daily GMV per Brand (Line)
    if (chart2Ref.current) {
      const lineDatasets = brands.map((brand, idx) => ({
        label: brand,
        data: dailyGMVByBrand[brand],
        borderColor: `hsla(${idx * 90}, 70%, 50%, 1)`,
        backgroundColor: `hsla(${idx * 90}, 70%, 50%, 0.1)`,
        fill: true,
        tension: 0.4,
        pointRadius: 4
      }));

      chartInstances.current.push(new window.Chart(chart2Ref.current, {
        type: 'line',
        data: { labels: dates.map(d => d.split('-').slice(1).join('/')), datasets: lineDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'DAILY GMV TREND BY BRAND', font: { size: 14, weight: '900' }, padding: 20 },
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (val: any) => 'Rp ' + (val / 1000).toFixed(0) + 'K' } }
          }
        }
      }));
    }

    // Chart 3: Total GMV per Host (Bar)
    if (chart3Ref.current) {
      chartInstances.current.push(new window.Chart(chart3Ref.current, {
        type: 'bar',
        data: {
          labels: sortedHosts.map(([name]) => name.split(' ')[0]),
          datasets: [{
            label: 'Total GMV',
            data: sortedHosts.map(([, val]) => val),
            backgroundColor: '#0f172a',
            borderRadius: 12
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'TOP 10 HOST LEADERBOARD (TOTAL GMV)', font: { size: 14, weight: '900' }, padding: 20 },
            legend: { display: false }
          },
          scales: {
            x: { beginAtZero: true, ticks: { callback: (val: any) => 'Rp ' + (val / 1000000).toFixed(1) + 'M' } }
          }
        }
      }));
    }

    return () => {
      chartInstances.current.forEach(instance => instance.destroy());
    };
  }, [reports, employeeMap]);

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-300">
         <Icons.Database className="w-16 h-16 mb-4 opacity-20" />
         <p className="text-xs font-black uppercase tracking-[0.3em]">Belum ada data laporan untuk diolah</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-[400px]">
            <canvas ref={chart2Ref}></canvas>
         </div>
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-[400px]">
            <canvas ref={chart1Ref}></canvas>
         </div>
      </div>
      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm h-[450px]">
         <canvas ref={chart3Ref}></canvas>
      </div>
    </div>
  );
};

export default LiveCharts;
