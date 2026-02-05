
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
  company: string; // Field baru untuk multi-company
  avatarUrl?: string;
  photoBase64?: string;
  hutang: number;
  isRemoteAllowed?: boolean; // Properti baru untuk izin absen luar kantor individu
  role?: 'owner' | 'super' | 'admin' | 'employee'; // Role sistem baru
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
  company: string; // Filter per company
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

export interface AttendanceSettings {
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number; // dalam meter
  allowRemote: boolean;
}

export interface Submission {
  id?: string;
  employeeId: string;
  employeeName: string;
  company: string; // Filter per company
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
  company: string; // Filter per company
  targetEmployeeIds: string[]; // Array of employee IDs
  sentAt: string;
}

export interface LiveSchedule {
  id?: string;
  date: string;
  brand: string;
  company: string; // Filter per company
  hourSlot: string;
  hostId: string;
  opId: string;
}

export interface LiveReport {
  id?: string;
  tanggal: string;
  brand: string;
  company: string; // Filter per company
  roomId: string;
  hostId: string;
  opId: string;
  totalView: number;
  enterRoomRate: string; // e.g. "4.5%"
  ctr: string; // e.g. "2.1%"
  waktuMulai: string;
  waktuSelesai: string;
  durasi: number; // Jam
  checkout: number;
  gmv: number;
}

export interface ContentPlan {
  id?: string;
  title: string;
  brand: string;
  company: string; // Filter per company
  platform: 'TikTok' | 'Instagram' | 'Shopee' | 'Youtube';
  creatorId: string;
  deadline: string;
  status: 'Draft' | 'Proses' | 'Editing' | 'Selesai';
  notes?: string;
  // Reporting Fields
  postingDate?: string;
  jamUpload?: string;
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
  pph21?: number;
  lembur: number;
  bonus: number;
  thr: number;
  potonganHutang: number;
  potonganLain: number;
}