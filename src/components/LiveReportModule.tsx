import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { Employee, LiveReport } from '../types';
import { Icons, LIVE_BRANDS } from '../constants';
import { supabase } from '../services/supabaseClient';

interface LiveReportModuleProps {
  employees: Employee[];
  reports: LiveReport[];
  setReports: React.Dispatch<React.SetStateAction<LiveReport[]>>;
  userRole: string;
  currentEmployee?: Employee | null;
  company: string;
  onClose: () => void;
  brands: any[];
  isPublicView?: boolean;
  forcedBrand?: string;
  selectedBrand?: string;
  setSelectedBrand?: (brand: string) => void;
}

const formatDateToYMD = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  return dateStr.replace(/-/g, '/');
};

const parseYMDToIso = (val: any) => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  
  const str = String(val).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  
  // Try YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
      } else if (parts[2].length === 4) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `${y}-${m}-${d}`;
      }
    }
  }
  
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return str; // Already YYYY-MM-DD
      if (parts[2].length === 4) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `${y}-${m}-${d}`;
      }
    }
  }
  
  if (!isNaN(Number(str)) && Number(str) > 30000) {
    const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  // Fallback to Date.parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return str;
};

const getThirtyDaysAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

const LiveReportModule: React.FC<LiveReportModuleProps> = ({ employees, reports, setReports, userRole, currentEmployee, company, onClose, brands, isPublicView = false, forcedBrand, selectedBrand: propSelectedBrand, setSelectedBrand: propSetSelectedBrand }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<LiveReport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [internalSelectedBrand, setInternalSelectedBrand] = useState(forcedBrand || 'ALL');
  const selectedBrand = propSelectedBrand || internalSelectedBrand;
  const setSelectedBrand = propSetSelectedBrand || setInternalSelectedBrand;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(getThirtyDaysAgoStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [formData, setFormData] = useState<Omit<LiveReport, 'id'>>({
    tanggal: new Date().toISOString().split('T')[0],
    brand: brands.length > 0 ? brands[0].name : '',
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
    gmv: 0,
    bestSeller: '',
    qty: 0,
    gmvPerProduct: 0
  });

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
    
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 1440;
    const result = parseFloat((diff / 60).toFixed(2));
    return isNaN(result) ? 0 : result;
  };

  useEffect(() => {
    const newDurasi = calculateDuration(formData.waktuMulai, formData.waktuSelesai);
    if (newDurasi !== formData.durasi) {
      setFormData(prev => ({ ...prev, durasi: newDurasi }));
    }
  }, [formData.waktuMulai, formData.waktuSelesai]);

  const canManage = useMemo(() => {
    const isHighRole = userRole === 'super' || userRole === 'admin' || userRole === 'owner';
    const isOperator = (currentEmployee?.jabatan || '').toLowerCase().includes('operator');
    return isHighRole || isOperator;
  }, [userRole, currentEmployee]);

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

  // Paginated Data
  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredReports.slice(start, start + rowsPerPage);
  }, [filteredReports, currentPage]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedReports.length && paginatedReports.length > 0) {
      setSelectedIds(new Set());
    } else {
      const currentIds = paginatedReports.map(r => r.id!).filter(Boolean);
      setSelectedIds(new Set(currentIds));
    }
  };

  const handleOpenModal = (report?: LiveReport) => {
    if (report) {
      setEditingReport(report);
      setFormData({ ...report, ctr: report.ctr || '0%' });
    } else {
      setEditingReport(null);
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        brand: selectedBrand !== 'ALL' ? selectedBrand : (brands.length > 0 ? brands[0].name : ''),
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
        gmv: 0,
        bestSeller: '',
        qty: 0,
        gmvPerProduct: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = editingReport 
        ? { ...formData, id: editingReport.id } 
        : { ...formData, id: uuidv4() };
      const { data, error } = await supabase.from('live_reports').upsert(payload).select();
      
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
      const nextSelected = new Set(selectedIds);
      nextSelected.delete(id);
      setSelectedIds(nextSelected);
    } catch (err: any) { alert("Gagal menghapus: " + err.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} laporan terpilih secara permanen?`)) return;
    
    try {
      const idsToDelete = Array.from(selectedIds);
      const { error } = await supabase.from('live_reports').delete().in('id', idsToDelete);
      if (error) throw error;
      
      setReports(prev => prev.filter(r => !selectedIds.has(r.id!)));
      setSelectedIds(new Set());
      alert(`Berhasil menghapus ${idsToDelete.length} laporan.`);
    } catch (err: any) {
      alert("Gagal menghapus massal: " + err.message);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const handleExport = () => {
    let dataToExport = filteredReports.map((r) => ({
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
      'GMV': r.gmv,
      'BEST SELLER': r.bestSeller || '',
      'QTY': r.qty || 0,
      'GMV PER PRODUCT': r.gmvPerProduct || 0
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Live Report");
    XLSX.writeFile(workbook, `LiveReport_Majova_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        'GMV': 0,
        'BEST SELLER': '',
        'QTY': 0,
        'GMV PER PRODUCT': 0
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Template Laporan Live");
    XLSX.writeFile(workbook, `Template_LiveReport_${company}.xlsx`);
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
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
        
        const MAX_VAL = Number.MAX_SAFE_INTEGER; 

        const missingHosts = new Set<string>();
        const missingOps = new Set<string>();

        const rawParsedReports = jsonData.map((row: any, index: number) => {
          try {
            const getVal = (keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined) return row[k];
                const lowerK = k.toLowerCase();
                if (row[lowerK] !== undefined) return row[lowerK];
                const upperK = k.toUpperCase();
                if (row[upperK] !== undefined) return row[upperK];
              }
              return undefined;
            };

            const brandVal = getVal(['BRAND', 'Brand', 'brand']);
            const roomIdVal = getVal(['ROOM ID', 'Room ID', 'RoomId', 'roomId']);
            
            if (!brandVal || !roomIdVal || String(roomIdVal).includes('CONTOH_')) return null;

          const cleanInt = (v: any) => {
            if (typeof v === 'number') return Math.floor(v);
            if (!v) return 0;
            // Remove currency symbols, spaces, and dots (thousands separators in ID)
            let str = String(v).replace(/Rp|[\s]/g, '');
            
            if (str.includes('.') && str.includes(',')) {
              str = str.replace(/\./g, '').replace(',', '.');
            } else if (str.includes(',')) {
              const parts = str.split(',');
              if (parts.length === 2 && parts[1].length <= 2) {
                str = str.replace(',', '.');
              } else {
                str = str.replace(/,/g, '');
              }
            } else if (str.includes('.')) {
               const parts = str.split('.');
               if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                 str = str.replace(/\./g, '');
               }
            }
            const parsed = Math.floor(parseFloat(str) || 0);
            return isNaN(parsed) ? 0 : Math.min(parsed, MAX_VAL);
          };

            const hostName = String(getVal(['HOST', 'Host', 'host']) || '').trim();
            const opName = String(getVal(['OP', 'Op', 'op', 'Admin', 'ADMIN']) || '').trim();
            
            const host = employees.find(e => String(e.nama).toLowerCase().trim() === hostName.toLowerCase());
            const op = employees.find(e => String(e.nama).toLowerCase().trim() === opName.toLowerCase());

            if (hostName && !host) missingHosts.add(hostName);
            if (opName && !op) missingOps.add(opName);

            const tgl = parseYMDToIso(getVal(['TANGGAL', 'DATE', 'Tanggal', 'Date']) || '');

            return {
              tanggal: tgl,
              brand: String(brandVal).toUpperCase().trim(),
              company: String(getVal(['COMPANY', 'Company', 'company']) || company || 'Majova.id'),
              roomId: String(roomIdVal).trim(),
              hostId: host?.id || '',
              opId: op?.id || '',
              totalView: cleanInt(getVal(['VIEW', 'TOTAL VIEW', 'Total View', 'TotalView'])),
              enterRoomRate: String(getVal(['RATE', 'ENTER ROOM RATE', 'Enter Room Rate', 'EnterRoomRate']) || '0%'),
              ctr: String(getVal(['CTR', 'ctr', 'Ctr']) || '0%'),
              waktuMulai: String(getVal(['START', 'WAKTU MULAI', 'Mulai', 'Start']) || '00:00'),
              waktuSelesai: String(getVal(['END', 'WAKTU SELESAI', 'Selesai', 'End']) || '00:00'),
              durasi: cleanInt(getVal(['DURASI', 'Durasi', 'Duration'])),
              checkout: cleanInt(getVal(['CO', 'CHECKOUT', 'Checkout'])),
              gmv: cleanInt(getVal(['GMV', 'gmv', 'Gmv'])),
              bestSeller: String(getVal(['BEST SELLER', 'Best Seller', 'bestSeller']) || '').trim(),
              qty: cleanInt(getVal(['QTY', 'Qty', 'qty'])),
              gmvPerProduct: cleanInt(getVal(['GMV PER PRODUCT', 'GMV Per Product', 'gmvPerProduct']))
            };
          } catch (e) {
            console.error(`Error parsing row ${index + 1}:`, e, row);
            return null;
          }
        }).filter(r => r !== null) as Omit<LiveReport, 'id'>[];

        if (missingHosts.size > 0 || missingOps.size > 0) {
          const msg = [
            missingHosts.size > 0 ? `Host tidak ditemukan: ${Array.from(missingHosts).join(', ')}` : '',
            missingOps.size > 0 ? `OP tidak ditemukan: ${Array.from(missingOps).join(', ')}` : ''
          ].filter(Boolean).join('\n');
          alert(`Gagal import!\n${msg}\n\nPastikan nama Host/OP sesuai dengan data karyawan.`);
          setIsImporting(false);
          return;
        }

        if (rawParsedReports.length > 0) {
          const fileDeduperMap = new Map<string, Omit<LiveReport, 'id'>>();
          rawParsedReports.forEach(report => {
            const existingInFile = fileDeduperMap.get(report.roomId);
            if (!existingInFile || report.gmv > existingInFile.gmv) {
              fileDeduperMap.set(report.roomId, report);
            }
          });

          const finalToUpsert: Partial<LiveReport>[] = [];
          
          // Fetch existing records from DB for the roomIds being imported to avoid duplicates
          const roomIdsInFile = Array.from(fileDeduperMap.keys());
          const { data: existingRecords } = await supabase
            .from('live_reports')
            .select('id, roomId')
            .in('roomId', roomIdsInFile);

          const existingInDbMap = new Map<string, string>(
            (existingRecords || []).map(r => [r.roomId, r.id])
          );

          fileDeduperMap.forEach((newReport, roomId) => {
            const existingId = existingInDbMap.get(roomId);
            if (existingId) {
              finalToUpsert.push({ ...newReport, id: existingId });
            } else {
              finalToUpsert.push({ ...newReport, id: uuidv4() });
            }
          });

          const { data: inserted, error } = await supabase.from('live_reports').upsert(finalToUpsert).select();
          if (error) throw error;
          
          setReports(prev => {
            const updated = [...prev];
            inserted?.forEach(item => {
              const idx = updated.findIndex(r => r.roomId === item.roomId);
              if (idx !== -1) updated[idx] = item;
              else updated.push(item);
            });
            return updated.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
          });
          
          alert(`Sukses! ${inserted?.length || 0} data berhasil diproses.`);
        }
      } catch (err: any) { 
        alert("Gagal import: " + err.message); 
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
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full shadow-sm"
          />
        </div>
        
        <div className="bg-slate-50 p-1.5 rounded-[28px] border border-slate-100 flex flex-col sm:flex-row gap-3 shadow-inner">
          {!isPublicView ? (
            <select 
              value={selectedBrand} 
              onChange={(e) => { setSelectedBrand(e.target.value); setCurrentPage(1); }} 
              className="bg-white border border-slate-200 px-6 py-3.5 rounded-[22px] text-[10px] font-black text-slate-900 outline-none shadow-sm appearance-none text-center uppercase tracking-widest sm:flex-grow"
            >
              <option value="ALL">SEMUA BRAND</option>
              {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          ) : (
            <div className="bg-slate-900 text-[#FFC000] px-6 py-3.5 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center sm:flex-grow">
              BRAND: {selectedBrand}
            </div>
          )}
          
          <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-[22px] shadow-sm border border-slate-100 shrink-0">
            <div className="flex flex-col items-start min-w-[100px]">
              <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Mulai</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
                className="bg-transparent text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
              />
            </div>
            <div className="h-8 w-px bg-slate-100"></div>
            <div className="flex flex-col items-start min-w-[100px]">
              <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Sampai</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
                className="bg-transparent text-[10px] font-black outline-none text-slate-900 cursor-pointer" 
              />
            </div>
          </div>
        </div>

        {!isPublicView && (
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
              <div className="col-span-3 flex gap-3">
                <button 
                  onClick={() => handleOpenModal()} 
                  className="flex-grow bg-slate-900 text-[#FFC000] px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Icons.Plus className="w-3 h-3" /> TAMBAH REPORT
                </button>
                {selectedIds.size > 0 && (
                  <button 
                    onClick={handleBulkDelete} 
                    className="bg-rose-500 text-white px-6 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all animate-in slide-in-from-right-2"
                  >
                    <Icons.Trash className="w-4 h-4" /> HAPUS ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Share Button for Admin */}
        {!isPublicView && canManage && selectedBrand !== 'ALL' && (
          <div className="flex justify-end">
            <button 
              onClick={() => {
                const origin = window.location.origin;
                // Support both query param and the new requested path format
                const pathUrl = `${origin}/livestreaming/report/${selectedBrand.toLowerCase()}`;
                navigator.clipboard.writeText(pathUrl);
                alert("Link report " + selectedBrand + " berhasil disalin ke clipboard:\n" + pathUrl);
              }}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Icons.Share2 className="w-4 h-4" /> SHARE REPORT {selectedBrand}
            </button>
          </div>
        )}
      </div>

      {/* Stats Section - Adjusted for Mobile Comfort */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total View</p>
          <p className="text-sm sm:text-xl font-black text-slate-900">{filteredReports.reduce((sum, r) => sum + (r.totalView || 0), 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Enter Rate</p>
          <p className="text-sm sm:text-xl font-black text-indigo-600">
            {filteredReports.length > 0 ? (() => {
              const rates = filteredReports.map(r => parseFloat(String(r.enterRoomRate || '0').replace('%', '')));
              const validRates = rates.filter(n => !isNaN(n));
              return validRates.length > 0 ? (validRates.reduce((a, b) => a + b, 0) / validRates.length).toFixed(1) : '0';
            })() : '0'}%
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Checkout</p>
          <p className="text-sm sm:text-xl font-black text-emerald-600">{filteredReports.reduce((sum, r) => sum + (r.checkout || 0), 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-center">
          <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Durasi</p>
          <p className="text-sm sm:text-xl font-black text-slate-900">{filteredReports.reduce((sum, r) => sum + (r.durasi || 0), 0).toFixed(1)} Jam</p>
        </div>
        <div className="bg-[#0f172a] p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-white/5 shadow-xl flex flex-col justify-center col-span-2 lg:col-span-1">
          <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total GMV</p>
          <p className="text-sm sm:text-base font-black text-[#FFC000]">{formatCurrency(filteredReports.reduce((sum, r) => sum + (r.gmv || 0), 0))}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                {!isPublicView && (
                  <th className="px-4 py-5 w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === paginatedReports.length && paginatedReports.length > 0} 
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-5 w-12 text-center">No</th>
                <th className="px-6 py-5">Sesi & Live</th>
                <th className="px-6 py-5">Host & OP</th>
                <th className="px-6 py-5 text-center">Performance</th>
                <th className="px-6 py-5 text-center">Sales</th>
                <th className="px-6 py-5">Best Seller</th>
                <th className="px-6 py-5 text-center">Qty</th>
                <th className="px-6 py-5 text-center font-black">GMV/Product</th>
                <th className="px-6 py-5 text-center">Durasi</th>
                {canManage && !isPublicView && <th className="px-6 py-5 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedReports.map((report, idx) => {
                const host = employees.find(e => e.id === report.hostId);
                const op = employees.find(e => e.id === report.opId);
                const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                const isEven = idx % 2 === 1;
                return (
                  <tr key={report.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.has(report.id!) ? 'bg-indigo-50/30' : (isEven ? 'bg-slate-50/80' : 'bg-white')}`}>
                    {!isPublicView && (
                      <td className="px-4 py-5 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(report.id!)} 
                          onChange={() => toggleSelect(report.id!)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-5 text-[10px] font-bold text-slate-300 text-center">{globalIdx}</td>
                    <td className="px-6 py-5">
                       <p className="text-[10px] font-black text-slate-900 uppercase">
                         {new Date(report.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                       </p>
                       <p className="text-[8px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter">{report.brand} • {report.roomId}</p>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] font-black text-slate-700 uppercase">{host?.nama || '-'}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">OP: {op?.nama || '-'}</p>
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
                    <td className="px-6 py-5">
                       <p className="text-[10px] font-black text-slate-900 uppercase">{report.bestSeller || '-'}</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <p className="text-[10px] font-black text-slate-900">{(report.qty || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <p className="text-[10px] font-black text-slate-900">{formatCurrency(report.gmvPerProduct || 0)}</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <p className="text-xs font-black text-slate-900">{(report.durasi || 0).toFixed(1)} Jam</p>
                    </td>
                    {canManage && !isPublicView && (
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
              {paginatedReports.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-8 py-20 text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tidak ada laporan ditemukan</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {paginatedReports.map((report, idx) => {
            const host = employees.find(e => e.id === report.hostId);
            const op = employees.find(e => e.id === report.opId);
            const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
            return (
              <div key={report.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
                {/* Header: Sesi & Live */}
                <div className="flex justify-between items-start border-b border-slate-50 pb-4">
                  <div className="flex gap-4 items-center">
                    <span className="w-8 h-8 rounded-full bg-slate-900 text-[#FFC000] flex items-center justify-center text-[10px] font-black shrink-0">{globalIdx}</span>
                    <div>
                      <p className="text-[10px] font-black text-[#6366f1] uppercase tracking-[0.2em] mb-0.5">
                        {new Date(report.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
                      </p>
                      <h3 className="text-sm font-black text-slate-900 uppercase">{report.brand}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">ROOM: {report.roomId}</p>
                    </div>
                  </div>
                  {canManage && !isPublicView && (
                    <div className="flex gap-2">
                       <button onClick={() => handleOpenModal(report)} className="p-2 text-indigo-600 bg-indigo-50 rounded-xl transition-all active:scale-95"><Icons.Edit className="w-4 h-4" /></button>
                       <button onClick={() => handleDelete(report.id!)} className="p-2 text-rose-600 bg-rose-50 rounded-xl transition-all active:scale-95"><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {/* Body Details */}
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  {/* Host & OP */}
                  <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl">
                    <div className="space-y-1">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">HOST LIVE</p>
                      <p className="text-[10px] font-black text-slate-700 uppercase">{host?.nama || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">OPERATOR OP</p>
                      <p className="text-[10px] font-black text-slate-700 uppercase">{op?.nama || '-'}</p>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="space-y-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">Performance</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">VIEW</p>
                        <p className="text-[10px] font-black text-slate-900">{(report.totalView || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <p className="text-[6px] font-black text-indigo-500 uppercase tracking-tighter mb-0.5">CTR</p>
                        <p className="text-[10px] font-black text-indigo-600">{report.ctr || '0%'}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100 col-span-2">
                         <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">ENTER RATE</p>
                         <p className="text-[10px] font-black text-slate-900">{report.enterRoomRate}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sales Metrics */}
                  <div className="space-y-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">Sales</p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                        <p className="text-[6px] font-black text-emerald-600 uppercase tracking-tighter mb-0.5">GMV TOTAL</p>
                        <p className="text-[10px] font-black text-[#0f172a]">{formatCurrency(report.gmv || 0)}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center">
                        <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">CHECKOUT</p>
                        <p className="text-[10px] font-black text-emerald-600">{report.checkout || 0} CO</p>
                      </div>
                    </div>
                  </div>

                  {/* Product Details (Best Seller, Qty, GMV/Product) */}
                  <div className="col-span-2 space-y-3 border-t border-slate-50 pt-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Produk Terlaris</p>
                    <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                       <div className="flex justify-between items-start gap-4">
                          <p className="text-[10px] font-black text-slate-900 uppercase leading-tight line-clamp-2">{report.bestSeller || '-'}</p>
                          <div className="bg-white px-2 py-1 rounded-lg border border-slate-100 shrink-0">
                             <p className="text-[8px] font-black text-slate-900">{report.qty || 0} PCS</p>
                          </div>
                       </div>
                       <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">GMV PER PRODUK</p>
                          <p className="text-[10px] font-black text-emerald-600 font-mono">{formatCurrency(report.gmvPerProduct || 0)}</p>
                       </div>
                    </div>
                  </div>

                  {/* Durasi */}
                  <div className="col-span-2 flex justify-between items-center bg-slate-900 px-6 py-4 rounded-2xl shadow-lg">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">DURASI LIVE</p>
                    <div className="flex items-center gap-2">
                       <Icons.Database className="w-3 h-3 text-[#FFC000]" />
                       <p className="text-xs font-black text-white">{(report.durasi || 0).toFixed(1)} <span className="text-[#FFC000]">JAM</span></p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {paginatedReports.length === 0 && (
            <div className="bg-white p-12 rounded-[32px] border border-slate-100 shadow-sm text-center">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tidak ada laporan ditemukan</p>
            </div>
          )}
        </div>
      </div>
        {totalPages > 1 && (
          <div className="px-6 py-5 flex items-center justify-between border-t border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
              <span className="text-xs font-black text-slate-900 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">{currentPage} / {totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => { setCurrentPage(prev => prev - 1); setSelectedIds(new Set()); }}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
              >
                <Icons.ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => { setCurrentPage(prev => prev + 1); setSelectedIds(new Set()); }}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
              >
                <Icons.ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
            </div>
          </div>
        )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-3 z-[200]">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <h2 className="text-xl font-black uppercase tracking-tight">{editingReport ? 'Edit Laporan' : 'Tambah Laporan'}</h2>
                <p className="text-black/60 text-[9px] font-bold uppercase tracking-widest">Majova.id Streaming Center</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-3xl leading-none opacity-40 hover:opacity-100 transition-opacity font-black">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 overflow-y-auto space-y-6 custom-scrollbar flex-grow bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand</label>
                  <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none">
                    {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
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

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Produk Terlaris (Best Seller)</label>
                <input type="text" value={formData.bestSeller} onChange={e => setFormData({...formData, bestSeller: e.target.value})} placeholder="Nama produk terlaris..." className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-bold text-slate-900 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty Terjual</label>
                  <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-black text-slate-900 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">GMV Per Produk</label>
                  <input type="number" value={formData.gmvPerProduct} onChange={e => setFormData({...formData, gmvPerProduct: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-black text-slate-900 outline-none" />
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
                  <input type="number" step="0.01" value={formData.durasi || 0} disabled className="w-full bg-slate-100 border border-slate-200 px-2 py-3.5 rounded-2xl text-[11px] font-black text-slate-400 outline-none" />
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