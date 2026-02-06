
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Employee, LiveReport } from '../types';
import { Icons, LIVE_BRANDS } from '../constants';
import { supabase } from '../App';

interface LiveReportModuleProps {
  employees: Employee[];
  reports: LiveReport[];
  setReports: React.Dispatch<React.SetStateAction<LiveReport[]>>;
  userRole: string;
  company: string;
  onClose: () => void;
}

// Updated: format to YYYY/MM/DD
const formatDateToYMD = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  return dateStr.replace(/-/g, '/');
};

// Updated: parse YYYY/MM/DD back to ISO YYYY-MM-DD
const parseYMDToIso = (val: any) => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  
  const str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      // Assuming YYYY/MM/DD format
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

const LiveReportModule: React.FC<LiveReportModuleProps> = ({ employees, reports, setReports, userRole, company, onClose }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<LiveReport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Omit<LiveReport, 'id'>>({
    tanggal: new Date().toISOString().split('T')[0],
    brand: LIVE_BRANDS[0].name,
    company: company,
    roomId: '',
    hostId: '',
    opId: '',
    totalView: 0,
    enterRoomRate: '0%',
    ctr: '0%',
    waktuMulai: '09:00',
    waktuSelesai: '12:00',
    durasi: 3,
    checkout: 0,
    gmv: 0
  });

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 1440;
    return parseFloat((diff / 60).toFixed(2));
  };

  useEffect(() => {
    const newDurasi = calculateDuration(formData.waktuMulai, formData.waktuSelesai);
    if (newDurasi !== formData.durasi) {
      setFormData(prev => ({ ...prev, durasi: newDurasi }));
    }
  }, [formData.waktuMulai, formData.waktuSelesai]);

  const canManage = userRole === 'super' || userRole === 'admin' || userRole === 'owner';

  const hostList = useMemo(() => employees.filter(e => {
    const jabatan = (e.jabatan || '').toLowerCase();
    const nama = (e.nama || '').toLowerCase();
    return jabatan.includes('host') || nama.includes('wida oktapiani');
  }), [employees]);
  
  const opList = useMemo(() => employees.filter(e => {
    const jabatan = (e.jabatan || '').toLowerCase();
    const nama = (e.nama || '').toLowerCase();
    return jabatan.includes('op') || jabatan.includes('operator') || nama.includes('ariyansyah');
  }), [employees]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesBrand = selectedBrand === 'ALL' || r.brand === selectedBrand;
      const matchesDate = (!startDate || r.tanggal >= startDate) && (!endDate || r.tanggal <= endDate);
      const hostName = employees.find(e => e.id === r.hostId)?.nama || '';
      const opName = employees.find(e => e.id === r.opId)?.nama || '';
      const matchesSearch = hostName.toLowerCase().includes(searchQuery.toLowerCase()) || opName.toLowerCase().includes(searchQuery.toLowerCase()) || (r.roomId && r.roomId.includes(searchQuery));
      return matchesBrand && matchesDate && matchesSearch;
    });
  }, [reports, selectedBrand, startDate, endDate, searchQuery, employees]);

  const handleOpenModal = (report?: LiveReport) => {
    if (report) {
      setEditingReport(report);
      setFormData({ ...report, ctr: report.ctr || '0%' });
    } else {
      setEditingReport(null);
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        brand: selectedBrand !== 'ALL' ? selectedBrand : LIVE_BRANDS[0].name,
        company: company,
        roomId: '',
        hostId: '',
        opId: '',
        totalView: 0,
        enterRoomRate: '0%',
        ctr: '0%',
        waktuMulai: '09:00',
        waktuSelesai: '12:00',
        durasi: 3,
        checkout: 0,
        gmv: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('live_reports').upsert(editingReport ? { ...formData, id: editingReport.id } : formData).select();
      if (error) throw error;
      setReports(prev => {
        if (editingReport) return prev.map(r => r.id === editingReport.id ? data[0] : r);
        return [data[0], ...prev];
      });
      setIsModalOpen(false);
    } catch (err: any) { alert("Gagal menyimpan: " + err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan ini?')) return;
    try {
      const { error } = await supabase.from('live_reports').delete().eq('id', id);
      if (error) throw error;
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (err: any) { alert("Gagal menghapus: " + err.message); }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const handleExport = () => {
    let dataToExport = filteredReports.map((r) => ({
      // Updated: format to YYYY/MM/DD
      'TANGGAL': formatDateToYMD(r.tanggal),
      'BRAND': r.brand,
      'ROOM ID': r.roomId,
      'HOST': employees.find(e => e.id === r.hostId)?.nama || '-',
      'OP': employees.find(e => e.id === r.opId)?.nama || '-',
      'VIEW': r.totalView,
      'RATE': r.enterRoomRate,
      'CTR': r.ctr || '0%',
      'START': r.waktuMulai,
      'END': r.waktuSelesai,
      'DURASI': r.durasi,
      'CO': r.checkout,
      'GMV': r.gmv
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Live Report");
    XLSX.writeFile(wb, `LiveReport_Visibel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'TANGGAL': '2026/02/06',
        'BRAND': 'HITJAB',
        'ROOM ID': 'ROOM_123',
        'HOST': 'NAMA HOST',
        'OP': 'NAMA OP',
        'VIEW': 0,
        'RATE': '0%',
        'CTR': '0%',
        'START': '00:00',
        'END': '00:00',
        'DURASI': 0,
        'CO': 0,
        'GMV': 0
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Laporan Live");
    XLSX.writeFile(wb, `Template_LiveReport_${company}.xlsx`);
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
        
        const MAX_INT = 2147483647; // Postgres standard Integer limit

        const newReports = jsonData.map((row: any) => {
          if (!row['BRAND'] || !row['ROOM ID'] || String(row['ROOM ID']).includes('CONTOH_')) return null;

          // Pembersih nilai numerik dari angka raksasa yang tidak masuk akal (seperti No KTP)
          const cleanInt = (v: any) => {
            if (typeof v === 'number') {
              // Jika nilai > 1 triliun, itu pasti salah kolom (seperti KTP)
              return v > 1000000000000 ? 0 : Math.min(Math.floor(v), MAX_INT);
            }
            const str = String(v || '0').replace(/[^0-9]/g, '');
            const parsed = parseInt(str, 10);
            return isNaN(parsed) ? 0 : (parsed > 1000000000000 ? 0 : Math.min(parsed, MAX_INT));
          };

          return {
            // Updated: parse using parseYMDToIso
            tanggal: parseYMDToIso(row['TANGGAL']),
            brand: String(row['BRAND'] || '').toUpperCase().trim(),
            company: String(row['COMPANY'] || company),
            roomId: String(row['ROOM ID'] || '').trim(),
            hostId: employees.find(e => String(e.nama).toLowerCase().trim() === String(row['HOST'] || '').toLowerCase().trim())?.id || '',
            opId: employees.find(e => String(e.nama).toLowerCase().trim() === String(row['OP'] || '').toLowerCase().trim())?.id || '',
            totalView: cleanInt(row['VIEW']),
            enterRoomRate: String(row['RATE'] || '0%'),
            ctr: String(row['CTR'] || '0%'),
            waktuMulai: String(row['START'] || '00:00'),
            waktuSelesai: String(row['END'] || '00:00'),
            durasi: parseFloat(String(row['DURASI'] || 0).replace(',', '.')) || 0,
            checkout: cleanInt(row['CO']),
            gmv: cleanInt(row['GMV'])
          };
        }).filter(r => r !== null && r.brand && r.roomId);

        if (newReports.length > 0) {
          const { data: inserted, error } = await supabase.from('live_reports').insert(newReports).select();
          if (error) throw error;
          
          setReports(prev => [...(inserted || []), ...prev]);
          alert(`Sukses! ${inserted?.length || 0} data laporan berhasil diimpor.`);
        } else {
          alert("Tidak ada data valid yang ditemukan dalam file.");
        }
      } catch (err: any) { 
        console.error(err);
        alert("Gagal import: " + (err.message || "Pastikan format file benar.")); 
      } finally { 
        setIsImporting(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col bg-transparent space-y-6">
      <div className="flex flex-col gap-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Icons.Search className="w-4 h-4" />
          </div>
          <input 
            type="text" 
            placeholder="Cari Host, OP, atau Room..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full shadow-sm"
          />
        </div>
        
        <div className="bg-slate-50 p-1.5 rounded-[28px] border border-slate-100 flex flex-col sm:flex-row gap-3 shadow-inner">
          <select 
            value={selectedBrand} 
            onChange={(e) => setSelectedBrand(e.target.value)} 
            className="bg-white border border-slate-200 px-6 py-3.5 rounded-[22px] text-[10px] font-black text-slate-900 outline-none shadow-sm appearance-none text-center uppercase tracking-widest sm:flex-grow"
          >
            <option value="ALL">SEMUA BRAND</option>
            {LIVE_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          
          <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-[22px] shadow-sm border border-slate-100 shrink-0">
            <div className="flex flex-col items-start min-w-[100px]">
              <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Mulai</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="bg-transparent text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
              />
            </div>
            <div className="h-8 w-px bg-slate-100"></div>
            <div className="flex flex-col items-start min-w-[100px]">
              <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sampai</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="bg-transparent text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button 
            onClick={handleDownloadTemplate} 
            className="bg-slate-50 border border-slate-200 text-slate-400 px-3 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
          >
            <Icons.Download className="w-3 h-3" /> TEMPLATE
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting} 
            className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-3 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
          >
            {isImporting ? '...' : <><Icons.Upload className="w-3 h-3" /> IMPORT</>}
          </button>
          <button 
            onClick={handleExport} 
            className="bg-white border border-slate-200 text-slate-600 px-3 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Icons.Download className="w-3 h-3" /> EXPORT
          </button>
          {canManage && (
            <button 
              onClick={() => handleOpenModal()} 
              className="col-span-3 bg-slate-900 text-[#FFC000] px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Icons.Plus className="w-3 h-3" /> TAMBAH REPORT
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total View</p>
          <p className="text-xl font-black text-slate-900">{filteredReports.reduce((sum, r) => sum + (r.totalView || 0), 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Enter Rate</p>
          <p className="text-xl font-black text-indigo-600">
            {(filteredReports.length > 0 ? (filteredReports.reduce((sum, r) => sum + parseFloat(r.enterRoomRate || '0'), 0) / filteredReports.length).toFixed(2) : 0)}%
          </p>
        </div>
        <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Checkout</p>
          <p className="text-xl font-black text-emerald-600">{filteredReports.reduce((sum, r) => sum + (r.checkout || 0), 0).toLocaleString()}</p>
        </div>
        <div className="bg-[#0f172a] p-5 rounded-[28px] border border-white/5 shadow-xl flex flex-col justify-center">
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total GMV</p>
          <p className="text-base font-black text-[#FFC000] truncate">{formatCurrency(filteredReports.reduce((sum, r) => sum + (r.gmv || 0), 0))}</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-5 w-12 text-center">No</th>
                <th className="px-6 py-5">Sesi & Live</th>
                <th className="px-6 py-5">Host & OP</th>
                <th className="px-6 py-5 text-center">Performance</th>
                <th className="px-6 py-5 text-center">Sales</th>
                {canManage && <th className="px-6 py-5 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReports.map((report, idx) => {
                const host = employees.find(e => e.id === report.hostId);
                const op = employees.find(e => e.id === report.opId);
                return (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 text-[10px] font-bold text-slate-300 text-center">{idx + 1}</td>
                    <td className="px-6 py-5">
                       <p className="text-[10px] font-black text-slate-900 uppercase">
                         {new Date(report.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                       </p>
                       <p className="text-[8px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter">{report.brand} • {report.roomId}</p>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[120px]">{host?.nama || '-'}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">OP: {op?.nama || '-'}</p>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <p className="text-xs font-black text-slate-900">{(report.totalView || 0).toLocaleString()}</p>
                       <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">ER: {report.enterRoomRate}</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <p className="text-[11px] font-black text-emerald-600">{report.checkout || 0} CO</p>
                       <p className="text-[9px] font-black text-slate-900 mt-0.5">{formatCurrency(report.gmv || 0)}</p>
                    </td>
                    {canManage && (
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(report)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Icons.Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(report.id!)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Icons.Trash className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tidak ada laporan ditemukan</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-3 z-[200]">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <h2 className="text-xl font-black uppercase tracking-tight">{editingReport ? 'Edit Laporan' : 'Tambah Laporan'}</h2>
                <p className="text-black/60 text-[9px] font-bold uppercase tracking-widest">Visibel Streaming Center</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-3xl leading-none opacity-40 hover:opacity-100 transition-opacity font-black">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 overflow-y-auto space-y-6 custom-scrollbar flex-grow bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand</label>
                  <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none">
                    {LIVE_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                  <input required type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Room ID</label>
                <input required type="text" value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})} placeholder="ID Sesi / Room..." className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Host Live</label>
                  <select required value={formData.hostId} onChange={e => setFormData({...formData, hostId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none">
                    <option value="">Pilih Host...</option>
                    {hostList.map(h => <option key={h.id} value={h.id}>{h.nama.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Operator</label>
                  <select required value={formData.opId} onChange={e => setFormData({...formData, opId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none">
                    <option value="">Pilih OP...</option>
                    {opList.map(o => <option key={o.id} value={o.id}>{o.nama.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Views</label>
                  <input type="number" value={formData.totalView} onChange={e => setFormData({...formData, totalView: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-2xl text-[11px] font-black text-slate-900 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate %</label>
                  <input type="text" value={formData.enterRoomRate} onChange={e => setFormData({...formData, enterRoomRate: e.target.value})} placeholder="5.2%" className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-2xl text-[11px] font-black text-slate-900 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CTR %</label>
                  <input type="text" value={formData.ctr} onChange={e => setFormData({...formData, ctr: e.target.value})} placeholder="2.1%" className="w-full bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-2xl text-[11px] font-black text-slate-900 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CO</label>
                  <input type="number" value={formData.checkout} onChange={e => setFormData({...formData, checkout: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-black text-slate-900 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">GMV</label>
                  <input type="number" value={formData.gmv} onChange={e => setFormData({...formData, gmv: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-black text-[#FFC000] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mulai</label>
                  <input type="time" value={formData.waktuMulai} onChange={e => setFormData({...formData, waktuMulai: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-2 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Selesai</label>
                  <input type="time" value={formData.waktuSelesai} onChange={e => setFormData({...formData, waktuSelesai: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-2 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Durasi</label>
                  <input type="number" step="0.01" value={formData.durasi} disabled className="w-full bg-slate-100 border border-slate-200 px-2 py-3.5 rounded-2xl text-[11px] font-black text-slate-400 outline-none" />
                </div>
              </div>

              <div className="pt-6">
                <button type="submit" className="w-full bg-slate-900 hover:bg-black text-[#FFC000] py-5 rounded-[28px] font-black text-sm uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all">SIMPAN DATA</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveReportModule;
