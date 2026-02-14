
import React, { useMemo, useState, useEffect } from 'react';
import { Employee } from '../types';
import { Icons } from '../constants';

interface LiveMapModuleProps {
  employees: Employee[];
  userRole: string;
  company: string;
  onClose: () => void;
}

const LiveMapModule: React.FC<LiveMapModuleProps> = ({ employees, company, onClose }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000); // Update tiap 30 detik
    return () => clearInterval(timer);
  }, []);

  const activeTrackingList = useMemo(() => {
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    return employees.filter(emp => {
      if (!emp.lastLocationUpdate || !emp.lastLatitude || !emp.lastLongitude) return false;
      const updateDate = new Date(emp.lastLocationUpdate);
      return updateDate >= tenMinutesAgo;
    }).sort((a, b) => {
      const dateA = new Date(a.lastLocationUpdate!).getTime();
      const dateB = new Date(b.lastLocationUpdate!).getTime();
      return dateB - dateA;
    });
  }, [employees, currentTime]);

  const formatTimeAgo = (isoString: string) => {
    const update = new Date(isoString);
    const diffMs = new Date().getTime() - update.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} m yang lalu`;
    return `${Math.floor(diffMins / 60)} j yang lalu`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 md:rounded-[48px] overflow-hidden shadow-2xl relative animate-in fade-in duration-700">
      <div className="px-6 py-10 bg-white border-b flex flex-col sm:flex-row sm:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="bg-[#0f172a] p-4 rounded-2xl text-white shadow-xl hover:bg-slate-800 transition-all">
            <Icons.Home className="w-6 h-6 text-yellow-400" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">LIVE TRACKING</h2>
            <div className="flex items-center gap-2 mt-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Memantau {activeTrackingList.length} Karyawan Aktif</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        {activeTrackingList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTrackingList.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[36px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group border-l-[12px] border-l-emerald-500">
                <div className="flex items-start justify-between mb-6">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner shrink-0">
                         {emp.photoBase64 ? (
                           <img src={emp.photoBase64} className="w-full h-full object-cover" alt="" />
                         ) : (
                           <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-200">
                              <Icons.Users className="w-6 h-6" />
                           </div>
                         )}
                      </div>
                      <div className="min-w-0">
                         <h3 className="text-sm font-black text-slate-900 uppercase truncate leading-tight">{emp.nama}</h3>
                         <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate">{emp.jabatan}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">ONLINE</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-1">{formatTimeAgo(emp.lastLocationUpdate!)}</p>
                   </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3 border border-slate-100">
                   <div className="flex items-center gap-3">
                      <Icons.MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                        Lat: {emp.lastLatitude?.toFixed(6)} | Lon: {emp.lastLongitude?.toFixed(6)}
                      </p>
                   </div>
                </div>

                <div className="flex gap-2">
                   <a 
                    href={`https://www.google.com/maps?q=${emp.lastLatitude},${emp.lastLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#0f172a] text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 shadow-lg"
                   >
                     <Icons.MapPin className="w-4 h-4 text-emerald-400" /> LIHAT DI GOOGLE MAPS
                   </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 opacity-40">
             <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center">
                <Icons.MapPin className="w-10 h-10 text-slate-400" />
             </div>
             <div className="space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Belum Ada Lokasi Aktif</p>
                <p className="text-[10px] text-slate-300 font-bold max-w-xs uppercase tracking-widest">Pastikan karyawan sudah mengaktifkan Live Tracking di Dashboard mereka.</p>
             </div>
          </div>
        )}
      </div>
      
      <div className="p-8 border-t bg-white shrink-0">
         <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-center gap-5">
            <Icons.AlertCircle className="w-8 h-8 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-800 font-bold leading-relaxed uppercase">
              Pelacakan hanya berjalan jika karyawan membuka tab aplikasi HR.Visibel di HP mereka. Data akan otomatis offline jika aplikasi ditutup atau browser masuk ke mode hemat daya.
            </p>
         </div>
      </div>
    </div>
  );
};

export default LiveMapModule;
