import React, { useState, useMemo, useEffect } from 'react';
import { Employee, CalendarEvent } from '../types';
import { Icons } from '../constants';
import { parseFlexibleDate, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { supabase } from '../App';

interface CalendarModuleProps {
  employees: Employee[];
  userRole: string;
  company: string;
  onClose: () => void;
}

const CalendarModule: React.FC<CalendarModuleProps> = ({ employees, userRole, company, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
  const [formData, setFormData] = useState<Omit<CalendarEvent, 'id'>>({
    title: '',
    description: '',
    date: formatDateToYYYYMMDD(new Date()),
    company: company
  });

  const isOwner = userRole === 'owner';
  const isSuper = userRole === 'super';
  const canEdit = isOwner || isSuper;

  useEffect(() => {
    fetchEvents();
  }, [company]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('company', company);
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.warn("Gagal memuat events. Pastikan tabel 'calendar_events' ada.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (dateStr: string, existing?: CalendarEvent) => {
    if (!canEdit) return;
    if (existing) {
      setEditingEvent(existing);
      setFormData({
        title: existing.title,
        description: existing.description || '',
        date: existing.date,
        company: existing.company
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        date: dateStr,
        company: company
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = editingEvent ? { ...formData, id: editingEvent.id } : formData;
      const { data, error } = await supabase.from('calendar_events').upsert(payload).select();
      if (error) throw error;
      
      setEvents(prev => {
        if (editingEvent) return prev.map(ev => ev.id === editingEvent.id ? data[0] : ev);
        return [data[0], ...prev];
      });
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Gagal menyimpan event: " + err.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Hapus reminder ini?')) return;
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
      setEvents(prev => prev.filter(ev => ev.id !== id));
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const calendarDays = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const days = [];
    const firstDay = startDayOfMonth(month, year);
    
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthCount = daysInMonth(prevMonth, prevYear);
    
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthCount - i, month: prevMonth, year: prevYear, current: false });
    }
    
    const count = daysInMonth(month, year);
    for (let i = 1; i <= count; i++) {
      days.push({ day: i, month, year, current: true });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({ day: i, month: nextMonth, year: nextYear, current: false });
    }
    
    return days;
  }, [currentDate]);

  const monthBirthdays = useMemo(() => {
    const month = currentDate.getMonth();
    return employees.filter(emp => {
      const bday = parseFlexibleDate(emp.tanggalLahir);
      return bday.getMonth() === month;
    });
  }, [employees, currentDate]);

  const changeMonth = (offset: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + offset);
    setCurrentDate(next);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 px-4 sm:px-0">
      <div className="bg-white rounded-[40px] sm:rounded-[48px] p-6 sm:p-12 shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8 sm:mb-12">
          <div className="flex items-center gap-4 sm:gap-6">
             <div className="bg-[#0f172a] p-3.5 sm:p-5 rounded-[20px] sm:rounded-3xl text-[#FFC000] shadow-xl shrink-0">
                <Icons.Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
             </div>
             <div className="min-w-0">
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">Internal Calendar</h2>
                <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.4em] mt-1 sm:mt-3 whitespace-nowrap">Company Events & Birthdays</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
             <div className="flex items-center justify-between bg-slate-50 p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-inner">
                <button onClick={() => changeMonth(-1)} className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-90">
                   <Icons.ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 rotate-90" />
                </button>
                <div className="text-center">
                   <h3 className="text-lg sm:text-2xl font-black text-[#0f172a] uppercase tracking-widest">{monthNames[currentDate.getMonth()]}</h3>
                   <p className="text-xs sm:text-sm font-bold text-slate-400">{currentDate.getFullYear()}</p>
                </div>
                <button onClick={() => changeMonth(1)} className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-90">
                   <Icons.ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 -rotate-90" />
                </button>
             </div>

             <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"].map(d => (
                  <div key={d} className="text-center py-2 text-[8px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest">{d}</div>
                ))}
                {calendarDays.map((dateObj, idx) => {
                  const dateStr = formatDateToYYYYMMDD(new Date(dateObj.year, dateObj.month, dateObj.day));
                  const dayEvents = events.filter(e => e.date === dateStr);
                  const bdays = dateObj.current ? monthBirthdays.filter(emp => parseFlexibleDate(emp.tanggalLahir).getDate() === dateObj.day) : [];
                  const isToday = dateObj.current && dateObj.day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleOpenModal(dateStr, dayEvents[0])}
                      className={`aspect-square p-1 sm:p-2 border border-slate-50 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center relative transition-all ${dateObj.current ? 'bg-white hover:bg-slate-50 cursor-pointer' : 'bg-slate-50/30 opacity-20'}`}
                    >
                       <span className={`text-[10px] sm:text-sm font-black ${dateObj.current ? 'text-slate-900' : 'text-slate-300'} ${isToday ? 'bg-[#FFC000] text-black w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shadow-lg shadow-amber-100' : ''}`}>{dateObj.day}</span>
                       
                       <div className="absolute bottom-1 flex gap-0.5 sm:gap-1">
                          {bdays.length > 0 && (
                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                          )}
                          {dayEvents.length > 0 && (
                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>
                          )}
                       </div>

                       {dayEvents.length > 0 && dateObj.current && (
                         <div className="hidden sm:block absolute top-1 left-1 right-1">
                            <p className="text-[6px] font-black text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded truncate uppercase">{dayEvents[0].title}</p>
                         </div>
                       )}
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Sembunyikan blok ini di mobile agar lebih rapi */}
          <div className="hidden lg:block space-y-8">
             <div className="bg-[#FFFBEB] p-8 rounded-[40px] border border-amber-100 shadow-sm">
                <h4 className="text-[11px] font-black text-[#806000] uppercase tracking-[0.2em] mb-6">Ulang Tahun & Reminder</h4>
                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                   {/* BIRTHDAYS */}
                   {monthBirthdays.map(emp => {
                     const bday = parseFlexibleDate(emp.tanggalLahir);
                     return (
                       <div key={emp.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-50 flex items-center gap-4 group hover:shadow-md transition-all">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform">
                             <Icons.Cake className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                             <p className="text-[11px] font-black text-slate-900 uppercase truncate leading-tight mb-1">{emp.nama}</p>
                             <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">HBD: {bday.getDate()} {monthNames[bday.getMonth()]}</p>
                          </div>
                       </div>
                     );
                   })}

                   {/* EVENTS/REMINDERS */}
                   {events.filter(e => {
                     const d = new Date(e.date);
                     return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
                   }).map(ev => (
                     <div 
                       key={ev.id} 
                       onClick={() => handleOpenModal(ev.date, ev)}
                       className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-50 flex items-center gap-4 group hover:shadow-md transition-all cursor-pointer"
                     >
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
                           <Icons.Bell className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[11px] font-black text-slate-900 uppercase truncate leading-tight mb-1">{ev.title}</p>
                           <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{new Date(ev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                        </div>
                     </div>
                   ))}

                   {monthBirthdays.length === 0 && events.length === 0 && (
                     <div className="text-center py-10 opacity-30">
                        <Icons.Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tidak ada agenda</p>
                     </div>
                   )}
                </div>
             </div>

             <div className="bg-[#0f172a] p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#FFC000] rounded-lg text-black group-hover:rotate-12 transition-transform">
                         <Icons.Bell className="w-4 h-4" />
                      </div>
                      <h4 className="text-[10px] font-black text-[#FFC000] uppercase tracking-[0.3em]">Reminder Feature</h4>
                   </div>
                   <p className="text-sm font-medium leading-relaxed opacity-80">
                     {canEdit ? 'Klik pada tanggal di kalender untuk menambah atau mengedit pengingat (Reminder).' : 'Gunakan kalender ini untuk memantau agenda perusahaan dan ulang tahun rekan kerja.'}
                   </p>
                </div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mb-10 -mr-10 transition-transform group-hover:scale-150 duration-700"></div>
             </div>
          </div>
        </div>
      </div>

      {/* REMINDER MODAL */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-8 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
               <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">{editingEvent ? 'Edit Reminder' : 'Tambah Reminder'}</h2>
                  <p className="text-black/60 text-[9px] font-bold uppercase tracking-widest">{new Date(formData.date).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-3xl font-light">&times;</button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-8 space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Agenda</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value.toUpperCase()})}
                    placeholder="CONTOH: MEETING BULANAN"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black text-black outline-none focus:border-[#FFC000] transition-all"
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan (Opsional)</label>
                  <textarea 
                    rows={3}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detail agenda..."
                    className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-medium text-slate-700 outline-none focus:border-[#FFC000] transition-all resize-none"
                  />
               </div>

               <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-slate-900 text-[#FFC000] py-6 rounded-[28px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Simpan</button>
                  {editingEvent && (
                    <button type="button" onClick={() => handleDeleteEvent(editingEvent.id!)} className="bg-rose-50 text-rose-500 px-6 rounded-[28px] font-black uppercase text-xs active:scale-95 transition-all border border-rose-100">Hapus</button>
                  )}
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarModule;