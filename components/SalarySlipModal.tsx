import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Employee, SalaryData, AttendanceRecord, Broadcast } from '../types';
import { Icons } from '../constants';
import { parseFlexibleDate, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { supabase } from '../App';
import { flipService } from '../services/flipService';

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

const ALPHA_START_DATE = '2025-01-01';

const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ employee, attendanceRecords, userRole, onClose, onUpdate, weeklyHolidays }) => {
  const isReadOnlyRole = userRole === 'admin' || userRole === 'employee';
  const isSuperAdmin = userRole === 'owner' || userRole === 'super';

  const getActivePayrollMonthInfo = () => {
    const now = new Date();
    const day = now.getDate();
    const payrollDate = new Date(now.getFullYear(), day > 28 ? now.getMonth() + 1 : now.getMonth(), 1);
    
    return {
      name: payrollDate.toLocaleString('id-ID', { month: 'long' }),
      year: payrollDate.getFullYear().toString()
    };
  };

  const activePeriod = getActivePayrollMonthInfo();

  const [isBPJSTKActive, setIsBPJSTKActive] = useState(true);
  const [showOvertimeDetails, setShowOvertimeDetails] = useState(false);
  const [data, setData] = useState<SalaryData & { adjustment: number; pph21: number }>({
    month: activePeriod.name,
    year: activePeriod.year,
    gapok: employee.salaryConfig?.gapok ?? 0,
    tunjanganMakan: employee.salaryConfig?.tunjanganMakan ?? 0,
    tunjanganTransport: employee.salaryConfig?.tunjanganTransport ?? 0,
    tunjanganKomunikasi: employee.salaryConfig?.tunjanganKomunikasi ?? 0,
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
  const [isFlipLoading, setIsFlipLoading] = useState(false);
  
  const previewSlipRef = useRef<HTMLDivElement>(null);
  const hiddenSlipRef = useRef<HTMLDivElement>(null);

  const formatCurrencyValue = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const parseCurrencyInput = (val: string) => {
    return parseInt(val.replace(/\./g, '')) || 0;
  };

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

    const summary = { 
      alpha: 0, 
      hadir: 0, 
      sakit: 0, 
      izin: 0, 
      libur: 0, 
      cuti: 0, 
      totalOvertimePay: 0, 
      overtimeHours: 0,
      overtimeItems: [] as { date: string, hours: number, pay: number, notes: string }[] 
    };
    
    const jabLower = (employee.jabatan || '').toLowerCase();
    const divLower = (employee.division || '').toLowerCase();
    const nameLower = (employee.nama || '').toLowerCase();
    let hourlyRate = 10000;

    if (
      jabLower.includes('host') || 
      jabLower.includes('operator') || 
      jabLower.includes('business development') ||
      jabLower.includes('owner') ||
      jabLower.includes('admin') ||
      jabLower.includes('ceo') ||
      divLower.includes('host') || 
      divLower.includes('operator') || 
      nameLower.includes('mahardhika') ||
      nameLower.includes('fikry') ||
      nameLower.includes('dimas')
    ) {
      hourlyRate = 20000;
    }

    const todayStr = formatDateToYYYYMMDD(new Date());
    let temp = new Date(rangeStart);
    while (temp <= rangeEnd) {
      const dStr = formatDateToYYYYMMDD(temp);
      const dayRecords = cutoffRecords.filter(r => r.date === dStr);
      const isWork = isWorkDay(temp, employee);
      
      const mainRecord = dayRecords.find(r => (r.status || '').toLowerCase() !== 'lembur');
      const overtimeRecords = dayRecords.filter(r => 
        (r.status || '').toLowerCase() === 'lembur' || 
        (r.notes && (
          r.notes.toLowerCase().includes('lembur') || 
          r.notes.toUpperCase().includes('JAM:') || 
          r.notes.toUpperCase().includes('BRAND:')
        ))
      );
      
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
        let cIn = ov.clockIn;
        let cOut = ov.clockOut;

        if (!cIn || !cOut || cOut === '--:--' || cIn === '--:--') {
          const timeMatch = (ov.notes || '').match(/(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/);
          if (timeMatch) {
            cIn = timeMatch[1].replace('.', ':');
            cOut = timeMatch[2].replace('.', ':');
          }
        }

        if (cIn && cOut && cOut !== '--:--' && cIn !== '--:--') {
          const startArr = cIn.split(':').map(Number);
          const endArr = cOut.split(':').map(Number);
          if (startArr.length === 2 && endArr.length === 2) {
             const startMinutes = startArr[0] * 60 + startArr[1];
             const endMinutes = endArr[0] * 60 + endArr[1];
             let diffMinutes = endMinutes - startMinutes;
             if (diffMinutes < 0) diffMinutes += 1440; 
             const hours = diffMinutes / 60;
             const pay = Math.round(hours * hourlyRate);
             summary.overtimeHours += hours;
             summary.totalOvertimePay += pay;
             summary.overtimeItems.push({
               date: dStr,
               hours: hours,
               pay: pay,
               notes: ov.notes || 'Lembur'
             });
          }
        }
      });
      temp.setDate(temp.getDate() + 1);
    }
    return summary;
  }, [attendanceRecords, data.month, data.year, employee, weeklyHolidays]);

  useEffect(() => {
    if (!isReadOnlyRole && attendanceResults.totalOvertimePay > 0) {
      setData(prev => ({ ...prev, lembur: attendanceResults.totalOvertimePay }));
    } else if (!isReadOnlyRole && attendanceResults.totalOvertimePay === 0) {
      setData(prev => ({ ...prev, lembur: 0 }));
    }
  }, [attendanceResults.totalOvertimePay, isReadOnlyRole]);

  const totalTunjanganOps = (data.tunjanganMakan || 0) + (data.tunjanganTransport || 0) + (data.tunjanganKomunikasi || 0) + (data.tunjanganKesehatan || 0) + (data.tunjanganJabatan || 0);
  
  const potonganAbsensi = useMemo(() => {
    const dailyRate = (data.gapok || 0) / 26;
    return Math.round((attendanceResults.alpha || 0) * dailyRate);
  }, [data.gapok, attendanceResults.alpha]);

  const totalPendapatan = (data.gapok || 0) + totalTunjanganOps + (data.lembur || 0) + (data.bonus || 0) + (data.thr || 0);

  const autoBPJS = useMemo(() => Math.round(totalPendapatan * 0.02), [totalPendapatan]);

  useEffect(() => {
    if (isBPJSTKActive) {
      setData(prev => ({ ...prev, bpjstk: autoBPJS }));
    }
  }, [autoBPJS, isBPJSTKActive]);

  const currentBPJSTK = isBPJSTKActive ? (data.bpjstk || 0) : 0;
  const totalPotongan = currentBPJSTK + potonganAbsensi + (data.pph21 || 0) + (data.potonganHutang || 0) + (data.potonganLain || 0);
  const takeHomePay = totalPendapatan - totalPotongan + (data.adjustment || 0);
  const sisaHutang = Math.max(0, (employee.hutang || 0) - (data.potonganHutang || 0));

  const handlePayViaFlip = async () => {
    if (!isSuperAdmin) return;
    if (takeHomePay <= 0) return alert("Jumlah pembayaran tidak valid.");
    if (!confirm(`Kirim gaji Rp ${takeHomePay.toLocaleString('id-ID')} ke ${employee.nama} (${employee.bank} - ${employee.noRekening}) via Flip?`)) return;

    setIsFlipLoading(true);
    try {
      const response = await flipService.disburse({
        amount: takeHomePay,
        bank_code: employee.bank.toLowerCase(),
        account_number: employee.noRekening,
        remark: `Gaji ${data.month} ${data.year} - ${employee.nama}`
      });

      if (response && response.status === 'PENDING') {
        alert("Instruksi pembayaran berhasil dikirim ke Flip! Cek status di Financial Hub.");
      } else {
        throw new Error("Respon tidak dikenal dari Flip.");
      }
    } catch (e: any) {
      alert("Gagal memproses pembayaran: " + e.message);
    } finally {
      setIsFlipLoading(false);
    }
  };

  const handleAutoCalculateTHR = () => {
    const totalFixed = (data.gapok || 0) + totalTunjanganOps;
    const { totalMonths } = tenureInfo;
    let thr = 0;
    if (totalMonths >= 12) {
      thr = totalFixed;
    } else if (totalMonths >= 1) {
      thr = Math.round((totalMonths / 12) * totalFixed);
    }
    setData(prev => ({ ...prev, thr }));
  };

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

  const generatePDFBlob = async () => {
    const target = isPreview ? previewSlipRef.current : hiddenSlipRef.current;
    if (!target) return null;
    
    const fileName = `Slip_Gaji_${employee.nama.replace(/\s/g, '_')}_${data.month}_${data.year}.pdf`;
    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    return await (window as any).html2pdf().from(target).set(opt).output('blob');
  };

  const handleSendEmail = async () => {
    setIsProcessing(true);
    try {
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) return;
      const fileName = `Slip_Gaji_${employee.nama.replace(/\s/g, '_')}_${data.month}_${data.year}.pdf`;
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], fileName, { type: 'application/pdf' })] })) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        await navigator.share({
          files: [file],
          title: `Slip Gaji ${employee.nama}`,
          text: `Halo ${employee.nama}, berikut slip gaji periode ${data.month} ${data.year}.`
        });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = fileName;
        link.click();

        const subject = `Slip Gaji ${employee.nama} - ${data.month} ${data.year}`;
        const body = `Halo ${employee.nama},\n\nSlip gaji Anda untuk periode ${data.month} ${data.year} telah berhasil di-generate sebagai PDF (terunduh otomatis).\n\nSilakan lampirkan file tersebut pada email ini.\n\nTotal Gaji Bersih: Rp ${takeHomePay.toLocaleString('id-ID')}\n\nSalam,\nHR Visibel ID`;
        window.location.href = `mailto:${employee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        alert("Slip Gaji PDF berhasil di-generate and diunduh. Silakan lampirkan secara manual ke draf email yang terbuka.");
      }
    } catch (err: any) {
      alert("Gagal memproses pengiriman: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendWhatsApp = async () => {
    setIsProcessing(true);
    try {
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) return;
      const fileName = `Slip_Gaji_${employee.nama.replace(/\s/g, '_')}_${data.month}_${data.year}.pdf`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], fileName, { type: 'application/pdf' })] })) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        await navigator.share({
          files: [file],
          title: `Slip Gaji ${employee.nama}`,
          text: `Halo ${employee.nama}, berikut slip gaji Anda untuk periode ${data.month} ${data.year}.`
        });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = fileName;
        link.click();

        const message = `Halo ${employee.nama}, berikut slip gaji Anda periode ${data.month} ${data.year} (terunduh sebagai PDF). Total Gaji: Rp ${takeHomePay.toLocaleString('id-ID')}`;
        window.open(`https://wa.me/${employee.noHandphone}?text=${encodeURIComponent(message)}`, '_blank');
        
        alert("Slip Gaji PDF berhasil di-generate and diunduh. Silakan kirim file tersebut melalui WhatsApp Web.");
      }
    } catch (err: any) {
      alert("Gagal memproses pengiriman WA: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToInbox = async () => {
    const target = isPreview ? previewSlipRef.current : hiddenSlipRef.current;
    if (!target) return;
    
    setIsProcessing(true);
    try {
      const worker = (window as any).html2pdf().from(target).set({ 
        html2canvas: { scale: 3, useCORS: true, scrollY: 0, scrollX: 0 } 
      });
      const canvas = await worker.toCanvas().get('canvas');
      const pngBase64 = canvas.toDataURL('image/png');

      const newBroadcast: Broadcast = {
        title: `SLIP GAJI ${data.month.toUpperCase()} ${data.year}`,
        message: `Halo ${employee.nama}, berikut slip gaji Anda untuk periode ${data.month} ${data.year} dalam format gambar (PNG). Anda dapat mendownload gambar ini langsung dari Inbox sebagai arsip pribadi.`,
        company: employee.company || 'Visibel',
        targetEmployeeIds: [employee.id],
        sentAt: new Date().toISOString(),
        imageBase64: pngBase64
      };

      const { error } = await supabase.from('broadcasts').insert([newBroadcast]);
      if (error) throw error;

      alert("Slip gaji berhasil dikirim ke Inbox karyawan!");
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert("Gagal mengirim ke Inbox: " + err.message);
    } finally {
      setIsProcessing(false);
    }
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tunjangan Ops..</span><span style={{ fontWeight: '800' }}>Rp {(totalTunjanganOps || 0).toLocaleString('id-ID')}</span></div>
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
      <div className="bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-300 border border-white/10">
        <div className="p-4 sm:p-6 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase leading-none text-white">KALKULASI PAYROLL</h2>
            <p className="text-[#FFC000] text-[8px] sm:text-[9px] mt-1.5 uppercase font-black tracking-widest opacity-90">{employee.nama} • {data.month} {data.year}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all text-white/40 hover:text-white">
            <span className="text-2xl leading-none font-light">&times;</span>
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 bg-white flex-grow custom-scrollbar">
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
            <div ref={hiddenSlipRef}><SalarySlipContent /></div>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bulan Periode</label>
                <select value={data.month} onChange={e => setData({...data, month: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-black text-black outline-none appearance-none shadow-inner">
                  {Object.keys(monthMap).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tahun</label>
                <select value={data.year} onChange={e => setData({...data, year: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-black text-black outline-none appearance-none shadow-inner">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Gaji Pokok</label>
              <div className="relative group p-0.5 border border-dashed border-rose-200 rounded-[24px]">
                <input 
                  type="text" 
                  disabled={isReadOnlyRole} 
                  value={formatCurrencyValue(data.gapok)} 
                  onChange={e => setData({...data, gapok: parseCurrencyInput(e.target.value)})} 
                  className="w-full bg-[#f8fafc] border border-slate-100 rounded-[22px] py-4 pl-12 sm:py-5 sm:pl-20 text-xl sm:text-2xl font-black text-slate-900 outline-none shadow-inner focus:border-[#FFC000] focus:bg-white transition-all disabled:opacity-60" 
                />
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm pointer-events-none block">Rp</span>
              </div>
            </div>

            <div className="bg-sky-50/40 p-4 sm:p-6 rounded-[32px] border border-sky-100 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-sky-100 rounded-lg flex items-center justify-center text-sky-600">
                  <Icons.Plus className="w-3 h-3" />
                </div>
                <p className="text-[9px] font-black text-sky-600 uppercase tracking-[0.2em]">Tunjangan Ops & Jabatan</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Makan', key: 'tunjanganMakan' },
                  { label: 'Transport', key: 'tunjanganTransport' },
                  { label: 'Komunikasi', key: 'tunjanganKomunikasi' },
                  { label: 'Kesehatan', key: 'tunjanganKesehatan' },
                  { label: 'Jabatan', key: 'tunjanganJabatan' }
                ].map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1.5">{item.label}</label>
                    <input 
                      type="text" 
                      disabled={isReadOnlyRole} 
                      value={formatCurrencyValue(data[item.key as keyof SalaryData] as number)} 
                      onChange={e => setData({...data, [item.key]: parseCurrencyInput(e.target.value)})} 
                      className="w-full bg-white border border-sky-200 rounded-xl pl-3 pr-3 py-3 text-[11px] font-black text-slate-800 focus:border-sky-400 outline-none shadow-sm disabled:opacity-60" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#FFFBEB] p-4 sm:p-6 rounded-[36px] border border-amber-200 space-y-4">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                      <Icons.Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-[#806000] uppercase tracking-tight">TAMBAHAN GAJI</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowOvertimeDetails(true)}
                    className="bg-[#FFEDAA] px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm flex flex-col items-end hover:bg-amber-200 transition-colors active:scale-95"
                  >
                     <span className="text-[7px] font-black text-[#A68000] uppercase tracking-[0.1em] opacity-60 leading-none">Lembur System</span>
                     <span className="text-[10px] font-black text-[#806000] tracking-tighter mt-0.5">{attendanceResults.overtimeHours.toFixed(1)} JAM</span>
                  </button>
               </div>
               
               <div className="space-y-3">
                  <div className="bg-white/60 p-4 rounded-[20px] border border-amber-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">LEMBUR (AUTO-SYNC)</label>
                      {!isReadOnlyRole && (
                        <button 
                          onClick={() => setData(prev => ({ ...prev, lembur: attendanceResults.totalOvertimePay }))}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all"
                        >
                          RE-SYNC
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        disabled={isReadOnlyRole} 
                        value={formatCurrencyValue(data.lembur)} 
                        onChange={e => setData({...data, lembur: parseCurrencyInput(e.target.value)})} 
                        className="w-full bg-white border border-slate-100 rounded-[16px] pl-10 pr-4 py-3.5 text-xs font-black text-slate-800 focus:border-amber-400 outline-none shadow-inner transition-all" 
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px] pointer-events-none">Rp</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50/40 p-3 rounded-[20px] border border-emerald-100 shadow-sm space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">THR</label>
                        {!isReadOnlyRole && (
                          <button 
                            type="button"
                            onClick={handleAutoCalculateTHR}
                            className="bg-emerald-600 text-white px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase"
                          >
                            AUTO
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          disabled={isReadOnlyRole} 
                          value={formatCurrencyValue(data.thr)} 
                          onChange={e => setData({...data, thr: parseCurrencyInput(e.target.value)})} 
                          className="w-full bg-white border border-emerald-100 rounded-[14px] pl-8 pr-2 py-2.5 text-[11px] font-black text-emerald-900 focus:border-emerald-400 outline-none shadow-inner" 
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-200 font-black text-[9px] pointer-events-none">Rp</span>
                      </div>
                    </div>

                    <div className="bg-sky-50/40 p-3 rounded-[20px] border border-sky-100 shadow-sm space-y-2">
                      <label className="text-[9px] font-black text-sky-800 uppercase tracking-widest block ml-1">BONUS</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          disabled={isReadOnlyRole} 
                          value={formatCurrencyValue(data.bonus)} 
                          onChange={e => setData({...data, bonus: parseCurrencyInput(e.target.value)})} 
                          className="w-full bg-white border border-sky-100 rounded-[14px] pl-8 pr-2 py-2.5 text-[11px] font-black text-sky-900 focus:border-sky-400 outline-none shadow-inner" 
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-200 font-black text-[9px] pointer-events-none">Rp</span>
                      </div>
                    </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-rose-50/50 p-4 rounded-[24px] border border-rose-100 flex flex-col justify-center">
                  <label className="text-[8px] font-black text-rose-600 uppercase tracking-widest block">ALPHA ({attendanceResults.alpha})</label>
                  <p className="text-lg font-black text-rose-700">Rp {potonganAbsensi.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-[24px] border border-slate-100 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <input 
                      type="checkbox" 
                      id="toggle-bpjstk" 
                      disabled={isReadOnlyRole} 
                      checked={isBPJSTKActive} 
                      onChange={(e) => setIsBPJSTKActive(e.target.checked)} 
                      className="w-4 h-4 rounded border-slate-200 text-[#FFC000] focus:ring-[#FFC000]" 
                    />
                    <label htmlFor="toggle-bpjstk" className="text-[8px] font-black text-slate-400 uppercase tracking-widest">BPJSTK</label>
                  </div>
                  <input 
                    type="text" 
                    disabled={!isBPJSTKActive || isReadOnlyRole} 
                    value={formatCurrencyValue(data.bpjstk)} 
                    onChange={e => setData({...data, bpjstk: parseCurrencyInput(e.target.value)})} 
                    className="w-full bg-white border border-amber-100 rounded-xl p-2 text-[10px] font-black text-slate-900 outline-none shadow-sm" 
                  />
                </div>
            </div>

            <div className="bg-slate-50/50 p-5 rounded-[32px] border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[9px] font-black text-sky-600 uppercase tracking-[0.2em]">Pinjaman & Lainnya</p>
                <span className="text-[8px] font-black text-slate-500 bg-white px-3 py-1 rounded-lg border shadow-sm">SISA: Rp {sisaHutang.toLocaleString('id-ID')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cicilan Hutang</label>
                  <input 
                    type="text" 
                    disabled={isReadOnlyRole} 
                    value={formatCurrencyValue(data.potonganHutang)} 
                    onChange={e => {
                      const val = parseCurrencyInput(e.target.value);
                      setData({...data, potonganHutang: Math.min(employee.hutang || 0, val)});
                    }} 
                    className="w-full bg-white border border-rose-100 rounded-xl p-3 text-[10px] font-black text-rose-600 focus:border-rose-400 outline-none shadow-sm" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Potongan Lain</label>
                  <input 
                    type="text" 
                    disabled={isReadOnlyRole} 
                    value={formatCurrencyValue(data.potonganLain)} 
                    onChange={e => setData({...data, potonganLain: parseCurrencyInput(e.target.value)})} 
                    className="w-full bg-white border border-slate-100 rounded-xl p-3 text-[10px] font-black text-slate-800 focus:border-[#FFC000] outline-none shadow-sm" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-slate-50 flex flex-col shrink-0">
          <div className="bg-[#111827] px-6 py-4 text-white flex justify-between items-center border-l-[12px] border-[#FFC000] relative z-10">
            <div className="space-y-0.5">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] leading-none">TAKE HOME PAY</p>
              <p className="text-lg font-black text-[#FFC000] tracking-tighter leading-none whitespace-nowrap">Rp {(takeHomePay || 0).toLocaleString('id-ID')}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none">TOTAL BRUTO</p>
              <p className="text-sm font-black text-slate-300 leading-none mt-1">Rp {(totalPendapatan || 0).toLocaleString('id-ID')}</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 space-y-3 bg-slate-50/50">
            {isSuperAdmin && (
              <button 
                type="button" 
                disabled={isFlipLoading || takeHomePay <= 0} 
                onClick={handlePayViaFlip} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-black transition-all shadow-md text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 active:scale-[0.98] border-b-4 border-emerald-800"
              >
                {isFlipLoading ? 'CONNECTING...' : <><Icons.Send className="w-4 h-4" /> BAYAR VIA FLIP</>}
              </button>
            )}

            {!isReadOnlyRole && (
              <button 
                type="button" 
                disabled={isSaving} 
                onClick={handleSaveConfig} 
                className="w-full bg-[#0f172a] hover:bg-black text-[#FFC000] py-3.5 rounded-2xl font-black transition-all shadow-md text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
              >
                {isSaving ? 'MEMPROSES...' : <><div className="w-3 h-3 bg-[#FFC000] rounded-sm mr-1"></div> SIMPAN CONFIG</>}
              </button>
            )}
            
            <button 
              type="button" 
              onClick={() => setIsPreview(true)} 
              className="w-full bg-[#FFC000] hover:bg-[#ffcd00] text-black py-3.5 rounded-2xl font-black transition-all shadow-md text-[11px] tracking-[0.2em] uppercase active:scale-[0.98] border-b-4 border-[#d97706]"
            >
              PRATINJAU SLIP
            </button>
          </div>
        </div>
      </div>
      {/* ... sisanya (modal overtime details & preview) tetap ... */}
      {showOvertimeDetails && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b bg-[#FFFBEB] flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-lg font-black uppercase text-[#806000] tracking-tight">Rincian Lembur System</h3>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">{employee.nama}</p>
               </div>
               <button onClick={() => setShowOvertimeDetails(false)} className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-light hover:bg-amber-200 transition-all">&times;</button>
            </div>
            <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30">
               {attendanceResults.overtimeItems.length > 0 ? (
                 attendanceResults.overtimeItems.map((item, idx) => (
                   <div key={idx} className="bg-white p-5 rounded-[24px] border border-slate-100 flex items-center justify-between shadow-sm group hover:shadow-md transition-all">
                      <div className="space-y-1">
                         <p className="text-xs font-black text-slate-900 uppercase">{item.date}</p>
                         <p className="text-[10px] text-slate-400 font-medium italic truncate max-w-[180px]">"{item.notes}"</p>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-black text-indigo-600 leading-none">{item.hours.toFixed(1)} JAM</p>
                         <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Rp {item.pay.toLocaleString('id-ID')}</p>
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                    <Icons.AlertCircle className="w-12 h-12 text-slate-300" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tidak Ada Data Lembur</p>
                 </div>
               )}
            </div>
            <div className="p-6 border-t bg-white shrink-0">
               <div className="bg-[#0f172a] p-5 rounded-2xl flex justify-between items-center text-white">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Terdeteksi</span>
                  <span className="text-lg font-black text-[#FFC000]">Rp {attendanceResults.totalOvertimePay.toLocaleString('id-ID')}</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {isPreview && (
        <div className="fixed inset-0 bg-slate-100 z-[210] p-3 sm:p-10 overflow-y-auto">
          <div className="max-w-[800px] mx-auto shadow-2xl bg-white mb-32 rounded-xl overflow-hidden scale-[0.9] sm:scale-100 origin-top">
            <div ref={previewSlipRef} className="p-0 sm:p-0"><SalarySlipContent /></div>
          </div>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-3 sm:gap-4 bg-white/95 backdrop-blur-xl px-6 sm:px-10 py-4 sm:py-5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/50 z-[220] flex-wrap justify-center items-center w-max">
            <button type="button" onClick={() => setIsPreview(false)} className="px-5 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors">TUTUP</button>
            <div className="h-6 w-px bg-slate-200"></div>
            <button type="button" onClick={() => handleDownloadImage()} className="bg-slate-900 text-white px-6 sm:px-8 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">PNG</button>
            <button type="button" onClick={handleSendEmail} className="bg-indigo-600 text-white px-6 sm:px-8 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg">EMAIL</button>
            <button type="button" onClick={handleSendWhatsApp} className="bg-emerald-600 text-white px-6 sm:px-8 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg">KIRIM WA</button>
            <button type="button" onClick={handleSendToInbox} className="bg-[#0f172a] text-[#FFC000] px-6 sm:px-8 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg border border-white/10">INBOX</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipModal;