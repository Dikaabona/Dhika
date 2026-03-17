
import { Employee, AttendanceRecord, WeeklyHolidays } from '../types';

export interface SalaryDetails {
  gapok: number;
  effectiveGapok: number;
  workingDays: number;
  tunjanganOps: number;
  lembur: number;
  bonus: number;
  thr: number;
  totalPendapatan: number;
  bpjstk: number;
  pph21: number;
  potonganAbsensi: number;
  potonganHutang: number;
  potonganLain: number;
  totalPotongan: number;
  takeHomePay: number;
  summary: {
    alpha: number;
    hadir: number;
    sakit: number;
    izin: number;
    libur: number;
    cuti: number;
    totalOvertimePay: number;
    overtimeHours: number;
    overtimeItems: { date: string, hours: number, pay: number, notes: string }[];
  };
  cutoffStart: number;
  cutoffEnd: number;
}

const formatDateToYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getSalaryDetails = (
  employee: Employee,
  config: any,
  attendanceRecords: AttendanceRecord[],
  selectedMonth: string,
  selectedYear: string,
  settings: any,
  weeklyHolidays: WeeklyHolidays | null,
  positionRates: any[] = []
): SalaryDetails => {
  const monthOptions = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const actualPotonganHutang = Math.min(employee.hutang || 0, config.potonganHutang || 0);
  const isDaily = config.type === 'daily';
  
  let workingDays = config.workingDays || 26;
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

  const monthIdx = monthOptions.indexOf(selectedMonth);
  if (monthIdx !== -1) {
    const cutoffStart = config.cutoffStart || settings?.payrollCutoffStart || 26;
    const cutoffEnd = config.cutoffEnd || settings?.payrollCutoffEnd || 25;
    const yearNum = parseInt(selectedYear);
    
    const rangeStart = new Date(yearNum, monthIdx - 1, cutoffStart);
    const rangeEnd = new Date(yearNum, monthIdx, cutoffEnd);
    const startStr = rangeStart.toISOString().split('T')[0];
    const endStr = rangeEnd.toISOString().split('T')[0];

    const relevantRecords = attendanceRecords.filter(r => 
      r.employeeId === employee.id && 
      r.date >= startStr && 
      r.date <= endStr
    );

    // Calculate Hourly Rate for Overtime
    const currentJabatan = (employee.jabatan || '').trim().toUpperCase();
    const rateConfig = positionRates.find(p => p.name.toUpperCase() === currentJabatan || currentJabatan.includes(p.name.toUpperCase()));
    let hourlyRate = rateConfig ? rateConfig.bonus : 10000;

    if (!rateConfig) {
      const jabLower = (employee.jabatan || '').toLowerCase();
      if (jabLower.includes('content creator')) {
        hourlyRate = 50000;
      } else if (
        jabLower.includes('host') || 
        jabLower.includes('operator') || 
        jabLower.includes('business development') ||
        jabLower.includes('owner') ||
        jabLower.includes('admin') ||
        jabLower.includes('finance') ||
        jabLower.includes('hr') ||
        jabLower.includes('manager')
      ) {
        hourlyRate = 10000;
      }
    }

    // Helper to check workday
    const isWorkDay = (date: Date) => {
      const day = date.getDay();
      const isHost = (employee.jabatan || '').toUpperCase().includes('HOST LIVE STREAMING');
      if (day === 0) return isHost;
      if (day === 6) return false;
      const dayNameMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
      const currentDayName = dayNameMap[day];
      if (weeklyHolidays) {
        const empNameUpper = employee.nama.toUpperCase();
        const employeeInHolidays = Object.values(weeklyHolidays).some(names => (names as string[]).map((n: string) => n.toUpperCase()).includes(empNameUpper));
        if (employeeInHolidays) {
          return !(weeklyHolidays[currentDayName] || []).map((n: string) => n.toUpperCase()).includes(empNameUpper);
        }
      }
      return true;
    };

    const todayStr = formatDateToYYYYMMDD(new Date());
    let temp = new Date(rangeStart);
    while (temp <= rangeEnd) {
      const dStr = formatDateToYYYYMMDD(temp);
      const dayRecords = relevantRecords.filter(r => r.date === dStr);
      const isWork = isWorkDay(temp);
      
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
        else if (mainRecord.status === 'Alpha') summary.alpha++;
        else if (mainRecord.status === 'Sakit') summary.sakit++;
        else if (mainRecord.status === 'Izin') summary.izin++;
        else if (mainRecord.status === 'Cuti') summary.cuti++;
        else summary.libur++;
      } else if (overtimeRecords.length > 0) {
        summary.hadir++;
      } else {
        if (dStr < todayStr) {
          if (isWork) summary.alpha++;
          else summary.libur++;
        } else {
          if (!isWork) summary.libur++;
        }
      }

      // Calculate Overtime Pay
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
    
    if (isDaily) {
      workingDays = summary.hadir;
    }
  }

  const gapok = config.gapok || 0;
  const effectiveGapok = isDaily ? gapok * workingDays : gapok;
  const dailyRate = gapok / 26;
  const potonganAbsensi = isDaily ? 0 : Math.round(summary.alpha * dailyRate);
  const finalLembur = summary.totalOvertimePay > 0 ? summary.totalOvertimePay : (config.lembur || 0);
  const tunjanganOps = (config.tunjanganMakan || 0) + (config.tunjanganTransport || 0) + (config.tunjanganKomunikasi || 0) + (config.tunjanganKesehatan || 0) + (config.tunjanganJabatan || 0);
  const bonus = config.bonus || 0;
  const thr = config.thr || 0;
  const totalPendapatan = effectiveGapok + tunjanganOps + finalLembur + bonus + thr;
  
  const bpjstk = config.isBPJSTKActive === true ? (config.bpjstk || 0) : 0;
  const pph21 = config.pph21 || 0;
  const potonganLain = config.potonganLain || 0;
  const totalPotongan = bpjstk + pph21 + potonganAbsensi + actualPotonganHutang + potonganLain;
  const takeHomePay = totalPendapatan - totalPotongan;

  return {
    gapok,
    effectiveGapok,
    workingDays,
    tunjanganOps,
    lembur: finalLembur,
    bonus,
    thr,
    totalPendapatan,
    bpjstk,
    pph21,
    potonganAbsensi,
    potonganHutang: actualPotonganHutang,
    potonganLain,
    totalPotongan,
    takeHomePay,
    summary,
    cutoffStart: config.cutoffStart || settings?.payrollCutoffStart || 26,
    cutoffEnd: config.cutoffEnd || settings?.payrollCutoffEnd || 25
  };
};
