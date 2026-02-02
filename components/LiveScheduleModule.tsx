
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Employee, LiveSchedule } from '../types';
import { Icons, LIVE_BRANDS as INITIAL_BRANDS, TIME_SLOTS } from '../constants';
import { supabase } from '../App';

interface LiveScheduleModuleProps {
  employees: Employee[];
  schedules: LiveSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<LiveSchedule[]>>;
  searchQuery?: string;
  readOnly?: boolean;
  onClose?: () => void;
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

const WEEK_DAYS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

const LiveScheduleModule: React.FC<LiveScheduleModuleProps> = ({ employees, schedules, setSchedules, readOnly = false, onClose }) => {
  const [activeSubTab, setActiveSubTab] = useState<'JADWAL' | 'LIBUR' | 'BRAND' | 'TEMPLATE'>('JADWAL');
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [localSearch, setLocalSearch] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('SEMUA BRAND');
  const [isSavingBrands, setIsSavingBrands] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  
  const scheduleFileInputRef = useRef<HTMLInputElement>(null);

  const [brands, setBrands] = useState<any[]>(() => {
    const saved = localStorage.getItem('live_brands_config');
    return saved ? JSON.parse(saved) : INITIAL_BRANDS;
  });
  
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('weekly_holidays_config');
    return saved ? JSON.parse(saved) : DEFAULT_HOLIDAYS;
  });

  const [newBrandName, setNewBrandName] = useState('');
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Sembunyikan BRAND dan TEMPLATE jika readOnly (Role Karyawan)
  const availableTabs = useMemo(() => {
    return readOnly ? ['JADWAL', 'LIBUR'] : ['JADWAL', 'LIBUR', 'BRAND', 'TEMPLATE'];
  }, [readOnly]);

  useEffect(() => {
    fetchCloudConfigs();
  }, []);

  const fetchCloudConfigs = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      if (data) {
        const cloudBrands = data.find(s => s.key === 'live_brands_config')?.value;
        const cloudHolidays = data.find(s => s.key === 'weekly_holidays_config')?.value;
        if (cloudBrands && Array.isArray(cloudBrands) && cloudBrands.length > 0) {
          setBrands(cloudBrands);
          localStorage.setItem('live_brands_config', JSON.stringify(cloudBrands));
        }
        if (cloudHolidays) {
          setWeeklyHolidays({ ...DEFAULT_HOLIDAYS, ...cloudHolidays });
          localStorage.setItem('weekly_holidays_config', JSON.stringify(cloudHolidays));
        }
      }
    } catch (err) {
      console.warn("Using local data.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveConfigToCloud = async (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
    try {
      await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    } catch (err: any) {
      console.error("Cloud save failed:", err);
    }
  };

  const persistBrandsUpdate = async (updatedBrands: any[]) => {
    setIsSavingBrands(true);
    setBrands(updatedBrands);
    try {
      await saveConfigToCloud('live_brands_config', updatedBrands);
    } finally {
      setIsSavingBrands(false);
    }
  };

  const addBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) return;
    if (brands.some((b: any) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Brand sudah ada!");
      return;
    }
    const updatedBrands = [...brands, { name: trimmed.toUpperCase(), color: 'bg-[#FFC000] text-black' }];
    await persistBrandsUpdate(updatedBrands);
    setNewBrandName('');
  };

  const removeBrand = async (name: string) => {
    if (readOnly) return;
    if (confirm(`Hapus brand "${name}"?`)) {
      const updatedBrands = brands.filter((b: any) => b.name !== name);
      await persistBrandsUpdate(updatedBrands);
    }
  };

  const handleAddSubmit = async (day: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const currentDayHolidays = weeklyHolidays[day] || [];
    const nameUpper = trimmed.toUpperCase();
    if (currentDayHolidays.includes(nameUpper)) {
      alert("Nama sudah ada!");
      return;
    }
    const updatedHolidays = { ...weeklyHolidays, [day]: [...currentDayHolidays, nameUpper] };
    setWeeklyHolidays(updatedHolidays);
    await saveConfigToCloud('weekly_holidays_config', updatedHolidays);
    setAddingDay(null);
    setNewName('');
  };

  const removeHolidayName = async (day: string, name: string) => {
    if (readOnly) return;
    const updatedHolidays = { ...weeklyHolidays, [day]: (weeklyHolidays[day] || []).filter(n => n !== name) };
    setWeeklyHolidays(updatedHolidays);
    await saveConfigToCloud('weekly_holidays_config', updatedHolidays);
  };

  const hostList = useMemo(() => employees.filter(e => {
    const n = (e.nama || '').trim().toUpperCase();
    const j = (e.jabatan || '').trim().toUpperCase();
    return (j.includes('HOST') || n === 'WIDA OKTAPIANI') && n !== 'FIKRY ADITYA RIZKY';
  }), [employees]);
  
  const opList = useMemo(() => employees.filter(e => {
    const n = (e.nama || '').trim().toUpperCase();
    const j = (e.jabatan || '').toLowerCase();
    return (j.includes('operator') || j.includes('op') || n === 'MUHAMMAD ARIYANSYAH') && n !== 'FIKRY ADITYA RIZKY';
  }), [employees]);

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => { map[e.id] = e.nama.toUpperCase(); });
    return map;
  }, [employees]);

  const findEmployeeIdByName = (name: string) => {
    const search = String(name || '').trim().toLowerCase();
    if (!search) return '';
    const match = employees.find(e => e.nama.toLowerCase() === search || e.nama.toLowerCase().includes(search));
    return match ? match.id : '';
  };

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
    const existing = schedules.find(s => s.date === date && s.brand === brand && s.hourSlot === hourSlot);
    const newRecord = existing 
      ? { ...existing, [field]: value }
      : { date, brand, hourSlot, hostId: field === 'hostId' ? value : '', opId: field === 'opId' ? value : '' };

    try {
      const { data, error } = await supabase.from('schedules').upsert(newRecord, { onConflict: 'date,brand,hourSlot' }).select();
      if (error) throw error;
      setSchedules(prev => {
        const idx = prev.findIndex(s => s.date === date && s.brand === brand && s.hourSlot === hourSlot);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = data[0];
          return updated;
        }
        return [...prev, data[0]];
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    if (schedules.length === 0) {
      alert("Tidak ada data jadwal untuk diekspor.");
      return;
    }
    const dataToExport = schedules
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({
        'TANGGAL': s.date,
        'BRAND': s.brand,
        'SLOT WAKTU': s.hourSlot,
        'NAMA HOST': employeeMap[s.hostId] || '',
        'NAMA OPERATOR': employeeMap[s.opId] || ''
      }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jadwal Live");
    XLSX.writeFile(workbook, `Jadwal_Live_Visibel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingExcel(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const newRecords = jsonData.map((row: any) => {
          const date = row['TANGGAL'] ? (row['TANGGAL'] instanceof Date ? row['TANGGAL'].toISOString().split('T')[0] : String(row['TANGGAL'])) : getLocalDateString();
          return {
            date: date,
            brand: String(row['BRAND'] || '').toUpperCase(),
            hourSlot: String(row['SLOT WAKTU'] || TIME_SLOTS[0]),
            hostId: findEmployeeIdByName(row['NAMA HOST']),
            opId: findEmployeeIdByName(row['NAMA OPERATOR'])
          };
        }).filter(r => r.brand && r.hourSlot);

        if (newRecords.length > 0) {
          const { error } = await supabase.from('schedules').upsert(newRecords, { onConflict: 'date,brand,hourSlot' });
          if (error) throw error;
          alert(`Berhasil mengimpor ${newRecords.length} entri jadwal!`);
          const { data: updated } = await supabase.from('schedules').select('*');
          if (updated) setSchedules(updated);
        }
      } catch (err: any) {
        alert("Gagal mengimpor: " + err.message);
      } finally {
        setIsProcessingExcel(false);
        if (scheduleFileInputRef.current) scheduleFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] md:min-h-[85vh] md:rounded-[48px] overflow-hidden shadow-2xl relative border-4 sm:border-[12px] border-white max-w-5xl mx-auto">
      {/* HEADER SECTION */}
      <div className="px-6 sm:px-10 pt-8 sm:pt-12 pb-6 sm:pb-8 bg-white shrink-0 relative border-b border-slate-100">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-5">
            <button onClick={onClose} className="bg-[#0f172a] p-3 sm:p-4 rounded-xl sm:rounded-2xl text-[#FFC000] shadow-xl transition-all active:scale-90 hover:bg-slate-800">
              <Icons.Home className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg sm:text-2xl font-extrabold text-[#0f172a] tracking-tight leading-none uppercase">JADWAL HOST LIVE</h2>
            </div>
          </div>
        </div>

        {/* TOP TAB NAVIGATION - Optimized for Mobile */}
        <div className="bg-slate-100 rounded-[20px] sm:rounded-[28px] p-1 sm:p-2 flex shadow-inner mb-6 max-w-xl mx-auto overflow-hidden">
          {availableTabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveSubTab(tab as any)} 
              className={`flex-1 py-2 sm:py-3.5 rounded-[16px] sm:rounded-[22px] text-[8px] sm:text-[10px] font-bold tracking-[0.1em] sm:tracking-[0.15em] uppercase transition-all duration-300 ${activeSubTab === tab ? 'bg-white text-[#0f172a] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeSubTab === 'JADWAL' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="flex-grow flex items-center bg-slate-50 border border-slate-100 rounded-[24px] sm:rounded-[32px] px-4 sm:px-8 py-3 sm:py-5 shadow-inner gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
                <div className="flex flex-col gap-0.5 sm:gap-1 shrink-0">
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">START DATE</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] sm:text-xs font-bold text-[#0f172a] outline-none bg-transparent" />
                </div>
                <div className="w-px h-8 sm:h-10 bg-slate-200 shrink-0"></div>
                <div className="flex flex-col gap-0.5 sm:gap-1 shrink-0">
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">END DATE</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] sm:text-xs font-bold text-[#0f172a] outline-none bg-transparent" />
                </div>
              </div>
              <div className="relative flex-grow md:max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300">
                  <Icons.Search className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <input 
                  type="text" 
                  placeholder="SEARCH..." 
                  value={localSearch} 
                  onChange={e => setLocalSearch(e.target.value)} 
                  className="w-full pl-12 pr-4 py-3.5 sm:py-5 bg-slate-50 border border-slate-100 rounded-[24px] sm:rounded-[32px] text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.1em] text-[#0f172a] shadow-inner outline-none focus:bg-white focus:ring-4 focus:ring-[#FFC000]/10 transition-all placeholder:text-slate-300" 
                />
              </div>
            </div>
            
            <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
              <button onClick={() => setSelectedBrandFilter('SEMUA BRAND')} className={`whitespace-nowrap px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-bold tracking-widest uppercase transition-all shadow-sm ${selectedBrandFilter === 'SEMUA BRAND' ? 'bg-[#0f172a] text-[#FFC000]' : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'}`}>SEMUA BRAND</button>
              {brands.map((brand: any) => (
                <button key={brand.name} onClick={() => setSelectedBrandFilter(brand.name)} className={`whitespace-nowrap px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-bold tracking-widest uppercase transition-all shadow-sm ${selectedBrandFilter === brand.name ? 'bg-[#0f172a] text-[#FFC000]' : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'}`}>{brand.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow overflow-y-auto px-4 sm:px-10 py-6 sm:py-10 bg-white custom-scrollbar">
        {activeSubTab === 'JADWAL' ? (
          <div className="animate-in fade-in duration-500 space-y-8 sm:space-y-12 pb-20">
             {datesInRange.map(date => (
               <div key={date} className="space-y-4 sm:space-y-6">
                 {/* DATE HEADER */}
                 <div className="flex items-center justify-center gap-3 sm:gap-6">
                    <div className="h-px flex-grow bg-slate-100"></div>
                    <span className="text-[8px] sm:text-[10px] font-extrabold text-[#0f172a] uppercase tracking-[0.15em] sm:tracking-[0.2em] bg-slate-50 px-4 sm:px-8 py-2 sm:py-2.5 rounded-full border border-slate-100 text-center">
                      {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
                    </span>
                    <div className="h-px flex-grow bg-slate-100"></div>
                 </div>
                 
                 {TIME_SLOTS.map(slot => {
                    const brandsForSlot = brands.filter((brand: any) => {
                      const matchesBrandFilter = selectedBrandFilter === 'SEMUA BRAND' || brand.name === selectedBrandFilter;
                      if (!matchesBrandFilter) return false;
                      if (!localSearch) return true;
                      const sched = schedules.find(s => s.date === date && s.brand === brand.name && s.hourSlot === slot);
                      const hostName = sched ? (employeeMap[sched.hostId] || '').toLowerCase() : '';
                      const opName = sched ? (employeeMap[sched.opId] || '').toLowerCase() : '';
                      return hostName.includes(localSearch.toLowerCase()) || opName.includes(localSearch.toLowerCase()) || brand.name.toLowerCase().includes(localSearch.toLowerCase());
                    });

                    if (brandsForSlot.length === 0) return null;

                    return (
                      <div key={`${date}-${slot}`} className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <span className="bg-[#0f172a] text-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-bold tracking-[0.1em]">{slot}</span>
                          <div className="h-px flex-grow bg-slate-50"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          {brandsForSlot.map((brand: any) => {
                            const sched = schedules.find(s => s.date === date && s.brand === brand.name && s.hourSlot === slot) || { hostId: '', opId: '' };
                            return (
                              <div key={`${date}-${slot}-${brand.name}`} className="bg-white border border-slate-100 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <div className="px-4 sm:px-6 py-2 sm:py-2.5 font-bold text-[8px] sm:text-[9px] uppercase tracking-[0.15em] sm:tracking-[0.2em] bg-[#FFC000] text-[#0f172a]">
                                  {brand.name}
                                </div>
                                <div className="p-4 sm:p-6 grid grid-cols-1 gap-3 sm:gap-4">
                                  <div className="space-y-1 sm:space-y-1.5">
                                    <label className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">HOST LIVE</label>
                                    <select value={sched.hostId} disabled={readOnly} onChange={(e) => updateSchedule(date, brand.name, slot, 'hostId', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 text-[9px] sm:text-[10px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#FFC000] appearance-none shadow-inner">
                                      <option value="">- PILIH HOST -</option>
                                      {hostList.map(h => <option key={h.id} value={h.id}>{h.nama.toUpperCase()}</option>)}
                                    </select>
                                  </div>
                                  <div className="space-y-1 sm:space-y-1.5">
                                    <label className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">OPERATOR</label>
                                    <select value={sched.opId} disabled={readOnly} onChange={(e) => updateSchedule(date, brand.name, slot, 'opId', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 text-[9px] sm:text-[10px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#FFC000] appearance-none shadow-inner">
                                      <option value="">- PILIH OP -</option>
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
             ))}
          </div>
        ) : activeSubTab === 'BRAND' ? (
          <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex items-center gap-4 sm:gap-6 mb-4">
               <div className="bg-[#FFC000] p-3 sm:p-4 rounded-xl sm:rounded-2xl text-[#0f172a] shadow-xl shadow-amber-200/50">
                 <Icons.Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
               </div>
               <div>
                 <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] uppercase tracking-tighter leading-none">PENGATURAN BRAND LIVE</h3>
                 <p className="text-[7px] sm:text-[8px] font-semibold text-slate-400 uppercase tracking-[0.3em] mt-1 sm:mt-1.5">Daftar Brand Aktif di Jadwal</p>
               </div>
            </div>

            {!readOnly && (
              <div className="bg-[#0f172a] p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFC000]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <h4 className="text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-4 sm:mb-5">TAMBAH BRAND BARU</h4>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <input 
                      type="text" 
                      value={newBrandName} 
                      onChange={e => setNewBrandName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addBrand()} 
                      placeholder="NAMA BRAND..." 
                      className="flex-grow bg-white/10 border border-white/20 rounded-xl sm:rounded-[24px] px-6 sm:px-8 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white outline-none focus:bg-white/15 focus:ring-2 focus:ring-[#FFC000]/50 transition-all placeholder:text-slate-500" 
                    />
                    <button 
                      onClick={addBrand} 
                      disabled={isSavingBrands} 
                      className="bg-[#FFC000] hover:bg-white text-[#0f172a] px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-[24px] font-bold text-[9px] sm:text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl disabled:opacity-50"
                    >
                      {isSavingBrands ? '...' : 'TAMBAH'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pt-2 sm:pt-4">
              {brands.map((brand: any) => (
                <div key={brand.name} className="bg-white border border-slate-100 rounded-[24px] sm:rounded-[32px] p-4 sm:p-8 flex items-center justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[24px] flex items-center justify-center bg-[#FFC000] text-[#0f172a] text-lg sm:text-xl font-bold shadow-lg shadow-amber-200/50 transform group-hover:rotate-6 transition-all duration-500">
                      {brand.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-[#0f172a] uppercase tracking-tighter leading-none">{brand.name}</h4>
                      <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        <p className="text-[7px] sm:text-[8px] font-semibold text-slate-400 uppercase tracking-widest">AKTIF DI JADWAL</p>
                      </div>
                    </div>
                  </div>
                  {!readOnly && (
                    <button 
                      onClick={() => removeBrand(brand.name)} 
                      disabled={isSavingBrands} 
                      className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg sm:rounded-[18px] hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <Icons.Trash className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : activeSubTab === 'LIBUR' ? (
          <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10 animate-in fade-in duration-500 pb-20">
            <h3 className="text-[10px] sm:text-xs font-bold text-[#0f172a] uppercase tracking-[0.2em] sm:tracking-[0.3em] border-b border-slate-100 pb-4 sm:pb-6 text-center">MANAJEMEN LIBUR MINGGUAN</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="bg-white border border-slate-100 rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 shadow-sm flex flex-col group hover:shadow-xl transition-all min-h-[220px] sm:min-h-[250px]">
                  <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <span className="text-[8px] sm:text-[10px] font-bold text-[#FFC000] uppercase tracking-[0.15em] sm:tracking-[0.2em] bg-[#0f172a] px-4 sm:px-5 py-1 sm:py-1.5 rounded-full">{day}</span>
                    <button onClick={() => !readOnly && setAddingDay(day)} className={`w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0f172a] hover:bg-[#FFC000] rounded-xl sm:rounded-2xl flex items-center justify-center transition-all active:scale-90 ${readOnly ? 'hidden' : ''}`}><Icons.Plus className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                  </div>
                  <div className="flex-grow flex flex-col gap-2 sm:gap-3">
                    {(weeklyHolidays[day] || []).map((name) => (
                      <div key={name} className="group/item bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2 sm:py-3 text-[9px] sm:text-[10px] font-bold text-[#0f172a] uppercase text-center relative transition-all hover:bg-white hover:border-[#FFC000]">
                        {name}
                        {!readOnly && (
                          <button onClick={() => removeHolidayName(day, name)} className="absolute -right-1.5 -top-1.5 w-5 h-5 sm:w-6 sm:h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg active:scale-90 text-xs">&times;</button>
                        )}
                      </div>
                    ))}
                    {addingDay === day && (
                      <div className="mt-2 sm:mt-4 space-y-2">
                        <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit(day)} placeholder="NAMA..." className="w-full bg-white border-2 border-[#0f172a] rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-bold text-black outline-none uppercase text-center" />
                        <div className="flex gap-1.5 sm:gap-2">
                          <button onClick={() => handleAddSubmit(day)} className="flex-1 bg-[#0f172a] text-[#FFC000] py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[8px] font-bold uppercase">SIMPAN</button>
                          <button onClick={() => { setAddingDay(null); setNewName(''); }} className="px-3 sm:px-4 bg-slate-100 text-slate-400 py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[8px] font-bold uppercase">BATAL</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeSubTab === 'TEMPLATE' ? (
          <div className="max-w-4xl mx-auto py-12 sm:py-20 text-center space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mt-6 sm:mt-12">
               <div className="bg-emerald-50/50 p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border-2 border-emerald-100 space-y-4 sm:space-y-6 flex flex-col items-center group hover:bg-emerald-50 transition-all">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Icons.Download className="w-6 h-6 sm:w-8 sm:h-8" /></div>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase tracking-tight">EKSPOR JADWAL</h3>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 sm:mt-2 leading-relaxed">Unduh riwayat jadwal live ke Excel.</p>
                  </div>
                  <button onClick={handleExportExcel} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">MULAI EKSPOR</button>
               </div>

               <div className="bg-blue-50/50 p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border-2 border-blue-100 space-y-4 sm:space-y-6 flex flex-col items-center group hover:bg-blue-50 transition-all">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-900 text-[#FFC000] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Icons.Upload className="w-6 h-6 sm:w-8 sm:h-8" /></div>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase tracking-tight">IMPOR JADWAL</h3>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 sm:mt-2 leading-relaxed">Unggah jadwal masal dari Excel.</p>
                  </div>
                  <input type="file" ref={scheduleFileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
                  <button 
                    disabled={isProcessingExcel || readOnly}
                    onClick={() => scheduleFileInputRef.current?.click()} 
                    className="w-full bg-slate-900 hover:bg-black text-[#FFC000] py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isProcessingExcel ? 'MEMPROSES...' : 'UNGGAH EXCEL'}
                  </button>
               </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* FOOTER ACTION BAR */}
      {activeSubTab === 'JADWAL' && (
        <div className="px-6 sm:px-10 py-6 sm:py-8 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[7px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">SYNCED & LIVE</span>
          </div>
          {!readOnly && (
            <button onClick={() => alert("Perubahan disimpan!")} className="bg-[#0f172a] text-[#FFC000] px-6 sm:px-12 py-3 sm:py-4 rounded-xl sm:rounded-[28px] text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] shadow-2xl transition-all active:scale-95 hover:bg-slate-800">SIMPAN SEMUA</button>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveScheduleModule;
