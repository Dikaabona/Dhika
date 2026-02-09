
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Employee, SalaryData, AttendanceRecord } from '../types';
import { Icons } from '../constants';
import { parseFlexibleDate, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { supabase } from '../App';

interface SalarySlipModalProps {
  employee: Employee;
  attendanceRecords: AttendanceRecord[];
  userRole: string;
  onClose: () => void;
  onUpdate?: () => void;
  weeklyHolidays?: Record<string, string[]>;
}

const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";

const ALPHA_START_DATE = '2026-02-02';

const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ employee, attendanceRecords, userRole, onClose, onUpdate, weeklyHolidays }) => {
  const isReadOnlyRole = userRole === 'admin' || userRole === 'employee';

  const getPreviousMonthInfo = () => {
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    return {
      name: lastMonthDate.toLocaleString('id-ID', { month: 'long' }),
      year: lastMonthDate.getFullYear().toString()
    };
  };

  const prevMonth = getPreviousMonthInfo();

  const [isBPJSTKActive, setIsBPJSTKActive] = useState(true);
  const [data, setData] = useState<SalaryData & { adjustment: number; pph21: number }>({
    month: prevMonth.name,
    year: prevMonth.year,
    gapok: employee.salaryConfig?.gapok ?? 5000000,
    tunjanganMakan: employee.salaryConfig?.tunjanganMakan ?? 500000,
    tunjanganTransport: employee.salaryConfig?.tunjanganTransport ?? 300000,
    tunjanganKomunikasi: employee.salaryConfig?.tunjanganKomunikasi ?? 200000,
    tunjanganKesehatan: employee.salaryConfig?.tunjanganKesehatan ?? 0,
    tunjanganJabatan: employee.salaryConfig?.tunjanganJabatan ?? 0,
    bpjstk: employee.salaryConfig?.bpjstk ?? 0,
    pph21: employee.salaryConfig?.pph21 ?? 0,
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
    const day = date.getDay();
    const isHost = (emp.jabatan || '').toUpperCase().includes('HOST LIVE STREAMING');
    if (day === 0) return isHost;
    if (day === 6) return false;
    const dayNameMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const currentDayName = dayNameMap[day];
    if (weeklyHolidays) {
      const empNameUpper = emp.nama.toUpperCase();
      const employeeInHolidays = Object.values(weeklyHolidays).some(names => (names as string[]).map(n => n.toUpperCase()).includes(empNameUpper));
      if (employeeInHolidays) {
        return !(weeklyHolidays[currentDayName] || []).map(n => n.toUpperCase()).includes(empNameUpper);
      }
    }
    return true;
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

  const attendanceResults = useMemo(() => {
    const targetMonthIdx = monthMap[data.month] ?? 0;
    const targetYear = parseInt(data.year);
    const rangeStart = new Date(targetYear, targetMonthIdx - 1, 29);
    const rangeEnd = new Date(targetYear, targetMonthIdx, 28);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    const rangeStartStr = formatDateToYYYYMMDD(rangeStart);
    const rangeEndStr = formatDateToYYYYMMDD(rangeEnd);

    const cutoffRecords = attendanceRecords.filter(r => {
      if (r.employeeId !== employee.id) return false;
      return r.date >= rangeStartStr && r.date <= rangeEndStr;
    });

    const summary = { alpha: 0, hadir: 0, sakit: 0, izin: 0, libur: 0, cuti: 0, totalOvertimePay: 0, overtimeHours: 0 };
    const todayStr = formatDateToYYYYMMDD(new Date());
    let temp = new Date(rangeStart);
    while (temp <= rangeEnd) {
      const dStr = formatDateToYYYYMMDD(temp);
      const dayRecords = cutoffRecords.filter(r => r.date === dStr);
      const isWork = isWorkDay(temp, employee);
      const mainRecord = dayRecords.find(r => r.status !== 'Lembur');
      const overtimeRecords = dayRecords.filter(r => r.status === 'Lembur');
      
      if (mainRecord) {
        if (mainRecord.status === 'Hadir') summary.hadir++;
        else if (mainRecord.status === 'Sakit') summary.sakit++;
        else if (mainRecord.status === 'Izin') summary.izin++;
        else if (mainRecord.status === 'Cuti') summary.cuti++;
        else if (mainRecord.status === 'Alpha') summary.alpha++;
        else summary.libur++;
      } else if (overtimeRecords.length > 0) {
        summary.hadir++;
      } else {
        if (dStr < todayStr && dStr >= ALPHA_START_DATE) {
          if (isWork) summary.alpha++;
          else summary.libur++;
        } else {
          if (!isWork) summary.libur++;
          else summary.hadir++;
        }
      }

      overtimeRecords.forEach(ov => {
        if (ov.clockIn && ov.clockOut) {
          const startArr = ov.clockIn.split(':').map(Number);
          const endArr = ov.clockOut.split(':').map(Number);
          const startMinutes = startArr[0] * 60 + startArr[1];
          const endMinutes = endArr[0] * 60 + endArr[1];
          let diffMinutes = endMinutes - startMinutes;
          if (diffMinutes < 0) diffMinutes += 1440; 
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

  const totalPendapatan = (data.gapok || 0) + totalTunjanganOps + (data.lembur || 0) + (data.bonus || 0) + (data.thr || 0);

  const autoBPJS = useMemo(() => Math.round(totalPendapatan * 0.02), [totalPendapatan]);
  const autoPajak = useMemo(() => {
    if (totalPendapatan <= 5400000) return 0;
    if (totalPendapatan <= 10000000) return Math.round(totalPendapatan * 0.0025);
    if (totalPendapatan <= 15000000) return Math.round(totalPendapatan * 0.0125);
    return Math.round(totalPendapatan * 0.05);
  }, [totalPendapatan]);

  useEffect(() => {
    if (isBPJSTKActive) {
      setData(prev => ({ ...prev, bpjstk: autoBPJS }));
    }
  }, [autoBPJS, isBPJSTKActive]);

  const calculateTHRValue = () => {
    if (isReadOnlyRole) return;
    const { totalMonths } = tenureInfo;
    const baseForTHR = (data.gapok || 0) + totalTunjanganOps;
    let thrValue = totalMonths >= 12 ? baseForTHR : (totalMonths >= 3 ? Math.round((totalMonths / 12) * baseForTHR) : 0);
    setData(prev => ({ ...prev, thr: thrValue }));
  };

  const currentBPJSTK = isBPJSTKActive ? (data.bpjstk || 0) : 0;
  const totalPotongan = currentBPJSTK + potonganAbsensi + (data.pph21 || 0) + (data.potonganHutang || 0) + (data.potonganLain || 0);
  const takeHomePay = totalPendapatan - totalPotongan + (data.adjustment || 0);
  const sisaHutang = Math.max(0, (employee.hutang || 0) - (data.potonganHutang || 0));

  const handleSaveConfig = async () => {
    if (isSaving || isReadOnlyRole) return;
    if (data.potonganHutang > 0) {
      const confirmUpdate = window.confirm(`Perhatian! Saldo hutang karyawan akan berkurang sebesar Rp ${data.potonganHutang.toLocaleString('id-ID')}. Saldo akhir akan menjadi Rp ${sisaHutang.toLocaleString('id-ID')}. Lanjutkan?`);
      if (!confirmUpdate) return;
    }
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
        pph21: data.pph21,
        lembur: data.lembur,
        bonus: data.bonus,
        thr: data.thr
      };
      const updates: any = { salaryConfig: configToSave };
      if (data.potonganHutang > 0) updates.hutang = sisaHutang;
      const { error } = await supabase.from('employees').update(updates).eq('id', employee.id);
      if (error) throw error;
      alert("Data Payroll & Saldo Hutang berhasil diperbarui!");
      if (onUpdate) onUpdate();
      onClose();
    } catch (err: any) {
      alert("Gagal menyimpan perubahan: " + err.message);
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

  const SalarySlipContent = () => {
    const slipLogo = (employee.company || '').toLowerCase() === 'seller space' ? SELLER_SPACE_LOGO : VISIBEL_LOGO;
    return (
      <div className="bg-white" style={{ width: '794px', height: '1122px', position: 'relative', overflow: 'hidden', color: '#0f172a', boxSizing: 'border-box' }}>
        <div style={{ padding: '20px 60px 30px 60px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img src={slipLogo} alt="Logo" style={{ height: '65px', width: 'auto' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '30px', fontWeight: '900', margin: '0', letterSpacing: '-1px' }}>SLIP GAJI</h2>
              <p style={{ fontSize: '14px', fontWeight: '800', color: '#806000', margin: '2px 0' }}>{(data.month || '').toUpperCase()} {data.year}</p>
              <p style={{ fontSize: '9px', color: '#94a3b8', margin: '2px 0 0 0' }}>Cutoff: 29 - 28</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFBEB', border: '1.2px solid #FFC000', borderRadius: '24px', padding: '20px 35px', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '20px', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Nama Karyawan</p>
              <p style={{ fontSize: '18px', fontWeight: '900', margin: '2px 0 8px 0' }}>{employee.nama}</p>
              <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>ID KARYAWAN</p>
              <p style={{ fontSize: '12px', fontWeight: '900', color: '#806000', margin: '2px 0 0 0' }}>{employee.idKaryawan}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>JABATAN</p>
              <p style={{ fontSize: '18px', fontWeight: '900', margin: '2px 0 8px 0' }}>{employee.jabatan}</p>
              <p style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>NO. REKENING</p>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#334155', margin: '2px 0 0 0' }}>{employee.noRekening} ({employee.bank})</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px', flexShrink: 0 }}>
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>Penerimaan (+)</h3>
              <div style={{ fontSize: '12px', lineHeight: '2.0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gaji Pokok</span><span style={{ fontWeight: '800' }}>Rp {(data.gapok || 0).toLocaleString('id-ID')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tunjangan Ops.</span><span style={{ fontWeight: '800' }}>Rp {(totalTunjanganOps || 0).toLocaleString('id-ID')}</span></div>
                {(data.lembur || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Lembur</span><span style={{ fontWeight: '800' }}>Rp {data.lembur.toLocaleString('id-ID')}</span></div>}
                {data.bonus > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bonus</span><span style={{ fontWeight: '800' }}>Rp {data.bonus.toLocaleString('id-ID')}</span></div>}
                {(data.thr || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#806000', fontWeight: '800' }}>THR</span><span style={{ color: '#806000', fontWeight: '900' }}>Rp {(data.thr || 0).toLocaleString('id-ID')}</span></div>}
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '13px' }}><span>Total Bruto</span><span>Rp {(totalPendapatan || 0).toLocaleString('id-ID')}</span></div>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>Potongan (-)</h3>
              <div style={{ fontSize: '12px', lineHeight: '2.0' }}>
                {isBPJSTKActive && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>BPJS TK (2%)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.bpjstk || 0).toLocaleString('id-ID')}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Absensi ({attendanceResults.alpha || 0} Alpha)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(potonganAbsensi || 0).toLocaleString('id-ID')}</span></div>
                {(data.pph21 || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PPh 21</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.pph21 || 0).toLocaleString('id-ID')}</span></div>}
                {(data.potonganHutang || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cicilan Hutang</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.potonganHutang || 0).toLocaleString('id-ID')}</span></div>}
                {(data.potonganLain || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Potongan Lain</span><span style={{ fontWeight: '800', color: '#ef4444' }}>Rp {(data.potonganLain || 0).toLocaleString('id-ID')}</span></div>}
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '13px' }}><span>Total Potongan</span><span style={{ color: '#ef4444' }}>Rp {(totalPotongan || 0).toLocaleString('id-ID')}</span></div>
              </div>
            </div>
          </div>

          {(employee.hutang || 0) > 0 && (
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '15px 25px', marginBottom: '20px', border: '1px solid #e2e8f0', flexShrink: 0 }}>
              <h3 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}>Informasi Hutang Karyawan</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><p style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Saldo Awal</p><p style={{ fontSize: '12px', fontWeight: '800', margin: '2px 0 0 0' }}>Rp {(employee.hutang || 0).toLocaleString('id-ID')}</p></div>
                <div><p style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Potongan</p><p style={{ fontSize: '12px', fontWeight: '800', color: '#ef4444', margin: '2px 0 0 0' }}>- Rp {(data.potonganHutang || 0).toLocaleString('id-ID')}</p></div>
                <div><p style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', margin: '0' }}>Sisa Hutang</p><p style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0' }}>Rp {(sisaHutang || 0).toLocaleString('id-ID')}</p></div>
              </div>
            </div>
          )}

          <div style={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '32px', padding: '25px', textAlign: 'center', border: '3px solid rgba(255, 192, 0, 0.2)', flexShrink: 0, marginTop: 'auto' }}>
            <span style={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '4px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Total Gaji Bersih</span>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '900', color: '#FFC000' }}>IDR</span>
              <span style={{ fontSize: '42px', fontWeight: '900' }}>Rp {(takeHomePay || 0).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <p style={{ fontSize: '8px', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>- DOKUMEN ELEKTRONIK SAH -</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[200]">
      <div className="bg-white rounded-[32px] sm:rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-300 border border-white/10">
        <div className="p-6 sm:p-8 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-none">Kalkulasi Payroll</h2>
            <p className="text-[#FFC000] text-[9px] sm:text-[10px] mt-2 uppercase font-black tracking-widest opacity-90">{employee.nama} • {data.month} {data.year}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all text-white/40 hover:text-white">
            <span className="text-3xl leading-none font-light">&times;</span>
          </button>
        </div>
        
        <div className="p-5 sm:p-8 overflow-y-auto space-y-6 sm:space-y-8 bg-white flex-grow custom-scrollbar">
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
            <div ref={hiddenSlipRef}><SalarySlipContent /></div>
          </div>
          
          <div className="space-y-6 sm:space-y-8">
            {/* GAJI POKOK */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Gaji Pokok</label>
              <div className="relative group">
                <input 
                  type="text" 
                  disabled={isReadOnlyRole} 
                  value={(data.gapok || 0).toLocaleString('id-ID')} 
                  onChange={e => setData({...data, gapok: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                  className="w-full bg-[#f8fafc] border-2 border-slate-100 rounded-[28px] p-5 sm:p-6 text-2xl sm:text-3xl font-black text-slate-900 outline-none shadow-inner focus:border-[#FFC000] focus:bg-white transition-all disabled:opacity-60" 
                />
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg pointer-events-none hidden sm:block">Rp</span>
              </div>
            </div>

            {/* TUNJANGAN */}
            <div className="bg-sky-50/40 p-6 sm:p-8 rounded-[40px] border-2 border-sky-100/50 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                  <Icons.Plus className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em]">Tunjangan Operasional & Jabatan</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Makan', key: 'tunjanganMakan' },
                  { label: 'Transport', key: 'tunjanganTransport' },
                  { label: 'Komunikasi', key: 'tunjanganKomunikasi' },
                  { label: 'Kesehatan', key: 'tunjanganKesehatan' },
                  { label: 'Jabatan', key: 'tunjanganJabatan' }
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2">{item.label}</label>
                    <input 
                      type="text" 
                      disabled={isReadOnlyRole} 
                      value={(data[item.key as keyof SalaryData] || 0).toLocaleString('id-ID')} 
                      onChange={e => setData({...data, [item.key]: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                      className="w-full bg-white border border-sky-200 rounded-2xl p-4 text-xs sm:text-sm font-black text-slate-800 focus:border-sky-400 outline-none shadow-sm disabled:opacity-60" 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* TAMBAHAN */}
            <div className="bg-[#FFFBEB] p-6 sm:p-8 rounded-[40px] border-2 border-[#FFE066]/50 space-y-6">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                      <Icons.Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black text-[#806000] uppercase tracking-[0.2em]">Tambahan Gaji</p>
                  </div>
                  <span className="text-[9px] font-bold text-[#A68000] bg-white/50 px-3 py-1 rounded-full border border-amber-200 self-start sm:self-auto uppercase">Lembur System: {attendanceResults.overtimeHours.toFixed(1)} Jam</span>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[9px] font-bold text-[#806000]/60 uppercase tracking-widest ml-1">Lembur Manual</label>
                      {!isReadOnlyRole && (
                        <button 
                          onClick={() => setData(prev => ({ ...prev, lembur: attendanceResults.totalOvertimePay }))}
                          className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-1 active:scale-95"
                          title="Sinkronkan dengan lembur sistem yang disetujui"
                        >
                          <Icons.Plus className="w-2.5 h-2.5" /> SYNC SYSTEM (Rp {attendanceResults.totalOvertimePay.toLocaleString('id-ID')})
                        </button>
                      )}
                    </div>
                    <input 
                      type="text" 
                      disabled={isReadOnlyRole} 
                      value={(data.lembur || 0).toLocaleString('id-ID')} 
                      onChange={e => setData({...data, lembur: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                      className="w-full bg-white border border-[#FFD700] rounded-2xl p-4 text-xs sm:text-sm font-black text-slate-800 focus:border-[#FFC000] outline-none shadow-sm disabled:opacity-60" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#806000]/60 uppercase tracking-widest ml-1">THR</label>
                      <input 
                        type="text" 
                        disabled={isReadOnlyRole} 
                        value={(data.thr || 0).toLocaleString('id-ID')} 
                        onChange={e => setData({...data, thr: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                        className="w-full bg-white border border-[#FFD700] rounded-2xl p-4 text-xs sm:text-sm font-black text-slate-800 focus:border-[#FFC000] outline-none shadow-sm disabled:opacity-60" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#806000]/60 uppercase tracking-widest ml-1">Bonus</label>
                      <input 
                        type="text" 
                        disabled={isReadOnlyRole} 
                        value={(data.bonus || 0).toLocaleString('id-ID')} 
                        onChange={e => setData({...data, bonus: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                        className="w-full bg-white border border-[#FFD700] rounded-2xl p-4 text-xs sm:text-sm font-black text-slate-800 focus:border-[#FFC000] outline-none shadow-sm disabled:opacity-60" 
                      />
                    </div>
                  </div>
               </div>
               {!isReadOnlyRole && (
                 <button 
                  onClick={calculateTHRValue} 
                  className="w-full bg-[#FFC000] hover:bg-black hover:text-[#FFC000] text-black text-[10px] font-black py-4 rounded-[22px] border border-[#cc9a00]/30 shadow-md active:scale-[0.98] transition-all uppercase tracking-widest"
                 >
                   AUTO HITUNG THR
                 </button>
               )}
            </div>

            {/* ABSENSI & BPJS */}
            <div className="bg-slate-50/50 p-6 sm:p-8 rounded-[40px] border-2 border-slate-100 space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Absensi & BPJS</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 bg-rose-50/50 p-6 rounded-[32px] border border-rose-100 relative overflow-hidden group">
                  <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest block relative z-10">HARI ALPHA ({attendanceResults.alpha})</label>
                  <p className="text-2xl sm:text-3xl font-black text-rose-700 relative z-10">Rp {potonganAbsensi.toLocaleString('id-ID')}</p>
                  <Icons.Trash className="absolute -right-4 -bottom-4 w-20 h-20 text-rose-100 opacity-50 transform -rotate-12 group-hover:scale-110 transition-transform" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        id="toggle-bpjstk" 
                        disabled={isReadOnlyRole} 
                        checked={isBPJSTKActive} 
                        onChange={(e) => setIsBPJSTKActive(e.target.checked)} 
                        className="w-6 h-6 rounded-lg border-slate-200 text-[#FFC000] focus:ring-[#FFC000] transition-all cursor-pointer" 
                      />
                    </div>
                    <label htmlFor="toggle-bpjstk" className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer">BPJSTK (2%)</label>
                  </div>
                  <div className={`transition-all duration-500 ${isBPJSTKActive ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-30 pointer-events-none'}`}>
                    <div className="flex items-center gap-2">
                       <input 
                        type="text" 
                        disabled={!isBPJSTKActive || isReadOnlyRole} 
                        value={(data.bpjstk || 0).toLocaleString('id-ID')} 
                        onChange={e => setData({...data, bpjstk: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                        className="flex-grow bg-white border-2 border-amber-100 rounded-2xl p-4 text-sm font-black text-slate-900 shadow-sm focus:border-amber-400 outline-none" 
                       />
                      {!isReadOnlyRole && (
                        <button 
                          onClick={() => setData({...data, bpjstk: autoBPJS})} 
                          className="bg-amber-500 text-white p-4 rounded-2xl hover:bg-amber-600 transition-colors shadow-lg active:scale-90"
                        >
                          <Icons.Sparkles className="w-5 h-5"/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Potongan PPh 21</label>
                    {!isReadOnlyRole && (
                      <button 
                        onClick={() => setData({...data, pph21: autoPajak})} 
                        className="text-[9px] font-black text-[#FFC000] bg-slate-900 px-6 py-2.5 rounded-xl active:scale-95 transition-all shadow-md uppercase tracking-widest"
                      >
                        HITUNG OTOMATIS
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    disabled={isReadOnlyRole} 
                    value={(data.pph21 || 0).toLocaleString('id-ID')} 
                    onChange={e => setData({...data, pph21: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                    className="w-full bg-white border-2 border-slate-100 rounded-[22px] p-4 text-sm font-black text-slate-900 shadow-sm focus:border-indigo-400 outline-none disabled:opacity-60" 
                    placeholder="Pajak Bulanan..." 
                  />
                </div>
              </div>
            </div>

            {/* PINJAMAN */}
            <div className="bg-slate-50/50 p-6 sm:p-8 rounded-[40px] border-2 border-slate-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                    <Icons.Database className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pinjaman & Lain-lain</p>
                </div>
                <span className="text-[9px] font-black text-slate-500 bg-white px-4 py-2 rounded-2xl border shadow-sm uppercase tracking-tighter self-start sm:self-auto">SISA: Rp {sisaHutang.toLocaleString('id-ID')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Potongan Hutang (Saldo: Rp {(employee.hutang || 0).toLocaleString('id-ID')})</label>
                  <input 
                    type="text" 
                    disabled={isReadOnlyRole} 
                    value={(data.potonganHutang || 0).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = parseInt(e.target.value.replace(/\./g, '')) || 0;
                      setData({...data, potonganHutang: Math.min(employee.hutang || 0, val)});
                    }} 
                    className="w-full bg-white border-2 border-rose-100 rounded-2xl p-4 text-sm font-black text-rose-600 focus:border-rose-400 outline-none shadow-sm disabled:opacity-60" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Potongan Lainnya</label>
                  <input 
                    type="text" 
                    disabled={isReadOnlyRole} 
                    value={(data.potonganLain || 0).toLocaleString('id-ID')} 
                    onChange={e => setData({...data, potonganLain: parseInt(e.target.value.replace(/\./g, '')) || 0})} 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-sm font-black text-slate-800 focus:border-[#FFC000] outline-none shadow-sm disabled:opacity-60" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY SECTION - STICKY FOR MOBILE */}
        <div className="bg-white border-t-2 border-slate-50 flex flex-col shrink-0">
          <div className="bg-[#0f172a] px-6 sm:px-10 py-5 sm:py-7 text-white flex justify-between items-center border-l-[12px] sm:border-l-[16px] border-[#FFC000] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] relative z-10">
            <div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-1.5 leading-none">Take Home Pay</p>
              <p className="text-2xl sm:text-4xl font-black text-[#FFC000] tracking-tighter">Rp {(takeHomePay || 0).toLocaleString('id-ID')}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase mb-1.5 leading-none">Total Bruto</p>
              <p className="text-xs sm:text-base font-black text-slate-300">Rp {(totalPendapatan || 0).toLocaleString('id-ID')}</p>
            </div>
          </div>
          
          <div className="p-5 sm:p-8 space-y-4 bg-slate-50/30">
            {!isReadOnlyRole && (
              <button 
                type="button" 
                disabled={isSaving} 
                onClick={handleSaveConfig} 
                className="w-full bg-[#0f172a] hover:bg-black text-[#FFC000] py-5 sm:py-6 rounded-[22px] font-black transition-all shadow-xl text-[10px] sm:text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-4 disabled:opacity-50 active:scale-[0.98]"
              >
                {isSaving ? 'MEMPROSES...' : <><Icons.Database className="w-5 h-5" /> SIMPAN & POTONG HUTANG</>}
              </button>
            )}
            
            <button 
              type="button" 
              onClick={() => setIsPreview(true)} 
              className="w-full bg-[#FFC000] hover:bg-amber-400 text-black py-5 sm:py-6 rounded-[22px] font-black transition-all shadow-lg text-[10px] sm:text-[11px] tracking-[0.2em] uppercase active:scale-[0.98]"
            >
              LIHAT PRATINJAU SLIP
            </button>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button" 
                onClick={() => window.open(`https://wa.me/${employee.noHandphone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${employee.nama},\n\nSlip Gaji ${data.month} Anda sudah terbit.\n\nTotal diterima: Rp ${takeHomePay.toLocaleString('id-ID')}\n\nSilakan cek detailnya di portal HR.\nTerima kasih.`)}`)} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white py-4.5 rounded-[20px] font-black text-[10px] sm:text-xs uppercase flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-md"
              >
                <Icons.Mail className="w-4 h-4" /> WA
              </button>
              <button 
                type="button" 
                onClick={handleSendEmail} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-4.5 rounded-[20px] font-black text-[10px] sm:text-xs uppercase flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-md"
              >
                <Icons.FileText className="w-4 h-4" /> EMAIL
              </button>
            </div>
          </div>
        </div>
      </div>

      {isPreview && (
        <div className="fixed inset-0 bg-slate-100 z-[210] p-3 sm:p-10 overflow-y-auto">
          <div className="max-w-[800px] mx-auto shadow-2xl bg-white mb-32 rounded-xl overflow-hidden scale-[0.9] sm:scale-100 origin-top">
            <div ref={previewSlipRef} className="p-0 sm:p-0"><SalarySlipContent /></div>
          </div>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-3 sm:gap-4 bg-white/95 backdrop-blur-xl px-6 sm:px-10 py-4 sm:py-5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/50 z-[220] flex-wrap justify-center items-center w-max">
            <button type="button" onClick={() => setIsPreview(false)} className="px-5 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors">Tutup</button>
            <div className="h-6 w-px bg-slate-200"></div>
            <button type="button" onClick={() => handleDownloadImage()} className="bg-slate-900 text-white px-6 sm:px-8 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">PNG</button>
            <button type="button" onClick={handleSendEmail} className="bg-indigo-600 text-white px-6 sm:px-8 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">Kirim</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipModal;
