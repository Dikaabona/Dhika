
export interface Employee {
  id: string;
  idKaryawan: string;
  nama: string;
  jabatan: string;
  email: string;
  tempatLahir: string;
  tanggalLahir: string;
  alamat: string;
  noKtp: string;
  noHandphone: string;
  tanggalMasuk: string;
  bank: string;
  noRekening: string;
  namaDiRekening: string;
  avatarUrl?: string;
  photoBase64?: string;
  hutang: number;
  // Digital Documents
  ktpDocBase64?: string;
  ktpDocType?: 'image' | 'pdf';
  contractDocBase64?: string; // Always PDF
  salaryConfig?: Omit<SalaryData, 'month' | 'year'>;
}

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpha' | 'Libur' | 'Cuti' | 'Lembur';

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
  notes?: string;
  docBase64?: string; // For medical letters
  docType?: string;
  submittedAt?: string;
  photoIn?: string;
  photoOut?: string;
}

export interface Submission {
  id?: string;
  employeeId: string;
  employeeName: string;
  type: AttendanceStatus;
  startDate: string;
  endDate: string;
  notes: string;
  docBase64?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
}

export interface Broadcast {
  id?: string;
  title: string;
  message: string;
  targetEmployeeIds: string[]; // Array of employee IDs
  sentAt: string;
}

export interface LiveSchedule {
  id?: string;
  date: string;
  brand: string;
  hourSlot: string;
  hostId: string;
  opId: string;
}

export interface ContentPlan {
  id?: string;
  title: string;
  brand: string;
  platform: 'TikTok' | 'Instagram' | 'Shopee' | 'Youtube';
  creatorId: string;
  deadline: string;
  status: 'Draft' | 'Proses' | 'Editing' | 'Selesai';
  notes?: string;
  // Reporting Fields
  postingDate?: string;
  linkReference?: string;
  contentPillar?: string;
  captionHashtag?: string;
  linkPostingan?: string;
  likes?: number;
  comments?: number;
  views?: number;
  saves?: number;
  shares?: number;
  screenshotBase64?: string;
}

export type SortField = 'nama' | 'tanggalMasuk' | 'bank';
export type SortOrder = 'asc' | 'desc';

export interface SalaryData {
  month: string;
  year: string;
  gapok: number;
  tunjanganMakan: number;
  tunjanganTransport: number;
  tunjanganKomunikasi: number;
  tunjanganKesehatan: number;
  tunjanganJabatan: number;
  bpjstk: number;
  lembur: number;
  bonus: number;
  thr: number;
  potonganHutang: number;
  potonganLain: number;
}
