import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { createClient, Session } from '@supabase/supabase-js';
import { Employee, AttendanceRecord, LiveSchedule, Submission, Broadcast, ContentPlan } from './types.ts';
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
import { getTenureYears, calculateTenure } from './utils/dateUtils.ts';

// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rcrtknakiwvfkmnwvdvf.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type ActiveTab = 'employees' | 'absen' | 'attendance' | 'schedule' | 'content' | 'submissions' | 'inbox';
type UserRole = 'super' | 'admin' | 'employee';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [currentUserEmployee, setCurrentUserEmployee] = useState<Employee | null>(null);
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const savedTab = localStorage.getItem('visibel_active_tab');
    return (savedTab as ActiveTab) || 'employees';
  });

  const [attendanceStartDate, setAttendanceStartDate] = useState(getTodayStr());
  const [attendanceEndDate, setAttendanceEndDate] = useState(getTodayStr());

  const syncAttendanceDates = () => {
    const today = getTodayStr();
    setAttendanceStartDate(today);
    setAttendanceEndDate(today);
  };

  useEffect(() => {
    localStorage.setItem('visibel_active_tab', activeTab);
  }, [activeTab]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [liveSchedules, setLiveSchedules] = useState<LiveSchedule[]>([]);
  const [contentPlans, setContentPlans] = useState<ContentPlan[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isAttendanceDropdownOpen, setIsAttendanceDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [slipEmployee, setSlipEmployee] = useState<Employee | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const employeeFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth >= 640 && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAttendanceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const getRoleBasedOnEmail = (email: string): UserRole => {
    const emailLower = email.toLowerCase();
    if (emailLower === 'muhammadmahardhikadib@gmail.com' || emailLower === 'rezaajidharma@gmail.com') return 'super';
    if (emailLower === 'fikryadityar93@gmail.com' || emailLower === 'ariyansyah02122002@gmail.com') return 'admin';
    return 'employee';
  };

  const fetchData = async (userEmail?: string, isSilent: boolean = false) => {
    if (!isSilent) setIsLoadingData(true);
    setFetchError(null);
    try {
      if (isSilent) syncAttendanceDates();

      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, idKaryawan, nama, jabatan, email, avatarUrl, tanggalMasuk, hutang, tempatLahir, tanggalLahir, alamat, noKtp, noHandphone, bank, noRekening, namaDiRekening, photoBase64, salaryConfig');
      
      if (empError) throw empError;
      const allEmployees = empData || [];
      setEmployees(allEmployees);

      let currentEmp: Employee | null = null;
      const targetEmail = userEmail || session?.user?.email;
      let role: UserRole = 'employee';
      
      if (targetEmail) {
        currentEmp = allEmployees.find(e => e.email?.toLowerCase() === targetEmail.toLowerCase()) || null;
        setCurrentUserEmployee(currentEmp);
        role = getRoleBasedOnEmail(targetEmail);
        setUserRole(role);
        
        if (role === 'employee' && activeTab === 'employees') {
          setActiveTab('absen');
        }
      }

      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('id, employeeId, date, status, clockIn, clockOut, notes')
        .order('date', { ascending: false });
      if (attError) throw attError;
      setAttendanceRecords(attData || []);

      let subQuery = supabase.from('submissions').select('id, employeeId, employeeName, type, startDate, endDate, notes, status, submittedAt').order('submittedAt', { ascending: false });
      if (role === 'employee' && currentEmp) {
        subQuery = subQuery.eq('employeeId', currentEmp.id);
      }
      const { data: subData, error: subError } = await subQuery;
      if (!subError) setSubmissions(subData || []);

      const { data: brdData, error: brdError } = await supabase.from('broadcasts').select('id, title, message, targetEmployeeIds, sentAt').order('sentAt', { ascending: false });
      if (!brdError) setBroadcasts(brdData || []);

      const { data: schData, error: schError } = await supabase.from('schedules').select('*');
      if (!schError) setLiveSchedules(schData || []);

      const { data: cpData, error: cpError } = await supabase.from('content_plans').select('id, title, brand, platform, creatorId, deadline, postingDate, contentPillar, linkPostingan, views, likes, comments, saves, shares, status').order('postingDate', { ascending: false });
      if (!cpError) setContentPlans(cpData || []);

      const { data: holidayData } = await supabase.from('settings').select('value').eq('key', 'weekly_holidays_config').single();
      if (holidayData) setWeeklyHolidays(holidayData.value);
      
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setFetchError("Gagal memuat data. Periksa koneksi atau kuota egress Supabase.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchEmployeeDetail = async (id: string): Promise<Employee | null> => {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  };

  const handleEditClick = async (emp: Employee) => {
    const detail = await fetchEmployeeDetail(emp.id);
    if (detail) {
      setEditingEmployee(detail);
      setIsFormOpen(true);
    } else {
      setEditingEmployee(emp);
      setIsFormOpen(true);
    }
  };

  useEffect(() => {
    if (!session) return;

    const subChannel = supabase
      .channel('realtime-updates-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        (payload) => {
          fetchData(session?.user?.email, true);
          if ((userRole === 'super' || userRole === 'admin') && Notification.permission === "granted") {
            new Notification("HR.Visibel: Pengajuan Baru!", {
              body: `Ada pengajuan ${payload.new.type} baru dari ${payload.new.employeeName}.`,
              icon: "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA"
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcasts' },
        (payload) => {
          fetchData(session?.user?.email, true);
          if (currentUserEmployee && payload.new.targetEmployeeIds.includes(currentUserEmployee.id)) {
            if (Notification.permission === "granted") {
              new Notification("Pengumuman Baru!", {
                body: payload.new.title,
                icon: "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA"
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submissions' },
        () => fetchData(session?.user?.email, true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subChannel);
    };
  }, [session, userRole, currentUserEmployee]);

  const handleAuth = async (loginEmail: string, loginPassword?: string, isRegister = false, isReset = false) => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        alert('Tautan pemulihan kata sandi telah dikirim ke email Anda.');
        setIsForgotPasswordMode(false);
      } else if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email: loginEmail,
          password: loginPassword!,
        });
        if (error) throw error;
        alert('Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi atau silakan login.');
        setIsRegisterMode(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword!,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan otentikasi');
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        fetchData(session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        fetchData(session.user.email);
      } else {
        setUserRole('employee');
        setCurrentUserEmployee(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('visibel_active_tab'); 
    setEmployees([]);
    setAttendanceRecords([]);
    setLiveSchedules([]);
    setContentPlans([]);
    setSubmissions([]);
    setBroadcasts([]);
    setWeeklyHolidays({});
    setCurrentUserEmployee(null);
  };

  const handleSave = async (employee: Employee) => {
    try {
      const { error } = await supabase.from('employees').upsert(employee);
      if (error) throw error;
      await fetchData(session?.user?.email, true);
      setIsFormOpen(false);
      setEditingEmployee(null);
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Hapus Karyawan?')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const downloadEmployeeTemplate = () => {
    const templateData = [{
      'ID Karyawan': 'VSB-XXXX',
      'Nama': 'Contoh Nama',
      'Jabatan': 'Staff',
      'Email': 'contoh@visibel.id',
      'Tempat Lahir': 'Jakarta',
      'Tanggal Lahir': '01/01/1990',
      'Alamat': 'Jl. Contoh No. 123',
      'No KTP': '3201xxxxxxxxxxxx',
      'No Handphone': '0812xxxxxxxx',
      'Tanggal Masuk': '01/01/2023',
      'Bank': 'BCA',
      'No Rekening': '1234567890',
      'Nama Di Rekening': 'CONTOH NAMA',
      'Hutang': 0
    }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Karyawan");
    XLSX.writeFile(workbook, `Template_Database_Karyawan.xlsx`);
  };

  const exportEmployees = (targetEmployees?: Employee[]) => {
    const listToExport = targetEmployees || employees;
    const dataToExport = listToExport.map(emp => ({
      'ID Karyawan': emp.idKaryawan,
      'Nama': emp.nama,
      'Jabatan': emp.jabatan,
      'Email': emp.email,
      'Tempat Lahir': emp.tempatLahir,
      'Tanggal Lahir': emp.tanggalLahir,
      'Alamat': emp.alamat,
      'No KTP': emp.noKtp,
      'No Handphone': emp.noHandphone,
      'Tanggal Masuk': emp.tanggalMasuk,
      'Bank': emp.bank,
      'No Rekening': emp.noRekening,
      'Nama Di Rekening': emp.namaDiRekening,
      'Hutang': emp.hutang
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Database Karyawan");
    XLSX.writeFile(workbook, `Database_Karyawan_Visibel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const importEmployees = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const newEmployees: any[] = jsonData.map((row: any) => {
          const idKaryawan = String(row['ID Karyawan'] || '').trim();
          const existingEmployee = employees.find(e => e.idKaryawan === idKaryawan);
          
          return {
            id: existingEmployee ? existingEmployee.id : (row['ID'] || Date.now().toString() + Math.random().toString(36).substr(2, 5)),
            idKaryawan: idKaryawan,
            nama: String(row['Nama'] || '').trim(),
            jabatan: String(row['Jabatan'] || '').trim(),
            email: String(row['Email'] || '').trim(),
            tempatLahir: String(row['Tempat Lahir'] || '').trim(),
            tanggalLahir: String(row['Tanggal Lahir'] || '').trim(),
            alamat: String(row['Alamat'] || '').trim(),
            noKtp: String(row['No KTP'] || '').trim(),
            noHandphone: String(row['No Handphone'] || '').trim(),
            tanggalMasuk: String(row['Tanggal Masuk'] || '').trim(),
            bank: String(row['Bank'] || 'BCA').trim(),
            noRekening: String(row['No Rekening'] || '').trim(),
            namaDiRekening: String(row['Nama Di Rekening'] || '').trim(),
            hutang: Number(row['Hutang'] || 0)
          };
        });

        if (newEmployees.length > 0) {
          const { error } = await supabase.from('employees').upsert(newEmployees, { onConflict: 'id' });
          if (error) throw error;
          alert(`Berhasil memproses ${newEmployees.length} data karyawan!`);
          fetchData(session?.user?.email, true);
        }
      } catch (err: any) {
        alert("Gagal mengimpor data: " + err.message);
      }
      if (employeeFileInputRef.current) employeeFileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const unreadCount = useMemo(() => {
    if (userRole === 'super' || userRole === 'admin') {
      return submissions.filter(s => s.status === 'Pending').length;
    } else if (userRole === 'employee' && currentUserEmployee) {
      const relevantBroadcasts = broadcasts.filter(b => b.targetEmployeeIds.includes(currentUserEmployee!.id));
      const mySubUpdates = submissions.filter(s => s.status !== 'Pending');
      return relevantBroadcasts.length + mySubUpdates.length;
    }
    return 0;
  }, [submissions, broadcasts, userRole, currentUserEmployee]);

  const filteredEmployees = useMemo(() => {
    let baseList = employees;
    if (userRole === 'employee' && currentUserEmployee) {
      baseList = employees.filter(emp => emp.id === currentUserEmployee.id);
    }
    return baseList.filter(emp => 
      emp.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.idKaryawan.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery, userRole, currentUserEmployee]);

  const getUsedLeave = (empId: string) => {
    const currentYear = new Date().getFullYear().toString();
    return attendanceRecords.filter(r => 
      r.employeeId === empId && 
      r.status === 'Cuti' && 
      r.date.startsWith(currentYear)
    ).length;
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden relative border border-slate-200 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-black p-10 text-center">
            <img src="https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA" alt="Logo" className="w-[140px] h-auto mx-auto" />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleAuth(loginEmail, loginPassword, isRegisterMode, isForgotPasswordMode); }} className="p-8 space-y-6">
            <h2 className="text-xl font-bold text-slate-900 text-center uppercase tracking-[0.2em]">
              {isForgotPasswordMode ? 'Reset Password' : isRegisterMode ? 'Daftar Baru' : 'Login'}
            </h2>
            <div className="space-y-2">
              <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Email Terdaftar</label>
              <input required type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@visibel.id" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-normal text-black outline-none focus:ring-2 focus:ring-[#FFC000] text-sm" />
            </div>
            {!isForgotPasswordMode && (
              <div className="space-y-2">
                <label className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Kata Sandi</label>
                <div className="relative">
                  <input required type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-normal text-black outline-none focus:ring-2 focus:ring-[#FFC000] pr-12 text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"><Icons.Search /></button>
                </div>
              </div>
            )}
            {authError && <p className="text-xs font-normal text-red-600 text-center">{authError}</p>}
            
            <button 
              disabled={isAuthLoading} 
              type="submit" 
              className="w-full bg-[#111827] text-white py-6 rounded-3xl font-black text-sm uppercase tracking-[0.3em] shadow-2xl disabled:opacity-50 active:scale-95 transition-all"
            >
              {isAuthLoading ? 'Memproses...' : (isForgotPasswordMode ? 'Kirim Link' : isRegisterMode ? 'Daftar' : 'Masuk')}
            </button>
            
            <div className="text-center pt-2 flex flex-col gap-3">
              <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setIsForgotPasswordMode(false); }} className="text-[9px] font-normal text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors">
                {isRegisterMode ? 'Sudah punya akun? Masuk' : 'Daftar Baru'}
              </button>
              {!isRegisterMode && (
                <button type="button" onClick={() => setIsForgotPasswordMode(!isForgotPasswordMode)} className="text-[9px] font-normal text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors">
                  {isForgotPasswordMode ? 'Kembali ke Masuk' : 'Lupa Password?'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  const isFullscreenModule = (activeTab as string) === 'absen' || (activeTab as string) === 'schedule';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {fetchError && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-3 px-6 z-[100] flex justify-between items-center animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <Icons.Database />
            <p className="text-sm font-bold uppercase tracking-wide">{fetchError}</p>
          </div>
          <button onClick={() => fetchData()} className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-colors shadow-lg">Coba Lagi</button>
        </div>
      )}

      {!isFullscreenModule && (
        <nav className="bg-white border-b sticky top-0 z-40 shadow-sm h-14 sm:h-20">
          <div className="max-w-7xl mx-auto h-full px-2 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
            
            <div className="flex items-center gap-1 sm:gap-3 shrink-0 cursor-pointer" onClick={() => userRole !== 'admin' && setActiveTab('employees')}>
              <img src="https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA" alt="Logo" className="h-6 sm:h-12 w-auto object-contain" />
              <div className="hidden xs:flex flex-col">
                <span className="text-[6px] sm:text-[9px] font-black text-[#FFC000] border border-[#FFC000] rounded px-1 uppercase tracking-tighter bg-white whitespace-nowrap">
                  {userRole === 'super' ? 'SUPER ADMIN' : userRole === 'admin' ? 'ADMIN' : 'KARYAWAN'}
                </span>
              </div>
            </div>

            <div className="flex-1 flex justify-center min-w-0">
              <div className="flex bg-slate-100 p-1 rounded-xl sm:rounded-2xl shadow-inner max-w-full overflow-x-auto sm:overflow-visible no-scrollbar relative z-[10]">
                <button 
                  type="button" 
                  onClick={() => setActiveTab('employees')} 
                  className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap active:scale-95 ${activeTab === 'employees' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {userRole === 'super' ? 'DATABASE' : 'PROFIL'}
                </button>
                
                <div className="relative" ref={dropdownRef}>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAttendanceDropdownOpen(!isAttendanceDropdownOpen);
                    }} 
                    className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase flex items-center gap-1 sm:gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer relative z-[20] ${['absen', 'attendance', 'submissions'].includes(activeTab as any) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    PRESENSI <Icons.ChevronDown className="w-2 sm:w-3" />
                  </button>
                  
                  {isAttendanceDropdownOpen && (
                    <div className="hidden sm:flex absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-[20px] shadow-2xl border border-slate-100 flex-col z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 ring-1 ring-black/5">
                      <button type="button" onClick={() => { setActiveTab('absen'); setIsAttendanceDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 text-slate-700 border-b border-slate-50 transition-colors">ABSEN SEKARANG</button>
                      {(userRole === 'super' || userRole === 'admin') && <button type="button" onClick={() => { setActiveTab('attendance'); setIsAttendanceDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 text-slate-700 border-b border-slate-50 transition-colors">Data Absensi</button>}
                      <button type="button" onClick={() => { setActiveTab('submissions'); setIsAttendanceDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 text-slate-700 transition-colors">FORM PENGAJUAN</button>
                    </div>
                  )}
                </div>

                <button 
                  type="button" 
                  onClick={() => setActiveTab('schedule')} 
                  className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap active:scale-95 ${activeTab === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  JADWAL
                </button>
                <button 
                  type="button" 
                  onClick={() => setActiveTab('content')} 
                  className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap active:scale-95 ${activeTab === 'content' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  CONTENT
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button 
                type="button" 
                onClick={() => setActiveTab('inbox')} 
                className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition-all relative active:scale-95 ${activeTab === 'inbox' ? 'bg-slate-900 text-[#FFC000]' : 'bg-slate-100 text-slate-500'}`}
              >
                <Icons.Mail className="w-3 sm:w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[5px] sm:text-[8px] w-2.5 sm:w-4 h-2.5 sm:h-4 flex items-center justify-center rounded-full border border-white font-bold">{unreadCount}</span>
                )}
              </button>

              <div className="relative group">
                <button type="button" className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-100 text-slate-500 group-focus-within:bg-white group-focus-within:border group-focus-within:border-slate-200 transition-all active:scale-95">
                  <Icons.Search className="w-3 sm:w-4" />
                </button>
                <input 
                  type="text" 
                  placeholder="CARI..." 
                  className="absolute right-0 top-0 h-full w-0 group-focus-within:w-24 sm:group-focus-within:w-48 group-focus-within:pr-8 pl-2 opacity-0 group-focus-within:opacity-100 bg-white sm:bg-transparent text-[8px] sm:text-[10px] font-bold text-black outline-none transition-all rounded-lg sm:rounded-none shadow-xl sm:shadow-none" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>

              <button 
                type="button" 
                onClick={handleLogout} 
                className="p-1.5 sm:p-2.5 text-slate-400 hover:text-red-500 transition-all active:scale-95"
              >
                <Icons.LogOut className="w-3 sm:w-4" />
              </button>
            </div>
          </div>
        </nav>
      )}

      {isAttendanceDropdownOpen && (
        <div className="sm:hidden fixed inset-0 z-[1000] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsAttendanceDropdownOpen(false)}>
          <div className="bg-white rounded-t-[32px] p-6 space-y-3 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"></div>
            <button type="button" onClick={() => { setActiveTab('absen'); setIsAttendanceDropdownOpen(false); }} className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 active:bg-amber-50 active:scale-95 transition-all">
              <Icons.Camera className="w-4 h-4 text-[#FFC000]" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Absen Sekarang</span>
            </button>
            {(userRole === 'super' || userRole === 'admin') && (
              <button type="button" onClick={() => { setActiveTab('attendance'); setIsAttendanceDropdownOpen(false); }} className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 active:bg-cyan-50 active:scale-95 transition-all">
                <Icons.Calendar className="w-4 h-4 text-cyan-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Data Absensi</span>
              </button>
            )}
            <button type="button" onClick={() => { setActiveTab('submissions'); setIsAttendanceDropdownOpen(false); }} className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 active:bg-emerald-50 active:scale-95 transition-all">
              <Icons.FileText className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Form Pengajuan</span>
            </button>
            <button type="button" onClick={() => setIsAttendanceDropdownOpen(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tutup</button>
          </div>
        </div>
      )}

      <main className={`flex-grow w-full relative ${isFullscreenModule ? 'bg-white p-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8'}`}>
        {activeTab === 'inbox' ? (
          <Inbox submissions={submissions} broadcasts={broadcasts} employee={currentUserEmployee} userRole={userRole} onUpdate={() => fetchData(session?.user?.email, true)} />
        ) : activeTab === 'absen' ? (
          <AbsenModule employee={currentUserEmployee} attendanceRecords={attendanceRecords} onSuccess={() => fetchData(session?.user?.email, true)} onClose={() => setActiveTab('employees')} />
        ) : activeTab === 'attendance' ? (
          <AttendanceModule 
            employees={employees} 
            records={attendanceRecords} 
            setRecords={setAttendanceRecords} 
            searchQuery={searchQuery} 
            userRole={userRole} 
            currentEmployee={currentUserEmployee}
            startDate={attendanceStartDate}
            endDate={attendanceEndDate}
            onStartDateChange={setAttendanceStartDate}
            onEndDateChange={setAttendanceEndDate}
            weeklyHolidays={weeklyHolidays}
          />
        ) : activeTab === 'schedule' ? (
          <LiveScheduleModule employees={employees} schedules={liveSchedules} setSchedules={setLiveSchedules} searchQuery={searchQuery} readOnly={userRole === 'employee'} onClose={() => setActiveTab('employees')} />
        ) : activeTab === 'content' ? (
          <ContentModule employees={employees} plans={contentPlans} setPlans={setContentPlans} searchQuery={searchQuery} userRole={userRole} currentEmployee={currentUserEmployee} />
        ) : activeTab === 'submissions' ? (
          <SubmissionForm employee={currentUserEmployee} onSuccess={() => fetchData(session?.user?.email, true)} />
        ) : (
          <>
            <Dashboard 
              employees={employees} 
              submissions={submissions} 
              broadcasts={broadcasts} 
              userRole={userRole} 
              currentUserEmployee={currentUserEmployee} 
              weeklyHolidays={weeklyHolidays}
            />
            <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100 overflow-hidden relative">
              <div className="px-6 sm:px-10 py-6 sm:py-8 border-b flex justify-between items-center bg-white flex-wrap gap-4 sm:gap-6">
                <div>
                  <h2 className="font-bold text-slate-900 uppercase tracking-tighter text-lg sm:text-xl leading-none">{userRole === 'super' ? 'DATABASE KARYAWAN' : 'DATA DIRI'}</h2>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 sm:mt-2 inline-block bg-slate-50 px-3 py-1 rounded-full">{filteredEmployees.length} ENTRI</span>
                </div>
                {userRole === 'super' && (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <button onClick={() => window.open('https://drive.google.com/drive/folders/1ccXLNRsTJuOyFe0F2RGq-EP6Zi5xotFV?usp=sharing', '_blank')} className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-black shadow-sm uppercase tracking-widest flex items-center gap-1.5 sm:gap-2.5 transition-all">
                      <Icons.Video className="w-3 h-3 sm:w-4 h-4" /> DRIVE
                    </button>
                    <button onClick={downloadEmployeeTemplate} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-semibold shadow-sm uppercase tracking-widest flex items-center gap-1.5 sm:gap-2.5 transition-colors">
                      <Icons.Download className="w-3 h-3 sm:w-4 h-4" /> TEMPLATE
                    </button>
                    <button onClick={() => setIsFormOpen(true)} className="bg-[#FFC000] hover:bg-[#E6AD00] text-black px-4 py-2.5 rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 font-bold shadow-sm text-[9px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer">
                      <Icons.Plus className="w-3 h-3 sm:w-4 h-4" /> TAMBAH
                    </button>
                    <button onClick={() => employeeFileInputRef.current?.click()} className="bg-emerald-600 text-white px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest shadow-lg flex items-center gap-1.5 sm:gap-2.5 hover:bg-emerald-700">
                      <Icons.Upload className="w-3 h-3 sm:w-4 h-4" /> UNGGAH
                    </button>
                    <input type="file" ref={employeeFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={importEmployees} />
                    <button onClick={() => exportEmployees()} className="bg-slate-900 text-white px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest shadow-xl flex items-center gap-1.5 sm:gap-2.5 hover:bg-black">
                      <Icons.Database className="w-3 h-3 sm:w-4 h-4" /> EKSPOR
                    </button>
                    <button onClick={() => setIsAnnouncementOpen(true)} className="bg-slate-900 text-white px-3 sm:px-4 py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-semibold uppercase flex items-center gap-1.5 sm:gap-2.5 hover:bg-black transition-all">
                      <Icons.Megaphone className="w-3 h-3 sm:w-4 h-4" /> BROADCAST
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-900 text-[10px] sm:text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 sm:px-8 py-4 sm:py-6">ID KARYAWAN</th>
                      <th className="px-4 sm:px-6 py-4 sm:py-6">NAMA KARYAWAN</th>
                      <th className="px-4 py-4 sm:py-6 hidden sm:table-cell">MASA KERJA</th>
                      <th className="px-4 py-4 sm:py-6">CUTI</th>
                      <th className="px-6 sm:px-10 py-4 sm:py-6 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredEmployees.map((emp) => {
                      const tenureYears = getTenureYears(emp.tanggalMasuk);
                      const usedLeave = getUsedLeave(emp.id);
                      const leaveDisplay = tenureYears >= 1 ? `${usedLeave} / 12` : '0 / 0';
                      const isNearlyUsedUp = tenureYears >= 1 && usedLeave > 10;
                      
                      const canEdit = userRole === 'super' || emp.id === currentUserEmployee?.id;
                      const canViewSlip = userRole === 'super' || emp.id === currentUserEmployee?.id;

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 sm:px-8 py-4 sm:py-6">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 tracking-wider bg-slate-100 px-2 sm:px-3 py-1 rounded-lg uppercase">{emp.idKaryawan}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 sm:py-6">
                            <div className="flex items-center gap-2 sm:gap-4">
                              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center shrink-0">
                                {emp.photoBase64 || emp.avatarUrl ? (
                                  <img src={emp.photoBase64 || emp.avatarUrl} className="w-full h-full object-cover" alt="" />
                                ) : null}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight text-[11px] sm:text-xs uppercase">{emp.nama}</p>
                                <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 sm:mt-1">{emp.jabatan}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 sm:py-6 hidden sm:table-cell">
                            <p className="text-[11px] font-semibold text-slate-600 uppercase leading-relaxed">{calculateTenure(emp.tanggalMasuk)}</p>
                          </td>
                          <td className="px-4 py-4 sm:py-6">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold border flex items-center justify-center min-w-[50px] sm:min-w-[60px] ${tenureYears < 1 ? 'bg-slate-50 text-slate-400 border-slate-100' : isNearlyUsedUp ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {leaveDisplay}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 sm:px-10 py-4 sm:py-6 text-right">
                            <div className="flex justify-end gap-1 sm:gap-2">
                              {canViewSlip && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setSlipEmployee(emp); }} className="p-1.5 sm:p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-lg sm:rounded-xl transition-colors cursor-pointer" title="Slip Gaji"><Icons.Download className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                              )}
                              {canEdit && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleEditClick(emp); }} className="p-1.5 sm:p-2.5 text-cyan-600 hover:bg-cyan-50 rounded-lg sm:rounded-xl transition-all cursor-pointer" title="Edit Data"><Icons.Edit className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                              )}
                              {userRole === 'super' && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.id); }} className="p-1.5 sm:p-2.5 text-red-500 hover:bg-red-50 rounded-lg sm:rounded-xl transition-colors cursor-pointer" title="Hapus Data"><Icons.Trash className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
      {isFormOpen && (
        <EmployeeForm employees={employees} initialData={editingEmployee} userRole={userRole} onSave={handleSave} onCancel={() => { setIsFormOpen(false); setEditingEmployee(null); }} />
      )}
      {slipEmployee && <SalarySlipModal employee={slipEmployee} attendanceRecords={attendanceRecords} onClose={() => setSlipEmployee(null)} onUpdate={() => fetchData(session?.user?.email, true)} weeklyHolidays={weeklyHolidays} />}
      {isAnnouncementOpen && <AnnouncementModal employees={employees} onClose={() => setIsAnnouncementOpen(false)} onSuccess={() => fetchData(session?.user?.email, true)} />}
    </div>
  );
};

export default App;