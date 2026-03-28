import React, { useState, useMemo, useEffect } from 'react';
import { Employee, CalendarEvent } from '../types';
import { Icons } from '../constants';
import { parseFlexibleDate, formatDateToYYYYMMDD } from '../utils/dateUtils';
import { supabase } from '../services/supabaseClient';
import { useConfirmation } from '../contexts/ConfirmationContext';

interface CalendarModuleProps {
  employees: Employee[];
  userRole: string;
  company: string;
  onClose: () => void;
}

const CalendarModule: React.FC<CalendarModuleProps> = ({ employees, userRole, company, onClose }) => {
  const { confirm } = useConfirmation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  
  const [formData, setFormData] = useState<Omit<CalendarEvent, 'id'>>({
    title: '',
    description: '',
    date: formatDateToYYYYMMDD(new Date()),
    start: '09:00',
    end: '10:00',
    type: 'Meeting',
    color: '#4F46E5',
    company: company,
    employeeIds: []
  });

  const [filterTypes, setFilterTypes] = useState<string[]>(['Meeting', 'Reminder', 'Appointment', 'Birthday', 'Event']);
  const [showBirthdays, setShowBirthdays] = useState(true);

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
        date: existing.date || existing.start?.split('T')[0] || dateStr,
        start: existing.start || '09:00',
        end: existing.end || '10:00',
        type: existing.type || 'Meeting',
        color: existing.color || '#4F46E5',
        company: existing.company,
        employeeIds: existing.employeeIds || []
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        date: dateStr,
        start: '09:00',
        end: '10:00',
        type: 'Meeting',
        color: '#4F46E5',
        company: company,
        employeeIds: []
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

      // 2. Send Notification to targeted employees
      if (formData.employeeIds && formData.employeeIds.length > 0) {
        try {
          await supabase.from('broadcasts').insert([{
            title: `AGENDA BARU: ${formData.title}`,
            message: `Anda memiliki agenda baru pada ${new Date(formData.date).toLocaleDateString('id-ID', { dateStyle: 'full' })} pukul ${formData.start}. Jenis: ${formData.type}.`,
            company: company,
            targetEmployeeIds: formData.employeeIds,
            sentAt: new Date().toISOString()
          }]);

          // WhatsApp logic
          if (sendWhatsApp) {
            const selectedEmployees = employees.filter(emp => formData.employeeIds?.includes(emp.id));
            selectedEmployees.forEach(emp => {
              if (emp.noTelp) {
                const message = `Halo ${emp.nama}, ada agenda baru untuk Anda:\n\n*${formData.title}*\nTanggal: ${new Date(formData.date).toLocaleDateString('id-ID', { dateStyle: 'full' })}\nWaktu: ${formData.start}\nJenis: ${formData.type}\n\nSilakan cek aplikasi HR Visibel untuk detail selengkapnya.`;
                const encodedMsg = encodeURIComponent(message);
                const phone = emp.noTelp.startsWith('0') ? '62' + emp.noTelp.slice(1) : emp.noTelp;
                window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
              }
            });
          }
        } catch (notifErr) {
          console.error("Gagal mengirim notifikasi agenda:", notifErr);
        }
      }

      setIsModalOpen(false);
    } catch (err: any) {
      alert("Gagal menyimpan event: " + err.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Reminder?',
      message: 'Hapus reminder ini?',
      type: 'danger',
      confirmText: 'HAPUS'
    });
    if (!isConfirmed) return;
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

  const typeColors: Record<string, string> = {
    'Meeting': '#4F46E5',
    'Reminder': '#F59E0B',
    'Appointment': '#10B981',
    'Event': '#EC4899',
    'Birthday': '#EF4444',
    'Holiday': '#6366F1',
    'Shift': '#8B5CF6',
    'Live': '#F43F5E'
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* SIDEBAR */}
        <div className="w-full md:w-64 space-y-6 shrink-0">
          <button 
            onClick={() => handleOpenModal(formatDateToYYYYMMDD(new Date()))}
            className="w-full bg-white border-2 border-slate-100 p-4 rounded-3xl flex items-center justify-center gap-3 shadow-sm hover:shadow-md hover:border-[#FFC000] transition-all group"
          >
            <div className="bg-[#FFC000] p-2 rounded-xl text-black group-hover:rotate-12 transition-transform">
              <Icons.Plus className="w-5 h-5" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest">Buat Agenda</span>
          </button>

          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Filter Agenda</h4>
              <div className="space-y-3">
                {Object.keys(typeColors).filter(t => !['Holiday', 'Shift', 'Live'].includes(t)).map(type => (
                  <label key={type} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={filterTypes.includes(type)}
                      onChange={() => {
                        setFilterTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
                        if (type === 'Birthday') setShowBirthdays(!showBirthdays);
                      }}
                      className="hidden"
                    />
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${filterTypes.includes(type) ? 'bg-slate-900 border-slate-900' : 'border-slate-200'}`}>
                      {filterTypes.includes(type) && <Icons.Check className="w-3 h-3 text-[#FFC000]" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColors[type] }}></div>
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-900">{type}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Agenda Mendatang</h4>
              <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                {events
                  .filter(e => new Date(e.date!) >= new Date())
                  .sort((a, b) => a.date!.localeCompare(b.date!))
                  .slice(0, 5)
                  .map(ev => (
                    <div key={ev.id} className="group cursor-pointer" onClick={() => handleOpenModal(ev.date!, ev)}>
                      <p className="text-[10px] font-black text-slate-900 uppercase truncate group-hover:text-[#FFC000] transition-colors">{ev.title}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(ev.date!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {ev.start || '00:00'}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CALENDAR */}
        <div className="flex-1 bg-white rounded-[40px] p-6 sm:p-10 shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
            <div className="flex items-center gap-4">
               <div className="bg-[#0f172a] p-4 rounded-2xl text-[#FFC000] shadow-xl">
                  <Icons.Calendar className="w-6 h-6" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Internal Calendar</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Company Events & Birthdays</p>
               </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-90">
                 <Icons.ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <div className="px-4 text-center min-w-[140px]">
                 <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-widest">{monthNames[currentDate.getMonth()]}</h3>
                 <p className="text-[10px] font-bold text-slate-400">{currentDate.getFullYear()}</p>
              </div>
              <button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-90">
                 <Icons.ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-inner">
            {["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"].map(d => (
              <div key={d} className="bg-slate-50 text-center py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{d}</div>
            ))}
            {calendarDays.map((dateObj, idx) => {
              const dateStr = formatDateToYYYYMMDD(new Date(dateObj.year, dateObj.month, dateObj.day));
              const dayEvents = events.filter(e => e.date === dateStr && filterTypes.includes(e.type || 'Event'));
              const bdays = (dateObj.current && showBirthdays) ? monthBirthdays.filter(emp => parseFlexibleDate(emp.tanggalLahir).getDate() === dateObj.day) : [];
              const isToday = dateObj.current && dateObj.day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
              
              return (
                <div 
                  key={idx} 
                  onClick={() => handleOpenModal(dateStr)}
                  className={`min-h-[120px] p-2 flex flex-col gap-1 relative transition-all ${dateObj.current ? 'bg-white hover:bg-slate-50 cursor-pointer' : 'bg-slate-50/50 opacity-40'}`}
                >
                   <div className="flex justify-between items-center mb-1">
                     <span className={`text-[11px] font-black ${dateObj.current ? 'text-slate-900' : 'text-slate-300'} ${isToday ? 'bg-[#FFC000] text-black w-6 h-6 flex items-center justify-center rounded-full shadow-lg shadow-amber-100' : ''}`}>{dateObj.day}</span>
                   </div>
                   
                   <div className="space-y-1 overflow-y-auto no-scrollbar max-h-[80px]">
                      {bdays.map(emp => (
                        <div key={emp.id} className="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-rose-100">
                          <Icons.Cake className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-black uppercase truncate">{emp.nama}</span>
                        </div>
                      ))}
                      {dayEvents.map(ev => (
                        <div 
                          key={ev.id} 
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(dateStr, ev); }}
                          className="px-2 py-1 rounded-lg flex flex-col border transition-all hover:brightness-95"
                          style={{ 
                            backgroundColor: `${ev.color || typeColors[ev.type || 'Event']}15`, 
                            borderColor: `${ev.color || typeColors[ev.type || 'Event']}30`,
                            color: ev.color || typeColors[ev.type || 'Event']
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: ev.color || typeColors[ev.type || 'Event'] }}></div>
                            <span className="text-[8px] font-black uppercase truncate">{ev.title}</span>
                          </div>
                          {ev.start && <span className="text-[7px] font-bold opacity-70 ml-2">{ev.start}</span>}
                        </div>
                      ))}
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* REMINDER MODAL */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-10 border-b bg-[#FFC000] text-black flex justify-between items-center shrink-0">
               <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">{editingEvent ? 'Edit Agenda' : 'Buat Agenda Baru'}</h2>
                  <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest mt-1">{new Date(formData.date).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-2xl font-light hover:bg-black/10 transition-all">&times;</button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-10 space-y-8 overflow-y-auto max-h-[70vh] no-scrollbar">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Agenda</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value.toUpperCase()})}
                    placeholder="CONTOH: MEETING BULANAN"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] text-sm font-black text-black outline-none focus:border-[#FFC000] transition-all"
                  />
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Agenda</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as any, color: typeColors[e.target.value]})}
                      className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] text-sm font-black text-black outline-none focus:border-[#FFC000] transition-all appearance-none"
                    >
                      {Object.keys(typeColors).filter(t => !['Birthday', 'Holiday', 'Shift', 'Live'].includes(t)).map(t => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Warna Label</label>
                    <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-100 p-4 rounded-[28px]">
                      <input 
                        type="color" 
                        value={formData.color}
                        onChange={e => setFormData({...formData, color: e.target.value})}
                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-[10px] font-black text-slate-400 uppercase">{formData.color}</span>
                    </div>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Mulai</label>
                    <input 
                      type="time" 
                      value={formData.start} 
                      onChange={e => setFormData({...formData, start: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] text-sm font-black text-black outline-none focus:border-[#FFC000] transition-all"
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Selesai</label>
                    <input 
                      type="time" 
                      value={formData.end} 
                      onChange={e => setFormData({...formData, end: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] text-sm font-black text-black outline-none focus:border-[#FFC000] transition-all"
                    />
                 </div>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                  <textarea 
                    rows={4}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detail agenda..."
                    className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] text-sm font-medium text-slate-700 outline-none focus:border-[#FFC000] transition-all resize-none"
                  />
               </div>

               <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ditujukan Untuk (Karyawan)</label>
                    <div className="flex items-center gap-2">
                      <Icons.Search className="w-3 h-3 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="CARI..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="text-[10px] font-black text-slate-900 uppercase bg-transparent border-none outline-none w-24 text-right"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] max-h-48 overflow-y-auto space-y-3 no-scrollbar">
                    {employees.filter(emp => emp.nama.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                      employees.filter(emp => emp.nama.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
                        <label key={emp.id} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={formData.employeeIds?.includes(emp.id)}
                            onChange={() => {
                              const currentIds = formData.employeeIds || [];
                              const newIds = currentIds.includes(emp.id) 
                                ? currentIds.filter(id => id !== emp.id)
                                : [...currentIds, emp.id];
                              setFormData({...formData, employeeIds: newIds});
                            }}
                            className="hidden"
                          />
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${formData.employeeIds?.includes(emp.id) ? 'bg-slate-900 border-slate-900' : 'border-slate-200'}`}>
                            {formData.employeeIds?.includes(emp.id) && <Icons.Check className="w-3 h-3 text-[#FFC000]" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-900">{emp.nama}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{emp.jabatan}</span>
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-4">Tidak ada data karyawan</p>
                    )}
                  </div>
               </div>

               <div className="flex items-center gap-3 ml-1">
                 <button 
                  type="button"
                  onClick={() => setSendWhatsApp(!sendWhatsApp)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${sendWhatsApp ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                 >
                   <Icons.MessageSquare className={`w-3 h-3 ${sendWhatsApp ? 'text-emerald-500' : 'text-slate-400'}`} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Kirim via WhatsApp</span>
                 </button>
               </div>

               <div className="flex gap-4 pt-6">
                  <button type="submit" className="flex-1 bg-slate-900 text-[#FFC000] py-7 rounded-[32px] font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Simpan Agenda</button>
                  {editingEvent && (
                    <button type="button" onClick={() => handleDeleteEvent(editingEvent.id!)} className="bg-rose-50 text-rose-500 px-8 rounded-[32px] font-black uppercase text-xs active:scale-95 transition-all border border-rose-100">Hapus</button>
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