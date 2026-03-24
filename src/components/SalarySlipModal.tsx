
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Employee, SalaryData, AttendanceRecord, Broadcast, AttendanceSettings } from '../types';
import { Icons } from '../constants';
import { parseFlexibleDate, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';
import { useConfirmation } from '../contexts/ConfirmationContext';

import SalarySlipContent from './SalarySlipContent';
import { getSalaryDetails } from '../utils/salaryCalculations';
import { domToJpeg } from 'modern-screenshot';
import { jsPDF } from 'jspdf';

interface SalarySlipModalProps {
  employee: Employee;
  attendanceRecords: AttendanceRecord[];
  userRole: string;
  onClose: () => void;
  onUpdate?: () => void;
  weeklyHolidays?: Record<string, string[]>;
  positionRates?: any[];
  initialMonth?: string;
  initialYear?: string;
}

const MAJOVA_LOGO = "https://lh3.googleusercontent.com/d/1pjtSR-r2YJMexgm3hl6jtANdjbVn2FZD";
const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";

const ALPHA_START_DATE = '2025-01-01';

const SalarySlipModal: React.FC<SalarySlipModalProps> = ({ 
  employee, 
  attendanceRecords, 
  userRole, 
  onClose, 
  onUpdate, 
  weeklyHolidays, 
  positionRates = [],
  initialMonth,
  initialYear
}) => {
  const { confirm } = useConfirmation();
  const isReadOnlyRole = userRole === 'admin' || userRole === 'employee';
  const [currentEmployee, setCurrentEmployee] = useState(employee);

  const handleRefreshEmployee = async () => {
    try {
      const { data: latest, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employee.id)
        .single();
      
      if (latest) {
        setCurrentEmployee(latest);
        setIsBPJSTKActive(latest.salaryConfig?.isBPJSTKActive ?? false);
        setData(prev => ({
          ...prev,
          gapok: latest.salaryConfig?.gapok ?? prev.gapok,
          tunjanganMakan: latest.salaryConfig?.tunjanganMakan ?? prev.tunjanganMakan,
          tunjanganTransport: latest.salaryConfig?.tunjanganTransport ?? prev.tunjanganTransport,
          tunjanganKomunikasi: latest.salaryConfig?.tunjanganKomunikasi ?? prev.tunjanganKomunikasi,
          tunjanganKesehatan: latest.salaryConfig?.tunjanganKesehatan ?? prev.tunjanganKesehatan,
          tunjanganJabatan: latest.salaryConfig?.tunjanganJabatan ?? prev.tunjanganJabatan,
          bpjstk: latest.salaryConfig?.bpjstk ?? prev.bpjstk,
          pph21: latest.salaryConfig?.pph21 ?? prev.pph21,
          lembur: latest.salaryConfig?.lembur ?? prev.lembur,
          bonus: latest.salaryConfig?.bonus ?? prev.bonus,
          thr: latest.salaryConfig?.thr ?? prev.thr,
          workingDays: latest.salaryConfig?.workingDays ?? prev.workingDays,
          potonganHutang: Math.min(latest.hutang || 0, latest.salaryConfig?.potonganHutang ?? prev.potonganHutang),
          potonganLain: latest.salaryConfig?.potonganLain ?? prev.potonganLain,
          totalHutang: latest.hutang || 0
        }));
        if (onUpdate) onUpdate();
      }
    } catch (e) {}
  };

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
  const [isBPJSTKActive, setIsBPJSTKActive] = useState(employee.salaryConfig?.isBPJSTKActive ?? false);
  const [showOvertimeDetails, setShowOvertimeDetails] = useState(false);
  const [data, setData] = useState<SalaryData & { adjustment: number; pph21: number; totalHutang: number }>({
    month: initialMonth || activePeriod.name,
    year: initialYear || activePeriod.year,
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
    workingDays: employee.salaryConfig?.workingDays ?? 26,
    potonganHutang: Math.min(employee.hutang || 0, employee.salaryConfig?.potonganHutang ?? 0),
    potonganLain: employee.salaryConfig?.potonganLain ?? 0,
    totalHutang: employee.hutang || 0,
    adjustment: 0
  });

  const [isPreview, setIsPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const previewSlipRef = useRef<HTMLDivElement>(null);
  const hiddenSlipRef = useRef<HTMLDivElement>(null);

  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', `company_details_${employee.company}`).maybeSingle();
        if (data && data.value) {
          setCompanyDetails(data.value);
        }
      } catch (e) {}
    };
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', `attendance_settings_${employee.company}`).maybeSingle();
        if (data && data.value) {
          setSettings(data.value);
        }
      } catch (e) {}
    };
    fetchCompany();
    fetchSettings();
  }, [employee.company]);

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

  const cutoffStart = employee.salaryConfig?.cutoffStart || settings?.payrollCutoffStart || 26;
  const cutoffEnd = employee.salaryConfig?.cutoffEnd || settings?.payrollCutoffEnd || 25;

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

  const salaryDetails = useMemo(() => {
    return getSalaryDetails(currentEmployee, data, attendanceRecords, data.month, String(data.year), settings, weeklyHolidays, positionRates);
  }, [currentEmployee, data, attendanceRecords, settings, weeklyHolidays, positionRates]);

  const attendanceResults = salaryDetails.summary;

  useEffect(() => {
    if (!isReadOnlyRole && attendanceResults.totalOvertimePay > 0) {
      setData(prev => ({ ...prev, lembur: attendanceResults.totalOvertimePay }));
    } else if (!isReadOnlyRole && attendanceResults.totalOvertimePay === 0) {
      setData(prev => ({ ...prev, lembur: 0 }));
    }
  }, [attendanceResults.totalOvertimePay, isReadOnlyRole]);

  const totalTunjanganOps = salaryDetails.tunjanganOps;
  
  const isDaily = currentEmployee.salaryConfig?.type === 'daily';
  const effectiveGapok = salaryDetails.effectiveGapok;

  const potonganAbsensi = salaryDetails.potonganAbsensi;

  useEffect(() => {
    if (isDaily && attendanceResults.hadir > 0) {
      setData(prev => ({ ...prev, workingDays: attendanceResults.hadir }));
    }
  }, [isDaily, attendanceResults.hadir]);

  const totalPendapatan = effectiveGapok + totalTunjanganOps + (data.lembur || 0) + (data.bonus || 0) + (data.thr || 0);

  const autoBPJS = useMemo(() => Math.round(totalPendapatan * 0.02), [totalPendapatan]);

  useEffect(() => {
    if (isBPJSTKActive) {
      setData(prev => ({ ...prev, bpjstk: autoBPJS }));
    } else {
      setData(prev => ({ ...prev, bpjstk: 0 }));
    }
  }, [autoBPJS, isBPJSTKActive]);

  const currentBPJSTK = isBPJSTKActive ? (data.bpjstk || 0) : 0;
  const totalPotongan = currentBPJSTK + potonganAbsensi + (data.pph21 || 0) + (data.potonganHutang || 0) + (data.potonganLain || 0);
  const takeHomePay = totalPendapatan - totalPotongan + (data.adjustment || 0);
  const sisaHutang = Math.max(0, (currentEmployee.hutang || 0) - (data.potonganHutang || 0));

  const handleAutoCalculateTHR = () => {
    const totalFixed = effectiveGapok + totalTunjanganOps;
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
      const isConfirmed = await confirm({
        title: 'Potong Hutang?',
        message: `Perhatian! Saldo hutang karyawan akan berkurang sebesar Rp ${data.potonganHutang.toLocaleString('id-ID')}. Saldo akhir akan menjadi Rp ${sisaHutang.toLocaleString('id-ID')}. Lanjutkan?`,
        type: 'warning',
        confirmText: 'LANJUTKAN'
      });
      if (!isConfirmed) return;
    }
    setIsSaving(true);
    try {
      const configToSave = {
        gapok: data.gapok,
        workingDays: data.workingDays,
        tunjanganMakan: data.tunjanganMakan,
        tunjanganTransport: data.tunjanganTransport,
        tunjanganKomunikasi: data.tunjanganKomunikasi,
        tunjanganKesehatan: data.tunjanganKesehatan,
        tunjanganJabatan: data.tunjanganJabatan,
        bpjstk: data.bpjstk,
        isBPJSTKActive: isBPJSTKActive,
        pph21: data.pph21,
        lembur: data.lembur,
        bonus: data.bonus,
        thr: data.thr,
        potonganHutang: data.potonganHutang,
        potonganLain: data.potonganLain
      };
      const updates: any = { 
        salaryConfig: configToSave,
        hutang: sisaHutang 
      };
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
      console.log("DEBUG: Capturing image with modern-screenshot...");
      const dataUrl = await domToJpeg(target, {
        quality: 0.8,
        scale: 2,
        width: 794,
        height: 1122,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `Slip_Gaji_${employee.nama}_${data.month}_${data.year}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      console.error("PNG Download Error:", err);
      if (!silent) alert("Gagal mengunduh gambar: " + (err.message || "Unknown Error"));
    } finally {
      if (!silent) setIsProcessing(false);
    }
  };

  const generatePDFBlob = async () => {
    const target = isPreview ? previewSlipRef.current : hiddenSlipRef.current;
    if (!target) return null;
    
    const fileName = `Slip_Gaji_${employee.nama.replace(/\s/g, '_')}_${data.month}_${data.year}.pdf`;
    
    try {
      console.log("DEBUG: Generating PDF blob with modern-screenshot + jsPDF...");
      const dataUrl = await domToJpeg(target, {
        quality: 0.8,
        scale: 2,
        width: 794,
        height: 1122,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [794, 1122]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 794, 1122);
      return pdf.output('blob');
    } catch (err) {
      console.error("PDF Generation Error:", err);
      throw err;
    }
  };

  const handleSendEmail = async () => {
    setIsProcessing(true);
    try {
      const target = isPreview ? previewSlipRef.current : hiddenSlipRef.current;
      if (!target) return;

      console.log("DEBUG: Capturing image for email with modern-screenshot...");
      const jpegBase64 = await domToJpeg(target, {
        quality: 0.8,
        scale: 1.5,
        width: 794,
        height: 1122,
        backgroundColor: '#ffffff'
      });

      if (!jpegBase64 || !jpegBase64.includes(',')) {
        throw new Error("Gagal menghasilkan gambar slip gaji. Silakan coba lagi.");
      }

      console.log("DEBUG: Image captured, size:", Math.round(jpegBase64.length / 1024), "KB");

      const recipientEmail = (currentEmployee.email || '').trim();
      if (!recipientEmail) {
        alert("Email karyawan belum diatur. Silakan lengkapi di Database Karyawan.");
        return;
      }

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 30px; text-align: center;">
            <h1 style="color: #FFC000; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">SLIP GAJI</h1>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px; font-weight: bold;">PERIODE ${data.month.toUpperCase()} ${data.year}</p>
          </div>
          <div style="padding: 40px; color: #1e293b;">
            <p style="margin-top: 0;">Halo <strong>${employee.nama}</strong>,</p>
            <p>Berikut adalah slip gaji Anda untuk periode ${data.month} ${data.year}.</p>
            
            <p style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #FFC000;">
              Silakan temukan rincian slip gaji Anda pada lampiran email ini.
            </p>

            <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Total Gaji Bersih</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 900; font-size: 18px; color: #0f172a;">Rp ${takeHomePay.toLocaleString('id-ID')}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
              Detail rincian lengkap dapat Anda lihat langsung melalui aplikasi <strong>Visibel HR</strong>.
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">Email ini dikirim secara otomatis oleh sistem Finance ${employee.company}.</p>
            </div>
          </div>
        </div>
      `;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject: `SLIP GAJI ${data.month.toUpperCase()} ${data.year} - ${employee.nama}`,
          html: emailHtml,
          from: companyDetails?.email || "admin@visibel.agency",
          replyTo: companyDetails?.email || "admin@visibel.agency",
          attachments: [
            {
              filename: `slip-gaji-${employee.nama.toLowerCase().replace(/\s+/g, '-')}.jpg`,
              content: jpegBase64.split(',')[1],
              contentType: 'image/jpeg'
            }
          ]
        })
      });

      if (response.ok) {
        alert("Slip gaji berhasil dikirim ke email karyawan!");
      } else {
        let errorMsg = "Gagal mengirim email";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errorMsg = errData.message || JSON.stringify(errData);
          } else {
            const text = await response.text();
            errorMsg = text.substring(0, 100);
          }
        } catch (e) {
          errorMsg = `HTTP Error ${response.status}`;
        }
        throw new Error(errorMsg);
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
      console.log("DEBUG: Capturing image for inbox with modern-screenshot...");
      const jpegBase64 = await domToJpeg(target, {
        quality: 0.8,
        scale: 2,
        width: 794,
        height: 1122,
        backgroundColor: '#ffffff'
      });

      const newBroadcast: Broadcast = {
        title: `SLIP GAJI ${data.month.toUpperCase()} ${data.year}`,
        message: `Halo ${employee.nama}, berikut slip gaji Anda untuk periode ${data.month} ${data.year} dalam format gambar (JPG). Anda dapat mendownload gambar ini langsung dari Inbox sebagai arsip pribadi.`,
        company: employee.company || 'Visibel',
        targetEmployeeIds: [employee.id],
        sentAt: new Date().toISOString(),
        imageBase64: jpegBase64
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

  const SalarySlipContentWrapper = () => {
    const comp = (employee.company || '').toLowerCase();
    const defaultLogo = comp === 'seller space' ? SELLER_SPACE_LOGO : comp === 'visibel' ? VISIBEL_LOGO : MAJOVA_LOGO;
    const slipLogo = companyDetails?.logo || defaultLogo;
    return (
      <SalarySlipContent 
        employee={employee}
        data={data}
        totalTunjanganOps={totalTunjanganOps}
        totalPendapatan={totalPendapatan}
        totalPotongan={totalPotongan}
        takeHomePay={takeHomePay}
        sisaHutang={sisaHutang}
        attendanceResults={attendanceResults}
        cutoffStart={cutoffStart}
        cutoffEnd={cutoffEnd}
        slipLogo={slipLogo}
        isBPJSTKActive={isBPJSTKActive}
        potonganAbsensi={potonganAbsensi}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[200]">
      <div className="bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-300 border border-white/10">
        <div className="p-4 sm:p-6 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20 shrink-0">
              {currentEmployee.photoBase64 || currentEmployee.avatarUrl ? (
                <img src={currentEmployee.photoBase64 || currentEmployee.avatarUrl} className="w-full h-full object-cover" alt={currentEmployee.nama} />
              ) : (
                <Icons.Users className="w-5 h-5 text-white/40" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight uppercase leading-none text-white">{currentEmployee.nama}</h2>
                <button onClick={handleRefreshEmployee} className="p-1 hover:bg-white/10 rounded-full transition-colors" title="Refresh Data">
                  <Icons.RefreshCw className="w-3 h-3 text-[#FFC000]" />
                </button>
              </div>
              <p className="text-[#FFC000] text-[8px] sm:text-[9px] mt-1 uppercase font-black tracking-widest opacity-90">{currentEmployee.idKaryawan} • {currentEmployee.jabatan}</p>
              {currentEmployee.email && <p className="text-[7px] text-slate-400 font-bold lowercase leading-none mt-0.5">{currentEmployee.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all text-white/40 hover:text-white">
            <span className="text-2xl leading-none font-light">&times;</span>
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 bg-white flex-grow custom-scrollbar">
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '794px', height: '1122px', zIndex: -1, pointerEvents: 'none' }}>
            <div ref={hiddenSlipRef}><SalarySlipContentWrapper /></div>
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
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                {isDaily ? 'Gaji Per Hari' : 'Gaji Pokok'}
              </label>
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

            {isDaily && (
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Jumlah Hari Kerja</label>
                <div className="relative group p-0.5 border border-dashed border-indigo-200 rounded-[24px]">
                  <input 
                    type="number" 
                    disabled={isReadOnlyRole} 
                    value={data.workingDays} 
                    onChange={e => setData({...data, workingDays: parseInt(e.target.value) || 0})} 
                    className="w-full bg-[#f8fafc] border border-slate-100 rounded-[22px] py-4 pl-12 sm:py-5 sm:pl-20 text-xl sm:text-2xl font-black text-indigo-600 outline-none shadow-inner focus:border-[#FFC000] focus:bg-white transition-all disabled:opacity-60" 
                  />
                  <Icons.Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6 pointer-events-none block" />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs pointer-events-none">HARI</span>
                </div>
                <div className="flex justify-between px-2">
                   <p className="text-[9px] font-bold text-slate-400 uppercase">Total Gaji Pokok: </p>
                   <p className="text-[10px] font-black text-indigo-600">Rp {effectiveGapok.toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}

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
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Total Pinjaman (Hutang)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      disabled={isReadOnlyRole} 
                      value={formatCurrencyValue(data.totalHutang)} 
                      onChange={e => {
                        const val = parseCurrencyInput(e.target.value);
                        setData({...data, totalHutang: val});
                      }} 
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-black text-slate-900 focus:border-sky-400 outline-none shadow-sm pl-10" 
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px]">Rp</span>
                  </div>
                </div>
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
                      setData({...data, potonganHutang: Math.min(data.totalHutang || 0, val)});
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
          <div className="max-w-[800px] mx-auto shadow-2xl bg-white mb-32 rounded-xl overflow-hidden scale-[0.9] sm:scale-100 origin-top" style={{ backgroundColor: '#ffffff' }}>
            <div ref={previewSlipRef}><SalarySlipContentWrapper /></div>
          </div>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-3 sm:gap-4 bg-white/95 backdrop-blur-xl px-6 sm:px-10 py-4 sm:py-5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/50 z-[220] flex-wrap justify-center items-center w-max">
            <button type="button" onClick={() => setIsPreview(false)} className="px-5 py-2.5 rounded-full text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors">TUTUP</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipModal;
