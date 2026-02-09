
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, LiveSchedule, LiveReport, AttendanceRecord } from '../types';
import { Icons, LIVE_BRANDS as INITIAL_BRANDS, TIME_SLOTS } from '../constants';
import { supabase } from '../App';
import { generateGoogleCalendarUrl, getMondayISO } from '../utils/dateUtils';
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
}

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_HOLIDAYS = {
  'SENIN': [], 'SELASA': [], 'RABU': [], 'KAMIS': [], 'JUMAT': [], 'SABTU': [], 'MINGGU': []
};

const formatDateToYMD = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  return dateStr.replace(/-/g, '/');
};

const parseYMDToIso = (val: any) => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  
  const str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  
  if (!isNaN(Number(str)) && Number(str) > 30000) {
    const date = new Date((Number(str) - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return str;
};

const isDateInRange = (target: string, start: string, end: string) => {
  const t = new Date(target).getTime();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return t >= s && t <= e;
};

const DAYS_OF_WEEK = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

const LiveScheduleModule: React.FC<LiveScheduleModuleProps> = ({ employees, schedules, setSchedules, reports, setReports, userRole = 'employee', company, onClose, attendanceRecords = [] }) => {
  const readOnly = userRole === 'employee';
  const [activeSubTab, setActiveSubTab] = useState<'JADWAL' | 'REPORT' | 'GRAFIK' | 'LIBUR' | 'BRAND'>('JADWAL');
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [localSearch, setLocalSearch] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('SEMUA BRAND');
  const [showEmptySlots] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>(DEFAULT_HOLIDAYS);
  const [brands, setBrands] = useState<any[]>(INITIAL_BRANDS);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  const scheduleFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBrandsAndHolidays();
  }, [company]);

  const fetchBrandsAndHolidays = async () => {
    setIsLoadingBrands(true);
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
    } catch (e) {
      console.warn("Gagal sinkronisasi data setting.");
    } finally {
      setIsLoadingBrands(false);
    }
  };

  const handleSaveBrands = async (updatedBrands: any[]) => {
    try {
      const { error } = await supabase.from('settings').upsert({
        key: `live_brands_${company}`,
        value: updatedBrands
      }, { onConflict: 'key' });
      if (error) throw error;
      setBrands(updatedBrands);
    } catch (err: any) {
      alert("Gagal sinkronisasi brand: " + err.message);
    }
  };

  const handleSaveHolidays = async () => {
    setIsSavingHolidays(true);
    try {
      const currentMonday = getMondayISO(new Date());
      const { error } = await supabase.from('settings').upsert({
        key: `weekly_holidays_${company}`,
        value: {
          days: weeklyHolidays,
          weekStart: currentMonday
        }
      }, { onConflict: 'key' });
      if (error) throw error;
      alert("Jadwal libur mingguan berhasil diperbarui!");
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSavingHolidays(false);
    }
  };

  const toggleHoliday = (day: string, empName: string) => {
    const isAssignedOtherDay = Object.entries(weeklyHolidays).some(([d, names]) => 
      d !== day && (names as string[]).includes(empName)
    );
    const currentNames = weeklyHolidays[day] || [];
    const isAlreadyOnThisDay = currentNames.includes(empName);
    if (!isAlreadyOnThisDay && isAssignedOtherDay) {
      alert(`Peringatan: ${empName.toUpperCase()} sudah memiliki jadwal libur di hari lain.`);
      return;
    }
    setWeeklyHolidays(prev => {
      const current = prev[day] || [];
      const next = current.includes(empName) ? current.filter(n => n !== empName) : [...current, empName];
      return { ...prev, [day]: next };
    });
  };

  const addBrand = async () => {
    const name = newBrandName.trim().toUpperCase();
    if (!name) return;
    if (brands.some((b: any) => b.name === name)) {
      alert("Brand sudah terdaftar.");
      return;
    }
    const updated = [...brands, { name, color: 'bg-slate-200' }];
    await handleSaveBrands(updated);
    setNewBrandName('');
  };

  const removeBrand = async (name: string) => {
    if (!confirm(`Hapus brand "${name}" secara permanen?`)) return;
    const updated = brands.filter((b: any) => b.name !== name);
    await handleSaveBrands(updated);
  };
  
  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => { map[e.id] = e.nama.toUpperCase(); });
    return map;
  }, [employees]);

  const findEmployeeIdByName = (name: string) => {
    const search = String(name || '').trim().toUpperCase();
    if (!search || search === 'TBA') return '';
    const match = employees.find(e => e.nama.toUpperCase() === search || e.nama.toUpperCase().includes(search));
    return match ? match.id : '';
  };

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
        
        const rawSchedules = jsonData.map((row: any) => {
          const rawDate = row['TANGGAL'];
          let formattedDate = '';
          if (rawDate instanceof Date) {
            formattedDate = rawDate.toISOString().split('T')[0];
          } else {
            const parts = String(rawDate).split('/');
            if (parts.length === 3) formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            else {
              const dashParts = String(rawDate).split('-');
              if (dashParts.length === 3) formattedDate = `${dashParts[0]}-${dashParts[1].padStart(2, '0')}-${dashParts[2].padStart(2, '0')}`;
            }
          }
          if (!formattedDate || !row['BRAND'] || !row['SLOT WAKTU']) return null;
          return {
            date: formattedDate,
            brand: String(row['BRAND']).trim().toUpperCase(),
            hourSlot: String(row['SLOT WAKTU']).trim(),
            hostId: findEmployeeIdByName(row['NAMA HOST']),
            opId: findEmployeeIdByName(row['NAMA OPERATOR']),
            company: company
          };
        }).filter(s => s !== null);

        if (rawSchedules.length > 0) {
          const { data: inserted, error } = await supabase.from('schedules').upsert(rawSchedules, { onConflict: 'date,brand,hourSlot' }).select();
          if (error) throw error;
          alert(`Berhasil mengimpor ${inserted?.length} jadwal!`);
          location.reload();
        }
      } catch (err: any) { alert("Gagal impor: " + err.message); } finally { setIsImporting(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    const activeFilter = selectedBrandFilter.trim().toUpperCase();
    const searchTerm = localSearch.trim().toLowerCase();
    const exportedData = schedules.filter(s => {
      const matchesDate = isDateInRange(s.date, startDate, endDate);
      const matchesBrand = activeFilter === 'SEMUA BRAND' || (s.brand || '').toUpperCase() === activeFilter;
      const hostName = (employeeMap[s.hostId] || '').toLowerCase();
      const opName = (employeeMap[s.opId] || '').toLowerCase();
      return matchesDate && matchesBrand && (!searchTerm || hostName.includes(searchTerm) || opName.includes(searchTerm));
    });
    if (exportedData.length === 0) return alert("Data tidak ditemukan.");
    const dataToExport = exportedData.sort((a, b) => a.date.localeCompare(b.date)).map(s => ({
      'TANGGAL': formatDateToYMD(s.date),
      'BRAND': s.brand.toUpperCase(),
      'SLOT WAKTU': s.hourSlot,
      'NAMA HOST': employeeMap[s.hostId] || 'TBA',
      'NAMA OPERATOR': employeeMap[s.opId] || 'TBA'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal Live");
    XLSX.writeFile(wb, `Jadwal_Live_${company}.xlsx`);
  };

  const hostList = useMemo(() => employees.filter(e => (e.jabatan || '').toUpperCase().includes('HOST')), [employees]);
  const opList = useMemo(() => employees.filter(e => (e.jabatan || '').toUpperCase().includes('OP') || (e.nama || '').toUpperCase().includes('ARIYANSYAH')), [employees]);
  const liveStaffList = useMemo(() => employees.filter(e => (e.jabatan || '').toUpperCase() === 'HOST LIVE STREAMING'), [employees]);

  const datesInRange = useMemo(() => {
    const dates = [];
    let current = new Date(startDate);
    const last = new Date(endDate);
    if (current > last) return [startDate];
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  const updateSchedule = async (date: string, brand: string, hourSlot: string, field: 'hostId' | 'opId', value: string) => {
    if (readOnly) return;
    const existing = schedules.find(s => s.date === date && (s.brand || '').trim().toUpperCase() === brand.toUpperCase() && s.hourSlot === hourSlot);
    const newRecord = { ...(existing || {}), date, brand: brand.toUpperCase(), hourSlot, company, [field]: value };
    try {
      const { data, error } = await supabase.from('schedules').upsert(newRecord, { onConflict: 'date,brand,hourSlot' }).select();
      if (error) throw error;
      setSchedules(prev => {
        const idx = prev.findIndex(s => s.date === date && s.brand === brand.toUpperCase() && s.hourSlot === hourSlot);
        if (idx !== -1) { const upd = [...prev]; upd[idx] = data[0]; return upd; }
        return [data[0], ...prev];
      });
    } catch (err: any) { alert("Gagal update: " + err.message); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white md:min-h-[85vh] md:rounded-[48px] overflow-hidden shadow-2xl relative border-4 sm:border-[12px] border-white max-w-6xl mx-auto">
      <div className="px-6 sm:px-12 pt-8 sm:pt-12 pb-6 bg-white shrink-0">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <button onClick={onClose} className="bg-[#111827] p-2.5 sm:p-4 rounded-[16px] sm:rounded-[20px] text-white shadow-xl transition-all active:scale-90 hover:bg-slate-800">
              <Icons.Home className="w-5 h-5 sm:w-7 sm:h-7 text-yellow-400" />
            </button>
            <h2 className="text-lg sm:text-3xl font-bold text-[#111827] tracking-tight leading-none uppercase">LIVE STREAMING</h2>
          </div>
        </div>

        <div className="bg-[#F3F4F6] rounded-full p-1.5 sm:p-2 flex shadow-inner mb-6 sm:mb-8 max-w-full overflow-x-auto no-scrollbar flex-nowrap touch-pan-x">
          {['JADWAL', 'REPORT', 'GRAFIK', 'LIBUR', 'BRAND'].map((tab) => (
             ((tab !== 'BRAND' && tab !== 'LIBUR') || !readOnly) && (
              <button 
                key={tab} 
                onClick={() => setActiveSubTab(tab as any)} 
                className={`flex-1 py-3 px-6 sm:py-4 sm:px-8 rounded-full text-[10px] sm:text-[11px] font-bold tracking-widest uppercase transition-all duration-300 whitespace-nowrap ${activeSubTab === tab ? 'bg-white text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.05)]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
              </button>
             )
          ))}
        </div>

        {activeSubTab === 'JADWAL' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="flex-1 flex-row flex items-center bg-[#F3F4F6] border border-slate-100 rounded-[24px] sm:rounded-[28px] px-6 py-4 sm:px-8 sm:py-5 shadow-inner gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
                <div className="flex flex-col gap-0.5 sm:gap-1 shrink-0">
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">START</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] sm:text-[12px] font-bold text-[#111827] outline-none bg-transparent cursor-pointer" />
                </div>
                <div className="w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="flex flex-col gap-0.5 sm:gap-1 shrink-0">
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">END</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] sm:text-[12px] font-bold text-[#111827] outline-none bg-transparent cursor-pointer" />
                </div>
              </div>
              <div className="relative flex-1 bg-[#F3F4F6] border border-slate-100 rounded-[24px] sm:rounded-[28px] px-6 py-4 sm:px-8 sm:py-5 shadow-inner flex items-center gap-3 sm:gap-4">
                <Icons.Search className="w-4 h-4 sm:w-6 sm:h-6 text-slate-400" />
                <input type="text" placeholder="CARI HOST / BRAND..." value={localSearch} onChange={e => setLocalSearch(e.target.value)} className="w-full bg-transparent text-[10px] sm:text-[12px] font-bold uppercase tracking-widest text-[#111827] outline-none placeholder:text-slate-300" />
              </div>
            </div>
            {!readOnly && (
              <div className="flex gap-3 sm:gap-4">
                <input type="file" ref={scheduleFileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
                <button onClick={() => scheduleFileInputRef.current?.click()} disabled={isImporting} className="flex-1 bg-[#EFF6FF] border border-blue-100 text-blue-700 px-4 py-3 sm:px-8 sm:py-4 rounded-[16px] sm:rounded-[20px] text-[8px] sm:text-[11px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-blue-100 disabled:opacity-50"><Icons.Upload className="w-4 h-4" /> IMPORT</button>
                <button onClick={handleExportExcel} className="flex-1 bg-[#ECFDF5] border border-emerald-100 text-emerald-700 px-4 py-3 sm:px-8 sm:py-4 rounded-[16px] sm:rounded-[20px] text-[8px] sm:text-[11px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-emerald-100"><Icons.Download className="w-4 h-4" /> EKSPOR</button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-4 border-t border-slate-50">
              <button onClick={() => setSelectedBrandFilter('SEMUA BRAND')} className={`px-4 py-2 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm ${selectedBrandFilter === 'SEMUA BRAND' ? 'bg-[#111827] text-yellow-400' : 'bg-[#F3F4F6] text-slate-400 hover:bg-slate-200'}`}>SEMUA</button>
              {brands.map((brand: any) => (
                <button key={brand.name} onClick={() => setSelectedBrandFilter(brand.name)} className={`px-4 py-2 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm ${selectedBrandFilter === brand.name ? 'bg-[#111827] text-yellow-400' : 'bg-[#F3F4F6] text-slate-400 hover:bg-slate-200'}`}>{brand.name.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-grow overflow-y-auto px-6 sm:px-12 pt-2 sm:pt-10 pb-16 bg-white custom-scrollbar">
        {activeSubTab === 'JADWAL' ? (
          <div className="animate-in fade-in duration-500 space-y-10 sm:space-y-16">
            {datesInRange.map(date => (
              <div key={date} className="space-y-6 sm:space-y-12">
                <div className="flex items-center justify-center">
                  <div className="bg-white border border-slate-100 px-10 py-3.5 sm:px-16 sm:py-6 rounded-full shadow-md">
                    <span className="text-[12px] sm:text-[16px] font-black text-[#111827] uppercase tracking-[0.2em]">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}</span>
                  </div>
                </div>
                <div className="space-y-8">
                  {TIME_SLOTS.map(slot => {
                    const brandsForSlot = brands.filter((brand: any) => {
                      const brandNameNorm = brand.name.toUpperCase();
                      const filterNorm = selectedBrandFilter.toUpperCase();
                      if (filterNorm !== 'SEMUA BRAND' && brandNameNorm !== filterNorm) return false;
                      const sched = schedules.find(s => s.date === date && (s.brand || '').toUpperCase() === brandNameNorm && s.hourSlot === slot);
                      if (localSearch) {
                        const h = sched ? (employeeMap[sched.hostId] || '').toLowerCase() : '';
                        const o = sched ? (employeeMap[sched.opId] || '').toLowerCase() : '';
                        return h.includes(localSearch.toLowerCase()) || o.includes(localSearch.toLowerCase()) || brandNameNorm.includes(localSearch.toUpperCase());
                      }
                      return (sched && (sched.hostId || sched.opId)) || showEmptySlots;
                    });
                    if (brandsForSlot.length === 0) return null;
                    return (
                      <div key={`${date}-${slot}`} className="bg-slate-50/70 p-6 sm:p-12 rounded-[40px] border border-slate-100 space-y-8 shadow-inner">
                        <div className="flex items-center gap-5"><span className="bg-[#111827] text-yellow-400 px-6 py-2.5 rounded-full text-[11px] font-black tracking-[0.1em]">{slot}</span><div className="h-px flex-grow bg-slate-200"></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                          {brandsForSlot.map((brand: any) => {
                            const sched = schedules.find(s => s.date === date && (s.brand || '').toUpperCase() === brand.name.toUpperCase() && s.hourSlot === slot) || { hostId: '', opId: '' };
                            return (
                              <div key={`${date}-${slot}-${brand.name}`} className="bg-white border border-slate-100 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-md hover:shadow-xl transition-all">
                                <p className="text-[12px] font-black text-[#111827] uppercase tracking-[0.15em] border-b border-slate-50 pb-3">{brand.name}</p>
                                <div className="grid grid-cols-2 gap-6">
                                   <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">HOST</label><select value={sched.hostId} disabled={readOnly} onChange={(e) => updateSchedule(date, brand.name, slot, 'hostId', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-[11px] font-black appearance-none cursor-pointer text-black focus:ring-4 focus:ring-yellow-400/10 outline-none"><option value="">- TBA -</option>{hostList.map(h => <option key={h.id} value={h.id}>{h.nama.toUpperCase()}</option>)}</select></div>
                                   <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">OP</label><select value={sched.opId} disabled={readOnly} onChange={(e) => updateSchedule(date, brand.name, slot, 'opId', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-[11px] font-black appearance-none cursor-pointer text-black focus:ring-4 focus:ring-yellow-400/10 outline-none"><option value="">- TBA -</option>{opList.map(o => <option key={o.id} value={o.id}>{o.nama.toUpperCase()}</option>)}</select></div>
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
            ))}
          </div>
        ) : activeSubTab === 'REPORT' ? (
          <LiveReportModule employees={employees} reports={reports} setReports={setReports} userRole={userRole} company={company} onClose={() => setActiveSubTab('JADWAL')} />
        ) : activeSubTab === 'GRAFIK' ? (
          <LiveCharts reports={reports} employees={employees} />
        ) : activeSubTab === 'LIBUR' ? (
          <div className="animate-in fade-in duration-500 space-y-8">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col h-[350px]">
                     <div className="flex justify-between items-center mb-6"><span className="text-sm font-black text-slate-900 tracking-widest">{day}</span></div>
                     <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {liveStaffList.map(emp => (
                          <div key={emp.id} onClick={() => !readOnly && toggleHoliday(day, emp.nama)} className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${(weeklyHolidays[day] || []).includes(emp.nama) ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
                             <span className="text-[10px] font-bold truncate">{emp.nama.toUpperCase()}</span>
                             {(weeklyHolidays[day] || []).includes(emp.nama) && <Icons.Plus className="w-3 h-3 rotate-45" />}
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
             {!readOnly && <button onClick={handleSaveHolidays} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs">Simpan Jadwal Libur</button>}
          </div>
        ) : activeSubTab === 'BRAND' ? (
          <div className="animate-in fade-in duration-500 space-y-8 max-w-4xl mx-auto pb-20">
            {!readOnly && (
              <div className="bg-slate-50 p-6 sm:p-10 rounded-[40px] border border-slate-100 space-y-6">
                <div className="flex flex-col gap-1"><h3 className="text-xl font-black text-slate-900 uppercase">Tambah Brand Live</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Daftar ini tersinkron dengan seluruh akun admin.</p></div>
                <div className="flex gap-3">
                  <input type="text" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBrand()} placeholder="MASUKKAN NAMA BRAND BARU..." className="flex-grow bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold text-black uppercase outline-none" />
                  <button onClick={addBrand} className="bg-slate-900 text-[#FFC000] px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">TAMBAH</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {brands.map((b: any) => (
                <div key={b.name} className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:shadow-xl transition-all">
                  <div className="flex items-center gap-4"><Icons.Video className="w-5 h-5 text-slate-300" /><span className="text-sm font-black text-slate-900 uppercase">{b.name}</span></div>
                  {!readOnly && <button onClick={() => removeBrand(b.name)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-rose-500 transition-all"><Icons.Trash className="w-5 h-5" /></button>}
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
