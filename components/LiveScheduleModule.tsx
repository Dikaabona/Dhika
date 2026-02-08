
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, LiveSchedule, LiveReport, AttendanceRecord } from '../types';
import { Icons, LIVE_BRANDS as INITIAL_BRANDS, TIME_SLOTS } from '../constants';
import { supabase } from '../App';
import { generateGoogleCalendarUrl } from '../utils/dateUtils';
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

// Updated: format to YYYY/MM/DD as requested
const formatDateToYMD = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  return dateStr.replace(/-/g, '/');
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
  const [activeSubTab, setActiveSubTab] = useState<'JADWAL' | 'BRAND' | 'REPORT' | 'GRAFIK' | 'LIBUR'>('JADWAL');
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [localSearch, setLocalSearch] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('SEMUA BRAND');
  const [showEmptySlots] = useState(true); 
  const [isImporting, setIsImporting] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>({
    'SENIN': [], 'SELASA': [], 'RABU': [], 'KAMIS': [], 'JUMAT': [], 'SABTU': [], 'MINGGU': []
  });

  const scheduleFileInputRef = useRef<HTMLInputElement>(null);

  const [brands, setBrands] = useState<any[]>(() => {
    const saved = localStorage.getItem(`live_brands_config_${company}`);
    return saved ? JSON.parse(saved) : INITIAL_BRANDS;
  });

  useEffect(() => {
    if (activeSubTab === 'LIBUR') {
      fetchHolidays();
    }
  }, [activeSubTab]);

  const fetchHolidays = async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', `weekly_holidays_${company}`).single();
      if (data) setWeeklyHolidays(data.value);
    } catch (e) {
      console.warn("Gagal memuat data libur.");
    }
  };

  const handleSaveHolidays = async () => {
    setIsSavingHolidays(true);
    try {
      const { error } = await supabase.from('settings').upsert({
        key: `weekly_holidays_${company}`,
        value: weeklyHolidays
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
    setWeeklyHolidays(prev => {
      const current = prev[day] || [];
      const next = current.includes(empName) 
        ? current.filter(n => n !== empName)
        : [...current, empName];
      return { ...prev, [day]: next };
    });
  };

  const addBrand = () => {
    const name = newBrandName.trim().toUpperCase();
    if (!name) return;
    if (brands.some((b: any) => b.name === name)) {
      alert("Brand sudah terdaftar.");
      return;
    }
    const updated = [...brands, { name, color: 'bg-slate-200' }];
    setBrands(updated);
    localStorage.setItem(`live_brands_config_${company}`, JSON.stringify(updated));
    setNewBrandName('');
  };

  const removeBrand = (name: string) => {
    if (!confirm(`Hapus brand "${name}"? Perubahan ini akan tersimpan secara lokal.`)) return;
    const updated = brands.filter((b: any) => b.name !== name);
    setBrands(updated);
    localStorage.setItem(`live_brands_config_${company}`, JSON.stringify(updated));
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
            if (parts.length === 3) {
              formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else {
              const dashParts = String(rawDate).split('-');
              if (dashParts.length === 3) {
                formattedDate = `${dashParts[0]}-${dashParts[1].padStart(2, '0')}-${dashParts[2].padStart(2, '0')}`;
              }
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
          // --- FIX: DEDUPLICATION LOGIC ---
          // Menghapus data duplikat dalam file Excel sebelum di-upsert ke Supabase
          // agar tidak terjadi error 'cannot affect row a second time'
          const uniqueSchedulesMap = new Map();
          rawSchedules.forEach((s: any) => {
            const key = `${s.date}_${s.brand}_${s.hourSlot}`;
            uniqueSchedulesMap.set(key, s);
          });
          const dedupedSchedules = Array.from(uniqueSchedulesMap.values());

          const { data: inserted, error } = await supabase
            .from('schedules')
            .upsert(dedupedSchedules, { onConflict: 'date,brand,hourSlot' })
            .select();

          if (error) throw error;
          
          setSchedules(prev => {
            const updated = [...prev];
            inserted?.forEach(newItem => {
              const idx = updated.findIndex(s => s.date === newItem.date && s.brand === newItem.brand && s.hourSlot === newItem.hourSlot);
              if (idx !== -1) updated[idx] = newItem;
              else updated.push(newItem);
            });
            return updated;
          });
          alert(`Berhasil mengimpor ${inserted?.length} jadwal! (Duplikat otomatis disatukan)`);
        } else {
          alert("Tidak ada data jadwal valid ditemukan.");
        }
      } catch (err: any) {
        alert("Gagal impor: " + err.message);
      } finally {
        setIsImporting(false);
        if (scheduleFileInputRef.current) scheduleFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    const activeFilter = selectedBrandFilter.trim().toUpperCase();
    const searchTerm = localSearch.trim().toLowerCase();

    const exportedData = schedules.filter(s => {
      const matchesDate = isDateInRange(s.date, startDate, endDate);
      const brandInDb = (s.brand || '').trim().toUpperCase();
      const matchesBrand = activeFilter === 'SEMUA BRAND' || brandInDb === activeFilter;
      const hostName = (employeeMap[s.hostId] || '').toLowerCase();
      const opName = (employeeMap[s.opId] || '').toLowerCase();
      const matchesSearch = !searchTerm || hostName.includes(searchTerm) || opName.includes(searchTerm) || brandInDb.includes(searchTerm.toUpperCase());

      return matchesDate && matchesBrand && matchesSearch;
    });

    if (exportedData.length === 0) {
      alert(`Data tidak ditemukan untuk rentang ${startDate} s/d ${endDate}.`);
      return;
    }

    const dataToExport = exportedData
      .sort((a, b) => a.date.localeCompare(b.date) || a.hourSlot.localeCompare(b.hourSlot))
      .map(s => ({
        // Updated: format to YYYY/MM/DD
        'TANGGAL': formatDateToYMD(s.date),
        'BRAND': s.brand.toUpperCase(),
        'SLOT WAKTU': s.hourSlot,
        'NAMA HOST': employeeMap[s.hostId] || 'TBA',
        'NAMA OPERATOR': employeeMap[s.opId] || 'TBA'
      }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jadwal Live");
    XLSX.writeFile(workbook, `Jadwal_Live_${company}_${startDate}.xlsx`);
  };

  const hostList = useMemo(() => employees.filter(e => {
    const j = (e.jabatan || '').trim().toUpperCase();
    return j.includes('HOST');
  }), [employees]);
  
  const opList = useMemo(() => employees.filter(e => {
    const j = (e.jabatan || '').trim().toUpperCase();
    const n = (e.nama || '').trim().toUpperCase();
    return j.includes('OPERATOR') || j.includes('OP') || n.includes('ARIYANSYAH');
  }), [employees]);

  // Updated: Restricted to only "HOST LIVE STREAMING" as per screenshot request
  const liveStaffList = useMemo(() => employees.filter(e => {
    const j = (e.jabatan || '').trim().toUpperCase();
    return j === 'HOST LIVE STREAMING';
  }), [employees]);

  // Derived Holiday Logic: Union of static weeklyHolidays and actual attendance 'Libur' records
  const syncedHolidays = useMemo(() => {
    const dayMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const currentHolidays: Record<string, string[]> = {
      'SENIN': [...(weeklyHolidays['SENIN'] || [])],
      'SELASA': [...(weeklyHolidays['SELASA'] || [])],
      'RABU': [...(weeklyHolidays['RABU'] || [])],
      'KAMIS': [...(weeklyHolidays['KAMIS'] || [])],
      'JUMAT': [...(weeklyHolidays['JUMAT'] || [])],
      'SABTU': [...(weeklyHolidays['SABTU'] || [])],
      'MINGGU': [...(weeklyHolidays['MINGGU'] || [])]
    };

    // Auto-sync from attendance data
    attendanceRecords.forEach(rec => {
      if (rec.status === 'Libur') {
        const emp = employees.find(e => e.id === rec.employeeId);
        // Sync only for job title "host live streaming"
        if (emp && (emp.jabatan || '').trim().toUpperCase() === 'HOST LIVE STREAMING') {
          const date = new Date(rec.date);
          const dayName = dayMap[date.getDay()];
          if (dayName && currentHolidays[dayName] && !currentHolidays[dayName].includes(emp.nama)) {
            currentHolidays[dayName].push(emp.nama);
          }
        }
      }
    });

    return currentHolidays;
  }, [weeklyHolidays, attendanceRecords, employees]);

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
    const normBrand = brand.trim().toUpperCase();
    const existing = schedules.find(s => s.date === date && (s.brand || '').trim().toUpperCase() === normBrand && s.hourSlot === hourSlot);
    const newRecord = { 
      ...(existing || {}),
      date, 
      brand: normBrand, 
      hourSlot, 
      company, 
      [field]: value 
    };

    try {
      const { data, error } = await supabase.from('schedules').upsert(newRecord, { onConflict: 'date,brand,hourSlot' }).select();
      if (error) throw error;
      setSchedules(prev => {
        const idx = prev.findIndex(s => s.date === date && (s.brand || '').trim().toUpperCase() === normBrand && s.hourSlot === hourSlot);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = data[0];
          return updated;
        }
        return [data[0], ...prev];
      });
    } catch (err: any) {
      alert("Gagal update: " + err.message);
    }
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
              <div className="flex-1 flex items-center bg-[#F3F4F6] border border-slate-100 rounded-[24px] sm:rounded-[28px] px-6 py-4 sm:px-8 sm:py-5 shadow-inner gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
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
                <input 
                  type="text" 
                  placeholder="CARI HOST / BRAND..." 
                  value={localSearch} 
                  onChange={e => setLocalSearch(e.target.value)} 
                  className="w-full bg-transparent text-[10px] sm:text-[12px] font-bold uppercase tracking-widest text-[#111827] outline-none placeholder:text-slate-300" 
                />
              </div>
            </div>

            {!readOnly && (
              <div className="flex gap-3 sm:gap-4">
                <input type="file" ref={scheduleFileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
                <button 
                  onClick={() => scheduleFileInputRef.current?.click()} 
                  disabled={isImporting}
                  className="flex-1 bg-[#EFF6FF] border border-blue-100 text-blue-700 px-4 py-3 sm:px-8 sm:py-4 rounded-[16px] sm:rounded-[20px] text-[8px] sm:text-[11px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 sm:gap-3 transition-all hover:bg-blue-100 active:scale-95 disabled:opacity-50"
                >
                  <Icons.Upload className="w-4 h-4 sm:w-5 h-5" /> {isImporting ? '...' : 'IMPORT'}
                </button>
                <button 
                  onClick={handleExportExcel} 
                  className="flex-1 bg-[#ECFDF5] border border-emerald-100 text-emerald-700 px-4 py-3 sm:px-8 sm:py-4 rounded-[16px] sm:rounded-[20px] text-[8px] sm:text-[11px] font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 sm:gap-3 transition-all hover:bg-emerald-100 active:scale-95"
                >
                  <Icons.Download className="w-4 h-4 sm:w-5 h-5" /> EKSPOR ({schedules.length})
                </button>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-4 border-t border-slate-50">
              <button 
                onClick={() => setSelectedBrandFilter('SEMUA BRAND')} 
                className={`px-4 py-2 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm ${selectedBrandFilter === 'SEMUA BRAND' ? 'bg-[#111827] text-yellow-400' : 'bg-[#F3F4F6] text-slate-400 hover:bg-slate-200'}`}
              >
                SEMUA
              </button>
              {brands.map((brand: any) => (
                <button 
                  key={brand.name} 
                  onClick={() => setSelectedBrandFilter(brand.name)} 
                  className={`px-4 py-2 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm ${selectedBrandFilter === brand.name ? 'bg-[#111827] text-yellow-400' : 'bg-[#F3F4F6] text-slate-400 hover:bg-slate-200'}`}
                >
                  {brand.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'LIBUR' && !readOnly && (
           <div className="flex justify-between items-end gap-6 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
              <div className="space-y-1">
                 <h3 className="text-lg font-black text-slate-900 uppercase">Manajemen Hari Libur</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Atur hari libur mingguan tetap untuk setiap host & OP</p>
              </div>
              <button 
                onClick={handleSaveHolidays}
                disabled={isSavingHolidays}
                className="bg-slate-900 text-[#FFC000] px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
              >
                {isSavingHolidays ? 'MENYIMPAN...' : 'SIMPAN JADWAL LIBUR'}
              </button>
           </div>
        )}
      </div>

      <div className="flex-grow overflow-y-auto px-6 sm:px-12 pt-6 sm:pt-10 pb-16 bg-white custom-scrollbar">
        {activeSubTab === 'JADWAL' ? (
          <div className="animate-in fade-in duration-500 space-y-12 sm:space-y-16">
            {datesInRange.map(date => (
              <div key={date} className="space-y-8 sm:space-y-12">
                <div className="flex items-center justify-center">
                  <div className="bg-white border border-slate-100 px-8 py-3 sm:px-12 sm:py-5 rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.04)]">
                    <span className="text-[10px] sm:text-[12px] font-bold text-[#111827] uppercase tracking-[0.2em] sm:tracking-[0.3em] whitespace-nowrap">
                      {new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {TIME_SLOTS.map(slot => {
                    const brandsForSlot = brands.filter((brand: any) => {
                      const brandNameNorm = brand.name.trim().toUpperCase();
                      const filterNorm = selectedBrandFilter.trim().toUpperCase();
                      const matchesBrandFilter = filterNorm === 'SEMUA BRAND' || brandNameNorm === filterNorm;
                      if (!matchesBrandFilter) return false;
                      
                      const sched = schedules.find(s => s.date === date && (s.brand || '').trim().toUpperCase() === brandNameNorm && s.hourSlot === slot);
                      const hasAssignment = sched && (sched.hostId || sched.opId);
                      
                      if (localSearch) {
                        const hostName = sched ? (employeeMap[sched.hostId] || '').toLowerCase() : '';
                        const opName = sched ? (employeeMap[sched.opId] || '').toLowerCase() : '';
                        const searchTerm = localSearch.toLowerCase();
                        return hostName.includes(searchTerm) || opName.includes(searchTerm) || brandNameNorm.includes(searchTerm.toUpperCase());
                      }

                      return hasAssignment || showEmptySlots;
                    });

                    if (brandsForSlot.length === 0) return null;

                    return (
                      <div key={`${date}-${slot}`} className="bg-slate-50/50 p-5 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 space-y-5 sm:space-y-6">
                        <div className="flex items-center gap-4 sm:gap-6">
                          <span className="bg-[#111827] text-yellow-400 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full text-[9px] sm:text-[11px] font-bold tracking-[0.1em] sm:tracking-[0.2em] shadow-lg">{slot}</span>
                          <div className="h-px flex-grow bg-slate-200"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          {brandsForSlot.map((brand: any) => {
                            const bName = brand.name.trim().toUpperCase();
                            const sched = schedules.find(s => s.date === date && (s.brand || '').trim().toUpperCase() === bName && s.hourSlot === slot) || { hostId: '', opId: '' };
                            return (
                              <div key={`${date}-${slot}-${brand.name}`} className="bg-white border border-slate-100 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-sm hover:shadow-xl transition-all">
                                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-slate-50">
                                   <div className="flex flex-col">
                                      <p className="text-[10px] sm:text-[12px] font-bold text-[#111827] tracking-widest uppercase">{brand.name}</p>
                                      <p className="text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Live Segment</p>
                                   </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                   <div className="space-y-1.5 sm:space-y-2">
                                      <label className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">HOST</label>
                                      <select 
                                        value={sched.hostId} 
                                        disabled={readOnly} 
                                        onChange={(e) => updateSchedule(date, brand.name, slot, 'hostId', e.target.value)} 
                                        className="w-full bg-[#F9FAFB] border border-slate-100 rounded-xl sm:rounded-2xl px-3 py-3 sm:px-5 sm:py-4 text-[10px] sm:text-[12px] font-bold text-[#111827] outline-none focus:ring-4 focus:ring-yellow-400/20 appearance-none transition-all cursor-pointer"
                                      >
                                        <option value="">- TBA -</option>
                                        {hostList.map(h => <option key={h.id} value={h.id}>{h.nama.toUpperCase()}</option>)}
                                      </select>
                                   </div>
                                   <div className="space-y-1.5 sm:space-y-2">
                                      <label className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">OP</label>
                                      <select 
                                        value={sched.opId} 
                                        disabled={readOnly} 
                                        onChange={(e) => updateSchedule(date, brand.name, slot, 'opId', e.target.value)} 
                                        className="w-full bg-[#F9FAFB] border border-slate-100 rounded-xl sm:rounded-2xl px-3 py-3 sm:px-5 sm:py-4 text-[10px] sm:text-[12px] font-bold text-[#111827] outline-none focus:ring-4 focus:ring-yellow-400/20 appearance-none transition-all cursor-pointer"
                                      >
                                        <option value="">- TBA -</option>
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
                     <div className="flex justify-between items-center mb-6 shrink-0">
                        <span className="text-sm font-black text-slate-900 tracking-widest">{day}</span>
                        <span className="bg-white px-3 py-1 rounded-lg text-[9px] font-black text-indigo-500 border border-slate-200">{syncedHolidays[day]?.length || 0} ORANG</span>
                     </div>
                     <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {liveStaffList.map(emp => (
                          <div 
                            key={emp.id} 
                            onClick={() => !readOnly && toggleHoliday(day, emp.nama)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${syncedHolidays[day]?.includes(emp.nama) ? 'bg-indigo-500 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                          >
                             <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                   {emp.photoBase64 ? <img src={emp.photoBase64} className="w-full h-full object-cover" /> : null}
                                </div>
                                <span className="text-[10px] font-bold truncate max-w-[120px]">{emp.nama.toUpperCase()}</span>
                             </div>
                             {syncedHolidays[day]?.includes(emp.nama) && <Icons.Plus className="w-3 h-3 rotate-45" />}
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        ) : activeSubTab === 'BRAND' ? (
          <div className="animate-in fade-in duration-500 space-y-8 max-w-4xl mx-auto pb-20">
            {!readOnly && (
              <div className="bg-slate-50 p-6 sm:p-10 rounded-[40px] border border-slate-100 space-y-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tambah Brand Live</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Daftar brand ini akan muncul di pilihan jadwal live streaming</p>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={newBrandName} 
                    onChange={e => setNewBrandName(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addBrand()}
                    placeholder="MASUKKAN NAMA BRAND BARU..."
                    className="flex-grow bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold text-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/20 transition-all shadow-sm"
                  />
                  <button 
                    onClick={addBrand}
                    className="bg-slate-900 text-[#FFC000] px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-black"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {brands.map((b: any) => (
                <div key={b.name} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-yellow-50 group-hover:text-yellow-600 transition-colors">
                      <Icons.Video className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">{b.name}</span>
                  </div>
                  {!readOnly && (
                    <button 
                      onClick={() => removeBrand(b.name)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                    >
                      <Icons.Trash className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {brands.length === 0 && (
                <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada brand terdaftar</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LiveScheduleModule;
