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

// --- KONFIGURASI SUPABASE AMAN ---
// Menggunakan pengecekan typeof untuk menghindari crash jika process.env hilang
const getEnv = (key: string, fallback: string) => {
  try {
    return (typeof process !== 'undefined' && process.env && process.env[key]) || fallback;
  } catch (e) {
    return fallback;
  }
};

const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://rcrtknakiwvfkmnwvdvf.supabase.co');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcnRrbmFraXd2Zmttbnd2ZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEyODYsImV4cCI6MjA4NTIzNzI4Nn0.Ca9m25c9K0_J_kCRphGSaECGs8CGz4-zUpVoA_rIERA');

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
    const savedTab = typeof localStorage !== 'undefined' ? localStorage.getItem('visibel_active_tab') : null;
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
      setFetchError("Gagal memuat data. Periksa koneksi atau variabel lingkungan Supabase.");
    } finally {
      setIsLoadingData(false);
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
        alert('Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi.');
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('visibel_active_tab'); 
    setEmployees([]);
    setAttendanceRecords([]);
    setLiveSchedules([]);
    setContentPlans([]);
    setSubmissions([]);
    setBroadcasts([]);
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

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-500">
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
      {!isFullscreenModule && (
        <nav className="bg-white border-b sticky top-0 z-40 shadow-sm h-14 sm:h-20">
          <div className="max-w-7xl mx-auto h-full px-2 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-3 shrink-0 cursor-pointer" onClick={() => userRole !== 'admin' && setActiveTab('employees')}>
              <img src="https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA" alt="Logo" className="h-6 sm:h-12 w-auto object-contain" />
              <span className="hidden xs:inline-block text-[6px] sm:text-[9px] font-black text-[#FFC000] border border-[#FFC000] rounded px-1 uppercase tracking-tighter bg-white">
                {userRole === 'super' ? 'SUPER ADMIN' : userRole === 'admin' ? 'ADMIN' : 'KARYAWAN'}
              </span>
            </div>
            <div className="flex-1 flex justify-center min-w-0">
              <div className="flex bg-slate-100 p-1 rounded-xl sm:rounded-2xl shadow-inner max-w-full overflow-x-auto no-scrollbar relative z-[10]">
                <button type="button" onClick={() => setActiveTab('employees')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap ${activeTab === 'employees' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>DATABASE</button>
                <button type="button" onClick={() => setActiveTab('absen')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap ${activeTab === 'absen' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>ABSEN</button>
                <button type="button" onClick={() => setActiveTab('schedule')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap ${activeTab === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>JADWAL</button>
                <button type="button" onClick={() => setActiveTab('content')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[10px] font-black tracking-widest transition-all uppercase whitespace-nowrap ${activeTab === 'content' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>CONTENT</button>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button type="button" onClick={() => setActiveTab('inbox')} className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition-all relative ${activeTab === 'inbox' ? 'bg-slate-900 text-[#FFC000]' : 'bg-slate-100 text-slate-500'}`}>
                <Icons.Mail className="w-3 sm:w-4" />
              </button>
              <button type="button" onClick={handleLogout} className="p-1.5 sm:p-2.5 text-slate-400 hover:text-red-500 transition-all">
                <Icons.LogOut className="w-3 sm:w-4" />
              </button>
            </div>
          </div>
        </nav>
      )}

      <main className={`flex-grow w-full relative ${isFullscreenModule ? 'bg-white p-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8'}`}>
        {activeTab === 'inbox' ? (
          <Inbox submissions={submissions} broadcasts={broadcasts} employee={currentUserEmployee} userRole={userRole} onUpdate={() => fetchData(session?.user?.email, true)} />
        ) : activeTab === 'absen' ? (
          <AbsenModule employee={currentUserEmployee} attendanceRecords={attendanceRecords} onSuccess={() => fetchData(session?.user?.email, true)} onClose={() => setActiveTab('employees')} />
        ) : activeTab === 'attendance' ? (
          <AttendanceModule employees={employees} records={attendanceRecords} setRecords={setAttendanceRecords} userRole={userRole} currentEmployee={currentUserEmployee} startDate={attendanceStartDate} endDate={attendanceEndDate} onStartDateChange={setAttendanceStartDate} onEndDateChange={setAttendanceEndDate} weeklyHolidays={weeklyHolidays} />
        ) : activeTab === 'schedule' ? (
          <LiveScheduleModule employees={employees} schedules={liveSchedules} setSchedules={setLiveSchedules} readOnly={userRole === 'employee'} onClose={() => setActiveTab('employees')} />
        ) : activeTab === 'content' ? (
          <ContentModule employees={employees} plans={contentPlans} setPlans={setContentPlans} searchQuery={searchQuery} userRole={userRole} currentEmployee={currentUserEmployee} />
        ) : activeTab === 'submissions' ? (
          <SubmissionForm employee={currentUserEmployee} onSuccess={() => fetchData(session?.user?.email, true)} />
        ) : (
          <>
            <Dashboard employees={employees} submissions={submissions} broadcasts={broadcasts} userRole={userRole} currentUserEmployee={currentUserEmployee} weeklyHolidays={weeklyHolidays} />
            <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
               <div className="px-6 sm:px-10 py-6 sm:py-8 border-b flex justify-between items-center bg-white flex-wrap gap-4">
                 <h2 className="font-bold text-slate-900 uppercase tracking-tighter text-lg sm:text-xl">{userRole === 'super' ? 'DATABASE KARYAWAN' : 'DATA DIRI'}</h2>
                 {userRole === 'super' && (
                   <button onClick={() => setIsFormOpen(true)} className="bg-[#FFC000] hover:bg-[#E6AD00] text-black px-4 py-2.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 font-bold text-[9px] sm:text-[11px] uppercase tracking-widest shadow-sm">
                     <Icons.Plus className="w-3 h-3 sm:w-4 h-4" /> TAMBAH
                   </button>
                 )}
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-[10px] sm:text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                     <tr>
                       <th className="px-6 py-4">ID</th>
                       <th className="px-4 py-4">NAMA</th>
                       <th className="px-4 py-4">JABATAN</th>
                       <th className="px-6 py-4 text-right">AKSI</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {filteredEmployees.map((emp) => (
                       <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 font-bold text-slate-900">{emp.idKaryawan}</td>
                         <td className="px-4 py-4 font-bold text-slate-900">{emp.nama}</td>
                         <td className="px-4 py-4 text-slate-500">{emp.jabatan}</td>
                         <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                             <button type="button" onClick={() => setSlipEmployee(emp)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Icons.Download className="w-4 h-4" /></button>
                             {(userRole === 'super' || emp.id === currentUserEmployee?.id) && (
                               <button type="button" onClick={() => { setEditingEmployee(emp); setIsFormOpen(true); }} className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg"><Icons.Edit className="w-4 h-4" /></button>
                             )}
                             {userRole === 'super' && (
                               <button type="button" onClick={() => handleDeleteEmployee(emp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Icons.Trash className="w-4 h-4" /></button>
                             )}
                           </div>
                         </td>
                       </tr>
                     ))}
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