export const parseFlexibleDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);
  
  const trimmed = String(dateStr).trim();
  
  // Mendukung format DD/MM/YYYY atau DD-MM-YYYY
  const localeMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (localeMatch) {
    const day = parseInt(localeMatch[1], 10);
    const month = parseInt(localeMatch[2], 10) - 1;
    const year = parseInt(localeMatch[3], 10);
    return new Date(year, month, day);
  }
  
  // Mendukung format YYYY-MM-DD (Standar HTML/ISO)
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }
  
  // Fallback ke parser bawaan browser
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date(NaN) : parsed;
};

export const formatDateToYYYYMMDD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const calculateTenure = (joinDateStr: string): string => {
  const joinDate = parseFlexibleDate(joinDateStr);
  if (isNaN(joinDate.getTime())) return 'Format Salah';
  const now = new Date();
  
  let years = now.getFullYear() - joinDate.getFullYear();
  let months = now.getMonth() - joinDate.getMonth();
  
  if (months < 0 || (months === 0 && now.getDate() < joinDate.getDate())) {
    years--;
    months += 12;
  }
  
  const result = [];
  if (years > 0) result.push(`${years} Tahun`);
  if (months > 0) result.push(`${months} Bulan`);
  
  return result.length > 0 ? result.join(' ') : 'Baru Masuk';
};

export const getTenureYears = (joinDateStr: string): number => {
  const joinDate = parseFlexibleDate(joinDateStr);
  if (isNaN(joinDate.getTime())) return 0;
  
  const now = new Date();
  // Set waktu ke 0 untuk perbandingan murni tanggal
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const join = new Date(joinDate.getFullYear(), joinDate.getMonth(), joinDate.getDate());
  
  let years = today.getFullYear() - join.getFullYear();
  const m = today.getMonth() - join.getMonth();
  
  // Jika bulan belum sampai, atau bulan sama tapi hari belum sampai
  if (m < 0 || (m === 0 && today.getDate() < join.getDate())) {
    years--;
  }
  
  return years;
};

export const getDaysUntilBirthday = (birthDateStr: string): number => {
  const birthDate = parseFlexibleDate(birthDateStr);
  if (isNaN(birthDate.getTime())) return 999;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const bMonth = birthDate.getMonth();
  const bDay = birthDate.getDate();
  
  let nextBday = new Date(today.getFullYear(), bMonth, bDay);
  
  if (nextBday < today) {
    nextBday.setFullYear(today.getFullYear() + 1);
  }
  
  const diff = nextBday.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Mendapatkan tanggal Senin di minggu saat ini dalam format ISO string.
 * Berguna untuk sinkronisasi mingguan / reset data.
 */
export const getMondayISO = (d: Date): string => {
  const date = new Date(d);
  const day = date.getDay();
  // Hitung selisih hari dari hari ini ke Senin (Senin = 1, Minggu = 0)
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
};

/**
 * Mendapatkan tanggal Minggu di akhir minggu saat ini dalam format ISO string.
 */
export const getSundayISO = (d: Date): string => {
  const date = new Date(d);
  const day = date.getDay();
  // Hitung selisih hari dari hari ini ke Minggu (Minggu = 0 atau 7)
  const diff = date.getDate() + (day === 0 ? 0 : 7 - day);
  const sunday = new Date(date.setDate(diff));
  sunday.setHours(23, 59, 59, 999);
  return sunday.toISOString().split('T')[0];
};

/**
 * Membuat URL Google Calendar template
 * Format tanggal ISO basic: YYYYMMDDTHHmmSSZ
 */
export const generateGoogleCalendarUrl = (params: {
  title: string;
  details: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g., "09.00 - 10.00" atau "19:00"
}) => {
  const dateOnly = params.date.replace(/-/g, '');
  
  // Handle single time or range
  const timeParts = params.timeSlot.split(' - ');
  const times = timeParts.map(t => t.replace(/[:.]/g, '').padEnd(4, '0'));
  
  let start = `${dateOnly}T${times[0]}00`;
  let end = '';
  
  if (times[1]) {
    end = `${dateOnly}T${times[1]}00`;
  } else {
    // Default duration: 1 hour
    const hour = parseInt(times[0].substring(0, 2), 10);
    const minute = times[0].substring(2, 4);
    const endHour = (hour + 1).toString().padStart(2, '0');
    end = `${dateOnly}T${endHour}${minute}00`;
  }
  
  const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
  const url = `${baseUrl}&text=${encodeURIComponent(params.title)}&dates=${start}/${end}&details=${encodeURIComponent(params.details)}&sf=true&output=xml`;
  
  return url;
};