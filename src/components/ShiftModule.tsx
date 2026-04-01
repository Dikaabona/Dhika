import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, Shift, ShiftAssignment } from '../types';
import { Icons, DEFAULT_SHIFTS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { formatDateToYYYYMMDD } from '../utils/dateUtils';
import { useConfirmation } from '../contexts/ConfirmationContext';

interface ShiftModuleProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<ShiftAssignment[]>>;
  userRole: string;
  company: string;
  onClose: () => void;
  globalShifts: Shift[];
  onRefreshShifts: () => void;
}

const ShiftModule: React.FC<ShiftModuleProps> = ({ employees, assignments, setAssignments, userRole, company, onClose, globalShifts, onRefreshShifts }) => {
  const { confirm } = useConfirmation();
  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const [activeTab, setActiveTab] = useState<'VIEW' | 'MANAGE'>('VIEW');
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Local state for edits before saving to cloud
  const [localShifts, setLocalShifts] = useState<Shift[]>(globalShifts || DEFAULT_SHIFTS);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    setLocalShifts(globalShifts || DEFAULT_SHIFTS);
  }, [globalShifts]);

  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.idKaryawan.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const datesInRange = useMemo(() => {
    const dates = [];
    let cur = new Date(startDate);
    let end = new Date(endDate);
    
    if (isNaN(cur.getTime()) || isNaN(end.getTime())) return [];
    
    cur.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    while (cur <= end) {
      dates.push(formatDateToYYYYMMDD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates.reverse();
  }, [startDate, endDate]);

  const tableRows = useMemo(() => {
    const rows: { employee: Employee; date: string }[] = [];
    datesInRange.forEach(date => filteredEmployees.forEach(employee => rows.push({ employee, date })));
    return rows;
  }, [filteredEmployees, datesInRange]);

  const totalPages = Math.ceil(tableRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    return tableRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [tableRows, currentPage]);

  const handleAssignShift = async (employeeId: string, date: string, shiftId: string) => {
    if (!isAdmin) return;
    
    const existing = assignments.find(a => a.employeeId === employeeId && a.date === date);
    
    try {
      const newAssignment: Partial<ShiftAssignment> = {
        employeeId,
        date,
        shiftId,
        company
      };

      const { data, error } = await supabase.from('shift_assignments').upsert(
        existing ? { ...newAssignment, id: existing.id } : newAssignment,
        { onConflict: 'employeeId,date' }
      ).select();

      if (error) throw error;
      setAssignments(prev => {
        const updated = [...prev];
        if (existing) {
          const idx = updated.findIndex(a => a.id === existing.id);
          updated[idx] = data[0];
        } else {
          updated.push(data[0]);
        }
        return updated;
      });
    } catch (err: any) {
      alert("Gagal update shift: " + err.message);
    }
  };

  const parseExcelDate = (val: any) => {
    if (!val) return '';
    if (val instanceof Date) return formatDateToYYYYMMDD(val);
    
    // Handle excel numeric date
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return formatDateToYYYYMMDD(date);
    }

    const str = String(val).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      // DD/MM/YYYY
      if (parts[0].length <= 2) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      // YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return str;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const processedRows = jsonData.map((row: any) => {
          const keys = Object.keys(row);
          const idKey = keys.find(k => k.toUpperCase() === 'ID KARYAWAN');
          const shiftKey = keys.find(k => k.toUpperCase() === 'SHIFT');
          const dateKey = keys.find(k => k.toUpperCase() === 'TANGGAL');

          if (!idKey || !shiftKey || !dateKey) return null;

          const empIdKaryawan = String(row[idKey]).trim();
          const shiftNameInput = String(row[shiftKey]).trim();
          const rawDate = row[dateKey];

          const emp = employees.find(e => String(e.idKaryawan).trim() === empIdKaryawan);
          const formattedDate = parseExcelDate(rawDate);

          if (!emp || !formattedDate) return null;

          const isOff = ['off', 'libur', '', 'null'].includes(shiftNameInput.toLowerCase());
          const shift = (globalShifts || DEFAULT_SHIFTS).find(s => s.name.toLowerCase().trim() === shiftNameInput.toLowerCase());

          if (!shift && !isOff) return null;
          
          return { 
            employeeId: emp.id, 
            date: formattedDate, 
            shiftId: shift ? shift.id : '', 
            company: company 
          };
        }).filter((a): a is any => a !== null);

        if (processedRows.length > 0) {
          const { data: upsertedData, error } = await supabase
            .from('shift_assignments')
            .upsert(processedRows, { onConflict: 'employeeId,date' })
            .select();
          if (error) throw error;
          
          setAssignments(prev => {
            const updated = [...prev];
            upsertedData?.forEach(newItem => {
              const idx = updated.findIndex(a => a.employeeId === newItem.employeeId && a.date === newItem.date);
              if (idx !== -1) updated[idx] = newItem;
              else updated.push(newItem);
            });
            return updated;
          });

          alert(`Berhasil memproses ${processedRows.length} data jadwal shift!`);
        } else {
          alert("Tidak ada data valid untuk diimpor. Pastikan header sesuai: TANGGAL, ID KARYAWAN, SHIFT");
        }
      } catch (err: any) { 
        alert("Gagal impor: " + err.message); 
      } finally { 
        setIsImporting(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    const dataToExport = tableRows.map(row => {
      const dayAssignment = assignments.find(a => a.employeeId === row.employee.id && a.date === row.date);
      const shiftName = (globalShifts || DEFAULT_SHIFTS).find(s => s.id === dayAssignment?.shiftId)?.name || 'OFF / LIBUR';
      return {
        'TANGGAL': row.date,
        'ID KARYAWAN': row.employee.idKaryawan,
        'NAMA': row.employee.nama,
        'SHIFT': shiftName
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Shift");
    XLSX.writeFile(wb, `Shift_${company}_${startDate}_to_${endDate}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [{ 'TANGGAL': '2026-02-06', 'ID KARYAWAN': employees[0]?.idKaryawan || 'VID-7251', 'SHIFT': (globalShifts || DEFAULT_SHIFTS)[0]?.name || 'Shift Pagi' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Shift");
    XLSX.writeFile(wb, `Template_Shift_${company}.xlsx`);
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const { error } = await supabase.from('settings').upsert({
        key: `shifts_config_${company}`,
        value: localShifts
      }, { onConflict: 'key' });
      
      if (error) throw error;
      alert("Tipe Shift berhasil disimpan ke Cloud Database!");
      onRefreshShifts();
    } catch (err: any) {
      alert("Gagal menyimpan ke Cloud: " + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAddShift = () => {
    const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-orange-500', 'bg-teal-500'];
    
    // More robust ID generation
    const numericIds = localShifts
      .map(s => parseInt(s.id))
      .filter(id => !isNaN(id));
    
    const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : localShifts.length + 1;
    const newId = nextId.toString();

    const newShift: Shift = {
      id: newId,
      name: 'Shift Baru',
      startTime: '09:00',
      endTime: '17:00',
      color: colors[localShifts.length % colors.length],
      company: company
    };
    
    setLocalShifts(prev => [...prev, newShift]);
  };

  const handleDeleteShift = async (id: string) => {
    if (localShifts.length <= 1) {
      alert("Minimal harus ada satu tipe shift.");
      return;
    }
    const confirmed = await confirm({
      title: 'Hapus Tipe Shift',
      message: 'Apakah Anda yakin ingin menghapus tipe shift ini?',
      type: 'danger'
    });
    if (!confirmed) return;
    setLocalShifts(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8 animate-in fade-in duration-500 pb-20 px-4 sm:px-0">
      <div className="bg-white rounded-[32px] sm:rounded-[48px] p-6 sm:p-12 shadow-sm border border-slate-50 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 sm:gap-8 mb-8 sm:mb-12">
           <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">Jadwal Shift</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manajemen Waktu Kerja Karyawan</p>
           </div>
           <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
              <button 
                onClick={() => setActiveTab('VIEW')} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'VIEW' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                LIHAT JADWAL
              </button>
              <button 
                onClick={() => setActiveTab('MANAGE')} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'MANAGE' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                KELOLA SHIFT
              </button>
           </div>
        </div>

        {activeTab === 'VIEW' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
             <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 bg-slate-50 p-2 rounded-[32px] border border-slate-100 shadow-inner">
                <div className="flex items-center gap-4 px-6 py-4 sm:px-8 bg-white rounded-[24px] shadow-sm border border-slate-100 shrink-0">
                   <div className="flex flex-col items-start min-w-[100px] sm:min-w-[120px]">
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Mulai</span>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
                        className="bg-transparent text-xs sm:text-sm font-black outline-none text-slate-900 cursor-pointer w-full" 
                      />
                   </div>
                   <div className="h-8 w-px bg-slate-100"></div>
                   <div className="flex flex-col items-start min-w-[100px] sm:min-w-[120px]">
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Selesai</span>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
                        className="bg-transparent text-xs sm:text-sm font-black outline-none text-slate-900 cursor-pointer w-full" 
                      />
                   </div>
                </div>
                <div className="relative flex-grow px-6 py-4 bg-white rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4">
                   <Icons.Search className="w-5 h-5 text-slate-300" />
                   <input 
                    type="text" 
                    placeholder="CARI NAMA ATAU ID..." 
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full text-xs font-black text-slate-800 outline-none placeholder:text-slate-300 uppercase tracking-widest bg-transparent"
                   />
                </div>
                <div className="flex gap-2 px-2 shrink-0 justify-center">
                   <button onClick={handleDownloadTemplate} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"><Icons.Download className="w-5 h-5" /></button>
                   <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white border border-slate-200 rounded-2xl text-emerald-500 hover:bg-emerald-50 transition-all shadow-sm"><Icons.Upload className="w-5 h-5" /></button>
                   <button onClick={handleExport} className="p-4 bg-slate-900 rounded-2xl text-[#FFC000] shadow-xl"><Icons.Database className="w-5 h-5" /></button>
                   <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
                </div>
             </div>

             {/* Desktop Table View */}
             <div className="hidden md:block overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[800px] border-separate border-spacing-0">
                   <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <tr>
                         <th className="px-10 py-6 rounded-tl-3xl">Karyawan</th>
                         <th className="px-6 py-6">Tanggal</th>
                         <th className="px-10 py-6 text-right rounded-tr-3xl">Pilih Shift</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {paginatedRows.map((row, idx) => {
                         const assignment = assignments.find(a => a.employeeId === row.employee.id && a.date === row.date);
                         return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                               <td className="px-10 py-5">
                                  <p className="text-[11px] font-black text-slate-900 uppercase">{row.employee.nama}</p>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{row.employee.idKaryawan}</p>
                               </td>
                               <td className="px-6 py-5">
                                  <p className="text-[11px] font-black text-slate-700">{row.date}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(row.date).toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                               </td>
                               <td className="px-10 py-5 text-right">
                                  <select 
                                    disabled={!isAdmin}
                                    value={assignment?.shiftId || ''}
                                    onChange={(e) => handleAssignShift(row.employee.id, row.date, e.target.value)}
                                    className={`bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none cursor-pointer focus:border-indigo-400 transition-all text-black`}
                                  >
                                     <option value="">OFF / LIBUR</option>
                                     {localShifts.map(s => (
                                        <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                                     ))}
                                  </select>
                               </td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>

             {/* Mobile Card View */}
             <div className="md:hidden space-y-4">
                {paginatedRows.map((row, idx) => {
                   const assignment = assignments.find(a => a.employeeId === row.employee.id && a.date === row.date);
                   const shift = localShifts.find(s => s.id === assignment?.shiftId);
                   return (
                      <div key={idx} className="bg-slate-50 rounded-3xl p-5 border border-slate-100 space-y-4">
                         <div className="flex justify-between items-start">
                            <div>
                               <p className="text-xs font-black text-slate-900 uppercase">{row.employee.nama}</p>
                               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{row.employee.idKaryawan}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black text-slate-700">{row.date}</p>
                               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(row.date).toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                            </div>
                         </div>
                         <div className="pt-2">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Pilih Shift</label>
                            <select 
                              disabled={!isAdmin}
                              value={assignment?.shiftId || ''}
                              onChange={(e) => handleAssignShift(row.employee.id, row.date, e.target.value)}
                              className={`w-full bg-white border border-slate-200 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none cursor-pointer focus:border-indigo-400 transition-all text-black ${shift ? 'border-l-4 ' + shift.color.replace('bg-', 'border-') : ''}`}
                            >
                               <option value="">OFF / LIBUR</option>
                               {localShifts.map(s => (
                                  <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                               ))}
                            </select>
                         </div>
                      </div>
                   );
                })}
             </div>

             {paginatedRows.length === 0 && (
                <div className="px-10 py-20 text-center text-slate-300 font-black uppercase tracking-widest bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                   Data tidak ditemukan
                </div>
             )}

             {totalPages > 1 && (
               <div className="flex items-center justify-between px-10 py-6 border-t border-slate-50 bg-slate-50/30 rounded-b-3xl">
                 <div className="flex items-center gap-3">
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
                   <span className="text-xs font-black text-slate-900 px-5 py-2 bg-white rounded-xl shadow-sm border border-slate-200">{currentPage} / {totalPages}</span>
                 </div>
                 <div className="flex gap-3">
                   <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center">
                     <Icons.ChevronDown className="w-6 h-6 rotate-90" />
                   </button>
                   <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center">
                     <Icons.ChevronDown className="w-6 h-6 -rotate-90" />
                   </button>
                 </div>
               </div>
             )}
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in duration-300">
             <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Daftar Tipe Shift</h3>
                <button 
                  onClick={handleAddShift} 
                  disabled={!isAdmin}
                  className="bg-slate-900 text-[#FFC000] px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  TAMBAH TIPE
                </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localShifts.map((s, idx) => (
                   <div key={s.id} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-6 relative group overflow-hidden">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-black uppercase tracking-widest ml-1">Nama Shift</label>
                         <input 
                            type="text" 
                            value={s.name} 
                            onChange={e => { 
                               setLocalShifts(prev => prev.map((shift, i) => i === idx ? { ...shift, name: e.target.value } : shift));
                             }}
                            className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-400 shadow-sm text-black"
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-black uppercase tracking-widest ml-1">Mulai</label>
                            <input 
                               type="time" 
                               value={s.startTime} 
                               onChange={e => { 
                                 setLocalShifts(prev => prev.map((shift, i) => i === idx ? { ...shift, startTime: e.target.value } : shift));
                               }}
                               className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-xs font-black outline-none focus:border-indigo-400 shadow-sm text-black"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-black uppercase tracking-widest ml-1">Selesai</label>
                            <input 
                               type="time" 
                               value={s.endTime} 
                               onChange={e => { 
                                 setLocalShifts(prev => prev.map((shift, i) => i === idx ? { ...shift, endTime: e.target.value } : shift));
                               }}
                               className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-xs font-black outline-none focus:border-indigo-400 shadow-sm text-black"
                            />
                         </div>
                      </div>
                      <button onClick={() => handleDeleteShift(s.id)} className="absolute top-4 right-4 p-2 text-rose-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 rounded-lg"><Icons.Trash /></button>
                      <div className={`absolute bottom-0 left-0 right-0 h-1 ${s.color}`}></div>
                   </div>
                ))}
             </div>
             <div className="pt-10 border-t flex justify-center">
                <button onClick={handleSaveConfig} disabled={isSavingConfig} className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:opacity-50">
                   {isSavingConfig ? 'MENYIMPAN...' : 'SIMPAN'}
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftModule;