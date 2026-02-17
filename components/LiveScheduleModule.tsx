
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, LiveSchedule, LiveReport, AttendanceRecord, ShiftAssignment, Shift } from '../types';
import { Icons, LIVE_BRANDS as INITIAL_BRANDS, TIME_SLOTS } from '../constants';
import { supabase } from '../App';
import { generateGoogleCalendarUrl, getMondayISO, getSundayISO, formatDateToYYYYMMDD } from '../utils/dateUtils';
import LiveReportModule from './LiveReportModule';
import LiveCharts from './LiveCharts';

interface LiveScheduleModuleProps {
  employees: Employee[];
  schedules: LiveSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<LiveSchedule[]>>;
  reports: LiveReport[];
  setReports: React.Dispatch<React.SetStateAction<LiveReport[]>>;
  searchQuery?: string;
  userRole?: string;
  company: string;
  onClose?: () => void;
  attendanceRecords?: AttendanceRecord[];
  shiftAssignments?: ShiftAssignment[];
  shifts?: Shift[];
  onRefreshData?: () => void;
}

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthStartString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getMonthEndString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

const DEFAULT_HOLIDAYS = {
  'SENIN': [], 'SELASA': [], 'RABU': [], 'KAMIS': [], 'JUMAT': [], 'SABTU': [], 'MINGGU': []
};

const isDateInRange = (target: string, start: string, end: string) => {
  const t = new Date(target).getTime();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return t >= s && t <= e;
};

const DAYS_OF_WEEK = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

const LiveScheduleModule: React.FC<LiveScheduleModuleProps> = ({ employees, schedules, setSchedules, reports, setReports, userRole = 'employee', company, onClose, attendanceRecords = [], shiftAssignments = [], shifts = [], onRefreshData }) => {
  const readOnly = userRole === 'employee';
  const [activeSubTab, setActiveSubTab] = useState<'JADWAL' | 'REPORT' | 'GRAFIK' | 'LIBUR' | 'BRAND'>('JADWAL');
  
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  
  const [localSearch, setLocalSearch] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('SEMUA BRAND');
  const [showEmptySlots, setShowEmptySlots] = useState(false); 
  const [newBrandName, setNewBrandName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [holidayStartDate, setHolidayStartDate] = useState(getMondayISO(new Date()));
  const [holidayEndDate, setHolidayEndDate] = useState(getSundayISO(new Date()));

  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>(DEFAULT_HOLIDAYS);
  const [brands, setBrands] = useState<any[]>(INITIAL_BRANDS);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBrandsAndHolidays();
  }, [company]);

  const fetchBrandsAndHolidays = async () => {
    try {
      const { data: brandData } = await supabase.from('settings').select('value').eq('key', `live_brands_${company}`).single();
      if (brandData) setBrands(brandData.value);

      const { data: holidayData } = await supabase.from('settings').select('value').eq('key', `weekly_holidays_${company}`).single();
      if (holidayData) {
        const stored = holidayData.value;
        const currentMonday = getMondayISO(new Date());
        if (stored && typeof stored === 'object' && stored.weekStart === currentMonday) {
          setWeeklyHolidays(stored.days || DEFAULT_HOLIDAYS);
        } else {
          setWeeklyHolidays(DEFAULT_HOLIDAYS);
        }
      }
    } catch (e) {}
  };

  const handleSaveBrands = async (updatedBrands: any[]) => {
    try {
      await supabase.from('settings').upsert({
        key: `live_brands_${company}`,
        value: updatedBrands
      }, { onConflict: 'key' });
      setBrands(updatedBrands);
    } catch (err: any) {
      alert("Gagal sinkronisasi brand: " + err.message);
    }
  };

  const addBrand = async () => {
    const name = newBrandName.trim().toUpperCase();
    if (!name) return;
    if (brands.some((b: any) => b.name === name)) return alert("Brand sudah ada.");
    const updated = [...brands, { name, color: 'bg-slate-200' }];
    await handleSaveBrands(updated);
    setNewBrandName('');
  };

  const removeBrand = async (name: string) => {
    if (!confirm(`Hapus brand "${name}"?`)) return;
    const updated = brands.filter((b: any) => b.name !== name);
    await handleSaveBrands(updated);
  };
  
  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => { map[e.id] = e.nama.toUpperCase(); });
    return map;
  }, [employees]);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        let notFoundNames: string[] = [];
        let earliestDateInExcel = '';
        let latestDateInExcel = '';

        const rawParsedSchedules = jsonData.map((row: any) => {
          const brand = String(row['BRAND'] || '').toUpperCase().trim();
          let rawDate = row['TANGGAL'];
          let formattedDate = '';
          
          if (rawDate instanceof Date) {
            formattedDate = formatDateToYYYYMMDD(rawDate);
          } else if (typeof rawDate === 'number') {
             const date = new Date((rawDate - 25569) * 86400 * 1000);
             formattedDate = formatDateToYYYYMMDD(date);
          } else {
             formattedDate = String(rawDate || '').trim();
          }

          if (formattedDate) {
            if (!earliestDateInExcel || formattedDate < earliestDateInExcel) earliestDateInExcel = formattedDate;
            if (!latestDateInExcel || formattedDate > latestDateInExcel) latestDateInExcel = formattedDate;
          }

          const hourSlot = String(row['SLOT WAKTU'] || '').trim();
          const cleanName = (n: any) => String(n || '').replace(/[\s\t\n\r]+/g, ' ').trim().toUpperCase();
          
          const hostName = cleanName(row['NAMA HOST']);
          const opName = cleanName(row['NAMA OPERATOR']);
          
          const hostId = employees.find(e => cleanName(e.nama) === hostName)?.id || '';
          const opId = employees.find(e => cleanName(e.nama) === opName)?.id || '';

          if (hostName && !hostId) notFoundNames.push(hostName);
          if (opName && !opId) notFoundNames.push(opName);

          if (!brand || !formattedDate || !hourSlot) return null;

          return {
            date: formattedDate,
            brand,
            hourSlot,
            company,
            hostId,
            opId
          };
        }).filter(s => s !== null);

        if (rawParsedSchedules.length > 0) {
          const importedBrands = Array.from(new Set(rawParsedSchedules.map((s: any) => s.brand)));
          const missingBrands = importedBrands.filter(b => !brands.some((ex: any) => ex.name === b));
          
          if (missingBrands.length > 0) {
            if (confirm(`BRAND BARU TERDETEKSI: ${missingBrands.join(', ')}. Daftarkan brand ini secara otomatis?`)) {
              const updatedBrands = [...brands, ...missingBrands.map(b => ({ name: b, color: 'bg-slate-200' }))];
              await handleSaveBrands(updatedBrands);
            }
          }

          const { data: inserted, error } = await supabase
            .from('schedules')
            .upsert(rawParsedSchedules, { onConflict: 'date,brand,hourSlot' })
            .select();

          if (error) throw error;
          
          // Re-fetch all data to ensure local state and cloud are perfectly in sync
          if (onRefreshData) onRefreshData();
          
          if (earliestDateInExcel && earliestDateInExcel < startDate) setStartDate(earliestDateInExcel);
          if (latestDateInExcel && latestDateInExcel > endDate) setEndDate(latestDateInExcel);
          
          alert(`Sukses! Berhasil mengimpor ${inserted?.length} jadwal ke Cloud Database.`);
        } else {
          alert("Tidak ada data valid yang ditemukan.");
        }
      } catch (err: any) { 
        alert("Gagal impor ke Cloud: " + err.message); 
      } finally { 
        setIsImporting(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    const exportedData = schedules.filter(s => isDateInRange(s.date, startDate, endDate));
    if (exportedData.length === 0) return alert("Data tidak ditemukan untuk rentang tanggal ini.");
    const dataToExport = exportedData.sort((a, b) => a.date.localeCompare(b.date)).map(s => ({
      'TANGGAL': s.date,
      'BRAND': s.brand.toUpperCase(),
      'SLOT WAKTU': s.hourSlot,
      'NAMA HOST': employeeMap[s.hostId] || '-',
      'NAMA OPERATOR': employeeMap[s.opId] || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Shift");
    XLSX.writeFile(wb, `Jadwal_Live_${company}_${startDate}_to_${endDate}.xlsx`);
  };

  const handleDownloadScheduleTemplate = () => {
    const template = [
      {
        'TANGGAL': formatDateToYYYYMMDD(new Date()),
        'BRAND': brands[0]?.name || 'HITJAB',
        'SLOT WAKTU': TIME_SLOTS[0],
        'NAMA HOST': employees[0]?.nama || 'NAMA HOST',
        'NAMA OPERATOR': employees[1]?.nama || 'NAMA OPERATOR'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Jadwal");
    XLSX.writeFile(wb, `Template_Jadwal_Live_${company}.xlsx`);
  };

  const hostList = useMemo(() => employees.filter(e => (e.jabatan || '').toUpperCase().includes('HOST')), [employees]);
  const opList = useMemo(() => employees.filter(e => (e.jabatan || '').toUpperCase().includes('OP') || (e.nama || '').toUpperCase().includes('ARIYANSYAH')), [employees]);
  
  const datesInRange = useMemo(() => {
    const dates = [];
    let dStart = new Date(startDate);
    let dEnd = new Date(endDate);
    
    if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) return [];
    
    const actualStart = dStart < dEnd ? dStart : dEnd;
    const actualEnd = dStart < dEnd ? dEnd : dStart;

    let current = new Date(actualStart);
    while (current <= actualEnd) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dStart < dEnd ? dates : dates.reverse();
  }, [startDate, endDate]);

  const updateSchedule = async (date: string, brand: string, hourSlot: string, field: 'hostId' | 'opId', value: string) => {
    if (readOnly) return;
    setIsSyncing(true);
    const existing = schedules.find(s => s.date === date && s.brand === brand.toUpperCase() && s.hourSlot === hourSlot);
    const newRecord = { ...(existing || {}), date, brand: brand.toUpperCase(), hourSlot, company, [field]: value };
    try {
      const { error } = await supabase.from('schedules').upsert(newRecord, { onConflict: 'date,brand,hourSlot' });
      if (error) throw error;
      if (onRefreshData) onRefreshData();
    } catch (err: any) { 
      alert("Gagal sinkronisasi ke Cloud: " + err.message); 
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteScheduleSlot = async (date: string, brand: string, hourSlot: string) => {
    if (readOnly) return;
    if (!confirm(`Hapus jadwal manual untuk ${brand} pada ${date} jam ${hourSlot}?`)) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .match({ date, brand: brand.toUpperCase(), hourSlot, company });
      
      if (error) throw error;
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert("Gagal menghapus di Cloud: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const holidayDates = useMemo(() => {
    const dates = [];
    let cur = new Date(holidayStartDate);
    let end = new Date(holidayEndDate);
    if (cur > end) return [];
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [holidayStartDate, holidayEndDate]);

  const holidayListByDate = useMemo(() => {
    const liveStaff = employees.filter(e => {
      const jab = (e.jabatan || '').toUpperCase();
      const name = (e.nama || '').toUpperCase();
      return jab.includes('HOST') || jab.includes('OP') || jab.includes('OPERATOR') || name.includes('ARIYANSYAH');
    });

    return holidayDates.map(dateStr => {
      const d = new Date(dateStr);
      const dayIndex = (d.getDay() + 6) % 7; 
      const dayName = DAYS_OF_WEEK[dayIndex];
      
      const offNames = liveStaff.filter(s => {
        const hasAssignment = shiftAssignments.some(a => a.employeeId === s.id && a.date === dateStr);
        return !hasAssignment;
      }).map(s => s.nama.toUpperCase());

      return { date: dateStr, day: dayName, names: offNames };
    });
  }, [holidayDates, employees, shiftAssignments]);

  const handleSetToday = () => {
    const today = getLocalDateString();
    setStartDate(today);
    setEndDate(today);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] md:min-h-[85vh] md:rounded-[60px] overflow-hidden shadow-2xl relative border-[8px] sm:border-[20px] border-white max-w-6xl mx-auto animate-in fade-in duration-700">
      
      {/* Header Visual Match Screenshot */}
      <div className="px-6 sm:px-14 pt-10 sm:pt-14 pb-8 bg-white shrink-0 space-y-10">
        <div className="flex items-center gap-8">
           <button onClick={onClose} className="bg-[#0f172a] p-5 rounded-3xl text-white shadow-xl hover:scale-105 active:scale-95 transition-all">
              <Icons.Home className="w-8 h-8 text-[#FFC000]" />
           </button>
           <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-none uppercase">LIVE STREAMING</h2>
        </div>

        {/* Sync Indicator */}
        {isSyncing && (
          <div className="fixed top-20 right-10 z-[200] bg-slate-900 text-[#FFC000] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
             <div className="w-2 h-2 bg-[#FFC000] rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black uppercase tracking-widest">Sinking to Cloud...</span>
          </div>
        )}

        {/* Navigation Tabs Match Screenshot */}
        <div className="bg-slate-100/60 p-2 rounded-full flex shadow-inner overflow-x-auto no-scrollbar max-w-4xl mx-auto">
          {['JADWAL', 'REPORT', 'GRAFIK', 'LIBUR', 'BRAND'].map((tab) => (
             ((tab !== 'BRAND' && tab !== 'LIBUR') || !readOnly) && (
              <button 
                key={tab} 
                onClick={() => setActiveSubTab(tab as any)} 
                className={`flex-1 py-4 px-10 rounded-full text-[11px] font-black tracking-widest uppercase transition-all duration-500 whitespace-nowrap ${activeSubTab === tab ? 'bg-white text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
              </button>
             )
          ))}
        </div>

        {activeSubTab === 'JADWAL' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex items-center bg-slate-100/50 border border-slate-50 rounded-[28px] px-4 py-5 shadow-inner gap-3 overflow-hidden">
                <div className="flex flex-col shrink-0">
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1">START</span>
                  <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value);}} className="text-[10px] font-black text-slate-900 outline-none bg-transparent cursor-pointer" />
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0"></div>
                <div className="flex flex-col shrink-0">
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1">END</span>
                  <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value);}} className="text-[10px] font-black text-slate-900 outline-none bg-transparent cursor-pointer" />
                </div>
                <button 
                  onClick={handleSetToday}
                  className="bg-slate-900 text-[#FFC000] px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shrink-0 ml-auto"
                >
                  TODAY
                </button>
              </div>
              <div className="relative flex-1 bg-slate-100/50 border border-slate-50 rounded-[28px] px-8 py-5 shadow-inner flex items-center gap-4">
                <Icons.Search className="w-6 h-6 text-slate-300" />
                <input type="text" placeholder="CARI HOST / BRAND..." value={localSearch} onChange={e => setLocalSearch(e.target.value)} className="w-full bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-900 outline-none placeholder:text-slate-200" />
              </div>
            </div>

            {!readOnly && (
              <div className="flex flex-col items-center gap-6">
                <div className="grid grid-cols-3 gap-6 w-full max-w-5xl">
                  <button onClick={handleDownloadScheduleTemplate} className="bg-slate-100/60 text-slate-500 px-8 py-7 rounded-[32px] text-[11px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-3 hover:bg-slate-200 transition-all border border-slate-100">
                    <Icons.Download className="w-5 h-5" /> TEMPLATE
                  </button>
                  
                  <input type="file" ref={fileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isImporting} 
                    className={`bg-white border border-slate-100 text-slate-900 px-8 py-7 rounded-[32px] text-[11px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 hover:bg-slate-50 transition-all animate-in fade-in duration-1000`}
                  >
                    <Icons.Upload className="w-5 h-5 text-indigo-500" /> {isImporting ? 'IMPORTING...' : 'IMPORT'}
                  </button>

                  <button onClick={handleExportExcel} className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-8 py-7 rounded-[32px] text-[11px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all">
                    <Icons.Download className="w-5 h-5" /> EKSPOR
                  </button>
                </div>

                <div className="flex items-center gap-4 px-8 py-3 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
                  <input 
                    type="checkbox" 
                    id="toggle-empty" 
                    checked={showEmptySlots} 
                    onChange={e => setShowEmptySlots(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer" 
                  />
                  <label htmlFor="toggle-empty" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer">Tampilkan Slot Kosong</label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* List Area */}
      <div className="flex-grow overflow-y-auto px-6 sm:px-14 pt-4 pb-20 bg-white custom-scrollbar">
        {activeSubTab === 'JADWAL' ? (
          <div className="space-y-12">
            {datesInRange.map(date => {
              const hasContentAtAll = TIME_SLOTS.some(slot => {
                return brands.some(b => {
                  const brandNameNorm = b.name.toUpperCase();
                  if (selectedBrandFilter !== 'SEMUA BRAND' && brandNameNorm !== selectedBrandFilter) return false;
                  const sched = schedules.find(s => s.date === date && s.brand === brandNameNorm && s.hourSlot === slot);
                  if (localSearch) {
                    const h = sched ? (employeeMap[sched.hostId] || '').toLowerCase() : '';
                    const o = sched ? (employeeMap[sched.opId] || '').toLowerCase() : '';
                    return h.includes(localSearch.toLowerCase()) || o.includes(localSearch.toLowerCase()) || brandNameNorm.includes(localSearch.toUpperCase());
                  }
                  return (sched && (sched.hostId || sched.opId));
                });
              });

              if (!hasContentAtAll && !showEmptySlots) return null;

              return (
                <div key={date} className="space-y-10">
                  <div className="flex items-center justify-center">
                    <div className="bg-slate-100 border border-slate-200 px-12 py-3.5 rounded-full shadow-inner">
                      <span className="text-[13px] font-black text-slate-900 uppercase tracking-[0.3em]">
                        {new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-12">
                    {TIME_SLOTS.map(slot => {
                      const brandsForSlot = brands.filter(b => {
                        const brandNameNorm = b.name.toUpperCase();
                        if (selectedBrandFilter !== 'SEMUA BRAND' && brandNameNorm !== selectedBrandFilter) return false;
                        const sched = schedules.find(s => s.date === date && s.brand === brandNameNorm && s.hourSlot === slot);
                        if (localSearch) {
                          const h = sched ? (employeeMap[sched.hostId] || '').toLowerCase() : '';
                          const o = sched ? (employeeMap[sched.opId] || '').toLowerCase() : '';
                          return h.includes(localSearch.toLowerCase()) || o.includes(localSearch.toLowerCase()) || brandNameNorm.includes(localSearch.toUpperCase());
                        }
                        return (sched && (sched.hostId || sched.opId)) || showEmptySlots;
                      });
                      if (brandsForSlot.length === 0) return null;
                      return (
                        <div key={`${date}-${slot}`} className="bg-slate-50/40 p-8 rounded-[48px] border border-slate-100 space-y-8 animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-6">
                            <span className="bg-[#0f172a] text-[#FFC000] px-8 py-2.5 rounded-full text-[11px] font-black tracking-widest">{slot}</span>
                            <div className="h-px flex-grow bg-slate-200"></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {brandsForSlot.map((brand: any) => {
                              const sched = schedules.find(s => s.date === date && s.brand === brand.name.toUpperCase() && s.hourSlot === slot) || { hostId: '', opId: '' };
                              return (
                                <div key={`${date}-${slot}-${brand.name}`} className="bg-white border border-slate-100 rounded-[32px] p-8 space-y-6 shadow-sm hover:shadow-xl transition-all relative group/slot">
                                  <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                                    <p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.1em]">{brand.name}</p>
                                    {!readOnly && (sched.hostId || sched.opId) && (
                                      <button 
                                        onClick={() => deleteScheduleSlot(date, brand.name, slot)}
                                        className="text-rose-400 hover:text-rose-600 opacity-0 group-hover/slot:opacity-100 transition-all p-2 rounded-xl hover:bg-rose-50"
                                      >
                                        <Icons.Trash className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-6">
                                     <div className="space-y-2.5">
                                        <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">HOST</label>
                                        <select value={sched.hostId} disabled={readOnly} onChange={(e) => updateSchedule(date, brand.name, slot, 'hostId', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-[10px] font-black appearance-none cursor-pointer text-slate-900 outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner">
                                          <option value="">-</option>
                                          {hostList.map(h => <option key={h.id} value={h.id}>{h.nama.toUpperCase()}</option>)}
                                        </select>
                                     </div>
                                     <div className="space-y-2.5">
                                        <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">OP</label>
                                        <select value={sched.opId} disabled={readOnly} onChange={(e) => updateSchedule(date, brand.name, slot, 'opId', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-[10px] font-black appearance-none cursor-pointer text-slate-900 outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner">
                                          <option value="">-</option>
                                          {opList.map(o => <option key={o.id} value={o.id}>{o.nama.toUpperCase()}</option>)}
                                        </select>
                                     </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {datesInRange.length === 0 && (
              <div className="py-32 text-center opacity-20">
                <Icons.Database className="w-20 h-20 mx-auto mb-6" />
                <p className="text-[11px] font-black uppercase tracking-[0.5em]">Tidak ada jadwal di rentang tanggal ini</p>
              </div>
            )}
          </div>
        ) : activeSubTab === 'REPORT' ? (
          <LiveReportModule employees={employees} reports={reports} setReports={setReports} userRole={userRole} company={company} onClose={() => setActiveSubTab('JADWAL')} />
        ) : activeSubTab === 'GRAFIK' ? (
          <LiveCharts reports={reports} employees={employees} />
        ) : activeSubTab === 'LIBUR' ? (
          <div className="space-y-12">
            <div className="flex items-center bg-slate-100/50 border border-slate-100 rounded-[28px] px-8 py-5 shadow-inner gap-8 w-fit mx-auto mb-12">
                <div className="flex flex-col shrink-0">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">DARI</span>
                  <input type="date" value={holidayStartDate} onChange={e => setHolidayStartDate(e.target.value)} className="text-[12px] font-black text-slate-900 outline-none bg-transparent cursor-pointer" />
                </div>
                <div className="w-px h-10 bg-slate-200 shrink-0"></div>
                <div className="flex flex-col shrink-0">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">SAMPAI</span>
                  <input type="date" value={holidayEndDate} onChange={e => setHolidayEndDate(e.target.value)} className="text-[12px] font-black text-slate-900 outline-none bg-transparent cursor-pointer" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {holidayListByDate.map(item => (
                <div key={item.date} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in zoom-in-95 duration-500 hover:shadow-lg transition-all">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase leading-none">{item.day}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-2">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="w-2 h-10 bg-indigo-500 rounded-full shadow-lg shadow-indigo-100"></div>
                  </div>
                  <div className="space-y-3">
                    {item.names.length > 0 ? (
                      item.names.map(name => (
                        <div key={name} className="p-5 bg-white rounded-3xl border border-indigo-50 shadow-sm flex items-center justify-between group">
                           <span className="text-[11px] font-black uppercase text-slate-700 group-hover:text-indigo-600 transition-colors">{name}</span>
                           <span className="bg-indigo-50 text-indigo-500 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase shadow-inner">OFF</span>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center opacity-20 border-2 border-dashed border-slate-200 rounded-[32px]">
                         <p className="text-[10px] font-black uppercase tracking-widest">Semua Aktif</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeSubTab === 'BRAND' ? (
          <div className="space-y-10 max-w-2xl mx-auto py-10 animate-in fade-in duration-500">
            {!readOnly && (
              <div className="bg-slate-100/50 p-6 rounded-[36px] flex gap-4 shadow-inner border border-slate-100">
                <input type="text" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="NAMA BRAND BARU..." className="flex-grow bg-white border border-slate-100 rounded-3xl px-8 py-5 text-sm font-black text-slate-900 uppercase tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/10 shadow-sm" />
                <button onClick={addBrand} className="bg-slate-900 text-[#FFC000] px-10 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">TAMBAH</button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {brands.map((b: any) => (
                <div key={b.name} className="bg-white p-8 rounded-[36px] border border-slate-100 flex items-center justify-between shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-[#FFC000]"></div>
                    <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">{b.name}</span>
                  </div>
                  {!readOnly && (
                    <button onClick={() => removeBrand(b.name)} className="text-slate-300 hover:text-rose-500 transition-colors p-3 rounded-2xl hover:bg-rose-50">
                      <Icons.Trash className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LiveScheduleModule;
