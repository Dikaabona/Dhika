
export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Cuti' | 'Alpa' | 'Lembur' | 'Reimburse' | 'Pending' | 'Approved' | 'Rejected';

export type UserRole = 'admin' | 'employee' | 'superadmin' | 'manager' | 'owner' | 'super';

export type ActiveTab = 'dashboard' | 'attendance' | 'employee' | 'content' | 'finance' | 'settings' | 'inbox' | 'inventory' | 'invoice' | 'quotation' | 'recruitment' | 'kpi' | 'calendar' | 'map' | 'report' | 'schedule' | 'minvis' | 'absen' | 'home' | 'database' | 'shift' | 'live_map' | 'submissions' | 'mobile_history' | 'content_report';

export interface Employee {
  id: string;
  nama: string;
  email?: string;
  jabatan?: string;
  divisi?: string;
  division?: string; // Alias for divisi
  lokasiKerja?: string;
  isRemoteAllowed?: boolean;
  company?: string;
  photo?: string;
  photoBase64?: string;
  avatarUrl?: string;
  status?: string;
  statusKaryawan?: string;
  joinDate?: string;
  tanggalMasuk?: string;
  bankName?: string;
  bank?: string;
  bankAccount?: string;
  noRekening?: string;
  bankHolder?: string;
  namaDiRekening?: string;
  salary?: number;
  dailyAllowance?: number;
  mealAllowance?: number;
  transportAllowance?: number;
  positionAllowance?: number;
  otherAllowance?: number;
  bpjsKesehatan?: number;
  bpjsKetenagakerjaan?: number;
  pph21?: number;
  resignedDate?: string;
  resigned_at?: string; // Alias for resignedDate
  resignationReason?: string;
  resign_reason?: string; // Alias for resignationReason
  idKaryawan?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  alamat?: string;
  noKtp?: string;
  noHandphone?: string;
  hutang?: number;
  statusNikah?: string;
  agama?: string;
  golonganDarah?: string;
  jenjangPendidikan?: string;
  lembagaPendidikan?: string;
  tahunLulus?: string;
  nilaiPendidikan?: string;
  statusPtkp?: string;
  tahunPtkp?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  kodePos?: string;
  masaProbation?: string;
  gender?: string;
  isTrackingActive?: boolean;
  lastLocationUpdate?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  role?: UserRole;
  salaryConfig?: {
    basicSalary?: number;
    gapok?: number; // Alias for basicSalary
    dailyAllowance?: number;
    mealAllowance?: number;
    tunjanganMakan?: number; // Alias
    transportAllowance?: number;
    tunjanganTransport?: number; // Alias
    positionAllowance?: number;
    tunjanganJabatan?: number; // Alias
    communicationAllowance?: number;
    tunjanganKomunikasi?: number; // Alias
    healthAllowance?: number;
    tunjanganKesehatan?: number; // Alias
    otherAllowance?: number;
    bpjsKesehatan?: number;
    bpjsKetenagakerjaan?: number;
    bpjstk?: number; // Alias
    pph21?: number;
    cutoffStart?: number;
    cutoffEnd?: number;
    type?: string;
    lembur?: number;
    bonus?: number;
    thr?: number;
  };
}

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  photoIn?: string;
  photoOut?: string;
  status: string;
  notes?: string;
  company?: string;
}

export interface AttendanceSettings {
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number;
  allowRemote: boolean;
  payrollCutoffStart?: number;
  payrollCutoffEnd?: number;
  branches?: Array<Branch>;
}

export interface Branch {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string;
  phone?: string;
  code?: string;
}

export interface LiveSchedule {
  id?: string;
  date: string;
  brand: string;
  hourSlot: string;
  hostId: string;
  opId: string;
  company: string;
}

export interface LiveReport {
  id?: string;
  date: string;
  tanggal?: string; // Alias for date
  brand: string;
  hourSlot: string;
  hostId: string;
  opId: string;
  views?: number;
  totalView?: number; // Alias for views
  likes?: number;
  comments?: number;
  shares?: number;
  orders?: number;
  checkout?: number; // Alias for orders
  revenue?: number;
  gmv?: number; // Alias for revenue
  notes?: string;
  company: string;
  roomId?: string;
  enterRoomRate?: string;
  ctr?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  durasi?: number;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  company: string;
  color?: string;
}

export interface ShiftAssignment {
  id?: string;
  employeeId: string;
  shiftId: string;
  date: string;
  company: string;
}

export interface Submission {
  id?: string;
  employeeId: string;
  employeeName: string;
  company: string;
  type: AttendanceStatus;
  startDate: string;
  endDate: string;
  notes?: string;
  docBase64?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  category: string;
  quantity: number;
  stock?: number; // Alias for quantity
  minStock?: number;
  unit: string;
  price?: number;
  status?: string;
  assignedTo?: string;
  company: string;
  lastUpdated?: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  qty?: number; // Alias for quantity
  price: number;
  total?: number;
}

export interface Invoice {
  id: string;
  number: string;
  invoiceNumber?: string; // Alias for number
  date: string;
  dueDate: string;
  customerName: string;
  recipientName?: string; // Alias for customerName
  customerAddress?: string;
  recipientAddress?: string; // Alias for customerAddress
  items: Array<InvoiceItem>;
  subtotal: number;
  subTotal?: number; // Alias for subtotal
  tax?: number;
  taxRate?: number;
  discount?: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';
  company: string;
  bankName?: string;
  bankBranch?: string;
  bankSwiftCode?: string;
  accountName?: string;
  accountNumber?: string;
  paymentReference?: string;
}

export interface QuotationItem {
  id?: string;
  description?: string;
  quantity: number;
  qty?: number; // Alias for quantity
  price: number;
  rate?: number; // Alias for price
  total?: number;
  service?: string;
  facilities?: string;
  amount?: number;
}

export interface Quotation {
  id: string;
  number: string;
  date: string;
  expiryDate: string;
  validUntil?: string; // Alias for expiryDate
  customerName: string;
  recipientName?: string; // Alias for customerName
  customerAddress?: string;
  recipientAddress?: string; // Alias for customerAddress
  items: Array<QuotationItem>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  company: string;
  additionalNotes?: string;
  paymentTerms?: string;
  signatureName?: string;
}

export interface Broadcast {
  id?: string;
  title: string;
  content?: string;
  message?: string; // Alias for content
  date?: string;
  sentAt?: string; // Alias for date
  author?: string;
  company: string;
  targetDivisi?: string;
  targetRole?: string;
  targetEmployeeIds?: string[];
  imageBase64?: string;
}

export interface Announcement extends Broadcast {}

export interface ContentPlan {
  id: string;
  title: string;
  type: 'Live' | 'Video';
  platform: string;
  date: string;
  postingDate?: string; // Alias for date
  deadline?: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Selesai';
  company: string;
  brand?: string;
  creatorId?: string;
  hostId?: string;
  opId?: string;
  jamUpload?: string;
  notes?: string;
  likes?: number;
  comments?: number;
  views?: number;
  saves?: number;
  shares?: number;
  captionHashtag?: string;
  linkPostingan?: string;
  contentPillar?: string;
  screenshotBase64?: string;
  linkReference?: string;
}

export interface KPI {
  id: string;
  employeeId: string;
  month: string;
  year: number;
  metrics: Array<{
    name: string;
    value: number;
    target: number;
    weight: number;
  }>;
  score: number;
  notes?: string;
  company: string;
}

export interface Candidate {
  id?: string;
  candidateName?: string;
  nama?: string; // Alias for candidateName
  email?: string;
  position?: string;
  posisi?: string; // Alias for position
  source?: string;
  status: 'Applied' | 'Screening' | 'Interview' | 'Offered' | 'Hired' | 'Rejected';
  appliedAt?: string;
  timestamp?: string; // Alias for appliedAt
  resumeUrl?: string;
  videoUrl?: string;
  portfolioUrl?: string;
  notes?: string;
  company: string;
  ttl?: string;
  alamat?: string;
  noHp?: string;
  gajiHarapan?: number;
}

export interface Recruitment extends Candidate {}

export interface SalaryData {
  id: string;
  employeeId: string;
  month: string;
  year: number;
  basicSalary: number;
  gapok?: number; // Alias for basicSalary
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'Draft' | 'Paid';
  company: string;
  tunjanganMakan?: number;
  tunjanganTransport?: number;
  tunjanganKomunikasi?: number;
  tunjanganKesehatan?: number;
  tunjanganJabatan?: number;
  bpjstk?: number;
  lembur?: number;
  bonus?: number;
  thr?: number;
  workingDays?: number;
  potonganHutang?: number;
  potonganLain?: number;
  cutoffStart?: number;
  cutoffEnd?: number;
  type?: string;
}

export interface SalarySlip extends SalaryData {}

export interface CalendarEvent {
  id?: string;
  title: string;
  start?: string;
  date?: string; // Alias for start
  end?: string;
  type?: 'Holiday' | 'Shift' | 'Live' | 'Birthday' | 'Meeting' | 'Event';
  color?: string;
  company: string;
  description?: string;
}
