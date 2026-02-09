
import React, { useMemo, useState, useEffect } from 'react';
import { Employee, AttendanceRecord, ContentPlan, LiveReport } from '../types';
import { Icons } from '../constants';
import { supabase } from '../App';

interface KPIModuleProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  contentPlans: ContentPlan[];
  liveReports: LiveReport[];
  userRole: string;
  currentEmployee: Employee | null;
  company: string;
  onClose: () => void;
}

interface CustomCriteria {
  id: string;
  name: string;
  weight: number;
}

interface KPISystemData {
  criteria: CustomCriteria[];
  attendanceWeight: number;
  contentWeight: number;
  gmvWeight: number;
  scores: Record<string, Record<string, Record<string, number>>>; // YYYY-MM -> employeeId -> criteriaId -> score
}

const KPIModule: React.FC<KPIModuleProps> = ({ 
  employees, 
  attendanceRecords, 
  contentPlans, 
  liveReports, 
  userRole, 
  currentEmployee, 
  company, 
  onClose 
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [kpiSystem, setKpiSystem] = useState<KPISystemData>({ 
    criteria: [], 
    attendanceWeight: 25, 
    contentWeight: 25, 
    gmvWeight: 25, 
    scores: {} 
  });
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  
  const [scoringEmployee, setScoringEmployee] = useState<Employee | null>(null);
  const [tempScores, setTempScores] = useState<Record<string, number>>({});

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const isAdmin = userRole !== 'employee';
  // HANYA super admin dan owner yang bisa merubah penilaian manual
  const isHighAdmin = userRole === 'owner' || userRole === 'super';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    fetchKpiSystem();
  }, [company]);

  const fetchKpiSystem = async () => {
    setIsLoadingSystem(true);
    try {
      const targetCompany = isOwner && companyFilter !== 'ALL' ? companyFilter : company;
      const { data, error } = await supabase.from('settings').select('value').eq('key', `kpi_system_${targetCompany}`).single();
      if (data) {
        const val = data.value;
        setKpiSystem({
          criteria: val.criteria || [],
          attendanceWeight: val.attendanceWeight ?? 25,
          contentWeight: val.contentWeight ?? 25,
          gmvWeight: val.gmvWeight ?? 25,
          scores: val.scores || {}
        });
      }
    } catch (e) {
      console.warn("No KPI system config found.");
    } finally {
      setIsLoadingSystem(false);
    }
  };

  const saveKpiSystem = async (newData: KPISystemData) => {
    try {
      const targetCompany = isOwner && companyFilter !== 'ALL' ? companyFilter : company;
      const { error } = await supabase.from('settings').upsert({
        key: `kpi_system_${targetCompany}`,
        value: newData
      }, { onConflict: 'key' });
      if (error) throw error;
      setKpiSystem(newData);
    } catch (err: any) {
      alert("Gagal menyimpan data KPI: " + err.message);
    }
  };

  const openScoring = (emp: Employee) => {
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const currentScores = kpiSystem.scores[monthKey]?.[emp.id] || {};
    setScoringEmployee(emp);
    setTempScores(currentScores);
  };

  const handleSaveScores = () => {
    if (!scoringEmployee) return;
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const updatedScores = { ...kpiSystem.scores };
    
    if (!updatedScores[monthKey]) updatedScores[monthKey] = {};
    updatedScores[monthKey][scoringEmployee.id] = tempScores;

    const updatedSystem = { ...kpiSystem, scores: updatedScores };
    saveKpiSystem(updatedSystem);
    setScoringEmployee(null);
  };

  const uniqueCompanies = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.company))).filter(Boolean);
  }, [employees]);

  const targetEmployees = useMemo(() => {
    let list = employees;
    if (!isAdmin && currentEmployee) {
      list = [currentEmployee];
    } else {
      if (isOwner && companyFilter !== 'ALL') {
        list = list.filter(e => e.company === companyFilter);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(e => e.nama.toLowerCase().includes(q) || e.idKaryawan.toLowerCase().includes(q));
      }
    }
    return list;
  }, [employees, isAdmin, currentEmployee, companyFilter, searchQuery, isOwner]);

  const kpiData = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    // Perhitungan Rentang Tanggal Kehadiran (29 - 28)
    const attStart = new Date(selectedYear, selectedMonth - 1, 29);
    const attEnd = new Date(selectedYear, selectedMonth, 28);
    attStart.setHours(0,0,0,0);
    attEnd.setHours(23,59,59,999);

    // Perhitungan Rentang Tanggal Konten (Cut off 25)
    // Berarti periode adalah 26 bulan lalu sampai 25 bulan ini
    const contentStart = new Date(selectedYear, selectedMonth - 1, 26);
    const contentEnd = new Date(selectedYear, selectedMonth, 25);
    contentStart.setHours(0,0,0,0);
    contentEnd.setHours(23,59,59,999);

    return targetEmployees.map(emp => {
      // Logic Presensi (29-28)
      const monthRecords = attendanceRecords.filter(r => {
        const d = new Date(r.date);
        return r.employeeId === emp.id && d >= attStart && d <= attEnd;
      });
      const presentDays = monthRecords.filter(r => r.status === 'Hadir').length;
      const attendanceScore = monthRecords.length > 0 ? (presentDays / monthRecords.length) * 100 : 0;

      // Logic Konten (Cut off tgl 25, Target 50 video)
      const monthContent = contentPlans.filter(p => {
        if (!p.postingDate) return false;
        const d = new Date(p.postingDate);
        return p.creatorId === emp.id && d >= contentStart && d <= contentEnd;
      });
      const contentCount = monthContent.length;

      // Logic Live GMV (Mengikuti bulan kalender standar)
      const monthLive = liveReports.filter(l => {
        const d = new Date(l.tanggal);
        return l.hostId === emp.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const totalGMV = monthLive.reduce((sum, l) => sum + (l.gmv || 0), 0);

      const manualScoresList = kpiSystem.criteria.map(c => ({
        ...c,
        score: kpiSystem.scores[monthKey]?.[emp.id]?.[c.id] || 0
      }));

      const isHost = (emp.jabatan || '').toUpperCase().includes('HOST');
      const isCreator = (emp.jabatan || '').toUpperCase().includes('CREATOR');
      
      // WEIGHTED SCORE CALCULATION
      const attW = kpiSystem.attendanceWeight || 0;
      const contW = kpiSystem.contentWeight || 0;
      const gmvW = kpiSystem.gmvWeight || 0;

      let weightedSum = (attendanceScore * (attW / 100));
      let totalWeightUsed = attW;

      if (isCreator) {
        const contentScore = Math.min(100, (contentCount / 50) * 100);
        weightedSum += (contentScore * (contW / 100));
        totalWeightUsed += contW;
      }
      
      if (isHost) {
        const gmvScore = Math.min(100, (totalGMV / 10000000) * 100);
        weightedSum += (gmvScore * (gmvW / 100));
        totalWeightUsed += gmvW;
      }
      
      manualScoresList.forEach(m => {
        weightedSum += (m.score * (m.weight / 100));
        totalWeightUsed += m.weight;
      });

      // Normalize if total weight isn't 100%
      const finalScore = totalWeightUsed > 0 ? weightedSum * (100 / totalWeightUsed) : 0;

      return {
        ...emp,
        attendanceScore,
        presentDays,
        contentCount,
        totalGMV,
        isHost,
        isCreator,
        manualScoresList,
        finalScore
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }, [targetEmployees, attendanceRecords, contentPlans, liveReports, selectedMonth, selectedYear, kpiSystem]);

  const totalPages = Math.ceil(kpiData.length / itemsPerPage);
  const paginatedKpiData = useMemo(() => {
    return kpiData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [kpiData, currentPage, itemsPerPage]);

  return (
    <div className="animate-in fade-in duration-500 bg-[#f8fafc] space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="bg-white border rounded-[24px] sm:rounded-[40px] shadow-sm border-slate-100 overflow-hidden">
        <div className="px-5 py-6 sm:px-10 sm:py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">Performance KPI</h2>
              </div>
              <p className="text-[8px] sm:text-[9px] font-bold text-black uppercase tracking-[0.4em]">Monitoring Kinerja Karyawan</p>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {isOwner && (
                <select 
                  value={companyFilter} 
                  onChange={e => { setCompanyFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-[#FFC000] text-black"
                >
                  <option value="ALL">SEMUA COMPANY</option>
                  {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <div className="relative flex-grow md:flex-grow-0 min-w-[150px]">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="CARI NAMA..." 
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-[#FFC000] text-black"
                />
              </div>
              <select 
                value={selectedMonth} 
                onChange={e => { setSelectedMonth(parseInt(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-[#FFC000] text-black"
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select 
                value={selectedYear}
                onChange={e => { setSelectedYear(parseInt(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-[#FFC000] text-black"
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-slate-50/50 p-3 sm:p-4 rounded-[20px] border border-slate-100 flex flex-col justify-center">
              <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Periode Presensi</p>
              <p className="text-[9px] sm:text-[11px] font-black text-slate-900 mt-1">29 Prev - 28 Curr</p>
            </div>
            <div className="bg-slate-50/50 p-3 sm:p-4 rounded-[20px] border border-slate-100 flex flex-col justify-center">
              <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Target Konten</p>
              <p className="text-[9px] sm:text-[11px] font-black text-indigo-600 mt-1">50 Video (Tgl 25)</p>
            </div>
            <div className="bg-slate-900 p-3 sm:p-4 rounded-[20px] border border-white/5 flex flex-col justify-center shadow-xl relative overflow-hidden group shrink-0">
              <div className="relative z-10">
                <p className="text-[7px] sm:text-[8px] font-black text-white/50 uppercase tracking-widest truncate">Avg. Score</p>
                <p className="text-xs sm:text-base font-black text-[#FFC000] leading-none mt-1">
                  {(kpiData.reduce((sum, d) => sum + d.finalScore, 0) / Math.max(1, kpiData.length)).toFixed(1)}%
                </p>
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#FFC000]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee KPI List */}
      <div className="space-y-3 sm:space-y-4">
        {paginatedKpiData.map((data, idx) => (
          <div key={data.id} className="bg-white p-4 sm:p-6 rounded-[28px] sm:rounded-[36px] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden border-2 border-slate-50 shadow-sm bg-slate-50 flex items-center justify-center">
                      {data.photoBase64 ? (
                        <img src={data.photoBase64} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <Icons.Users className="w-5 h-5 text-slate-200" />
                      )}
                    </div>
                    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-slate-900 text-[#FFC000] rounded-full flex items-center justify-center text-[9px] font-black border border-white shadow-sm">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-lg font-black text-black uppercase tracking-tight truncate whitespace-nowrap">{data.nama}</h3>
                      {isHighAdmin && (
                        <button 
                          onClick={() => openScoring(data)}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shrink-0 bg-slate-50"
                          title="Input Nilai Manual"
                        >
                          <Icons.Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate whitespace-nowrap">{data.jabatan} • {data.company}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5 whitespace-nowrap">KPI Score</p>
                  <p className="text-base sm:text-xl font-black text-slate-900 leading-none whitespace-nowrap">{data.finalScore.toFixed(1)}%</p>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
                <div 
                   className={`${data.finalScore >= 75 ? 'bg-emerald-500' : data.finalScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'} h-full transition-all duration-1000`} 
                   style={{ width: `${data.finalScore}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex flex-col items-center bg-slate-50 py-2 rounded-xl border border-slate-100/50">
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 whitespace-nowrap">Presensi</p>
                  <p className="text-[10px] sm:text-xs font-black text-slate-900 whitespace-nowrap">{data.attendanceScore.toFixed(1)}%</p>
                </div>
                <div className={`flex flex-col items-center bg-slate-50 py-2 rounded-xl border border-slate-100/50 ${!data.isCreator ? 'opacity-20' : ''}`}>
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 whitespace-nowrap">Output (Target 50)</p>
                  <p className="text-[10px] sm:text-xs font-black text-slate-900 whitespace-nowrap">{data.isCreator ? `${data.contentCount}` : '-'}</p>
                </div>
                <div className={`flex flex-col items-center bg-slate-50 py-2 rounded-xl border border-slate-100/50 ${!data.isHost ? 'opacity-20' : ''}`}>
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 whitespace-nowrap">Live GMV</p>
                  <p className="text-[10px] sm:text-xs font-black text-slate-900 truncate max-w-full whitespace-nowrap">
                    {data.isHost ? `Rp ${(data.totalGMV / 1000000).toFixed(1)}M` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {kpiData.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-30 bg-white rounded-[40px] border border-dashed border-slate-200">
            <Icons.Sparkles className="w-12 h-12 mx-auto text-slate-200" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Data Tidak Ditemukan</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4 pb-24">
          <button 
            disabled={currentPage === 1}
            onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30 shadow-sm active:scale-90 transition-all"
          >
            <Icons.ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
            {currentPage} / {totalPages}
          </span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30 shadow-sm active:scale-90 transition-all"
          >
            <Icons.ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      )}

      {/* Individual Scoring Modal - ONLY FOR HIGH ADMIN */}
      {scoringEmployee && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-4 z-[310]">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Input Penilaian</h2>
                <p className="text-[#FFC000] text-[8px] font-bold uppercase tracking-[0.3em] mt-1 whitespace-nowrap">{scoringEmployee.nama}</p>
              </div>
              <button onClick={() => setScoringEmployee(null)} className="text-3xl font-light">&times;</button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto flex-grow custom-scrollbar">
              {kpiSystem.criteria.map(crit => (
                <div key={crit.id} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest whitespace-nowrap">{crit.name}</label>
                    <span className="text-xl font-black text-indigo-600">{tempScores[crit.id] || 0}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={tempScores[crit.id] || 0} 
                    onChange={e => setTempScores({ ...tempScores, [crit.id]: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-slate-900 cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    <span>Bobot: {crit.weight}%</span>
                    <span>Sangat Baik</span>
                  </div>
                </div>
              ))}
              {kpiSystem.criteria.length === 0 && (
                <div className="text-center py-10">
                  <Icons.Sparkles className="w-10 h-10 mx-auto text-slate-100 mb-4" />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Belum ada kriteria manual.<br/>Tambahkan di menu Settings.</p>
                </div>
              )}
            </div>
            <div className="p-8 border-t bg-slate-50 flex gap-3">
              <button onClick={handleSaveScores} className="flex-grow bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg">Simpan Nilai</button>
              <button onClick={() => setScoringEmployee(null)} className="bg-white border border-slate-200 text-slate-400 py-4 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIModule;
