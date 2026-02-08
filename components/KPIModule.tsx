
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

const VISIBEL_LOGO = "https://lh3.googleusercontent.com/d/1aGXJp0RwVbXlCNxqL_tAfHS5dc23h7nA";
const SELLER_SPACE_LOGO = "https://lh3.googleusercontent.com/d/1Hh5302qSr_fEcas9RspSPtZDYBM7ZC-w";

interface CustomCriteria {
  id: string;
  name: string;
}

interface KPISystemData {
  criteria: CustomCriteria[];
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
  
  // Custom Criteria & Scores State
  const [kpiSystem, setKpiSystem] = useState<KPISystemData>({ criteria: [], scores: {} });
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  const [isManagingCriteria, setIsManagingCriteria] = useState(false);
  const [newCriteriaName, setNewCriteriaName] = useState('');
  
  // Scoring State
  const [scoringEmployee, setScoringEmployee] = useState<Employee | null>(null);
  const [tempScores, setTempScores] = useState<Record<string, number>>({});

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const isAdmin = userRole !== 'employee';
  const isHighAdmin = userRole === 'owner' || userRole === 'super';
  const currentLogo = (company || '').toLowerCase() === 'seller space' ? SELLER_SPACE_LOGO : VISIBEL_LOGO;

  useEffect(() => {
    fetchKpiSystem();
  }, [company]);

  const fetchKpiSystem = async () => {
    setIsLoadingSystem(true);
    try {
      const { data, error } = await supabase.from('settings').select('value').eq('key', `kpi_system_${company}`).single();
      if (data) setKpiSystem(data.value);
    } catch (e) {
      console.warn("No KPI system config found for this company.");
    } finally {
      setIsLoadingSystem(false);
    }
  };

  const saveKpiSystem = async (newData: KPISystemData) => {
    try {
      const { error } = await supabase.from('settings').upsert({
        key: `kpi_system_${company}`,
        value: newData
      }, { onConflict: 'key' });
      if (error) throw error;
      setKpiSystem(newData);
    } catch (err: any) {
      alert("Gagal menyimpan kriteria: " + err.message);
    }
  };

  const handleAddCriteria = () => {
    if (!newCriteriaName.trim()) return;
    const newCriteria: CustomCriteria = {
      id: `crit-${Date.now()}`,
      name: newCriteriaName.trim().toUpperCase()
    };
    const updated = { ...kpiSystem, criteria: [...kpiSystem.criteria, newCriteria] };
    saveKpiSystem(updated);
    setNewCriteriaName('');
  };

  const handleDeleteCriteria = (id: string) => {
    if (!confirm('Hapus kriteria ini? Nilai yang sudah ada juga akan terhapus.')) return;
    const updated = { ...kpiSystem, criteria: kpiSystem.criteria.filter(c => c.id !== id) };
    saveKpiSystem(updated);
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

  const targetEmployees = useMemo(() => {
    if (!isAdmin && currentEmployee) return [currentEmployee];
    return employees;
  }, [employees, isAdmin, currentEmployee]);

  const kpiData = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    return targetEmployees.map(emp => {
      // 1. Attendance KPI
      const monthRecords = attendanceRecords.filter(r => {
        const d = new Date(r.date);
        return r.employeeId === emp.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const presentDays = monthRecords.filter(r => r.status === 'Hadir').length;
      const attendanceScore = monthRecords.length > 0 ? (presentDays / monthRecords.length) * 100 : 0;

      // 2. Content KPI
      const monthContent = contentPlans.filter(p => {
        if (!p.postingDate) return false;
        const d = new Date(p.postingDate);
        return p.creatorId === emp.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const contentCount = monthContent.length;

      // 3. Live KPI (GMV)
      const monthLive = liveReports.filter(l => {
        const d = new Date(l.tanggal);
        return l.hostId === emp.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const totalGMV = monthLive.reduce((sum, l) => sum + (l.gmv || 0), 0);

      // Manual Criteria Logic
      const manualScoresList = kpiSystem.criteria.map(c => ({
        ...c,
        score: kpiSystem.scores[monthKey]?.[emp.id]?.[c.id] || 0
      }));

      const avgManualScore = manualScoresList.length > 0 
        ? manualScoresList.reduce((sum, c) => sum + c.score, 0) / manualScoresList.length 
        : 100;

      // Determine roles
      const isHost = (emp.jabatan || '').toUpperCase().includes('HOST');
      const isCreator = (emp.jabatan || '').toUpperCase().includes('CREATOR');
      const isBizDev = (emp.jabatan || '').toUpperCase().includes('BUSINESS DEVELOPMENT');

      // Final Combined Score Calculation
      let totalPoints = attendanceScore;
      let count = 1;
      
      if (isCreator) {
        totalPoints += Math.min(100, contentCount * 10);
        count++;
      }
      if (isHost || isBizDev) {
        totalPoints += Math.min(100, (totalGMV / 10000000) * 100);
        count++;
      }
      
      // Add manual criteria to average
      if (kpiSystem.criteria.length > 0) {
        totalPoints += avgManualScore;
        count++;
      }

      const finalScore = totalPoints / count;

      return {
        ...emp,
        attendanceScore,
        presentDays,
        contentCount,
        totalGMV,
        isHost,
        isCreator,
        isBizDev,
        manualScoresList,
        finalScore
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }, [targetEmployees, attendanceRecords, contentPlans, liveReports, selectedMonth, selectedYear, kpiSystem]);

  return (
    <div className="animate-in fade-in duration-500 bg-[#f8fafc]">
      {/* Header Section */}
      <div className="bg-white border rounded-[32px] sm:rounded-[40px] shadow-sm border-slate-100 overflow-hidden mb-8">
        <div className="px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <img src={currentLogo} alt="Logo" className="h-8 sm:h-12 w-auto shrink-0" />
                <div className="h-8 w-px bg-slate-100 hidden sm:block"></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight truncate">PERFORMANCE KPI</h2>
                    {isHighAdmin && (
                      <button 
                        onClick={() => setIsManagingCriteria(true)}
                        className="p-1.5 bg-[#FFC000] text-black rounded-lg shadow-sm hover:bg-black hover:text-[#FFC000] transition-all active:scale-90"
                      >
                        <Icons.Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Indikator Kinerja Karyawan</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 px-4 py-3 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-[#FFC000] text-black"
              >
                {months.map((m, i) => <option key={m} value={i} className="text-black">{m}</option>)}
              </select>
              <select 
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 px-4 py-3 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-[#FFC000] text-black"
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y} className="text-black">{y}</option>)}
              </select>
            </div>
          </div>

          {/* Highlight Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50/50 p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border border-slate-100 flex items-center gap-4 transition-all hover:bg-slate-50">
              <div className="bg-white p-3 rounded-2xl text-emerald-500 shadow-sm border border-slate-50"><Icons.Camera className="w-5 h-5 sm:w-6 sm:h-6" /></div>
              <div>
                <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Avg. Presence</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                  {(kpiData.reduce((sum, d) => sum + d.attendanceScore, 0) / Math.max(1, kpiData.length)).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="bg-slate-50/50 p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border border-slate-100 flex items-center gap-4 transition-all hover:bg-slate-50">
              <div className="bg-white p-3 rounded-2xl text-indigo-500 shadow-sm border border-slate-50"><Icons.Image className="w-5 h-5 sm:w-6 sm:h-6" /></div>
              <div>
                <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Content Output</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                  {kpiData.reduce((sum, d) => sum + d.contentCount, 0)} Posts
                </p>
              </div>
            </div>
            <div className="bg-slate-900 p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border border-white/5 flex items-center gap-4 shadow-xl relative overflow-hidden group">
              <div className="bg-white/10 p-3 rounded-2xl text-[#FFC000] relative z-10 transition-transform group-hover:scale-110"><Icons.Sparkles className="w-5 h-5 sm:w-6 sm:h-6" /></div>
              <div className="relative z-10">
                <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Total Impact</p>
                <p className="text-xl sm:text-2xl font-black text-[#FFC000] leading-none">
                  Rp {(kpiData.reduce((sum, d) => sum + d.totalGMV, 0) / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFC000]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee KPI List */}
      <div className="grid grid-cols-1 gap-6 pb-20">
        {kpiData.map((data, idx) => (
          <div key={data.id} className="bg-white p-6 sm:p-8 rounded-[36px] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[24px] sm:rounded-[28px] overflow-hidden border-2 border-slate-50 shadow-md bg-slate-50">
                      {data.photoBase64 ? <img src={data.photoBase64} className="w-full h-full object-cover" alt="" /> : <Icons.Users className="w-full h-full p-4 text-slate-200" />}
                    </div>
                    <div className="absolute -top-2 -left-2 w-7 h-7 bg-slate-900 text-[#FFC000] rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight truncate">{data.nama}</h3>
                      {isHighAdmin && (
                        <button 
                          onClick={() => openScoring(data)}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Input Nilai Kriteria Manual"
                        >
                          <Icons.Sparkles className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{data.jabatan}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Overall Rank</p>
                  <p className="text-lg font-black text-slate-900 leading-none">{data.finalScore.toFixed(1)}%</p>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="flex flex-col gap-3">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 shadow-inner">
                  <div className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, data.attendanceScore)}%` }}></div>
                  {data.isCreator && (
                    <div className="bg-indigo-500 h-full shadow-[0_0_8px_rgba(99,102,241,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, data.contentCount * 10)}%` }}></div>
                  )}
                  {(data.isHost || data.isBizDev) && (
                    <div className="bg-[#FFC000] h-full shadow-[0_0_8px_rgba(255,192,0,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, (data.totalGMV / 10000000) * 100)}%` }}></div>
                  )}
                </div>

                {/* Values Footer */}
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Presensi</p>
                    <p className={`text-xs sm:text-sm font-black ${data.attendanceScore >= 90 ? 'text-emerald-600' : 'text-slate-900'}`}>{data.attendanceScore.toFixed(1)}%</p>
                  </div>
                  <div className={`text-center transition-opacity ${data.isCreator ? 'opacity-100' : 'opacity-20'}`}>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Konten</p>
                    <p className="text-xs sm:text-sm font-black text-indigo-600">{data.isCreator ? data.contentCount : '-'}</p>
                  </div>
                  <div className={`text-center transition-opacity ${(data.isHost || data.isBizDev) ? 'opacity-100' : 'opacity-20'}`}>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Live GMV</p>
                    <p className="text-xs sm:text-sm font-black text-emerald-600 truncate">
                      {(data.isHost || data.isBizDev) ? `Rp ${(data.totalGMV / 1000).toFixed(0)}K` : '-'}
                    </p>
                  </div>
                </div>

                {/* Custom Qualitative Criteria Section */}
                {data.manualScoresList.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-x-6 gap-y-2">
                    {data.manualScoresList.map(crit => (
                      <div key={crit.id} className="flex items-center gap-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{crit.name}:</span>
                        <span className="text-[10px] font-black text-slate-900">{crit.score}/100</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {kpiData.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-30 bg-white rounded-[40px] border">
            <Icons.Sparkles className="w-16 h-16 mx-auto text-slate-200" />
            <p className="text-xs font-black uppercase tracking-[0.4em]">Belum Ada Data KPI Bulan Ini</p>
          </div>
        )}
      </div>

      {/* Criteria Management Modal */}
      {isManagingCriteria && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md flex items-center justify-center p-4 z-[300]">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight leading-none">Management KPI</h2>
                <p className="text-black/60 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Tambah Kriteria Penilaian</p>
              </div>
              <button onClick={() => setIsManagingCriteria(false)} className="text-3xl font-light">&times;</button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto flex-grow custom-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kriteria Baru (Contoh: SIKAP)</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={newCriteriaName} 
                    onChange={e => setNewCriteriaName(e.target.value)} 
                    placeholder="NAMA KRITERIA..." 
                    className="flex-grow bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:border-[#FFC000]" 
                  />
                  <button onClick={handleAddCriteria} className="bg-slate-900 text-[#FFC000] p-4 rounded-2xl shadow-lg active:scale-90"><Icons.Plus className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Daftar Kriteria Kustom</h3>
                <div className="space-y-3">
                  {kpiSystem.criteria.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{c.name}</span>
                      <button onClick={() => handleDeleteCriteria(c.id)} className="text-rose-500 hover:bg-rose-100 p-2 rounded-lg transition-all"><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {kpiSystem.criteria.length === 0 && (
                    <p className="text-center py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic opacity-50">Belum ada kriteria tambahan</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-8 border-t bg-slate-50">
              <button onClick={() => setIsManagingCriteria(false)} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest">Selesai</button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Scoring Modal */}
      {scoringEmployee && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-4 z-[310]">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b bg-[#0f172a] text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight leading-none">Update Nilai KPI</h2>
                <p className="text-[#FFC000] text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{scoringEmployee.nama} • {months[selectedMonth]} {selectedYear}</p>
              </div>
              <button onClick={() => setScoringEmployee(null)} className="text-3xl font-light">&times;</button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto flex-grow custom-scrollbar">
              {kpiSystem.criteria.map(crit => (
                <div key={crit.id} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">{crit.name}</label>
                    <span className="text-lg font-black text-indigo-600">{tempScores[crit.id] || 0}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={tempScores[crit.id] || 0} 
                    onChange={e => setTempScores({ ...tempScores, [crit.id]: parseInt(e.target.value) })}
                    className="w-full accent-[#0f172a]"
                  />
                  <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-tighter">
                    <span>BURUK</span>
                    <span>STANDAR</span>
                    <span>EXCELLENT</span>
                  </div>
                </div>
              ))}
              {kpiSystem.criteria.length === 0 && (
                <div className="text-center py-10 space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Silakan tambahkan kriteria manual terlebih dahulu di menu management KPI.</p>
                  <button onClick={() => { setScoringEmployee(null); setIsManagingCriteria(true); }} className="text-[10px] font-black text-[#FFC000] bg-slate-900 px-6 py-2 rounded-full uppercase">Update Kriteria</button>
                </div>
              )}
            </div>
            <div className="p-8 border-t bg-slate-50 flex gap-4">
              <button onClick={handleSaveScores} className="flex-grow bg-emerald-600 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95">Simpan Nilai</button>
              <button onClick={() => setScoringEmployee(null)} className="px-8 bg-white border border-slate-200 text-slate-400 py-5 rounded-3xl font-black text-xs uppercase tracking-widest">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIModule;
