
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Employee, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';

interface AttendanceModuleProps {
  employees: Employee[];
  records: AttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  searchQuery?: string;
  userRole?: string;
  currentEmployee?: Employee | null;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  weeklyHolidays?: Record<string, string[]>;
  company: string;
}

const ALPHA_START_DATE = '2026-02-02';

const AttendanceModule: React.FC<AttendanceModuleProps> = ({ 
  employees, 
  records, 
  setRecords, 
  searchQuery = '', 
  userRole = 'employee',
  currentEmployee = null,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  weeklyHolidays,
  company
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'super' || userRole === 'admin' || userRole === 'owner';

  const searchedEmployees = useMemo(() => {
    let base = employees;
    if (!isAdmin && currentEmployee) {
      base = [currentEmployee];
    }
    const finalQuery = (localSearch || searchQuery).toLowerCase();
    return base.filter(emp => 
      emp.nama.toLowerCase().includes(finalQuery) ||
      emp.idKaryawan.toLowerCase().includes(finalQuery)
    );
  }, [employees, searchQuery, localSearch, isAdmin, currentEmployee]);

  const datesInRange = useMemo(() => {
    const dates = [];
    let cur = new Date(startDate);
    let end = new Date(endDate);
    if (isNaN(cur.getTime()) || isNaN(end.getTime())) return [];
    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates.reverse();
  }, [startDate, endDate]);

  const fetchRecordPhoto = async (id: string, type: 'photoIn' | 'photoOut') => {
    if (!id) return;
    setIsPhotoLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(type)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (data?.[type]) {
        setZoomedImage(data[type]);
      } else {
        alert("Foto verifikasi tidak tersedia.");
      }
    } catch (err: any) {
      alert("Gagal memuat foto: " + err.message);
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const isWorkDay = (dateStr: string, emp: Employee) => {
    const date = new Date(dateStr);
    const dayNameMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const currentDayName = dayNameMap[date.getDay()];
    if (weeklyHolidays) {
      const empNameUpper = emp.nama.toUpperCase();
      const employeeInHolidays = Object.values(weeklyHolidays).some(names => (names as string[]).map(n => n.toUpperCase()).includes(empNameUpper));
      if (employeeInHolidays) {
        return !(weeklyHolidays[currentDayName] || []).map(n => n.toUpperCase()).includes(empNameUpper);
      }
    }
    const day = date.getDay();
    return day !== 0 && day !== 6;
  };

  const tableRows = useMemo(() => {
    const rows: { employee: Employee; date: string }[] = [];
    datesInRange.forEach(date => searchedEmployees.forEach(employee => rows.push({ employee, date })));
    return rows;
  }, [searchedEmployees, datesInRange]);

  const totalPages = Math.ceil(tableRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    return tableRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [tableRows, currentPage]);

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase.from('attendance').upsert(editingRecord);
      if (error) throw error;
      setRecords(prev => {
        const idx = prev.findIndex(r => r.employeeId === editingRecord.employeeId && r.date === editingRecord.date);
        const updated = [...prev];
        if (idx !== -1) updated[idx] = { ...updated[idx], ...editingRecord };
        else updated.push(editingRecord);
        return updated;
      });
      setIsEditModalOpen(false);
    } catch (err: any) { alert(err.message); }
  };

  const handleDownloadTemplate = () => {
    const template = [{ 'TANGGAL': '2026-02-06', 'ID KARYAWAN': 'VID-7251', 'NAMA': 'NAMA CONTOH', 'STATUS': 'Hadir', 'MASUK': '09:00', 'PULANG': '18:00', 'CATATAN': '' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Absensi");
    XLSX.writeFile(wb, `Template_Absensi_${company}.xlsx`);
  };

  const handleExportExcel = () => {
    const dataToExport = tableRows.map(row => {
      const existingRec = records.find(r => r.employeeId === row.employee.id && r.date === row.date);
      return {
        'TANGGAL': row.date,
        'ID KARYAWAN': row.employee.idKaryawan,
        'NAMA': row.employee.nama,
        'STATUS': existingRec?.status || (isWorkDay(row.date, row.employee) ? 'Alpha' : 'Libur'),
        'MASUK': existingRec?.clockIn || '',
        'PULANG': existingRec?.clockOut || '',
        'CATATAN': existingRec?.notes || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Kehadiran");
    XLSX.writeFile(wb, `Log_Kehadiran_${company}_${startDate}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const newRecords = jsonData.map((row: any) => {
          const emp = employees.find(e => e.idKaryawan === String(row['ID KARYAWAN']));
          if (!emp) return null;
          return {
            employeeId: emp.id,
            company: company,
            date: String(row['TANGGAL']),
            status: String(row['STATUS'] || 'Hadir') as any,
            clockIn: row['MASUK'] ? String(row['MASUK']) : undefined,
            clockOut: row['PULANG'] ? String(row['PULANG']) : undefined,
            notes: row['CATATAN'] ? String(row['CATATAN']) : 'Imported'
          };
        }).filter(r => r !== null);
        if (newRecords.length > 0) {
          const { error } = await supabase.from('attendance').upsert(newRecords, { onConflict: 'employeeId,date' });
          if (error) throw error;
          alert(`Berhasil mengimpor ${newRecords.length} data absensi!`);
          location.reload();
        }
      } catch (err: any) { alert("Gagal impor: " + err.message); } finally { setIsImporting(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Hadir': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Libur': return 'bg-slate-50 text-slate-400 border-slate-200';
      case 'Sakit': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Izin': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'Alpha': return 'bg-rose-50 text-rose-600 border-rose-100 font-bold';
      case 'Cuti': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-700">
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-[80vh] rounded-[32px] shadow-2xl border-4 border-white/10 scale-95 animate-in zoom-in-95 duration-300" alt="Verifikasi" />
        </div>
      )}

      {isPhotoLoading && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-[2px] z-[250] flex items-center justify-center">
           <div className="bg-slate-900 text-[#FFC000] px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in zoom-in duration-300">
              <div className="w-5 h-5 border-2 border-[#FFC000]/20 border-t-[#FFC000] rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Memproses Foto...</p>
           </div>
        </div>
      )}

      <div className="bg-white rounded-[40px] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-6">
        <div className="space-y-1">
          <h2 className="font-black text-slate-900 text-3xl sm:text-4xl tracking-tighter uppercase leading-tight">Log Kehadiran</h2>
          <div className="h-1 w-12 bg-[#FFC000] mx-auto rounded-full"></div>
          <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.5em] pt-1">Monitoring & History</p>
        </div>
        
        <div className="w-full max-w-4xl space-y-4">
          <div className="flex flex-col lg:flex-row items-center gap-3 bg-slate-50 p-1.5 rounded-[28px] border border-slate-100 shadow-inner w-full overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-[22px] shadow-sm border border-slate-100 shrink-0">
              <div className="flex flex-col items-start min-w-[100px]">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Mulai</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => onStartDateChange(e.target.value)} 
                  className="bg-transparent text-xs sm:text-sm font-black outline-none text-slate-900 cursor-pointer" 
                />
              </div>
              <div className="h-8 w-px bg-slate-100"></div>
              <div className="flex flex-col items-start min-w-[100px]">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sampai</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => onEndDateChange(e.target.value)} 
                  className="bg-transparent text-xs sm:text-sm font-black outline-none text-slate-900 cursor-pointer" 
                />
              </div>
            </div>

            <div className="relative flex-grow w-full lg:w-auto px-4 py-3 bg-white rounded-[22px] shadow-sm border border-slate-100 flex items-center gap-3 h-[52px]">
               <Icons.Search className="w-4 h-4 text-slate-300" />
               <input 
                type="text" 
                placeholder="CARI NAMA ATAU ID..." 
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent text-[10px] font-black outline-none text-slate-800 placeholder:text-slate-300 uppercase tracking-widest"
               />
            </div>
            <button onClick={() => { setLocalSearch(''); onStartDateChange(new Date().toISOString().split('T')[0]); onEndDateChange(new Date().toISOString().split('T')[0]); setCurrentPage(1); }} className="hidden lg:flex bg-slate-900 text-[#FFC000] px-6 h-[52px] rounded-[20px] items-center justify-center text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shrink-0">Refresh</button>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-2 md:flex md:flex-row gap-2 sm:gap-4 justify-center w-full animate-in slide-in-from-top-2 duration-500">
              <button onClick={handleDownloadTemplate} className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 px-4 py-3 rounded-[20px] text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2">
                <Icons.Download className="w-4 h-4" /> TEMPLATE
              </button>
              <input type="file" ref={importFileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
              <button onClick={() => importFileInputRef.current?.click()} className="bg-[#059669] hover:bg-[#047857] text-white px-4 py-3 rounded-[20px] text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                <Icons.Upload className="w-4 h-4" /> UNGGAH
              </button>
              <button onClick={handleExportExcel} className="col-span-2 md:col-auto bg-[#0f172a] hover:bg-black text-white px-4 py-3 rounded-[20px] text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                <Icons.Database className="w-4 h-4" /> EKSPOR
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden mb-6 flex flex-col">
        <div className="overflow-x-auto custom-scrollbar touch-pan-x">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-[0.1em] border-b border-slate-100">
              <tr>
                <th className="px-6 sm:px-10 py-5">Tanggal</th>
                <th className="px-5 py-5">Karyawan</th>
                <th className="px-3 py-5 text-center">Status</th>
                <th className="px-3 py-5">Masuk</th>
                <th className="px-3 py-5">Pulang</th>
                <th className="px-6 sm:px-10 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedRows.map(row => {
                const existingRec = records.find(r => r.employeeId === row.employee.id && r.date === row.date);
                const isToday = row.date === new Date().toISOString().split('T')[0];
                const isPast = row.date < new Date().toISOString().split('T')[0];
                const isWork = isWorkDay(row.date, row.employee);
                const rec = (existingRec || { status: isWork ? (isPast ? 'Alpha' : 'Hadir') : 'Libur', employeeId: row.employee.id, date: row.date }) as AttendanceRecord;
                
                return (
                  <tr key={`${row.employee.id}-${row.date}`} className={`hover:bg-slate-50/50 transition-all duration-300 group ${isToday ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-6 sm:px-10 py-4">
                      <div className="flex flex-col">
                        <p className="text-[10px] font-black text-slate-900 whitespace-nowrap">{row.date}</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(row.date).toLocaleDateString('id-ID', { weekday: 'short' })}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden border-2 border-white shadow-sm shrink-0 bg-slate-50">
                            {row.employee.photoBase64 || row.employee.avatarUrl ? <img src={row.employee.photoBase64 || row.employee.avatarUrl} className="w-full h-full object-cover" alt="" /> : <Icons.Users className="w-4 h-4 text-slate-200" />}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[10px] sm:text-[11px] font-black uppercase text-slate-900 truncate max-w-[150px]">{row.employee.nama}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{row.employee.jabatan}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center">
                       <span className={`inline-block text-[8px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${getStatusStyle(rec.status)}`}>{rec.status}</span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black ${rec.clockIn ? 'text-slate-900' : 'text-slate-200'}`}>{rec.clockIn || '--:--'}</span>
                        {rec.id && rec.clockIn && <button onClick={() => fetchRecordPhoto(rec.id!, 'photoIn')} className="p-1 bg-slate-100 hover:bg-[#FFC000] hover:text-white rounded-lg transition-all"><Icons.Camera className="w-3 h-3" /></button>}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black ${rec.clockOut ? 'text-slate-900' : 'text-slate-200'}`}>{rec.clockOut || '--:--'}</span>
                        {rec.id && rec.clockOut && <button onClick={() => fetchRecordPhoto(rec.id!, 'photoOut')} className="p-1 bg-slate-100 hover:bg-[#FFC000] hover:text-white rounded-lg transition-all"><Icons.Camera className="w-3 h-3" /></button>}
                      </div>
                    </td>
                    <td className="px-6 sm:px-10 py-4 text-right">
                      {isAdmin && <button onClick={() => { setEditingRecord(rec); setIsEditModalOpen(true); }} className="p-2 text-slate-300 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all"><Icons.Edit className="w-4 h-4" /></button>}
                    </td>
                  </tr>
                );
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tidak ada data kehadiran</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="bg-slate-50/50 px-6 sm:px-10 py-5 flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
              <span className="text-xs font-black text-slate-900 px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-200">{currentPage} / {totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95"
              >
                <Icons.ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95"
              >
                <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-md space-y-10 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="text-center"><h3 className="text-2xl font-black uppercase text-slate-900">Koreksi Absensi</h3></div>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3"><label className="text-[9px] font-black text-slate-300 uppercase">CLOCK IN</label><input type="time" value={editingRecord.clockIn || ''} onChange={e => setEditingRecord({...editingRecord, clockIn: e.target.value})} className="w-full border-2 border-slate-50 bg-slate-50 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000]" /></div>
                <div className="space-y-3"><label className="text-[9px] font-black text-slate-300 uppercase">CLOCK OUT</label><input type="time" value={editingRecord.clockOut || ''} onChange={e => setEditingRecord({...editingRecord, clockOut: e.target.value})} className="w-full border-2 border-slate-50 bg-slate-50 p-5 rounded-3xl text-sm font-black outline-none focus:border-[#FFC000]" /></div>
              </div>
              <div className="space-y-3"><label className="text-[9px] font-black text-slate-300 uppercase">STATUS</label><select value={editingRecord.status} onChange={e => setEditingRecord({...editingRecord, status: e.target.value as any})} className="w-full border-2 border-slate-50 bg-slate-50 p-5 rounded-3xl text-sm font-black outline-none appearance-none"><option value="Hadir">Hadir</option><option value="Sakit">Sakit</option><option value="Izin">Izin</option><option value="Alpha">Alpha</option><option value="Cuti">Cuti</option><option value="Libur">Libur</option></select></div>
            </div>
            <div className="flex gap-4"><button onClick={handleSaveEdit} className="flex-1 bg-slate-900 text-[#FFC000] py-6 rounded-[28px] font-black uppercase text-xs">Simpan</button><button onClick={() => setIsEditModalOpen(false)} className="px-8 bg-slate-100 text-slate-400 py-6 rounded-[28px] font-black uppercase text-xs">Batal</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceModule;
