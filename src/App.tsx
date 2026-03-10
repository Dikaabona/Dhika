
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Session } from '@supabase/supabase-js';
import { supabase as supabaseInstance } from './services/supabaseClient.ts';
export const supabase = supabaseInstance;
import { Employee, AttendanceRecord, LiveSchedule, Submission, Broadcast, ContentPlan, LiveReport, ShiftAssignment, ActiveTab, UserRole, Shift } from './types.ts';
import { Icons, BANK_OPTIONS, DEFAULT_SHIFTS } from './constants.tsx';
import EmployeeForm from './components/EmployeeForm.tsx';
import Dashboard from './components/Dashboard.tsx';
import SalarySlipModal from './components/SalarySlipModal.tsx';
import BulkSalaryModal from './components/BulkSalaryModal.tsx';
import AttendanceModule from './components/AttendanceModule.tsx';
import AnnouncementModal from './components/AnnouncementModal.tsx';
import LiveScheduleModule from './components/LiveScheduleModule.tsx';
import SubmissionForm from './components/SubmissionForm.tsx';
import Inbox from './components/Inbox.tsx';
import ContentModule from './components/ContentModule.tsx';
import ContentReport from './components/ContentReport.tsx';
import AbsenModule from './components/AbsenModule.tsx';
import LegalModal from './components/LegalModal.tsx';
import SettingsModule from './components/SettingsModule.tsx';
import ShiftModule from './components/ShiftModule.tsx';
import MinVisModule from './components/MinVisModule.tsx';
import KPIModule from './components/KPIModule.tsx';
import CalendarModule from './components/CalendarModule.tsx';
import InventoryModule from './components/InventoryModule.tsx';
import EmployeeDetailModal from './components/EmployeeDetailModal.tsx';
import MobileAttendanceHistory from './components/MobileAttendanceHistory.tsx';
import LiveMapModule from './components/LiveMapModule.tsx';
import FinancialModule from './components/FinancialModule.tsx';
import RecruitmentModule from './components/RecruitmentModule.tsx';
import { InvoiceModule } from './components/InvoiceModule.tsx';
import { getTenureYears, calculateTenure, formatDateToYYYYMMDD, getMondayISO } from './utils/dateUtils.ts';

const OWNER_EMAIL = 'muhammadmahardhikadib@gmail.com';

const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";

const sanitizeConfig = (val: any, fallback: string) => {
  if (!val || typeof val !== 'string' || val === 'undefined' || val === 'null') return fallback.trim();
  const sanitized = val.replace(/[\n\r\s\t]/g, '').trim();
  return sanitized || fallback.trim();
};

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [currentUserEmployee, setCurrentUserEmployee] = useState<Employee | null>(null);
  const [userCompany, setUserCompany] = useState<string>('Visibel');
  const [trialInfo, setTrialInfo] = useState<{ daysLeft: number; isExpired: boolean; isActive: boolean }>({ daysLeft: 7, isExpired: false, isActive: false });
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [registerCompanyName, setRegisterCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [legalType, setLegalType] = useState<'privacy' | 'tos' | 'contact' | null>(null);

  const getTodayStr = () => formatDateToYYYYMMDD(new Date());
  
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const savedTab = localStorage.getItem('visibel_active_tab');
      return (savedTab as ActiveTab) || 'home';
    } catch (e) {
      return 'home';
    }
  });

  const [attendanceStartDate, setAttendanceStartDate] = useState(getTodayStr());
  const [attendanceEndDate, setAttendanceEndDate] = useState(getTodayStr());

  useEffect(() => {
    try {
      localStorage.setItem('visibel_active_tab', activeTab);
    } catch (e) {
      console.warn("Failed to save active tab to localStorage", e);
    }
  }, [activeTab]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [liveSchedules, setLiveSchedules] = useState<LiveSchedule[]>([]);
  const [contentPlans, setContentPlans] = useState<ContentPlan[]>([]);
  const [liveReports, setLiveReports] = useState<LiveReport[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [shifts, setShifts] = useState<Shift[]>(DEFAULT_SHIFTS);
  const [positionRates, setPositionRates] = useState<any[]>([]);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isImportingEmployees, setIsImportingEmployees] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);
  const [isDesktopModulOpen, setIsDesktopModulOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'Aktif' | 'Resign' | 'ALL'>('Aktif');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [slipEmployee, setSlipEmployee] = useState<Employee | null>(null);
  const [isBulkSalaryOpen, setIsBulkSalaryOpen] = useState(false);

  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const desktopModulRef = useRef<HTMLDivElement>(null);
  const employeeFileInputRef = useRef<HTMLInputElement>(null);

  const [currentEmpPage, setCurrentEmpPage] = useState(1);
  const empRowsPerPage = 10;

  const currentLogo = useMemo(() => {
    return (userCompany || '').trim().toLowerCase() === 'seller space' ? SELLER_SPACE_LOGO : VISIBEL_LOGO;
  }, [userCompany]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopDropdownRef.current && !desktopDropdownRef.current.contains(event.target as Node)) {
        setIsDesktopDropdownOpen(false);
      }
      if (desktopModulRef.current && !desktopModulRef.current.contains(event.target as Node)) {
        setIsDesktopModulOpen(false);
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

  useEffect(() => {
    let intervalId: any;

    const trackLocation = () => {
      if (!session || !currentUserEmployee || !currentUserEmployee.isTrackingActive) return;

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              await supabase
                .from('employees')
                .update({ 
                  lastLatitude: latitude, 
                  lastLongitude: longitude, 
                  lastLocationUpdate: new Date().toISOString() 
                })
                .eq('id', currentUserEmployee.id);
            } catch (e) {
              console.error("Gagal update live location:", e);
            }
          },
          (error) => {
            console.warn("GPS Permission Denied / Error:", error.message);
          },
          { enableHighAccuracy: true }
        );
      }
    };

    if (session && currentUserEmployee?.isTrackingActive) {
      trackLocation(); 
      intervalId = setInterval(trackLocation, 120000); 
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, currentUserEmployee]);

  const fetchData = async (userEmail?: string, isSilent: boolean = false) => {
    if (!navigator.onLine) {
      setFetchError("Anda sedang offline. Periksa koneksi internet Anda.");
      return;
    }

    if (!isSilent) setIsLoadingData(true);
    setFetchError(null);
    const targetEmail = (userEmail || session?.user?.email || '').toLowerCase().trim();

    try {
      const { data: myProfile, error: profileError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', targetEmail)
        .is('deleted_at', null)
        .maybeSingle();

      if (profileError) throw profileError;

      const activeUserRole = getRoleBasedOnEmail(targetEmail, myProfile?.role);
      const isOwner = activeUserRole === 'owner';
      const detectedCompany = myProfile?.company || 'Visibel';

      const isResignedUser = (myProfile?.resigned_at && myProfile.resigned_at.trim() !== '') || (myProfile?.resign_reason && myProfile.resign_reason.trim() !== '');
      if (isResignedUser) {
        alert("Akun Anda telah dinonaktifkan (Resign). Silakan hubungi admin.");
        await supabase.auth.signOut();
        return;
      }

      setUserRole(activeUserRole);
      setUserCompany(detectedCompany);
      setCurrentUserEmployee(myProfile);

      // Cleanup old data (Retention Policy)
      if (activeUserRole === 'owner' || activeUserRole === 'super' || activeUserRole === 'admin') {
        try {
          const now = new Date();
          
          // 1. Cleanup old photos (older than 14 days)
          const fourteenDaysAgo = new Date(now);
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          const photoDateStr = fourteenDaysAgo.toISOString().split('T')[0];
          
          await supabase
            .from('attendance')
            .update({ photoIn: null, photoOut: null })
            .lt('date', photoDateStr);

          // 2. Cleanup old shifts (older than 21 days / 3 weeks)
          const twentyOneDaysAgo = new Date(now);
          twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
          const shiftDateStr = twentyOneDaysAgo.toISOString().split('T')[0];

          await supabase
            .from('shift_assignments')
            .delete()
            .lt('date', shiftDateStr)
            .eq('company', detectedCompany);

          // 3. Cleanup old schedules (Retention Policy: Max 2000 records)
          const { count: scheduleCount } = await supabase
            .from('schedules')
            .select('*', { count: 'exact', head: true })
            .eq('company', detectedCompany);

          if (scheduleCount && scheduleCount > 2000) {
            const overflow = scheduleCount - 1800; // Leave 1800 records to have some buffer
            const { data: oldSchedules } = await supabase
              .from('schedules')
              .select('id, date')
              .eq('company', detectedCompany)
              .order('date', { ascending: true })
              .limit(overflow);

            if (oldSchedules && oldSchedules.length > 0) {
              const idsToDelete = oldSchedules.map(s => s.id);
              await supabase.from('schedules').delete().in('id', idsToDelete);
              console.log(`Auto-Cleanup: Berhasil menghapus ${idsToDelete.length} jadwal lama untuk menjaga performa.`);
            }
          }

        } catch (e) {
          console.error("Gagal membersihkan data lama:", e);
        }
      }

      // Trial Check Logic
      try {
        const { data: trialData } = await supabase.from('settings').select('value').eq('key', `trial_info_${detectedCompany}`).single();
        let startDateStr: string;
        
        if (!trialData) {
          startDateStr = new Date().toISOString();
          // Auto-initialize trial for new company if user is admin/owner
          if (activeUserRole === 'owner' || activeUserRole === 'super' || activeUserRole === 'admin') {
            await supabase.from('settings').upsert({ 
              key: `trial_info_${detectedCompany}`, 
              value: { startDate: startDateStr, isPremium: false } 
            });
          }
          setTrialInfo({ daysLeft: 7, isExpired: false, isActive: true });
        } else {
          const isPremium = trialData.value.isPremium || false;
          if (isPremium) {
            setTrialInfo({ daysLeft: 999, isExpired: false, isActive: false });
          } else {
            startDateStr = trialData.value.startDate;
            const start = new Date(startDateStr);
            const now = new Date();
            const diffTime = now.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const remaining = 7 - diffDays;
            setTrialInfo({ 
              daysLeft: remaining < 0 ? 0 : remaining, 
              isExpired: remaining < 0,
              isActive: true
            });
          }
        }
      } catch (e) {
        console.error("Trial check error:", e);
      }

      let empQuery = supabase.from('employees').select('*').is('deleted_at', null);
      if (!isOwner) {
        empQuery = empQuery.eq('company', detectedCompany);
      }
      
      const { data: empData, error: empError } = await empQuery;
      if (empError) throw empError;
      
      setEmployees(empData || []);

      const companyFilterVal = detectedCompany;

      const buildQuery = (table: string): any => {
        let q: any = supabase.from(table);
        if (table === 'attendance') {
           q = q.select('id, employeeId, company, date, status, clockIn, clockOut, notes, submittedAt');
        } else if (table === 'content_plans') {
           q = q.select('id, title, brand, company, platform, creatorId, deadline, status, notes, postingDate, linkPostingan, views, likes, comments, saves, shares, contentPillar');
        } else if (table === 'broadcasts') {
           q = q.select('id, title, message, company, targetEmployeeIds, sentAt');
        } else if (table === 'submissions') {
           q = q.select('id, employeeId, employeeName, company, type, startDate, endDate, notes, status, submittedAt');
        } else {
           q = q.select('*');
        }
        
        if (!isOwner) q = q.eq('company', companyFilterVal);
        return q;
      };

      const fetchPromises = [
        buildQuery('attendance').order('date', { ascending: false }).limit(2000).then(({data, error}: any) => { if(error) throw error; setAttendanceRecords(data || []); }),
        buildQuery('live_reports').order('tanggal', { ascending: false }).limit(500).then(({data, error}: any) => { if(error) throw error; setLiveReports(data || []); }),
        buildQuery('submissions').order('submittedAt', { ascending: false }).limit(50).then(({data, error}: any) => { if(error) throw error; setSubmissions(data || []); }),
        buildQuery('broadcasts').order('sentAt', { ascending: false }).limit(30).then(({data, error}: any) => { if(error) throw error; setBroadcasts(data || []); }),
        buildQuery('schedules').order('date', { ascending: false }).limit(2000).then(({data, error}: any) => { 
          if(error) throw error; 
          if (data && data.length > 1500) {
            console.warn("PERINGATAN EGRESS: Data jadwal mendekati 2.000 record. Pertimbangkan untuk membersihkan data lama.");
          }
          setLiveSchedules(data || []); 
        }),
        buildQuery('content_plans').order('postingDate', { ascending: false }).limit(1000).then(({data, error}: any) => { if(error) throw error; setContentPlans(data || []); }),
        buildQuery('shift_assignments').order('date', { ascending: false }).limit(3000).then(({data, error}: any) => { if(error) throw error; setShiftAssignments(data || []); }),
        supabase.from('settings').select('value').eq('key', `shifts_config_${companyFilterVal}`).single().then(({data}) => {
          if (data && Array.isArray(data.value)) setShifts(data.value);
          else setShifts(DEFAULT_SHIFTS);
        }),
        supabase.from('settings').select('value').eq('key', `positions_${companyFilterVal}`).single().then(({data}) => {
          if (data && Array.isArray(data.value)) setPositionRates(data.value);
          else setPositionRates([]);
        }),
        supabase.from('settings').select('value').eq('key', `weekly_holidays_${companyFilterVal}`).single().then(({data}) => { 
          if (data) {
             const stored = data.value;
             const currentMonday = getMondayISO(new Date());
             if (stored && typeof stored === 'object' && stored.weekStart === currentMonday) {
                setWeeklyHolidays(stored.days || DEFAULT_HOLIDAYS);
             } else {
                setWeeklyHolidays(DEFAULT_HOLIDAYS);
             }
          } 
          else setWeeklyHolidays(DEFAULT_HOLIDAYS);
        })
      ];
      await Promise.all(fetchPromises);
    } catch (err: any) {
      console.error("Fetch error detail:", err);
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || err.name === 'TypeError') {
        setFetchError("Gagal Terhubung ke Server. Periksa koneksi internet Anda.");
      } else {
        setFetchError(`Koneksi Terganggu: ${msg}`);
      }
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
        if (!registerCompanyName.trim()) {
          throw new Error("Nama Perusahaan wajib diisi untuk pendaftaran trial.");
        }
        
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: password! });
        if (authError) throw authError;
        
        if (authData.user) {
          // Create Super Admin employee record
          const newSuperAdmin: Partial<Employee> = {
            email: email.toLowerCase().trim(),
            nama: 'SUPER ADMIN ' + registerCompanyName.toUpperCase(),
            company: registerCompanyName.trim().toUpperCase(),
            role: 'super',
            jabatan: 'SUPER ADMIN',
            division: 'MANAGEMENT',
            idKaryawan: 'SA-' + Math.floor(Math.random() * 9000 + 1000),
            tanggalMasuk: new Date().toISOString().split('T')[0],
            hutang: 0
          };
          
          const { error: empError } = await supabase.from('employees').insert(newSuperAdmin);
          if (empError) console.error("Error creating employee record:", empError);

          // Initialize Trial
          await supabase.from('settings').upsert({ 
            key: `trial_info_${registerCompanyName.trim().toUpperCase()}`, 
            value: { startDate: new Date().toISOString(), isPremium: false } 
          });
        }

        alert('Berhasil daftar Trial 7 Hari! Silakan cek email untuk verifikasi.');
        setIsRegisterMode(false);
        setRegisterCompanyName('');
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

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message.toLowerCase().includes('refresh token')) {
            await supabase.auth.signOut();
            setSession(null);
          }
          return;
        }
        setSession(session);
        if (session?.user?.email) fetchData(session.user.email);
      } catch (err) {
        setSession(null);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user?.email) {
        fetchData(session.user.email);
      } else if (event === 'SIGNED_OUT') {
        setEmployees([]);
        setCurrentUserEmployee(null);
        setUserRole('employee');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const uniqueCompanies = useMemo(() => {
    const set = new Set(employees.map(e => e.company || 'Visibel'));
    set.add('YONGKI KOMALADI');
    return Array.from(set).sort();
  }, [employees]);

  const isResigned = (emp: Employee) => (emp.resigned_at && emp.resigned_at.trim() !== '') || (emp.resign_reason && emp.resign_reason.trim() !== '');

  const filteredEmployees = useMemo(() => {
    let baseList = employees;
    if (userRole !== 'owner') {
      baseList = baseList.filter(emp => (emp.email || '').toLowerCase().trim() !== OWNER_EMAIL.toLowerCase());
    }
    if (userRole === 'owner' && companyFilter !== 'ALL') {
      baseList = baseList.filter(emp => (emp.company || 'Visibel') === companyFilter);
    }
    
    // Status Filter
    if (statusFilter === 'Aktif') {
      baseList = baseList.filter(emp => !isResigned(emp));
    } else if (statusFilter === 'Resign') {
      baseList = baseList.filter(emp => isResigned(emp));
    }

    if (userRole === 'employee' && currentUserEmployee) {
      baseList = baseList.filter(emp => emp.id === currentUserEmployee.id);
    }
    return baseList.filter(emp => 
      (emp.nama || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.idKaryawan || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery, userRole, currentUserEmployee, companyFilter, statusFilter]);

  const totalEmpPages = Math.ceil(filteredEmployees.length / empRowsPerPage);
  const paginatedEmployeesList = useMemo(() => {
    return filteredEmployees.slice((currentEmpPage - 1) * empRowsPerPage, currentEmpPage * empRowsPerPage);
  }, [filteredEmployees, currentEmpPage]);

  const unreadCount = useMemo(() => {
    const pending = submissions.filter(s => s.status === 'Pending');
    if (userRole === 'owner' || userRole === 'super') return pending.length;
    if (userRole === 'admin') return pending.filter(s => s.type === 'Lembur').length;
    return 0;
  }, [submissions, userRole]);

  const handleEditEmployee = async (emp: Employee) => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase.from('employees').select('*').eq('id', emp.id).single();
      if (error) throw error;
      setEditingEmployee(data);
      setIsFormOpen(true);
    } catch (err: any) {
      alert("Gagal memuat data: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleViewEmployee = async (emp: Employee) => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase.from('employees').select('*').eq('id', emp.id).single();
      if (error) throw error;
      setViewingEmployee(data);
    } catch (err: any) {
      alert("Gagal memuat profil: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Pindahkan karyawan ini ke Tempat Sampah?')) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) throw error;
      fetchData(session?.user?.email, true);
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const handleExportAllEmployees = () => {
    if (filteredEmployees.length === 0) return alert("Tidak ada data untuk diekspor.");
    const dataToExport = filteredEmployees.map(emp => ({
      'COMPANY': emp.company,
      'ID KARYAWAN': emp.idKaryawan,
      'NAMA': emp.nama,
      'TEMPAT LAHIR': emp.tempatLahir,
      'TANGGAL LAHIR': emp.tanggalLahir,
      'ALAMAT': emp.alamat,
      'NO KTP': emp.noKtp,
      'DIVISI': emp.division || '-',
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
        'JENIS KELAMIN': 'Laki-laki',
        'NO KTP': '3201000000000001',
        'NO HP': '081234567890',
        'DIVISI': 'OFFICE',
        'EMAIL': 'contoh@visibel.id',
        'TANGGAL MASUK': '01/01/2024',
        'BANK': 'BCA',
        'REKENING': '1234567890',
        'GAPOK': 5000000,
        'TUNJANGAN MAKAN': 500000,
        'TUNJANGAN TRANSPORT': 300000,
        'TUNJANGAN KOMUNIKASI': 200000,
        'TUNJANGAN KESEHATAN': 0,
        'TUNJANGAN JABATAN': 0,
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

        const parseNum = (val: any) => {
          if (typeof val === 'number') return val;
          const p = parseInt(String(val || '0').replace(/[^0-9]/g, ''), 10);
          return isNaN(p) ? 0 : p;
        };

        const newEmployeesRaw = jsonData.map((row: any) => {
          let rawHutang = row['HUTANG'] || 0;
          let cleanHutang = parseNum(rawHutang);
          if (cleanHutang > 1000000000000) cleanHutang = 0;
          else cleanHutang = Math.min(cleanHutang, MAX_INT);

          const division = String(row['DIVISI'] || '');

          return {
            company: String(row['COMPANY'] || userCompany),
            idKaryawan: String(row['ID KARYAWAN'] || ''),
            nama: String(row['NAMA'] || ''),
            gender: String(row['JENIS KELAMIN'] || 'Laki-laki'),
            tempatLahir: String(row['TEMPAT LAHIR'] || ''),
            tanggalLahir: String(row['TANGGAL LAHIR'] || row['TANGGAL LALIR'] || ''),
            alamat: String(row['ALAMAT'] || ''),
            noKtp: String(row['NO KTP'] || ''),
            noHandphone: String(row['NO HP'] || ''),
            division: division,
            jabatan: String(row['JABATAN'] || division || 'Staff'),
            email: String(row['EMAIL'] || '').toLowerCase().trim(),
            tanggalMasuk: String(row['TANGGAL MASUK'] || ''),
            bank: String(row['BANK'] || 'BCA'),
            noRekening: String(row['REKENING'] || ''),
            hutang: cleanHutang,
            deleted_at: null,
            salaryConfig: {
              gapok: parseNum(row['GAPOK'] || 0),
              tunjanganMakan: parseNum(row['TUNJANGAN MAKAN'] || 0),
              tunjanganTransport: parseNum(row['TUNJANGAN TRANSPORT'] || 0),
              tunjanganKomunikasi: parseNum(row['TUNJANGAN KOMUNIKASI'] || 0),
              tunjanganKesehatan: parseNum(row['TUNJANGAN KESEHATAN'] || 0),
              tunjanganJabatan: parseNum(row['TUNJANGAN JABATAN'] || 0),
              bpjstk: 0, pph21: 0, lembur: 0, bonus: 0, thr: 0, potonganHutang: 0, potonganLain: 0
            }
          };
        }).filter(emp => emp.nama && emp.email && (userRole === 'owner' || emp.company === userCompany));

        if (newEmployeesRaw.length > 0) {
          const dedupedBatchMap = new Map<string, any>();
          newEmployeesRaw.forEach(emp => {
            dedupedBatchMap.set(emp.email, emp);
          });
          const finalEmployees = Array.from(dedupedBatchMap.values());

          const { error } = await supabase.from('employees').upsert(finalEmployees, { onConflict: 'email' });
          if (error) throw error;
          alert(`Berhasil memproses ${finalEmployees.length} data karyawan!`);
          fetchData(session?.user?.email, true);
        } else {
          alert("Tidak ada data valid yang ditemukan.");
        }
      } catch (err: any) {
        alert("Gagal mengimpor: " + (err.message || "Pastikan format file benar."));
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

  const isFullscreenModule = activeTab === 'absen' || activeTab === 'minvis';
  const isAttendanceActive = ['absen', 'attendance', 'submissions', 'shift', 'live_map'].includes(activeTab);
  const isModulActive = ['schedule', 'content', 'minvis', 'calendar'].includes(activeTab);

  const isUnregistered = useMemo(() => {
    if (!session || isLoadingData) return false;
    if (session.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) return false;
    return !currentUserEmployee && userRole === 'employee';
  }, [session, isLoadingData, currentUserEmployee, userRole]);

  const isAdminAccess = userRole === 'owner' || userRole === 'super' || userRole === 'admin';
  const isHighAdminAccess = userRole === 'owner' || userRole === 'super';

  const DesktopNav = () => {
    const isSellerSpace = (userCompany || '').trim().toLowerCase() === 'seller space';

    return (
      <div className="flex items-center flex-nowrap">
        <button onClick={() => setActiveTab('home')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'home' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>HOME</button>
        <button onClick={() => setActiveTab('database')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'database' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>DATABASE</button>
        <div className="relative" ref={desktopDropdownRef}>
          <button onClick={() => setIsDesktopDropdownOpen(!isDesktopDropdownOpen)} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${isAttendanceActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            PRESENSI <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDesktopDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDesktopDropdownOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-[150] overflow-hidden animate-in fade-in duration-300">
              <button onClick={() => { setActiveTab('absen'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">ABSEN SEKARANG</button>
              {userRole !== 'employee' && (
                <>
                  <div className="h-px bg-slate-50 w-full"></div>
                  <button onClick={() => { setActiveTab('shift'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">JADWAL SHIFT</button>
                  <div className="h-px bg-slate-50 w-full"></div>
                  <button onClick={() => { setActiveTab('live_map'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-emerald-50 text-emerald-700 transition-colors">LIVE TRACKING</button>
                </>
              )}
              <div className="h-px bg-slate-50 w-full"></div>
              <button onClick={() => { setActiveTab('attendance'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">DATA ABSENSI</button>
              <div className="h-px bg-slate-50 w-full"></div>
              <button onClick={() => { setActiveTab('submissions'); setIsDesktopDropdownOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">FORM PENGAJUAN</button>
            </div>
          )}
        </div>

        {!isSellerSpace && (
          <div className="relative" ref={desktopModulRef}>
            <button onClick={() => setIsDesktopModulOpen(!isDesktopModulOpen)} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${isModulActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              CONTENT <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDesktopModulOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDesktopModulOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-[150] overflow-hidden animate-in fade-in duration-300">
                <button onClick={() => { setActiveTab('schedule'); setIsDesktopModulOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">LIVE STREAMING</button>
                <div className="h-px bg-slate-50 w-full"></div>
                <button onClick={() => { setActiveTab('content'); setIsDesktopModulOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors text-[#334155]">SHORT VIDEO</button>
                <div className="h-px bg-slate-50 w-full"></div>
                <button onClick={() => { setActiveTab('minvis'); setIsDesktopModulOpen(false); }} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-[#FFC000] hover:text-black transition-colors text-[#334155]">MINVIS (AI)</button>
              </div>
            )}
          </div>
        )}

        {(isHighAdminAccess || session?.user?.email === 'wida.oktapiani99@gmail.com') && (
          <button onClick={() => setActiveTab('finance')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'finance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>FINANCE</button>
        )}
        {isAdminAccess && (
          <button onClick={() => setActiveTab('inventory')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>ASET</button>
        )}
        {isAdminAccess && (
          <button onClick={() => setActiveTab('recruitment')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'recruitment' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>REKRUTMEN</button>
        )}
        {isAdminAccess && (
          <button onClick={() => setActiveTab('kpi')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'kpi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>KPI</button>
        )}
        {isHighAdminAccess && (
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-full text-[8px] font-bold tracking-widest uppercase whitespace-nowrap transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>SETTING</button>
        )}
      </div>
    );
  };

  const MobileNav = () => {
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-10 py-3 flex items-center justify-between z-[300] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => {
            setActiveTab('home');
            setViewingEmployee(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' && !viewingEmployee ? 'text-[#1E6BFF]' : 'text-slate-400'}`}
        >
          <Icons.Home className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-tighter">BERANDA</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('mobile_history');
            setViewingEmployee(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'mobile_history' && !viewingEmployee ? 'text-[#1E6BFF]' : 'text-slate-400'}`}
        >
          <Icons.Clock className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-tighter">RIWAYAT</span>
        </button>
        <button 
          onClick={() => {
            if (currentUserEmployee) setViewingEmployee(currentUserEmployee);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${viewingEmployee ? 'text-[#1E6BFF]' : 'text-slate-400'}`}
        >
          <Icons.Users className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-tighter">PROFIL</span>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      {session ? (
        (trialInfo.isExpired && userRole !== 'owner') ? (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Icons.Clock className="w-12 h-12 text-rose-500" />
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Masa Trial Berakhir</h1>
            <p className="text-slate-400 max-w-md mb-8 font-medium">
              Masa percobaan 7 hari untuk perusahaan <span className="text-[#FFC000] font-bold">{userCompany}</span> telah berakhir. 
              Silakan hubungi administrator atau Owner untuk mengaktifkan layanan premium.
            </p>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="px-8 py-3 bg-white text-slate-900 rounded-full font-black uppercase tracking-widest hover:bg-[#FFC000] transition-all active:scale-95"
            >
              Keluar Aplikasi
            </button>
          </div>
        ) : isUnregistered ? (
          <div className="flex-grow flex items-center justify-center p-6 animate-in fade-in duration-700 bg-slate-50">
            <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-slate-200 text-center max-w-lg w-full space-y-10">
              <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Icons.Users className="w-10 h-10" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Email Tidak Terdaftar</h2>
                <p className="text-slate-500 font-medium text-lg leading-relaxed">
                  Email <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">({session.user.email})</span> tidak terdeteksi dalam database karyawan aktif perusahaan Anda.
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
                      <img src={currentLogo} alt="Logo" className={`${ (userCompany || '').trim().toLowerCase() === 'seller space' ? 'h-[80px] sm:h-[120px]' : 'h-10 sm:h-14' } w-auto`} />
                    </div>
                    <div className="flex-1 min-w-0 flex justify-center">
                      <div className="hidden md:flex flex-col items-center gap-1">
                        <div className="bg-slate-100/60 p-1.5 rounded-full border border-slate-100 shadow-inner relative">
                          <DesktopNav />
                        </div>
                        {trialInfo.isActive && (
                          <div className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${trialInfo.isExpired ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            Trial Mode: {trialInfo.daysLeft} Hari Tersisa
                          </div>
                        )}
                      </div>
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

            <main className={`flex-grow w-full overflow-y-auto pb-24 md:pb-0 ${isFullscreenModule ? 'bg-white' : 'max-w-7xl mx-auto px-4 py-6 sm:py-10'}`}>
              {fetchError ? (
                <div className="p-10 text-center space-y-4">
                   <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                      <Icons.AlertCircle className="w-10 h-10" />
                   </div>
                   <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Koneksi Bermasalah</h2>
                   <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">{fetchError}</p>
                   <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                      <button onClick={() => fetchData(session?.user?.email)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Coba Muat Ulang</button>
                      <button onClick={() => supabase.auth.signOut()} className="bg-white border border-slate-200 text-slate-400 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95">Keluar Akun</button>
                   </div>
                </div>
              ) : activeTab === 'absen' ? (
                <AbsenModule employee={currentUserEmployee} attendanceRecords={attendanceRecords} company={userCompany} onSuccess={() => fetchData(session?.user?.email, true)} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'minvis' ? (
                <MinVisModule company={userCompany} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'live_map' ? (
                <LiveMapModule employees={employees} userRole={userRole} company={userCompany} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'finance' ? (
                <FinancialModule
                  company={userCompany}
                  employees={employees}
                  attendanceRecords={attendanceRecords}
                  onClose={() => setActiveTab('home')}
                  onUpdate={() => fetchData(undefined, true)}
                />
              ) : activeTab === 'inventory' ? (
                <InventoryModule company={userCompany} userRole={userRole} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'calendar' ? (
                <CalendarModule employees={employees} userRole={userRole} company={userCompany} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'kpi' ? (
                <KPIModule employees={employees} attendanceRecords={attendanceRecords} contentPlans={contentPlans} liveReports={liveReports} shiftAssignments={shiftAssignments} userRole={userRole} currentEmployee={currentUserEmployee} company={userCompany} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'recruitment' ? (
                <RecruitmentModule company={userCompany} userRole={userRole} onClose={() => setActiveTab('home')} />
              ) : activeTab === 'shift' ? (
                <ShiftModule employees={employees} assignments={shiftAssignments} setAssignments={setShiftAssignments} userRole={userRole} company={userCompany} onClose={() => setActiveTab('home')} globalShifts={shifts} onRefreshShifts={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'attendance' ? (
                <AttendanceModule employees={employees} records={attendanceRecords} setRecords={setAttendanceRecords} searchQuery={searchQuery} userRole={userRole} currentEmployee={currentUserEmployee} startDate={attendanceStartDate} endDate={attendanceEndDate} onStartDateChange={setAttendanceStartDate} onEndDateChange={setAttendanceEndDate} weeklyHolidays={weeklyHolidays} company={userCompany} positionRates={positionRates} />
              ) : activeTab === 'schedule' ? (
                <LiveScheduleModule employees={employees} schedules={liveSchedules} setSchedules={setLiveSchedules} reports={liveReports} setReports={setLiveReports} userRole={userRole} company={userCompany} onClose={() => setActiveTab('home')} attendanceRecords={attendanceRecords} shiftAssignments={shiftAssignments} shifts={shifts} onRefreshData={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'content' ? (
                <ContentModule 
                  employees={employees} 
                  plans={contentPlans} 
                  setPlans={setContentPlans} 
                  searchQuery={searchQuery} 
                  userRole={userRole} 
                  currentEmployee={currentUserEmployee} 
                  company={userCompany} 
                  onOpenReport={() => setActiveTab('content_report')}
                />
              ) : activeTab === 'content_report' ? (
                <ContentReport 
                  plans={contentPlans}
                  employees={employees}
                  company={userCompany}
                  onClose={() => setActiveTab('content')}
                />
              ) : activeTab === 'submissions' ? (
                <SubmissionForm employee={currentUserEmployee} company={userCompany} onSuccess={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'inbox' ? (
                <Inbox submissions={submissions} broadcasts={broadcasts} employee={currentUserEmployee} userRole={userRole} onUpdate={() => fetchData(session?.user?.email, true)} />
              ) : (activeTab === 'settings' && isHighAdminAccess) ? (
                <SettingsModule userRole={userRole} userCompany={userCompany} userEmail={session?.user?.email} onRefresh={() => fetchData(session?.user?.email, true)} />
              ) : activeTab === 'mobile_history' ? (
                currentUserEmployee && (
                  <MobileAttendanceHistory 
                    employee={currentUserEmployee} 
                    records={attendanceRecords} 
                    shiftAssignments={shiftAssignments}
                    shifts={shifts}
                    onClose={() => setActiveTab('home')} 
                  />
                )
              ) : activeTab === 'database' ? (
                <div className="bg-[#f8fafc] sm:bg-white rounded-none sm:rounded-[60px] sm:shadow-sm sm:border sm:border-slate-100 overflow-hidden animate-in fade-in duration-700">
                  <div className="px-5 sm:px-14 py-8 sm:py-16 flex flex-col items-center sm:items-start bg-transparent sm:bg-white gap-6">
                      <h2 className="font-black text-slate-900 uppercase tracking-tight text-4xl sm:text-7xl -mb-4">Data Karyawan</h2>
                      <span className="inline-block bg-white sm:bg-slate-50 text-slate-400 text-[10px] font-black uppercase px-5 py-2.5 rounded-full tracking-widest shadow-sm sm:shadow-none border border-slate-100 sm:border-none">{filteredEmployees.length} ENTRI {userRole === 'owner' ? '(GLOBAL)' : `(${userCompany})`}</span>
                      <div className="w-full flex flex-col gap-4 max-w-lg mx-auto sm:max-w-none">
                        <div className="flex flex-col sm:flex-row gap-4 w-full">
                          {(userRole === 'owner' || userRole === 'super' || userRole === 'admin') && (
                            <div className="flex gap-2 w-full sm:w-auto">
                              {userRole === 'owner' && (
                                <div className="relative w-full sm:w-56 shrink-0">
                                   <div className="bg-[#0f172a] text-[#FFC000] px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer shadow-xl active:scale-95 transition-all">
                                     {companyFilter === 'ALL' ? 'SEMUA COMPANY' : companyFilter}
                                     <Icons.ChevronDown className="w-3.5 h-3.5" />
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
                              
                              <div className="relative w-full sm:w-44 shrink-0">
                                 <div className="bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer shadow-sm active:scale-95 transition-all">
                                   {statusFilter === 'ALL' ? 'SEMUA STATUS' : statusFilter.toUpperCase()}
                                   <Icons.ChevronDown className="w-3.5 h-3.5" />
                                   <select 
                                    value={statusFilter} 
                                    onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentEmpPage(1); }}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                   >
                                      <option value="Aktif">AKTIF</option>
                                      <option value="Resign">RESIGN</option>
                                      <option value="ALL">SEMUA STATUS</option>
                                   </select>
                                 </div>
                              </div>
                            </div>
                          )}
                          <div className="relative flex-grow w-full bg-white rounded-full shadow-md border border-slate-100 px-6 py-3 flex items-center gap-4 sm:gap-6">
                            <Icons.Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 shrink-0" />
                            <input 
                              type="text" 
                              placeholder="CARI NAMA ATAU ID..." 
                              value={searchQuery}
                              onChange={(e) => { setSearchQuery(e.target.value); setCurrentEmpPage(1); }}
                              className="w-full text-xs sm:text-sm font-black text-black outline-none placeholder:text-slate-300 uppercase tracking-widest bg-transparent"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-start w-full mt-2">
                          <button onClick={handleDownloadTemplate} className="bg-[#e2e8f0] hover:bg-slate-300 text-slate-600 px-5 py-3 rounded-full flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all shadow-sm active:scale-95">
                            <Icons.Download className="w-4 h-4" /> TEMPLATE
                          </button>
                          {(userRole === 'owner' || userRole === 'super' || userRole === 'admin') && (
                            <button onClick={() => { setEditingEmployee(null); setIsFormOpen(true); }} className="bg-[#FFC000] hover:bg-black text-black hover:text-white px-8 py-3 rounded-full flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-amber-100 active:scale-95">
                              <Icons.Plus className="w-4 h-4" /> TAMBAH
                            </button>
                          )}
                          <input type="file" ref={employeeFileInputRef} onChange={handleImportEmployees} className="hidden" accept=".xlsx,.xls" />
                          <button onClick={() => employeeFileInputRef.current?.click()} disabled={isImportingEmployees} className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-3 rounded-full flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-50">
                            <Icons.Upload className="w-4 h-4" /> {isImportingEmployees ? '...' : 'UNGGAH'}
                          </button>
                          <div className="flex gap-2">
                            <button onClick={handleExportAllEmployees} className="bg-[#0f172a] hover:bg-black text-white p-3 rounded-full flex items-center justify-center shadow-md active:scale-95" title="Export Database">
                              <Icons.Database className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div className="py-32 text-center flex flex-col items-center gap-6 animate-in fade-in duration-1000">
                      <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center shadow-inner">
                        <Icons.Database className="w-12 h-12" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">Database Masih Kosong</p>
                        <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto">Silakan klik tombol <span className="text-emerald-500 font-black">UNGGAH</span> untuk mengimpor file Excel atau klik <span className="text-amber-500 font-black">TAMBAH</span> untuk input manual.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[1400px]">
                        <div className="grid grid-cols-11 bg-slate-50 text-slate-500 text-[8px] uppercase font-bold tracking-[0.15em] border-b border-slate-100 px-14 py-4 sticky top-0 z-10">
                          <div className="col-span-1 flex items-center gap-1">
                            <Icons.Edit className="w-2.5 h-2.5" />
                            <span>ID KARYAWAN</span>
                          </div>
                          <div className="col-span-2">NAMA KARYAWAN</div>
                          <div className="col-span-1">LOKASI KERJA</div>
                          <div className="col-span-1">DIVISI</div>
                          <div className="col-span-1">JABATAN</div>
                          <div className="col-span-1">STATUS</div>
                          <div className="col-span-1">TANGGAL MULAI KERJA</div>
                          <div className="col-span-1">KONTRAK BERAKHIR</div>
                          <div className="col-span-1">SALDO CUTI</div>
                          <div className="col-span-1 text-right">AKSI</div>
                        </div>
                        <div className="bg-white">
                          {paginatedEmployeesList.map((emp, index) => {
                            const isEven = index % 2 === 1;
                            return (
                              <div key={emp.id} className={`hover:bg-slate-100/50 transition-all duration-300 border-b border-slate-50 last:border-0 ${isResigned(emp) ? 'opacity-60 grayscale-[0.5]' : ''} ${isEven ? 'bg-slate-50/50' : 'bg-white'}`}>
                                <div className="md:hidden p-6 flex items-center justify-between relative group overflow-hidden">
                                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-rose-500 rounded-r-full shadow-[2px_0_10px_rgba(244,63,94,0.3)]"></div>
                                  <div className="flex-1 min-w-0" onClick={() => handleViewEmployee(emp)}>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-tight truncate pl-2">{emp.nama}</p>
                                      {isResigned(emp) && <span className="text-[7px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full uppercase tracking-widest">RESIGN</span>}
                                    </div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-2 mt-0.5 truncate">{emp.jabatan}</p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="bg-[#f1f5f9] text-slate-600 font-black text-[10px] uppercase px-4 py-2 rounded-full tracking-[0.1em] border border-slate-200/50 shadow-sm">{emp.idKaryawan}</span>
                                    <div className="flex gap-1.5 ml-2">
                                       {userRole !== 'employee' && (
                                         <button onClick={() => handleEditEmployee(emp)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><Icons.Edit className="w-4 h-4" /></button>
                                       )}
                                    </div>
                                  </div>
                                </div>
                                <div className="hidden md:grid grid-cols-11 items-center px-14 py-4 gap-4">
                                  <div className="col-span-1 flex items-center gap-2">
                                    {userRole !== 'employee' && (
                                      <button onClick={() => handleEditEmployee(emp)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                        <Icons.Edit className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <span className="inline-block bg-slate-50 text-slate-700 font-black text-[9px] uppercase px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-sm">{emp.idKaryawan}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-900 text-[11px] uppercase truncate cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleViewEmployee(emp)}>{emp.nama}</p>
                                      {isResigned(emp) && <span className="text-[7px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full uppercase tracking-widest">RESIGN</span>}
                                    </div>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 uppercase">{emp.lokasiKerja || 'Head Office'}</p>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 uppercase">{emp.division || '-'}</p>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 uppercase">{emp.jabatan || '-'}</p>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 uppercase">{emp.statusKaryawan || 'Tetap'}</p>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 uppercase">{emp.tanggalMasuk || '-'}</p>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 uppercase">{emp.resigned_at || '-'}</p>
                                  </div>
                                  <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-800 font-mono">
                                      {(() => {
                                        const tenure = getTenureYears(emp.tanggalMasuk);
                                        if (tenure < 1) return '0 Hari';
                                        
                                        const name = emp.nama.toLowerCase();
                                        let adjustment = 0;
                                        if (name.includes('fikry aditya rizky')) adjustment = 2;
                                        else if (name.includes('iskandar juliana')) adjustment = 3;
                                        else if (name.includes('adinda salsabilla')) adjustment = 3;
                                        else if (name.includes('pajar sidik')) adjustment = 1;

                                        const used = attendanceRecords.filter(r => 
                                          r.employeeId === emp.id && 
                                          r.status === 'Cuti' && 
                                          new Date(r.date).getFullYear() === new Date().getFullYear()
                                        ).length;
                                        
                                        return `${Math.max(0, 12 - used - adjustment)} Hari`;
                                      })()}
                                    </p>
                                  </div>
                                  <div className="col-span-1 text-right">
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => handleViewEmployee(emp)} className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-all active:scale-90 border border-transparent shadow-sm bg-white" title="Info Karyawan"><Icons.Info className="w-4 h-4" /></button>
                                      {isHighAdminAccess && <button onClick={() => handleDeleteEmployee(emp.id)} className="p-2.5 text-rose-500 hover:bg-rose-100 rounded-xl transition-all active:scale-90 border border-transparent shadow-sm bg-white" title="Hapus Karyawan"><Icons.Trash className="w-4 h-4" /></button>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {totalEmpPages > 1 && (
                    <div className="px-8 sm:px-14 py-10 flex items-center justify-between border-t border-slate-100 bg-white">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Halaman</span>
                        <span className="text-xs font-black text-slate-900 px-4 py-2 bg-slate-50 rounded-full border border-slate-200">{currentEmpPage} / {totalEmpPages}</span>
                      </div>
                      <div className="flex gap-3">
                        <button disabled={currentEmpPage === 1} onClick={() => setCurrentEmpPage(prev => prev - 1)} className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm active:scale-95"><Icons.ChevronDown className="w-5 h-5 rotate-90" /></button>
                        <button disabled={currentEmpPage === totalEmpPages} onClick={() => setCurrentEmpPage(prev => prev + 1)} className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30 flex items-center justify-center transition-all shadow-sm active:scale-95"><Icons.ChevronDown className="w-5 h-5 -rotate-90" /></button>
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
                  attendanceRecords={attendanceRecords} 
                  shiftAssignments={shiftAssignments} 
                  onNavigate={setActiveTab} 
                  userCompany={userCompany} 
                  onOpenBroadcast={() => setIsAnnouncementOpen(true)} 
                  onOpenDrive={handleOpenDrive}
                  onViewProfile={handleViewEmployee}
                  shifts={shifts}
                  onRefreshData={() => fetchData(session?.user?.email, true)}
                />
              )}
            </main>
          </>
        )
      ) : (
        <div className="flex-grow flex items-center justify-center p-6 animate-in fade-in duration-700 bg-white">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="bg-black p-12 text-center"><img src={VISIBEL_LOGO} alt="Logo" className="w-[180px] h-auto mx-auto" /></div>
            <form onSubmit={(e) => { e.preventDefault(); handleAuth(loginEmailInput, loginPasswordInput, isRegisterMode, isForgotPasswordMode); }} className="p-10 space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-[#0f172a] text-center uppercase tracking-[0.3em]">{isForgotPasswordMode ? 'RESET' : isRegisterMode ? 'TRIAL 7 HARI' : 'LOGIN'}</h2>
                {isRegisterMode && <p className="text-[9px] text-center font-black text-amber-500 uppercase tracking-widest">Daftar sekarang & coba gratis 7 hari!</p>}
              </div>
              <div className="space-y-6">
                {isRegisterMode && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">NAMA PERUSAHAAN</label>
                    <input required type="text" value={registerCompanyName} onChange={(e) => setRegisterCompanyName(e.target.value)} placeholder="PT. VISIBEL DIGITAL INDONESIA" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#FFC000] text-sm font-medium text-black transition-all" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">EMAIL {isRegisterMode ? 'ADMIN' : 'TERDAFTAR'}</label>
                  <input required type="email" value={loginEmailInput} onChange={(e) => setLoginEmailInput(e.target.value)} placeholder="admin@visibel.id" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#FFC000] text-sm font-medium text-black transition-all" />
                </div>
                {!isForgotPasswordMode && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">KATA SANDI</label>
                    <div className="relative">
                      <input required type={showPassword ? 'text' : 'password'} value={loginPasswordInput} onChange={(e) => setLoginPasswordInput(e.target.value)} placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#FFC000] text-sm font-medium text-black transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search className="w-5 h-5" /></button>
                    </div>
                  </div>
                )}
              </div>
              {authError && <p className="text-xs text-red-600 text-center font-bold">{authError}</p>}
              <button disabled={isAuthLoading} type="submit" className="w-full bg-[#0f172a] text-white py-5 rounded-3xl font-bold text-xs uppercase tracking-[0.4em] shadow-xl hover:bg-black transition-all">
                {isAuthLoading ? 'MENGHUBUNGKAN...' : isRegisterMode ? 'DAFTAR TRIAL' : 'MASUK'}
              </button>
              <div className="text-center flex flex-col gap-4 pt-2">
                <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setIsForgotPasswordMode(false); setRegisterCompanyName(''); }} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors">{isRegisterMode ? 'KEMBALI KE LOGIN' : 'DAFTAR TRIAL 7 HARI'}</button>
                {!isRegisterMode && <button type="button" onClick={() => setIsForgotPasswordMode(!isForgotPasswordMode)} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">{isForgotPasswordMode ? 'KEMBALI KE LOGIN' : 'LUPA PASSWORD?'}</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className={`pt-4 pb-12 sm:py-16 shrink-0 border-none transition-colors duration-700 ${session ? 'bg-[#f8fafc]' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-8">
          <img src={VISIBEL_LOGO} alt="Logo" className={`h-10 sm:h-12 transition-all duration-700 ${session ? 'opacity-20 grayscale brightness-0' : 'opacity-80'}`} />
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
             <button onClick={() => setLegalType('contact')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">Hubungi Kami</button>
             <button onClick={() => setLegalType('privacy')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">Kebijakan Privasi</button>
             <button onClick={() => setLegalType('tos')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">Syarat & Ketentuan</button>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-center text-slate-300">&copy; 2026 VISIBEL ID • SISTEM MANAJEMEN</p>
        </div>
      </footer>

      {isFormOpen && <EmployeeForm employees={employees} initialData={editingEmployee} userRole={userRole} userCompany={userCompany} currentUserEmployee={currentUserEmployee} onSave={async (emp) => { 
        const { error } = await supabase.from('employees').upsert(emp); 
        if (error) {
          alert("Gagal menyimpan data: " + error.message);
          return;
        }
        fetchData(session?.user?.email, true); 
        setIsFormOpen(false); 
      }} onCancel={() => setIsFormOpen(false)} />}
      {viewingEmployee && <EmployeeDetailModal employee={viewingEmployee} userRole={userRole} onClose={() => setViewingEmployee(null)} onUpdate={() => fetchData(session?.user?.email, true)} />}
      {slipEmployee && <SalarySlipModal employee={slipEmployee} attendanceRecords={attendanceRecords} userRole={userRole} onClose={() => setSlipEmployee(null)} onUpdate={() => fetchData(session?.user?.email, true)} weeklyHolidays={weeklyHolidays} positionRates={positionRates} />}
      {isBulkSalaryOpen && <BulkSalaryModal employees={filteredEmployees} attendanceRecords={attendanceRecords} userRole={userRole} company={userCompany} weeklyHolidays={weeklyHolidays} onClose={() => setIsBulkSalaryOpen(false)} positionRates={positionRates} />}
      {isAnnouncementOpen && <AnnouncementModal employees={filteredEmployees} company={userCompany} onClose={() => setIsAnnouncementOpen(false)} onSuccess={() => fetchData(session?.user?.email, true)} />}
      {legalType && <LegalModal type={legalType} onClose={() => setLegalType(null)} />}
      {session && !isUnregistered && <MobileNav />}
    </div>
  );
};

export default App;
