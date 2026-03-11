
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Employee, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { supabase } from '../services/supabaseClient';

interface AttendanceModuleProps {
  employees: Employee[];
  records: AttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userRole: string;
  currentEmployee: Employee | null;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  weeklyHolidays: Record<string, string[]>;
  company: string;
  positionRates: any[];
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  employees,
  records,
  setRecords,
  searchQuery,
  setSearchQuery,
  userRole,
  currentEmployee,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  weeklyHolidays,
  company,
  positionRates
}) => {
  const isAdmin = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const employee = employees.find(e => e.id === record.employeeId);
      const nameMatch = employee?.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        employee?.idKaryawan?.toLowerCase().includes(searchQuery.toLowerCase());
      const dateMatch = record.date >= startDate && record.date <= endDate;
      return nameMatch && dateMatch;
    });
  }, [records, employees, searchQuery, startDate, endDate]);

  const exportToExcel = () => {
    const data = filteredRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return {
        'ID Karyawan': emp?.idKaryawan || emp?.id || '-',
        'Nama': emp?.nama || 'Unknown',
        'Tanggal': r.date,
        'Jam Masuk': r.clockIn || '-',
        'Jam Pulang': r.clockOut || '-',
        'Status': r.status,
        'Catatan': r.notes || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_${startDate}_to_${endDate}.xlsx`);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'ID Karyawan': 'VSB-01',
        'Tanggal': '2024-03-11',
        'Jam Masuk': '08:00',
        'Jam Pulang': '17:00',
        'Status': 'Hadir',
        'Catatan': 'Import Manual'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Absensi.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newRecords: AttendanceRecord[] = [];
        for (const row of data) {
          const empId = row['ID Karyawan'];
          const employee = employees.find(e => e.idKaryawan === empId || e.id === empId);
          
          if (employee) {
            newRecords.push({
              employeeId: employee.id,
              date: row['Tanggal'],
              clockIn: row['Jam Masuk'],
              clockOut: row['Jam Pulang'],
              status: row['Status'] || 'Hadir',
              notes: row['Catatan'] || 'Imported',
              company: company
            });
          }
        }

        if (newRecords.length > 0) {
          const { error } = await supabase.from('attendance').upsert(newRecords);
          if (error) throw error;
          
          alert(`Berhasil mengimpor ${newRecords.length} data absensi!`);
          // Refresh records logic should be handled by parent or by updating local state if records is local
          // Since records is passed as prop, we assume parent handles refresh or we update via setRecords
          setRecords(prev => [...newRecords, ...prev]);
        }
      } catch (err: any) {
        alert("Gagal mengimpor data: " + err.message);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Data Absensi</h2>
          <p className="text-slate-500 text-sm font-medium">Kelola dan pantau kehadiran karyawan</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-grow lg:flex-initial w-full lg:w-64 bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-2 flex items-center gap-3">
            <Icons.Search className="w-4 h-4 text-slate-300 shrink-0" />
            <input 
              type="text" 
              placeholder="CARI NAMA / ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-[10px] font-black text-slate-700 outline-none placeholder:text-slate-300 uppercase tracking-widest bg-transparent"
            />
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => onStartDateChange(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none"
            />
            <span className="mx-2 text-slate-300">-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => onEndDateChange(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none"
            />
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-white transition-all active:scale-95"
                >
                  <Icons.Download className="w-4 h-4" />
                  TEMPLATE
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center gap-2 bg-[#059669] text-white px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-[#047857] transition-all active:scale-95 disabled:opacity-50"
                >
                  <Icons.Upload className="w-4 h-4" />
                  {isImporting ? 'IMPORTING...' : 'IMPORT'}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImport} 
                  className="hidden" 
                  accept=".xlsx,.xls" 
                />
              </>
            )}
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#FFC000] text-black px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-[#eab308] transition-all active:scale-95"
            >
              <Icons.Download className="w-4 h-4" />
              EKSPOR
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Karyawan</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Masuk</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pulang</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => {
                  const employee = employees.find(e => e.id === record.employeeId);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-sm">{employee?.nama}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{employee?.idKaryawan || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-500">{record.date}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                            {record.clockIn || '--:--'}
                          </span>
                          {record.photoIn && (
                            <button 
                              onClick={() => setSelectedPhoto({ url: record.photoIn!, title: `Foto Masuk - ${employee?.nama}` })}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-all active:scale-90"
                              title="Lihat Foto Masuk"
                            >
                              <Icons.Camera className="w-3 h-3" />
                              <span className="text-[8px] font-black">FOTO</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                            {record.clockOut || '--:--'}
                          </span>
                          {record.photoOut && (
                            <button 
                              onClick={() => setSelectedPhoto({ url: record.photoOut!, title: `Foto Pulang - ${employee?.nama}` })}
                              className="flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-all active:scale-90"
                              title="Lihat Foto Pulang"
                            >
                              <Icons.Camera className="w-3 h-3" />
                              <span className="text-[8px] font-black">FOTO</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${
                          record.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          record.status === 'Terlambat' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-slate-50 text-slate-700 border-slate-100'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <Icons.Clock className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">
                        Tidak ada data absensi ditemukan
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] overflow-hidden max-w-md w-full shadow-2xl border border-white/10">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">{selectedPhoto.title}</h3>
              <button onClick={() => setSelectedPhoto(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <Icons.X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-8 flex justify-center bg-white">
              <div className="w-full aspect-square rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-inner">
                <img src={selectedPhoto.url} alt="Absensi" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 text-center">
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-black transition-all active:scale-95"
              >
                TUTUP PRATINJAU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceModule;
