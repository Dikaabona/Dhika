
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { createClient, Session } from '@supabase/supabase-js';
import { Employee, AttendanceRecord, LiveSchedule, Submission, Broadcast, ContentPlan, LiveReport, ShiftAssignment, ActiveTab, UserRole } from './types.ts';
import { Icons, BANK_OPTIONS } from './constants.tsx';
import EmployeeForm from './components/EmployeeForm.tsx';
import Dashboard from './components/Dashboard.tsx';
import SalarySlipModal from './components/SalarySlipModal.tsx';
import AttendanceModule from './components/AttendanceModule.tsx';
import AnnouncementModal from './components/AnnouncementModal.tsx';
import LiveScheduleModule from './components/LiveScheduleModule.tsx';
import SubmissionForm from './components/SubmissionForm.tsx';
import Inbox from './components/Inbox.tsx';
import ContentModule from './components/ContentModule.tsx';
import AbsenModule from './components/AbsenModule.tsx';
import LegalModal from './components/LegalModal.tsx';
import SettingsModule from './components/SettingsModule.tsx';
import ShiftModule from './components/ShiftModule.tsx';
import MinVisModule from './components/MinVisModule.tsx';
import KPIModule from './components/KPIModule.tsx';
import { getTenureYears, calculateTenure } from './utils/dateUtils.ts';

const OWNER_EMAIL = 'muhammadmahardhikadib@gmail.com';

// --- KONFIGURASI LOGO ---
const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";

// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA').trim();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [currentUserEmployee, setCurrentUserEmployee] = useState<Employee | null>(null);
  const [userCompany, setUserCompany] = useState<string>('Visibel');
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [legalType, setLegalType] = useState<'privacy' | 'tos' | null>(null);

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const savedTab = localStorage.getItem('visibel_active_tab');
    return (savedTab as ActiveTab) || 'home';
  });

  const [attendanceStartDate, setAttendanceStartDate] = useState(getTodayStr());
  const [attendanceEndDate, setAttendanceEndDate] = useState(getTodayStr());

  useEffect(() => {
    localStorage.setItem('visibel_active_tab', activeTab);
  }, [activeTab]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [liveSchedules, setLiveSchedules] = useState<LiveSchedule[]>([]);
  const [contentPlans, setContentPlans] = useState<ContentPlan[]>([]);
  const [liveReports, setLiveReports] = useState<LiveReport[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isImportingEmployees, setIsImportingEmployees] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);
  const [isDesktopModulOpen, setIsDesktopModulOpen] = useState(false);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [isMobileModulOpen, setIsMobileModulOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [slipEmployee, setSlipEmployee] = useState<Employee | null>(null);

  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const desktopModulRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const mobileModulRef = useRef<HTMLDivElement>(null);
  const employeeFileInputRef = useRef<HTMLInputElement>(null);

  const [currentEmpPage, setCurrentEmpPage] = useState(1);
  const empRowsPerPage = 10;

  const currentLogo = useMemo(() => {
    return (userCompany || '').toLowerCase() === 'seller space' ? SELLER_SPACE_LOGO : VISIBEL_LOGO;
  }, [userCompany]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopDropdownRef.current && !desktopDropdownRef.current.contains(event.target as Node)) {
        setIsDesktopDropdownOpen(false);
      }
      if (desktopModulRef.current && !desktopModulRef.current.contains(event.target as Node)) {
        setIsDesktopModulOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setIsMobileDropdownOpen(false);
      }
      if (mobileModulRef.current && !mobileModulRef.current.contains(event.target as Node)) {
        setIsMobileModulOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleBasedOnEmail = (email: string, dbRole?: string): UserRole => {
    const emailLower = (email || '').toLowerCase().trim();
    if (emailLower === OWNER_EMAIL.toLowerCase()) return 'owner';
    
    if (dbRole) return dbRole as UserRole;
    
    if (emailLower === 'rezaajidharma@gmail.com') return 'super';
    if (emailLower === 'fikryadityar93@gmail.com' || emailLower === 'ariyansyah02122002@gmail.com') return 'admin';
    
    return 'employee';
  };

  const fetchData = async (userEmail?: string, isSilent: boolean = false) => {
    if (!navigator.onLine) {
      setFetchError("Anda sedang offline.");
      return;
    }
    if (!isSilent) setIsLoadingData(true);
    
    const targetEmail = (userEmail || session?.user?.email || '').toLowerCase().trim();

    try {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*');
      
      if (empError) throw empError;
      
      let allEmployees = empData || [];
      let currentEmp: Employee | null = null;
      let detectedCompany = 'Visibel';

      if (targetEmail) {
        currentEmp = allEmployees.find(e => (e.email || '').toLowerCase().trim() === targetEmail) || null;
        
        if (currentEmp) {
          detectedCompany = currentEmp.company || 'Visibel';
          setUserCompany(detectedCompany);
          setCurrentUserEmployee(currentEmp);
        } else {
          setCurrentUserEmployee(null);
        }
        
        const currentRole = getRoleBasedOnEmail(targetEmail, currentEmp?.role);
        setUserRole(currentRole);
      }
      
      const activeUserRole = targetEmail ? getRoleBasedOnEmail(targetEmail, currentEmp?.role) : 'employee';
      const isOwner = activeUserRole === 'owner';
      const companyFilterVal = detectedCompany;

      const companyEmployees = allEmployees.filter(e => isOwner || (e.company || 'Visibel') === companyFilterVal);
      setEmployees(companyEmployees);

      const buildQuery = (table: string) => {
        let q = supabase.from(table).select('*');
        if (!isOwner) q = q.eq('company', companyFilterVal);
        return q;
      };

      const fetchPromises = [
        buildQuery('attendance').order('date', { ascending: false }).then(({data}) => setAttendanceRecords(data || [])),
        buildQuery('live_reports').order('tanggal', { ascending: false }).then(({data}) => setLiveReports(data || [])),
        buildQuery('submissions').order('submittedAt', { ascending: false }).then(({data}) => setSubmissions(data || [])),
        buildQuery('broadcasts').order('sentAt', { ascending: false }).then(({data}) => setBroadcasts(data || [])),
        buildQuery('schedules').then(({data}) => setLiveSchedules(data || [])),
        buildQuery('content_plans').order('postingDate', { ascending: false }).then(({data}) => setContentPlans(data || [])),
        buildQuery('shift_assignments').then(({data}) => setShiftAssignments(data || [])),
        supabase.from('settings').select('value').eq('key', `weekly_holidays_${companyFilterVal}`).single().then(({data}) => { 
          if (data) setWeeklyHolidays(data.value); 
          else setWeeklyHolidays(DEFAULT_HOLIDAYS);
        })
      ];
      await Promise.all(fetchPromises);
    } catch (err: any) {
      setFetchError("Gagal sinkronisasi data.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const DEFAULT_HOLIDAYS = {
    'SENIN': [], 'SELASA': [], 'RABU': [], 'KAMIS': [], 'JUMAT': [], 'SABTU': [], 'MINGGU': []
  };

  const handleAuth = async (email: string, password?: string, isRegister = false, isReset = false) => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        alert('Cek email untuk reset password.');
        setIsForgotPasswordMode(false);
      } else if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password: password! });
        if (error) throw error;
        alert('Berhasil daftar, silakan cek email.');
        setIsRegisterMode(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: password! });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message);
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) fetchData(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) fetchData(session.user.email);
    });
    return () => subscription.unsubscribe();
  }, []);

  const uniqueCompanies = useMemo(() => {
    const set = new Set(employees.map(e => e.company || 'Visibel'));
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let baseList = employees;
    if (userRole !== 'owner') {
      baseList = baseList.filter(emp => (emp.email || '').toLowerCase().trim() !== OWNER_EMAIL.toLowerCase());
    }
    if (userRole === 'owner' && companyFilter !== 'ALL') {
      baseList = baseList.filter(emp => (emp.company || 'Visibel') === companyFilter);
    }
    if (userRole === 'employee' && currentUserEmployee) {
      baseList = baseList.filter(emp => emp.id === currentUserEmployee.id);
    }
    return baseList.filter(emp => 
      emp.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.idKaryawan.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery, userRole, currentUserEmployee, companyFilter]);

  const totalEmpPages = Math.ceil(filteredEmployees.length / empRowsPerPage);
  const paginatedEmployeesList = useMemo(() => {
    return filteredEmployees.slice((currentEmpPage - 1) * empRowsPerPage, currentEmpPage * empRowsPerPage);
  }, [filteredEmployees, currentEmpPage]);

  const unreadCount = useMemo(() => {
    if (userRole === 'owner' || userRole === 'super') return submissions.filter(s => s.status === 'Pending').length;
    return 0;
  }, [submissions, userRole]);

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Hapus karyawan ini secara permanen?')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      fetchData(session?.user?.email, true);
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const handleExportAllEmployees = () => {
    const dataToExport = filteredEmployees.map(emp => ({
      'COMPANY': emp.company,
      'ID KARYAWAN': emp.idKaryawan,
      'NAMA': emp.nama,
      'TEMPAT LAHIR': emp.tempatLahir,
      'TANGGAL LAHIR': emp.tanggalLahir,
      'ALAMAT': emp.alamat,
      'NO KTP': emp.noKtp,
      'JABATAN': emp.jabatan,
      'EMAIL': emp.email,
      'NO HP': emp.noHandphone,
      'MASA KERJA': calculateTenure(emp.tanggalMasuk),
      'TANGGAL MASUK': emp.tanggalMasuk,
      'BANK': emp.bank,
      'REKENING': emp.noRekening,
      'HUTANG': emp.hutang
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Database Karyawan");
    XLSX.writeFile(workbook, `Database_Karyawan_${userCompany}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'COMPANY': userCompany,
        'ID KARYAWAN': 'VID-7251',
        'NAMA': 'NAMA CONTOH',
        'TEMPAT LAHIR': 'BOGOR',
        'TANGGAL LAHIR': '01/01/1995',
        'ALAMAT': 'JL. CONTOH NO 123',
        'NO KTP': '3201000000000001',
        'NO HP': '081234567890',
        'JABATAN': 'STAFF',
        'EMAIL': 'contoh@visibel.id',
        'TANGGAL MASUK': '01/01/2024',
        'BANK': 'BCA',
        'REKENING': '1234567890',
        'HUTANG': 0
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Template_Database_${userCompany}.xlsx`);
  };

  const handleImportEmployees = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingEmployees(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const MAX_INT = 2147483647; 

        const newEmployees = jsonData.map((row: any) => {
          let rawHutang = row['HUTANG'] || 0;
          let cleanHutang = 0;
          if (typeof rawHutang === 'number') {
            cleanHutang = rawHutang > 1000000000000 ? 0 : Math.min(rawHutang, MAX_INT);
          } else {
            const parsed = parseInt(String(rawHutang).replace(/[^0-9]/g, ''), 10);
            cleanHutang = isNaN(parsed) ? 0 : (parsed > 1000000000000 ? 0 : Math.min(parsed, MAX_INT));
          }

          return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            company: String(row['COMPANY'] || userCompany),
            idKaryawan: String(row['ID KARYAWAN'] || ''),
            nama: String(row['NAMA'] || ''),
            tempatLahir: String(row['TEMPAT LAHIR'] || ''),
            tanggalLahir: String(row['TANGGAL LAHIR'] || ''),
            alamat: String(row['ALAMAT'] || ''),
            noKtp: String(row['NO KTP'] || ''),
            noHandphone: String(row['NO HP'] || ''),
            jabatan: String(row['JABATAN'] || ''),
            email: String(row['EMAIL'] || '').toLowerCase().trim(),
            tanggalMasuk: String(row['TANGGAL MASUK'] || ''),
            bank: String(row['BANK'] || 'BCA'),
            noRekening: String(row['REKENING'] || ''),
            hutang: cleanHutang
          };
        }).filter(emp => emp.nama && emp.email && (userRole === 'owner' || emp.company === userCompany));

        if (newEmployees.length > 0) {
          const { error } = await supabase.from('employees').upsert(newEmployees, { onConflict: 'email' });
          if (error) throw error;
          alert(`Berhasil mengimpor ${newEmployees.length} data karyawan!`);
          fetchData(session?.user?.email, true);
        } else {
          alert("Tidak ada data valid yang ditemukan.");
        }
      } catch (err: any) {
        alert("Gagal impor: " + err.message);
      } finally {
        setIsImportingEmployees(false);
        if (employeeFileInputRef.current) employeeFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenDrive = async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', `drive_link_${userCompany}`).single();
      const driveUrl = data?.value || 'https://drive.google.com/drive/folders/1ccXLNRsTJuOyFe0F2RGq-EP6Zi5xotFV?usp=sharing';
      window.open(driveUrl, '_blank');
    } catch {
      window.open('https://drive.google.com/drive/folders/1ccXLNRsTJuOyFe0F2RGq-EP6Zi5xotFV?usp=sharing', '_blank');
    }
  };

  const handleContactAction = () => {
    const wa = '628111743005';
    const email = 'kontakvisibel@gmail.com';
    const msg = encodeURIComponent(`Halo Visibel ID, saya ingin bertanya tentang layanan Sistem Manajemen untuk company ${userCompany}...`);
    
    if (window.confirm("Hubungi via WhatsApp? (Klik 'Batal' untuk kirim Email)")) {
      window.open(`https://wa.me/${wa}?text=${msg}`, '_blank');
    } else {
      window.location.href = `mailto:${email}?subject=Informasi%20Sistem&body=${msg}`;
    }
  };

  const isFullscreenModule = (activeTab as string) === 'absen' || (activeTab as string) === 'minvis';
  const isAttendanceActive = ['absen', 'attendance', 'submissions', 'shift'].includes(activeTab);
  const isModulActive = ['schedule', 'content', 'minvis'].includes(activeTab);

  const isUnregistered = useMemo(() => {
    if (!session || isLoadingData) return false;
    return !currentUserEmployee && userRole === 'employee';
  }, [session, isLoadingData, currentUserEmployee, userRole]);

  const isGlobalUser = userRole === 'owner';
  const isAdminAccess = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const isHighAdminAccess = userRole === 'owner' || userRole === 'super';

  const DesktopNav = () => (
    <div className="flex items-center flex-nowrap">
      <button onClick={() => setActiveTab('home')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'home' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>HOME</button>
      <button onClick={() => setActiveTab('database')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'database' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>DATABASE</button>
      <div className="relative" ref={desktopDropdownRef}>
        <button onClick={() => setIsDesktopDropdownOpen(!isDesktopDropdownOpen)} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${isAttendanceActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
          PRESENSI <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDesktopDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {isDesktopDropdownOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-[150] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <button onClick={() => { setActiveTab('absen'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">ABSEN SEKARANG</button>
            {userRole !== 'employee' && (
              <>
                <div className="h-px bg-slate-50 w-full"></div>
                <button onClick={() => { setActiveTab('shift'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">JADWAL SHIFT</button>
              </>
            )}
            <div className="h-px bg-slate-50 w-full"></div>
            <button onClick={() => { setActiveTab('attendance'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">DATA ABSENSI</button>
            <div className="h-px bg-slate-50 w-full"></div>
            <button onClick={() => { setActiveTab('submissions'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">FORM PENGAJUAN</button>
          </div>
        )}
      </div>

      <div className="relative" ref={desktopModulRef}>
        <button onClick={() => setIsDesktopModulOpen(!isDesktopModulOpen)} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${isModulActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
          CONTENT <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDesktopModulOpen ? 'rotate-180' : ''}`} />
        </button>
        {isDesktopModulOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-[150] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <button onClick={() => { setActiveTab('schedule'); setIsDesktopModulOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">LIVE STREAMING</button>
            <div className="h-px bg-slate-50 w-full"></div>
            <button onClick={() => { setActiveTab('content'); setIsDesktopModulOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">SHORT VIDEO</button>
            <div className="h-px bg-slate-50 w-full"></div>
            <button onClick={() => { setActiveTab('minvis'); setIsDesktopModulOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-[#FFC000] hover:text-black transition-colors text-[#334155]">MINVIS (AI)</button>
          </div>
        )}
      </div>

      {isHighAdminAccess && (
        <button onClick={() => setActiveTab('kpi')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'kpi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>PERFORMANCE KPI</button>
      )}

      {isAdminAccess && (
        <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>SETTING</button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      {session ? (
        isUnregistered ? (
          <div className="flex-grow flex items-center justify-center p-6 animate-in fade-in duration-700 bg-slate-50">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-200 text-center max-w-lg w-full space-y-10">
              <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Icons.Users className="w-10 h-10" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Email Tidak Terdaftar</h2>
                <p className="text-slate-500 font-medium text-lg leading-relaxed">
                  Email <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">({session.user.email})</span> tidak terdeteksi dalam database karyawan aktif sistem manapun.
                </p>
                <div className="bg-[#FFFBEB] p-8 rounded-3xl border border-[#FFD700] text-left">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-4">Instruksi Penting:</p>
                  <ol className="text-xs text-amber-800 font-bold space-y-3 list-decimal pl-4">
                    <li>Copy email Anda di atas: <span className="underline select-all">{session.user.email}</span></li>
                    <li>Berikan email tersebut kepada HRD / Admin perusahaan Anda.</li>
                    <li>Admin harus memasukkan email tersebut ke menu <span className="font-black">DATABASE</span> agar Anda dapat mengakses sistem ini.</li>
                  </ol>
                </div>
              </div>
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="w-full bg-[#0f172a] text-white py-6 rounded-3xl font-bold text-xs uppercase tracking-[0.4em] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-4"
              >
                <Icons.LogOut className="w-5 h-5" /> KELUAR & COBA LAGI
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isFullscreenModule && (
              <nav className="bg-white border-b sticky top-0 z-[150] shadow-sm">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="flex items-center justify-between h-16 sm:h-24 gap-3">
                    <div className="flex items-center cursor-pointer shrink-0 sm:w-auto" onClick={() => setActiveTab('home')}>
                      <img src={currentLogo} alt="Logo" className={`${ (userCompany || '').toLowerCase() === 'seller space' ? 'h-[30px] sm:h-[120px]' : 'h-10 sm:h-14' } w-auto`} />
                    </div>

                    <div className="flex-1 min-w-0 flex justify-center">
                      <div className="hidden md:block bg-slate-100/60 p-1.5 rounded-full border border-slate-100 shadow-inner relative">
                        <DesktopNav />
                      </div>
                      
                      {/* Navigasi tengah dihilangkan pada mobile sesuai permintaan screenshot */}
                      <div className="md:hidden"></div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 w-[75px] sm:w-auto justify-end">
                      <button onClick={() => setActiveTab('inbox')} className={`p-2 sm:p-3.5 rounded-full relative shadow-sm border transition-all ${activeTab === 'inbox' ? 'bg-slate-900 text-[#FFC000] border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white'}`}>
                        <Icons.Mail className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                        {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] sm:text-[8px] w-4 h-4 flex items-center justify-center rounded-full border border-white font-bold animate-bounce">{unreadCount}</span>}
                      </button>
                      <button onClick={() => supabase.auth.signOut()} className="p-2 sm:p-3.5 rounded-full bg-slate-50 text-slate-300 border border-slate-100 shadow-sm hover:text-red-500 hover:border-red-100 transition-all active:scale-90">
                        <Icons.LogOut className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </nav>
            )}

            <main className={`flex-grow w-full ${isFullscreenModule ? 'bg-white' : 'max-w-7xl mx-auto px-4 py-6 sm:py-10'}`}>
              {activeTab === 'absen' ? (
                <AbsenModule employee={currentUserEmployee} attendanceRecords={attendanceRecords} company={userCompany} onSuccess={() => fetchData(session?.user?.email, true)} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'minvis' ? (
                <MinVisModule onClose={() => setActiveTab('home')} />
              ) : activeTab === 'kpi' ? (
                <KPIModule employees={employees} attendanceRecords={attendanceRecords} contentPlans={contentPlans} liveReports={liveReports} userRole={userRole} currentEmployee={currentUserEmployee} company={userCompany} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'shift' ? (
                <ShiftModule employees={employees} assignments={shiftAssignments} setAssignments={setShiftAssignments} userRole={userRole} company={userCompany} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'attendance' ? (
                <AttendanceModule employees={employees} records={attendanceRecords} setRecords={setAttendanceRecords} searchQuery={searchQuery} userRole={userRole} currentEmployee={currentUserEmployee} startDate={attendanceStartDate} endDate={attendanceEndDate} onStartDateChange={setAttendanceStartDate} onEndDateChange={setAttendanceEndDate} weeklyHolidays={weeklyHolidays} company={userCompany} />
              ) : activeTab === 'schedule' ? (
                <LiveScheduleModule employees={employees} schedules={liveSchedules} setSchedules={setLiveSchedules} reports={liveReports} setReports={setLiveReports} userRole={userRole} company={userCompany} onClose={() => setActiveTab('home')} attendanceRecords={attendanceRecords} />
              ) : activeTab === 'content' ? (
                <ContentModule employees={employees} plans={contentPlans} setPlans={setContentPlans} searchQuery={searchQuery} userRole={userRole} currentEmployee={currentUserEmployee} company={userCompany} />
              ) : activeTab === 'submissions' ? (
                <SubmissionForm employee={currentUserEmployee} company={userCompany} onSuccess={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'inbox' ? (
                <Inbox submissions={submissions} broadcasts={broadcasts} employee={currentUserEmployee} userRole={userRole} onUpdate={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'settings' ? (
                <SettingsModule userRole={userRole} userCompany={userCompany} onRefresh={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'database' ? (
                <div className="bg-white rounded-[32px] sm:rounded-[60px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="px-8 sm:px-14 py-10 sm:py-16 border-b flex flex-col items-start bg-white gap-8">
                      <div className="flex flex-col gap-3">
                        <h2 className="font-black text-slate-900 uppercase tracking-tight text-2xl sm:text-4xl">DATABASE KARYAWAN</h2>
                        <span className="inline-block bg-slate-50 text-slate-400 text-[10px] font-black uppercase px-5 py-2 rounded-full tracking-widest self-start">{filteredEmployees.length} ENTRI {userRole === 'owner' ? '(GLOBAL)' : `(${userCompany})`}</span>
                      </div>
                      
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-8 w-full">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-100 p-1.5 rounded-[28px] border border-slate-100 shadow-inner w-full xl:max-w-[700px]">
                          {userRole === 'owner' && (
                            <div className="relative shrink-0">
                               <div className="bg-[#0f172a] text-white px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest flex items-center gap-3 cursor-pointer shadow-lg active:scale-95 transition-all">
                                 {companyFilter === 'ALL' ? 'SEMUA COMPANY' : companyFilter}
                                 <Icons.ChevronDown className="w-3 h-3" />
                                 <select 
                                  value={companyFilter} 
                                  onChange={(e) => { setCompanyFilter(e.target.value); setCurrentEmpPage(1); }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                 >
                                    <option value="ALL">SEMUA COMPANY</option>
                                    {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                               </div>
                            </div>
                          )}

                          <div className="relative flex-grow bg-white rounded-[22px] shadow-sm border border-slate-100 px-6 py-4 flex items-center gap-4 min-w-0">
                            <Icons.Search className="w-5 h-5 text-slate-300 shrink-0" />
                            <input 
                              type="text" 
                              placeholder="Cari Nama atau ID..." 
                              value={searchQuery}
                              onChange={(e) => { setSearchQuery(e.target.value); setCurrentEmpPage(1); }}
                              className="w-full text-xs font-bold text-black outline-none placeholder:text-slate-300 uppercase tracking-widest bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 sm:gap-4 items-center shrink-0 w-full lg:w-auto pb-4 sm:pb-0">
                          <button onClick={handleDownloadTemplate} className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-[18px] sm:rounded-[22px] flex items-center justify-center gap-1.5 sm:gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 text-slate-500 whitespace-nowrap">
                            <Icons.Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> TEMPLATE
                          </button>
                          {(userRole === 'owner' || userRole === 'super' || userRole === 'admin') && (
                            <button onClick={() => setIsFormOpen(true)} className="bg-[#FFC000] hover:bg-black text-black hover:text-white px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-[18px] sm:rounded-[22px] flex items-center justify-center gap-1.5 sm:gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-amber-100 active:scale-95 whitespace-nowrap">
                              <Icons.Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> TAMBAH
                            </button>
                          )}
                          <input type="file" ref={employeeFileInputRef} onChange={handleImportEmployees} className="hidden" accept=".xlsx,.xls" />
                          <button onClick={() => employeeFileInputRef.current?.click()} disabled={isImportingEmployees} className="bg-[#059669] hover:bg-[#047857] text-white px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-[18px] sm:rounded-[22px] flex items-center justify-center gap-1.5 sm:gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-50 whitespace-nowrap">
                            <Icons.Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {isImportingEmployees ? '...' : 'UNGGAH'}
                          </button>
                          <button onClick={handleExportAllEmployees} className="bg-[#0f172a] hover:bg-black text-white px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-[18px] sm:rounded-[22px] flex items-center justify-center gap-1.5 sm:gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95 whitespace-nowrap">
                            <Icons.Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> EKSPOR
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar touch-pan-x">
                    <table className="w-full text-left min-w-[1500px] border-separate border-spacing-0">
                      <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 text-[10px] uppercase font-bold tracking-[0.15em] sticky top-0 z-10">
                        <tr>
                          {isGlobalUser && <th className="px-14 py-6 border-b border-slate-100">COMPANY</th>}
                          <th className="px-8 py-6 border-b border-slate-100">ID KARYAWAN</th>
                          <th className="px-10 py-6 border-b border-slate-100">NAMA KARYAWAN</th>
                          <th className="px-10 py-6 border-b border-slate-100">TTL</th>
                          <th className="px-10 py-6 border-b border-slate-100">ALAMAT</th>
                          <th className="px-8 py-6 border-b border-slate-100">NO KTP</th>
                          <th className="px-8 py-6 border-b border-slate-100">CUTI</th>
                          <th className="px-8 py-6 border-b border-slate-100 text-right">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {paginatedEmployeesList.map((emp, idx) => {
                          const tenureYears = getTenureYears(emp.tanggalMasuk);
                          const leaveQuota = tenureYears >= 1 ? 12 : 0;
                          const currentYear = new Date().getFullYear();
                          const usedLeave = attendanceRecords.filter(r => 
                            r.employeeId === emp.id && 
                            r.status === 'Cuti' && 
                            new Date(r.date).getFullYear() === currentYear
                          ).length;
                          const sisaCuti = Math.max(0, leaveQuota - usedLeave);
                          
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/70 transition-all duration-300 group border-b border-slate-50 last:border-0">
                              {isGlobalUser && (
                                <td className="px-14 py-7 whitespace-nowrap">
                                  <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">{emp.company || 'VISIBEL'}</span>
                                </td>
                              )}
                              <td className="px-8 py-7 whitespace-nowrap">
                                <span className="inline-block bg-slate-50 text-slate-700 font-black text-[10px] uppercase px-4 py-2 rounded-xl tracking-[0.1em] border border-slate-200/50 shadow-sm whitespace-nowrap">
                                  {emp.idKaryawan || 'VSB-00'}
                                </span>
                              </td>
                              <td className="px-10 py-7 whitespace-nowrap">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-[22px] overflow-hidden border-2 border-white shadow-md bg-slate-100 shrink-0 transform group-hover:scale-105 transition-all duration-500 ring-1 ring-slate-100/50">
                                      {emp.photoBase64 ? (
                                        <img src={emp.photoBase64} className="w-full h-full object-cover" alt="" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                          <Icons.Users className="w-5 h-5" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900 text-[14px] uppercase truncate leading-tight mb-1 tracking-tight">{emp.nama}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{emp.jabatan}</p>
                                    </div>
                                </div>
                              </td>
                              <td className="px-10 py-7 whitespace-nowrap">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{emp.tempatLahir}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{emp.tanggalLahir}</p>
                                </div>
                              </td>
                              <td className="px-10 py-7 whitespace-nowrap">
                                <p className="text-[11px] text-slate-600 font-medium max-w-[280px] truncate uppercase tracking-tight" title={emp.alamat}>{emp.alamat}</p>
                              </td>
                              <td className="px-8 py-7 whitespace-nowrap">
                                <p className="text-[11px] font-bold text-slate-800 tracking-widest opacity-80">{emp.noKtp}</p>
                              </td>
                              <td className="px-8 py-7 whitespace-nowrap">
                                <span className={`inline-block font-black text-[10px] px-3 py-1 rounded-lg ${sisaCuti > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                  {sisaCuti} HARI
                                </span>
                              </td>
                              <td className="px-8 py-7 text-right whitespace-nowrap">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-2">
                                  {(userRole === 'owner' || userRole === 'super' || emp.id === currentUserEmployee?.id) && (
                                    <button onClick={() => setSlipEmployee(emp)} className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90 border border-transparent hover:border-emerald-100 shadow-sm hover:shadow-md bg-white" title="Slip Gaji"><Icons.Download className="w-4.5 h-4.5" /></button>
                                  )}
                                  {(userRole === 'owner' || userRole === 'super' || emp.id === currentUserEmployee?.id) && (
                                    <button onClick={() => { setEditingEmployee(emp); setIsFormOpen(true); }} className="p-2.5 text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all active:scale-90 border border-transparent hover:border-cyan-100 shadow-sm hover:shadow-md bg-white" title="Edit Data"><Icons.Edit className="w-4.5 h-4.5" /></button>
                                  )}
                                  {(userRole === 'owner' || userRole === 'super' || userRole === 'admin') && (
                                    <button onClick={() => handleDeleteEmployee(emp.id)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90 border border-transparent hover:border-rose-100 shadow-sm hover:shadow-md bg-white" title="Hapus"><Icons.Trash className="w-4.5 h-4.5" /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredEmployees.length === 0 && (
                          <tr>
                            <td colSpan={isGlobalUser ? 8 : 7} className="py-20 text-center">
                              <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                                <Icons.Users className="w-12 h-12" />
                                <p className="text-xs font-black uppercase tracking-[0.4em]">Data Tidak Ditemukan</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalEmpPages > 1 && (
                    <div className="px-8 sm:px-14 py-6 flex items-center justify-between border-t border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
                        <span className="text-xs font-black text-white px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-200">{currentEmpPage} / {totalEmpPages}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          disabled={currentEmpPage === 1}
                          onClick={() => setCurrentEmpPage(prev => prev - 1)}
                          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95"
                        >
                          <Icons.ChevronDown className="w-4 h-4 rotate-90" />
                        </button>
                        <button 
                          disabled={currentEmpPage === totalEmpPages}
                          onClick={() => setCurrentEmpPage(prev => prev + 1)}
                          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all shadow-sm active:scale-95"
                        >
                          <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Dashboard 
                  employees={filteredEmployees} 
                  submissions={submissions} 
                  broadcasts={broadcasts} 
                  userRole={userRole} 
                  currentUserEmployee={currentUserEmployee} 
                  contentPlans={contentPlans} 
                  onNavigate={setActiveTab} 
                  userCompany={userCompany}
                  onOpenBroadcast={() => setIsAnnouncementOpen(true)}
                  onOpenDrive={handleOpenDrive}
                  contentBrandConfigs={[]}
                />
              )}
            </main>
          </>
        )
      ) : (
        <div className="flex-grow flex items-center justify-center p-6 animate-in fade-in duration-700 bg-[#2e2e2e]">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-black p-12 text-center">
              <img src={VISIBEL_LOGO} alt="Logo" className="w-[180px] h-auto mx-auto" />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAuth(loginEmail, loginPassword, isRegisterMode, isForgotPasswordMode); }} className="p-10 space-y-8">
              <h2 className="text-2xl font-bold text-[#0f172a] text-center uppercase tracking-[0.3em]">
                {isForgotPasswordMode ? 'RESET' : isRegisterMode ? 'DAFTAR BARU' : 'LOGIN'}
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">EMAIL TERDAFTAR</label>
                  <input required type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@visibel.id" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#FFC000] text-sm font-medium text-black transition-all" />
                </div>
                {!isForgotPasswordMode && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">KATA SANDI</label>
                    <div className="relative">
                      <input required type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#FFC000] text-sm font-medium text-black transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">
                        <Icons.Search className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {authError && <p className="text-xs text-red-600 text-center font-bold">{authError}</p>}
              <div className="space-y-4">
                <button disabled={isAuthLoading} type="submit" className="w-full bg-[#0f172a] text-white py-5 rounded-3xl font-bold text-xs uppercase tracking-[0.4em] shadow-xl active:scale-[0.98] transition-all hover:bg-black">
                  {isAuthLoading ? 'MENGHUBUNGKAN...' : 'MASUK'}
                </button>
              </div>

              <div className="text-center flex-col gap-4 pt-2 flex">
                <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setIsForgotPasswordMode(false); }} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors">
                  {isRegisterMode ? 'KEMBALI KE LOGIN' : 'DAFTAR BARU'}
                </button>
                {!isRegisterMode && (
                  <button type="button" onClick={() => setIsForgotPasswordMode(!isForgotPasswordMode)} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors">
                    {isForgotPasswordMode ? 'KEMBALI KE LOGIN' : 'LUPA PASSWORD?'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className={`${!session ? 'bg-[#2e2e2e] border-none' : 'bg-white border-t'} py-12 sm:py-16 shrink-0`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-8">
          <img src={currentLogo} alt="Logo" className={`h-12 sm:h-16 ${!session ? 'opacity-40' : 'opacity-20 grayscale'}`} />
          <div className="flex flex-wrap justify-center gap-6 sm:gap-12">
            <button onClick={() => setLegalType('privacy')} className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${!session ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Kebijakan Privasi</button>
            <button onClick={() => setLegalType('tos')} className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${!session ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Syarat & Ketentuan</button>
            <button onClick={handleContactAction} className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${!session ? 'text-slate-500 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}>Informasi Kontak</button>
          </div>
          <p className={`text-[9px] font-bold uppercase tracking-[0.4em] text-center leading-relaxed ${!session ? 'text-slate-600' : 'text-slate-300'}`}>
            &copy; {new Date().getFullYear()} Visibel ID • Sistem Manajemen
          </p>
        </div>
      </footer>

      {isFormOpen && <EmployeeForm employees={employees} initialData={editingEmployee} userRole={userRole} userCompany={userCompany} currentUserEmployee={currentUserEmployee} onSave={async (emp) => { await supabase.from('employees').upsert(emp); fetchData(session?.user?.email, true); setIsFormOpen(false); }} onCancel={() => setIsFormOpen(false)} />}
      {slipEmployee && <SalarySlipModal employee={slipEmployee} attendanceRecords={attendanceRecords} userRole={userRole} onClose={() => setSlipEmployee(null)} onUpdate={() => fetchData(session?.user?.email, true)} weeklyHolidays={weeklyHolidays} />}
      {isAnnouncementOpen && <AnnouncementModal employees={filteredEmployees} company={userCompany} onClose={() => setIsAnnouncementOpen(false)} onSuccess={() => fetchData(session?.user?.email, true)} />}
      {legalType && <LegalModal type={legalType} onClose={() => setLegalType(null)} />}
    </div>
  );
};

export default App;
