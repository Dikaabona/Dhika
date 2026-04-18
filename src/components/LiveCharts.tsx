
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveReport, Employee } from '../types';
import { Icons, LIVE_BRANDS } from '../constants';

interface LiveChartsProps {
  reports: LiveReport[];
  employees: Employee[];
  brands: any[];
  forcedBrand?: string;
  isPublicView?: boolean;
}

declare global {
  interface Window {
    Chart: any;
  }
}

const LiveCharts: React.FC<LiveChartsProps> = ({ reports, employees, brands, forcedBrand, isPublicView = false }) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getSevenDaysAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getSevenDaysAgoStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedBrand, setSelectedBrand] = useState(forcedBrand || 'ALL');
  const [selectedHost, setSelectedHost] = useState('ALL');

  const chart1Ref = useRef<HTMLCanvasElement>(null);
  const chart2Ref = useRef<HTMLCanvasElement>(null);
  const chart3Ref = useRef<HTMLCanvasElement>(null);
  const chart4Ref = useRef<HTMLCanvasElement>(null);
  const chart5Ref = useRef<HTMLCanvasElement>(null);
  const chartInstances = useRef<any[]>([]);

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => { map[e.id] = e.nama; });
    return map;
  }, [employees]);

  // Derive host list from reports or employees
  const hostList = useMemo(() => {
    return employees.filter(e => {
      const jabatan = (e.jabatan || '').toLowerCase();
      return jabatan.includes('host');
    });
  }, [employees]);

  // Filter reports based on user criteria
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesBrand = selectedBrand === 'ALL' || r.brand === selectedBrand;
      const matchesHost = selectedHost === 'ALL' || r.hostId === selectedHost;
      const matchesDate = r.tanggal >= startDate && r.tanggal <= endDate;
      return matchesBrand && matchesHost && matchesDate;
    });
  }, [reports, selectedBrand, selectedHost, startDate, endDate]);

  useEffect(() => {
    if (!window.Chart || filteredReports.length === 0) return;

    // Bersihkan chart sebelumnya
    chartInstances.current.forEach(instance => instance.destroy());
    chartInstances.current = [];

    // --- DATA PROCESSING ---

    // 1. Performance Host di setiap Brand (Top Host by GMV per Brand)
    const activeBrands: string[] = Array.from<string>(new Set(filteredReports.map(r => r.brand)));
    const hostPerformancePerBrand: Record<string, Record<string, number>> = {};
    
    filteredReports.forEach(r => {
      if (!hostPerformancePerBrand[r.brand]) hostPerformancePerBrand[r.brand] = {};
      const hostName = employeeMap[r.hostId] || 'Unknown';
      hostPerformancePerBrand[r.brand][hostName] = (hostPerformancePerBrand[r.brand][hostName] || 0) + (r.gmv || 0);
    });

    // 2. GMV Daily setiap Brand
    const dates: string[] = Array.from<string>(new Set(filteredReports.map(r => r.tanggal))).sort();
    const dailyGMVByBrand: Record<string, number[]> = {};
    
    activeBrands.forEach(brand => {
      dailyGMVByBrand[brand] = dates.map(date => {
        return filteredReports
          .filter(r => r.brand === brand && r.tanggal === date)
          .reduce((sum, r) => sum + (r.gmv || 0), 0);
      });
    });

    // 3. Total GMV setiap Host (Overall)
    const hostTotalGMV: Record<string, number> = {};
    filteredReports.forEach(r => {
      const hostName = employeeMap[r.hostId] || 'Unknown';
      hostTotalGMV[hostName] = (hostTotalGMV[hostName] || 0) + (r.gmv || 0);
    });
    const sortedHosts = Object.entries(hostTotalGMV)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // 4. Best Seller Products (Top Products by Qty)
    const productQty: Record<string, number> = {};
    filteredReports.forEach(r => {
      if (r.bestSeller) {
        productQty[r.bestSeller] = (productQty[r.bestSeller] || 0) + (r.qty || 0);
      }
    });
    const topProductsByQty = Object.entries(productQty)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // 5. Top Products by GMV
    const productGMV: Record<string, number> = {};
    filteredReports.forEach(r => {
      if (r.bestSeller) {
        productGMV[r.bestSeller] = (productGMV[r.bestSeller] || 0) + (r.gmvPerProduct || 0);
      }
    });
    const topProductsByGMV = Object.entries(productGMV)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // --- CHART INITIALIZATION ---

    // Chart 1: Host Performance per Brand (Stacked Bar)
    if (chart1Ref.current) {
      const allHostsInReports = Array.from<string>(new Set(Object.values(hostPerformancePerBrand).flatMap(h => Object.keys(h))));
      const datasets = allHostsInReports.slice(0, 5).map((host, idx) => ({
        label: host,
        data: activeBrands.map(brand => hostPerformancePerBrand[brand][host] || 0),
        backgroundColor: `hsla(${idx * 45}, 70%, 60%, 0.8)`,
        borderRadius: 8
      }));

      chartInstances.current.push(new window.Chart(chart1Ref.current, {
        type: 'bar',
        data: { labels: activeBrands, datasets },
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
      const lineDatasets = activeBrands.map((brand, idx) => ({
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

    // Chart 4: Best Seller Products (Bar Chart - Qty)
    if (chart4Ref.current && topProductsByQty.length > 0) {
      chartInstances.current.push(new window.Chart(chart4Ref.current, {
        type: 'bar',
        data: {
          labels: topProductsByQty.map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name),
          datasets: [{
            label: 'Qty Terjual',
            data: topProductsByQty.map(([, val]) => val),
            backgroundColor: '#FFC000',
            borderRadius: 12
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'TOP 10 BEST SELLER PRODUCTS (QTY)', font: { size: 14, weight: '900' }, padding: 20 },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => `Terjual: ${context.raw} pcs`
              }
            }
          },
          scales: {
            x: { beginAtZero: true }
          }
        }
      }));
    }

    // Chart 5: GMV Per Product (Pie/Doughnut Chart)
    if (chart5Ref.current && topProductsByGMV.length > 0) {
      chartInstances.current.push(new window.Chart(chart5Ref.current, {
        type: 'doughnut',
        data: {
          labels: topProductsByGMV.map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name),
          datasets: [{
            data: topProductsByGMV.map(([, val]) => val),
            backgroundColor: topProductsByGMV.map((_, idx) => `hsla(${idx * 36}, 70%, 50%, 0.8)`),
            borderWidth: 0,
            hoverOffset: 20
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'GMV DISTRIBUTION BY PRODUCT', font: { size: 14, weight: '900' }, padding: 20 },
            legend: { 
              position: 'right', 
              labels: { 
                boxWidth: 10, 
                font: { size: 9, weight: 'bold' },
                generateLabels: (chart: any) => {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label: string, i: number) => {
                      const value = data.datasets[0].data[i];
                      const formattedValue = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
                      return {
                        text: `${label}: ${formattedValue}`,
                        fillStyle: data.datasets[0].backgroundColor[i],
                        hidden: false,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              } 
            }
          },
          cutout: '60%'
        }
      }));
    }

    return () => {
      chartInstances.current.forEach(instance => instance.destroy());
    };
  }, [filteredReports, employeeMap]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* FILTER SECTION */}
      <div className="bg-slate-50 p-1.5 rounded-[24px] sm:rounded-[28px] border border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-3 shadow-inner">
        {!isPublicView && (
          <select 
            value={selectedBrand} 
            onChange={(e) => setSelectedBrand(e.target.value)} 
            className="bg-white border border-slate-200 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[20px] sm:rounded-[22px] text-[10px] font-black text-slate-900 outline-none shadow-sm appearance-none text-center uppercase tracking-widest sm:flex-grow"
          >
            <option value="ALL">SEMUA BRAND</option>
            {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        )}

        {isPublicView && (
          <div className="bg-slate-900 text-[#FFC000] px-4 sm:px-6 py-3 sm:py-3.5 rounded-[20px] sm:rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center sm:flex-grow">
            BRAND: {selectedBrand}
          </div>
        )}

        <select 
          value={selectedHost} 
          onChange={(e) => setSelectedHost(e.target.value)} 
          className="bg-white border border-slate-200 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[20px] sm:rounded-[22px] text-[10px] font-black text-slate-900 outline-none shadow-sm appearance-none text-center uppercase tracking-widest sm:flex-grow"
        >
          <option value="ALL">SEMUA HOST</option>
          {hostList.map(h => <option key={h.id} value={h.id}>{h.nama.toUpperCase()}</option>)}
        </select>
        
        <div className="flex items-center justify-center gap-3 px-6 py-3 bg-white rounded-[20px] sm:rounded-[22px] shadow-sm border border-slate-100 shrink-0">
          <div className="flex flex-col items-center sm:items-start min-w-[80px] sm:min-w-[100px]">
            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Mulai</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="bg-transparent text-[9px] sm:text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
            />
          </div>
          <div className="h-6 sm:h-8 w-px bg-slate-100"></div>
          <div className="flex flex-col items-center sm:items-start min-w-[80px] sm:min-w-[100px]">
            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sampai</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="bg-transparent text-[9px] sm:text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
            />
          </div>
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-300">
           <Icons.Database className="w-16 h-16 mb-4 opacity-20" />
           <p className="text-xs font-black uppercase tracking-[0.3em]">Tidak ada data untuk filter ini</p>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
             <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm h-[300px] sm:h-[400px]">
                <canvas ref={chart2Ref}></canvas>
             </div>
             <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm h-[300px] sm:h-[400px]">
                <canvas ref={chart1Ref}></canvas>
             </div>
          </div>
          {!isPublicView && (
            <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm h-[350px] sm:h-[450px]">
               <canvas ref={chart3Ref}></canvas>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
             <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm h-[350px] sm:h-[450px]">
                <canvas ref={chart4Ref}></canvas>
             </div>
             <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 shadow-sm h-[350px] sm:h-[450px]">
                <canvas ref={chart5Ref}></canvas>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCharts;
