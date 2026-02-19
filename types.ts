
export interface Employee {
  id: string;
  idKaryawan: string;
  nama: string;
  jabatan: string;
  division?: string;
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
  company: string;
  avatarUrl?: string;
  photoBase64?: string;
  hutang: number;
  isRemoteAllowed?: boolean;
  role?: 'owner' | 'super' | 'admin' | 'employee';
  ktpDocBase64?: string;
  ktpDocType?: 'image' | 'pdf';
  contractDocBase64?: string;
  salaryConfig?: Omit<SalaryData, 'month' | 'year'>;
  deleted_at?: string | null;
  lastLatitude?: number;
  lastLongitude?: number;
  lastLocationUpdate?: string;
  isTrackingActive?: boolean;
}

export interface FlipTransaction {
  id: string;
  external_id: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'CANCELLED';
  recipient_bank: string;
  recipient_account: string;
  recipient_name: string;
  created_at: string;
  remark: string;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  date: string;
  company: string;
}

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpha' | 'Libur' | 'Cuti' | 'Lembur' | 'Reimburse';

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  company: string;
  date: string;
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
  notes?: string;
  docBase64?: string;
  docType?: string;
  submittedAt?: string;
  photoIn?: string;
  photoOut?: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

export interface ShiftAssignment {
  id?: string;
  employeeId: string;
  date: string;
  shiftId: string;
  company: string;
}

export interface AttendanceSettings {
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number;
  allowRemote: boolean;
}

export interface Submission {
  id?: string;
  employeeId: string;
  employeeName: string;
  company: string;
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
  company: string;
  targetEmployeeIds: string[];
  sentAt: string;
  imageBase64?: string;
}

export interface LiveSchedule {
  id?: string;
  date: string;
  brand: string;
  company: string;
  hourSlot: string;
  hostId: string;
  opId: string;
}

export interface LiveReport {
  id?: string;
  tanggal: string;
  brand: string;
  company: string;
  roomId: string;
  hostId: string;
  opId: string;
  totalView: number;
  enterRoomRate: string;
  ctr: string;
  waktuMulai: string;
  waktuSelesai: string;
  durasi: number;
  checkout: number;
  gmv: number;
}

export interface ContentPlan {
  id?: string;
  title: string;
  brand: string;
  company: string;
  platform: 'TikTok' | 'Instagram' | 'Shopee' | 'Youtube';
  creatorId: string;
  deadline: string;
  status: 'Draft' | 'Proses' | 'Editing' | 'Selesai';
  notes?: string;
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

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  company: string;
  lastUpdated?: string;
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

export interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  price: number;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  date: string;
  recipientName: string;
  recipientAddress: string;
  items: InvoiceItem[];
  bankName: string;
  bankBranch: string;
  bankSwiftCode: string;
  accountName: string;
  accountNumber: string;
  paymentReference: string;
  company: string;
  subTotal: number;
  taxRate: number;
  total: number;
}

export interface Client {
  id?: string;
  namaPic: string;
  noTelepon: string;
  namaBrand: string;
  alamat: string;
  company: string;
  created_at?: string;
}

export type ActiveTab = 'home' | 'database' | 'absen' | 'attendance' | 'schedule' | 'content' | 'submissions' | 'inbox' | 'settings' | 'shift' | 'minvis' | 'kpi' | 'inventory' | 'calendar' | 'live_map' | 'finance' | 'invoice' | 'mobile_history' | 'profile';
export type UserRole = 'owner' | 'super' | 'admin' | 'employee';
