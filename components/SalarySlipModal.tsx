
import React, { useState, useRef, useMemo } from 'react';
import { Employee, SalaryData, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { parseFlexibleDate } from '../utils/dateUtils';
import { supabase } from '../App';

interface SalarySlipModalProps {
  employee: Employee;
  attendanceRecords: AttendanceRecord[];
  onClose: () => void;
  onUpdate?: () => void;
  weeklyHolidays?: Record<string, string[]>;
}

const ALPHA_START_DATE = '2026-02-02';

const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ employee, attendanceRecords, onClose, onUpdate, weeklyHolidays }) => {
  const getPreviousMonthInfo = () => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    return {
      name: lastMonthDate.toLocaleString('id-ID', { month: 'long' }),
      year: lastMonthDate.getFullYear().toString()
    };
  };

  const prevMonth = getPreviousMonthInfo();

  const [data, setData] = useState<SalaryData & { adjustment: number }>({
    month: prevMonth.name,
    year: prevMonth.year,
    gapok: employee.salaryConfig?.gapok ?? 5000000,
    tunjanganMakan: employee.salaryConfig?.tunjanganMakan ?? 500000,
    tunjanganTransport: employee.salaryConfig?.tunjanganTransport ?? 300000,
    tunjanganKomunikasi: employee.salaryConfig?.tunjanganKomunikasi ?? 200000,
    tunjanganKesehatan: employee.salaryConfig?.tunjanganKesehatan ?? 0,
    tunjanganJabatan: employee.salaryConfig?.tunjanganJabatan ?? 0,
    bpjstk: employee.salaryConfig?.bpjstk ?? 150000,
    lembur: employee.salaryConfig?.lembur ?? 0,
    bonus: employee.salaryConfig?.bonus ?? 0,
    thr: employee.salaryConfig?.thr ?? 0,
    potonganHutang: 0,
    potonganLain: 0,
    adjustment: 0
  });

  const [isPreview, setIsPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const previewSlipRef = useRef<HTMLDivElement>(null);
  const hiddenSlipRef = useRef<HTMLDivElement>(null);

  const monthMap: Record<string, number> = {
    'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
    'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
  };

  const isWorkDay = (date: Date, emp: Employee) => {
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

  const tenureInfo = useMemo(() => {
    const joinDate = parseFlexibleDate(employee.tanggalMasuk);
    if (isNaN(joinDate.getTime())) return { years: 0, months: 0, totalMonths: 0 };
    
    const now = new Date();
    let years = now.getFullYear() - joinDate.getFullYear();
    let months = now.getMonth() - joinDate.getMonth();
    
    if (months < 0 || (months === 0 && now.getDate() < joinDate.getDate())) {
      years--;
      months += 12;
    }
    
    const totalMonths = (years * 12) + months;
    return { years, months, totalMonths };
  }, [employee.tanggalMasuk]);

  // Perhitungan Kehadiran dan Lembur Otomatis
  const attendanceResults = useMemo(() => {
    const targetMonthIdx = monthMap[data.month] ?? 0;
    const targetYear = parseInt(data.year);
    const rangeStart = new Date(targetYear, targetMonthIdx - 1, 29);
    const rangeEnd = new Date(targetYear, targetMonthIdx, 28);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    const cutoffRecords = attendanceRecords.filter(r => {
      if (r.employeeId !== employee.id) return false;
      const recDate = new Date(r.date);
      return recDate >= rangeStart && recDate <= rangeEnd;
    });

    const summary = { alpha: 0, hadir: 0, sakit: 0, izin: 0, libur: 0, cuti: 0, totalOvertimePay: 0, overtimeHours: 0 };
    const todayStr = new Date().toISOString().split('T')[0];

    let temp = new Date(rangeStart);
    while (temp <= rangeEnd) {
      const dStr = temp.toISOString().split('T')[0];
      const dayRecords = cutoffRecords.filter(r => r.date === dStr);
      
      const mainRecord = dayRecords.find(r => r.status !== 'Lembur');
      const overtimeRecords = dayRecords.filter(r => r.status === 'Lembur');

      if (mainRecord) {
        if (mainRecord.status === 'Hadir') summary.hadir++;
        else if (mainRecord.status === 'Sakit') summary.sakit++;
        else if (mainRecord.status === 'Izin') summary.izin++;
        else if (mainRecord.status === 'Cuti') summary.cuti++;
        else if (mainRecord.status === 'Alpha') summary.alpha++;
        else summary.libur++;
      } else {
        if (dStr < todayStr && dStr >= ALPHA_START_DATE && isWorkDay(temp, employee)) {
          summary.alpha++;
        } else {
          summary.libur++;
        }
      }

      // Hitung Lembur: Rp 20.000 / jam
      overtimeRecords.forEach(ov => {
        if (ov.clockIn && ov.clockOut) {
          const startArr = ov.clockIn.split(':').map(Number);
          const endArr = ov.clockOut.split(':').map(Number);
          const startMinutes = startArr[0] * 60 + startArr[1];
          const endMinutes = endArr[0] * 60 + endArr[1];
          
          let diffMinutes = endMinutes - startMinutes;
          if (diffMinutes < 0) diffMinutes += 1440; // Menangani lembur lewat tengah malam
          
          const hours = diffMinutes / 60;
          summary.overtimeHours += hours;
          summary.totalOvertimePay += Math.round(hours * 20000);
        }
      });

      temp.setDate(temp.getDate() + 1);
    }

    return summary;
  }, [attendanceRecords, data.month, data.year, employee, weeklyHolidays]);

  const totalTunjanganOps = (data.tunjanganMakan || 0) + (data.tunjanganTransport || 0) + (data.tunjanganKomunikasi || 0) + (data.tunjanganKesehatan || 0) + (data.tunjanganJabatan || 0);

  const potonganAbsensi = useMemo(() => {
    const totalGajiTetap = (data.gapok || 0) + totalTunjanganOps;
    const dailyRate = totalGajiTetap / 26;
    return Math.round((attendanceResults.alpha || 0) * dailyRate);
  }, [data.gapok, totalTunjanganOps, attendanceResults.alpha]);

  const calculateTHRValue = () => {
    const { totalMonths } = tenureInfo;
    const baseForTHR = (data.gapok || 0) + totalTunjanganOps;
    let thrValue = totalMonths >= 12 ? baseForTHR : (totalMonths >= 3 ? Math.round((totalMonths / 12) * baseForTHR) : 0);
    setData(prev => ({ ...prev, thr: thrValue }));
  };

  const finalLemburValue = (data.lembur || 0) + attendanceResults.totalOvertimePay;
  const totalPendapatan = (data.gapok || 0) + totalTunjanganOps + finalLemburValue + (data.bonus || 0) + (data.thr || 0);
  const totalPotongan = (data.bpjstk || 0) + potonganAbsensi + (data.potonganHutang || 0) + (data.potonganLain || 0);
  const takeHomePay = totalPendapatan - totalPotongan + (data.adjustment || 0);
  const sisaHutang = Math.max(0, (employee.hutang || 0) - (data.potonganHutang || 0));

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const configToSave = {
        gapok: data.gapok,
        tunjanganMakan: data.tunjanganMakan,
        tunjanganTransport: data.tunjanganTransport,
        tunjanganKomunikasi: data.tunjanganKomunikasi,
        tunjanganKesehatan: data.tunjanganKesehatan,
        tunjanganJabatan: data.tunjanganJabatan,
        bpjstk: data.bpjstk,
        lembur: data.lembur,
        bonus: data.bonus,
        thr: data.thr
      };
      const { error } = await supabase.from('employees').update({ salaryConfig: configToSave }).eq('id', employee.id);
      if (error) throw error;
      alert("Konfigurasi gaji berhasil disimpan!");
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImage = async (silent = false) => {
    const target = isPreview ? previewSlipRef.current : hiddenSlipRef.current;
    if (!target) return;
    if (!silent) setIsProcessing(true);
    try {
      const worker = (window as any).html2pdf().from(target).set({ 
        html2canvas: { scale: 3, useCORS: true, scrollY: 0, scrollX: 0 } 
      });
      const canvas = await worker.toCanvas().get('canvas');
      const link = document.createElement('a');
      link.download = `Slip_Gaji_${employee.nama}_${data.month}_${data.year}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      if (!silent) alert("Gagal mengunduh gambar.");
    } finally {
      if (!silent) setIsProcessing(false);
    }
  };

  const handleSendEmail = async () => {
    await handleDownloadImage(true);
    const subject = `Slip Gaji ${employee.nama} - ${data.month} ${data.year}`;
    const body = `Halo ${employee.nama},\n\nTerlampir slip gaji Anda untuk periode ${data.month} ${data.year}.\n\nTotal Gaji Bersih: Rp ${takeHomePay.toLocaleString('id-ID')}\n\nSalam,\nHR Visibel ID`;
    window.location.href = `mailto:${employee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const SalarySlipContent = () => (
    <div className="bg-white" style={{ width: '794px', height: '1122px', position: 'relative', overflow: 'hidden', color: '#0f172a', boxSizing: 'border-box' }}>
      <div style={{ padding: '60px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '2px solid #000', paddingBottom: '30px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA" alt="Logo" style={{ width: '220px', height: 'auto' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '42px', fontWeight: '800', margin: '0' }}>SLIP GAJI</h2>
            <p style={{ fontSize: '18px', fontWeight: '900', color: '#806000', margin: '5px 0' }}>{(data.month || '').toUpperCase()} {data.year}</p>
            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '10px 0 0 0' }}>Cutoff: 29 - 28</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFBEB', border: '2px solid #FFC000', borderRadius: '35px', padding: '40px 50px', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '40px', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Nama Karyawan</p>
            <p style={{ fontSize: '24px', fontWeight: '800', margin: '5px 0 15px 0' }}>{employee.nama}</p>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>ID Karyawan</p>
            <p style={{ fontSize: '18px', fontWeight: '900', color: '#806000', margin: '5px 0 0 0' }}>{employee.idKaryawan}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Jabatan</p>
            <p style={{ fontSize: '24px', fontWeight: '800', margin: '5px 0 15px 0' }}>{employee.jabatan}</p>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>No. Rekening</p>
            <p style={{ fontSize: '18px', fontWeight: '700', color: '#334155', margin: '5px 0 0 0' }}>{employee.noRekening} ({employee.bank})</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginBottom: '40px', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>Penerimaan (+)</h3>
            <div style={{ fontSize: '14px', lineHeight: '2.4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gaji Pokok</span><span style={{ fontWeight: '800' }}>Rp {(data.gapok || 0).toLocaleString('id-ID')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tunjangan Ops.</span><span style={{ fontWeight: '800' }}>Rp {(totalTunjanganOps || 0).toLocaleString('id-ID')}</span></div>
              {finalLemburValue > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Lembur ({attendanceResults.overtimeHours.toFixed(1)} jam)</span><span style={{ fontWeight: '800' }}>Rp {finalLemburValue.toLocaleString('id-ID')}</span></div>}
              {data.bonus > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bonus</span><span style={{ fontWeight: '800' }}>Rp {data.bonus.toLocaleString('id-ID')}</span></div>}
              {(data.thr || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#806000', fontWeight: '800' }}>THR</span><span style={{ color: '#806000', fontWeight: '900' }}>Rp {(data.thr || 0).toLocaleString('id-ID')}</span></div>}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px' }}><span>Total Bruto</span><span>Rp {(totalPendapatan || 0).toLocaleString('id-ID')}</span></div>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>Potongan (-)</h3>
            <div style={{ fontSize: '14px', lineHeight: '2.4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>BPJS TK</span><span style={{ fontWeight: '800' }}>Rp {(data.bpjstk || 0).toLocaleString('id-ID')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Absensi ({attendanceResults.alpha || 0} Alpha)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(potonganAbsensi || 0).toLocaleString('id-ID')}</span></div>
              {(data.potonganHutang || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cicilan Hutang</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.potonganHutang || 0).toLocaleString('id-ID')}</span></div>}
              {(data.potonganLain || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Potongan Lain</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.potonganLain || 0).toLocaleString('id-ID')}</span></div>}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px' }}><span>Total Potongan</span><span style={{ color: '#ef4444' }}>Rp {(totalPotongan || 0).toLocaleString('id-ID')}</span></div>
            </div>
          </div>
        </div>

        {(employee.hutang || 0) > 0 && (
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '20px', padding: '25px', marginBottom: '40px', border: '1px solid #e2e8f0', flexShrink: 0 }}>
            <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', marginBottom: '15px', letterSpacing: '1px' }}>Informasi Hutang Karyawan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div><p style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Saldo Awal</p><p style={{ fontSize: '14px', fontWeight: '800', margin: '5px 0 0 0' }}>Rp {(employee.hutang || 0).toLocaleString('id-ID')}</p></div>
              <div><p style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Potongan Bulan Ini</p><p style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444', margin: '5px 0 0 0' }}>- Rp {(data.potonganHutang || 0).toLocaleString('id-ID')}</p></div>
              <div><p style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Sisa Hutang</p><p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: '5px 0 0 0' }}>Rp {(sisaHutang || 0).toLocaleString('id-ID')}</p></div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '40px', padding: '40px', textAlign: 'center', border: '4px solid rgba(255, 192, 0, 0.3)', flexShrink: 0, marginTop: 'auto' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '6px', color: '#94a3b8', display: 'block', marginBottom: '15px' }}>Total Gaji Bersih</span>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#FFC000' }}>IDR</span>
            <span style={{ fontSize: '54px', fontWeight: '900' }}>Rp {(takeHomePay || 0).toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
          <p style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '3px' }}>- DOKUMEN ELEKTRONIK SAH -</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm flex items-center justify-center p-4 z-[50]">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-8 border-b bg-[#111827] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Kalkulasi Payroll</h2>
            <p className="text-slate-400 text-[10px] mt-1 uppercase font-bold tracking-widest">{employee.nama} • {data.month} {data.year}</p>
          </div>
          <button onClick={onClose} className="text-4xl leading-none opacity-40 hover:opacity-100 transition-opacity">&times;</button>
        </div>
        
        <div className="p-8 overflow-y-auto space-y-6 bg-white flex-grow custom-scrollbar">
          <div style={{ position: 'fixed', top: 0, left: 0, width: '794px', height: '1122px', zIndex: -100, visibility: 'hidden', pointerEvents: 'none' }}>
            <div ref={hiddenSlipRef}><SalarySlipContent /></div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gaji Pokok</label>
              <input type="text" value={(data.gapok || 0).toLocaleString('id-ID')} onChange={e => setData({...data, gapok: parseInt(e.target.value.replace(/\./g, '')) || 0})} className="w-full bg-[#f8fafc] border-2 border-slate-100 rounded-2xl p-4 text-xl font-black text-black outline-none shadow-sm focus:border-[#FFC000] transition-all" />
            </div>

            <div className="bg-[#FFFBEB] p-6 rounded-3xl border-2 border-[#FFE066] space-y-4">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-[#806000] uppercase tracking-widest">Tambahan Gaji</p>
                  <span className="text-[9px] font-bold text-[#A68000]">Approved Lembur: {attendanceResults.overtimeHours.toFixed(1)} Jam (Rp {attendanceResults.totalOvertimePay.toLocaleString('id-ID')})</span>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-[#806000] uppercase tracking-widest">Lembur Manual (Rp)</label>
                    <input type="text" value={(data.lembur || 0).toLocaleString('id-ID')} onChange={e => setData({...data, lembur: parseInt(e.target.value.replace(/\./g, '')) || 0})} className="w-full bg-white border border-[#FFD700] rounded-xl p-3 text-sm font-bold text-black focus:border-[#FFC000] outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-[#806000] uppercase tracking-widest">THR (Rp)</label>
                    <input type="text" value={(data.thr || 0).toLocaleString('id-ID')} onChange={e => setData({...data, thr: parseInt(e.target.value.replace(/\./g, '')) || 0})} className="w-full bg-white border border-[#FFD700] rounded-xl p-3 text-sm font-bold text-black focus:border-[#FFC000] outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-[#806000] uppercase tracking-widest">Bonus (Rp)</label>
                    <input type="text" value={(data.bonus || 0).toLocaleString('id-ID')} onChange={e => setData({...data, bonus: parseInt(e.target.value.replace(/\./g, '')) || 0})} className="w-full bg-white border border-[#FFD700] rounded-xl p-3 text-sm font-bold text-black focus:border-[#FFC000] outline-none" />
                  </div>
               </div>
               <button onClick={calculateTHRValue} className="w-full bg-[#FFC000] text-black text-[9px] font-black py-2 rounded-xl border border-[#cc9a00]">AUTO HITUNG THR</button>
            </div>
            
            <div className="bg-slate-50/50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Absensi & BPJS</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                  <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest">HARI ALPHA ({attendanceResults.alpha})</label>
                  <p className="text-xl font-black text-rose-700">Rp {potonganAbsensi.toLocaleString('id-ID')}</p>
                </div>
                <div className="space-y-1.5 p-4 rounded-2xl border border-amber-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Potongan BPJSTK</label>
                  <input type="text" value={(data.bpjstk || 0).toLocaleString('id-ID')} onChange={e => setData({...data, bpjstk: parseInt(e.target.value.replace(/\./g, '')) || 0})} className="w-full bg-white border-2 border-amber-100 rounded-xl p-3 text-base font-black text-black shadow-sm focus:border-amber-400 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Potongan Pinjaman & Lain-lain</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Potongan Hutang (Saldo: Rp {(employee.hutang || 0).toLocaleString('id-ID')})</label>
                  <input type="text" value={(data.potonganHutang || 0).toLocaleString('id-ID')} onChange={e => setData({...data, potonganHutang: Math.min(employee.hutang || 0, parseInt(e.target.value.replace(/\./g, '')) || 0)})} className="w-full bg-white border-2 border-red-100 rounded-xl p-3 text-sm font-black text-black focus:border-red-400 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Potongan Lain</label>
                  <input type="text" value={(data.potonganLain || 0).toLocaleString('id-ID')} onChange={e => setData({...data, potonganLain: parseInt(e.target.value.replace(/\./g, '')) || 0})} className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 text-sm font-black text-black focus:border-[#FFC000] outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex justify-between items-center border-l-[12px] border-[#FFC000]">
              <div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Take Home Pay</p><p className="text-4xl font-black text-[#FFC000]">Rp {(takeHomePay || 0).toLocaleString('id-ID')}</p></div>
              <div className="text-right"><p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Total Bruto</p><p className="text-sm font-bold">Rp {(totalPendapatan || 0).toLocaleString('id-ID')}</p></div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-white border-t-2 flex flex-col gap-4 shrink-0">
          <button disabled={isSaving} onClick={handleSaveConfig} className="w-full bg-slate-900 text-[#FFC000] py-4 rounded-2xl font-black transition-all shadow-lg text-sm tracking-widest uppercase flex items-center justify-center gap-3 disabled:opacity-50">
            {isSaving ? 'Menyimpan...' : <><Icons.Database /> SIMPAN PERUBAHAN</>}
          </button>
          <button onClick={() => setIsPreview(true)} className="w-full bg-[#FFC000] text-black py-4 rounded-2xl font-black hover:bg-[#E6AD00] transition-all shadow-md text-sm tracking-widest uppercase">LIHAT PRATINJAU SLIP</button>
          <div className="flex gap-4">
            <button onClick={() => window.open(`https://wa.me/${employee.noHandphone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${employee.nama}, Slip Gaji ${data.month} Anda sudah terbit. Total diterima: Rp ${takeHomePay.toLocaleString('id-ID')}`)}`)} className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">WA</button>
            <button onClick={handleSendEmail} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">Email</button>
          </div>
        </div>
      </div>
      {isPreview && (
        <div className="fixed inset-0 bg-slate-100 z-[60] p-10 overflow-y-auto">
          <div className="max-w-[800px] mx-auto shadow-2xl bg-white mb-32"><div ref={previewSlipRef}><SalarySlipContent /></div></div>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-white/90 backdrop-blur-xl px-8 py-5 rounded-full shadow-2xl border border-white/50 z-[70]">
            <button onClick={() => setIsPreview(false)} className="px-6 py-2 rounded-full text-[10px] font-black text-slate-500 uppercase">Kembali</button>
            <button onClick={() => handleDownloadImage()} className="bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase">Simpan PNG</button>
            <button onClick={handleSendEmail} className="bg-blue-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase">Kirim via Email</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipModal;
