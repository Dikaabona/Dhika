
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../constants';
import { Employee, AttendanceRecord, WeeklyHolidays, ShiftAssignment, Shift } from '../types';
import { getSalaryDetails } from '../utils/salaryCalculations';
import SalarySlipContent from './SalarySlipContent';
import { supabase } from '../services/supabaseClient';
import { domToJpeg } from 'modern-screenshot';

interface PersonalSalarySlipProps {
  employee: Employee;
  attendanceRecords: AttendanceRecord[];
  weeklyHolidays: WeeklyHolidays | null;
  positionRates: any[];
  shiftAssignments: ShiftAssignment[];
  shifts: Shift[];
  company: string;
  onClose: () => void;
}

const monthOptions = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PersonalSalarySlip: React.FC<PersonalSalarySlipProps> = ({
  employee,
  attendanceRecords,
  weeklyHolidays,
  positionRates,
  shiftAssignments,
  shifts,
  company,
  onClose
}) => {
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [settings, setSettings] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>(attendanceRecords);
  const previewRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fetchLocalAttendance = async () => {
      const monthIdx = monthOptions.indexOf(selectedMonth);
      if (monthIdx === -1) return;
      const yearNum = parseInt(selectedYear);
      
      const config = (employee.salaryConfig || {}) as any;
      const currentCutoffStart = config.cutoffStart || settings?.payrollCutoffStart || 26;
      const currentCutoffEnd = config.cutoffEnd || settings?.payrollCutoffEnd || 25;
      
      const startDate = new Date(yearNum, monthIdx - 1, currentCutoffStart);
      const endDate = new Date(yearNum, monthIdx, currentCutoffEnd);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .ilike('company', company.trim())
        .eq('employeeId', employee.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);
      
      if (!error && data) {
        setLocalAttendance(data);
      }
    };

    if (settings) {
      fetchLocalAttendance();
    }
  }, [selectedMonth, selectedYear, company, employee.id, settings, monthOptions]);

  useEffect(() => {
    const updateScale = () => {
      const mobilePadding = 32; // 16px each side
      const containerWidth = window.innerWidth - mobilePadding;
      if (containerWidth < 794) {
        // A4 width is ~794px at 96dpi (210mm)
        setScale(containerWidth / 794);
      } else {
        setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', `attendance_settings_${company}`).maybeSingle();
      if (data && data.value) setSettings(data.value);
    };
    const fetchCompany = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', `company_details_${company}`).maybeSingle();
      if (data && data.value) setCompanyDetails(data.value);
    };
    fetchSettings();
    fetchCompany();
  }, [company]);

  const salaryDetails = getSalaryDetails(
    employee,
    employee.salaryConfig || {},
    localAttendance,
    selectedMonth,
    selectedYear,
    settings,
    weeklyHolidays,
    positionRates,
    shiftAssignments,
    shifts
  );

  const slipLogo = companyDetails?.logo || 'https://via.placeholder.com/200x80?text=LOGO';

  const handleDownload = async () => {
    if (!captureRef.current || isProcessing) return;
    setIsProcessing(true);
    // Tiny delay to ensure everything is rendered
    await new Promise(resolve => setTimeout(resolve, 200));
    try {
      // Use higher quality and explicit dimensions for A4 (~794x1122 at 96dpi)
      const dataUrl = await domToJpeg(captureRef.current, {
        quality: 0.98,
        scale: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1122,
      });
      const link = document.createElement('a');
      link.download = `Slip_Gaji_${employee.nama}_${selectedMonth}_${selectedYear}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal download slip:", err);
      alert("Gagal mengunduh slip gaji. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const slipContentProps = {
    employee,
    data: {
      ...employee.salaryConfig,
      bonus: salaryDetails.bonus,
      thr: salaryDetails.thr,
      lembur: salaryDetails.lembur,
      potonganHutang: salaryDetails.potonganHutang,
      potonganLain: salaryDetails.potonganLain,
      pph21: salaryDetails.pph21,
      gapok: salaryDetails.gapok,
      workingDays: salaryDetails.workingDays,
      month: selectedMonth,
      year: selectedYear,
    } as any,
    totalTunjanganOps: salaryDetails.tunjanganOps,
    totalPendapatan: salaryDetails.totalPendapatan,
    totalPotongan: salaryDetails.totalPotongan,
    takeHomePay: salaryDetails.takeHomePay,
    sisaHutang: employee.hutang || 0,
    attendanceResults: salaryDetails.summary,
    cutoffStart: salaryDetails.cutoffStart,
    cutoffEnd: salaryDetails.cutoffEnd,
    slipLogo: slipLogo,
    isBPJSTKActive: employee.salaryConfig?.isBPJSTKActive || false,
    potonganAbsensi: salaryDetails.potonganAbsensi,
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 overflow-x-hidden">
      {/* Hidden high-res capture target - using small opacity instead of fixed off-screen to help some browsers */}
      <div 
        className="fixed top-0 left-0 opacity-[0.01] pointer-events-none z-[-50] overflow-hidden" 
        aria-hidden="true"
        style={{ width: '794px', height: '1122px' }}
      >
        <div ref={captureRef} style={{ width: '794px' }}>
          <SalarySlipContent {...slipContentProps} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-90">
            <Icons.ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Slip Gaji Saya</h1>
        </div>
        
        <button 
          onClick={handleDownload}
          disabled={isProcessing}
          className="bg-[#FFC000] hover:bg-[#e6ac00] disabled:bg-slate-200 text-slate-900 px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase transition-all shadow-sm active:scale-95"
        >
          {isProcessing ? (
            <Icons.Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Icons.Download className="w-4 h-4" />
          )}
          <span>UNDUH</span>
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto pb-10">
        {/* Selectors */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 appearance-none shadow-sm focus:ring-2 focus:ring-[#FFC000] focus:border-transparent outline-none"
            >
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Icons.ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 appearance-none shadow-sm focus:ring-2 focus:ring-[#FFC000] focus:border-transparent outline-none"
            >
              {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
            <Icons.ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Info Text */}
        <p className="mb-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center px-4 leading-relaxed bg-white/50 py-2.5 rounded-2xl border border-slate-100">
          Gaji dari {salaryDetails.cutoffStart} bulan lalu s/d {salaryDetails.cutoffEnd} bulan ini.
        </p>

        {/* Slip Preview (Scaled version) */}
        <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden relative flex justify-center">
          <div 
            className="origin-top transition-transform duration-500 will-change-transform shrink-0"
            style={{ 
              transform: `scale(${scale})`,
              width: '794px',
              pointerEvents: 'none',
              userSelect: 'none',
              position: 'absolute',
              top: 0
            }}
          >
            <div ref={previewRef}>
              <SalarySlipContent {...slipContentProps} />
            </div>
          </div>
          {/* Spacer to give the outer container the correct height based on the scaled content */}
          <div style={{ height: `${1020 * scale}px` }}></div>
        </div>
      </div>
    </div>
  );
};

export default PersonalSalarySlip;
