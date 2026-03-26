import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from '../constants';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';

interface SalesRecord {
  id: string;
  company_id: string;
  company_name: string;
  contact_person: string;
  phone_number: string;
  visit_time: string;
  gmaps_link: string;
  visit_result: string;
  follow_up: string;
  client_status: string;
  offering: string;
  offering_details: string;
  company: string;
  photo_url?: string;
}

interface SalesReportProps {
  company: string;
  onClose: () => void;
}

const SalesReport: React.FC<SalesReportProps> = ({ company, onClose }) => {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState<Partial<SalesRecord>>({
    company_id: '',
    company_name: '',
    contact_person: '',
    phone_number: '',
    visit_time: new Date().toISOString().slice(0, 16),
    gmaps_link: '',
    visit_result: '',
    follow_up: '',
    client_status: 'Lead',
    offering: '',
    offering_details: '',
    company: company
  });

  useEffect(() => {
    fetchRecords();
  }, [company]);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sales_visit_records')
        .select('*')
        .eq('company', company)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, company };
      
      if (editingRecord) {
        const { error } = await supabase
          .from('sales_visit_records')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_visit_records')
          .insert([payload]);
        if (error) throw error;
      }

      setIsFormOpen(false);
      setEditingRecord(null);
      setFormData({
        company_id: '',
        company_name: '',
        contact_person: '',
        phone_number: '',
        visit_time: new Date().toISOString().slice(0, 16),
        gmaps_link: '',
        visit_result: '',
        follow_up: '',
        client_status: 'Lead',
        offering: '',
        offering_details: '',
        company: company
      });
      fetchRecords();
    } catch (error) {
      console.error('Error saving record:', error);
      alert('Gagal menyimpan data. Pastikan tabel sales_visit_records sudah dibuat di Supabase.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data ini?')) return;
    try {
      const { error } = await supabase
        .from('sales_visit_records')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  const handleEdit = (record: SalesRecord) => {
    setEditingRecord(record);
    setFormData(record);
    setIsFormOpen(true);
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const handleExport = () => {
    const dataToExport = filteredRecords.map((r, index) => ({
      'NO': index + 1,
      'ID PERUSAHAAN': r.company_id,
      'PERUSAHAAN': r.company_name,
      'CONTACT PERSON': r.contact_person,
      'NO TELEPON / HP': r.phone_number,
      'WAKTU VISIT': r.visit_time,
      'LINK GMAPS': r.gmaps_link,
      'VISIT RESULT': r.visit_result,
      'FOLLOW UP': r.follow_up,
      'STATUS CLIENT': r.client_status,
      'OFFERING': r.offering,
      'KET OFFERING': r.offering_details
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visit Report");
    XLSX.writeFile(workbook, `Visit_Report_${company}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-6 py-8 sm:px-12 sm:py-14 border-b border-slate-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all active:scale-90 group">
              <Icons.ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-900 transition-colors" />
            </button>
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">Sales Visit Report</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{company}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                type="text" 
                placeholder="CARI DATA..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-6 py-4 sm:py-3 bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-full text-sm font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FFC000] transition-all w-full"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleExport} className="flex-1 sm:flex-none flex justify-center items-center p-4 sm:p-3 bg-slate-900 text-white rounded-2xl sm:rounded-full hover:bg-black transition-all active:scale-95 shadow-lg">
                <Icons.Download className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} 
                className="flex-[3] sm:flex-none bg-[#FFC000] text-black px-8 py-4 sm:py-3 rounded-2xl sm:rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
              >
                <Icons.Plus className="w-4 h-4" /> TAMBAH DATA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table / Mobile Cards */}
      <div className="p-0 sm:p-8">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1800px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">No</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Perusahaan</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Perusahaan</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">No Telepon / Hp</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Visit</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Gmaps</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visit Result</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow Up</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Client</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Offering</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ket Offering</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 bg-slate-100 rounded-full" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Memuat Data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Icons.Database className="w-12 h-12" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Belum Ada Data Kunjungan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 text-xs font-bold text-slate-400">{index + 1}</td>
                    <td className="px-6 py-5 text-xs font-black text-slate-900 uppercase">{record.company_id}</td>
                    <td className="px-6 py-5 text-xs font-black text-slate-900 uppercase">{record.company_name}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase">{record.contact_person}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600">{record.phone_number}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600">{record.visit_time}</td>
                    <td className="px-6 py-5 text-xs font-bold text-blue-600 underline truncate max-w-[150px]">
                      <a href={record.gmaps_link} target="_blank" rel="noopener noreferrer">{record.gmaps_link}</a>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600 truncate max-w-[200px]">{record.visit_result}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600 truncate max-w-[150px]">{record.follow_up}</td>
                    <td className="px-6 py-5">
                      <span className="text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-slate-100 text-slate-600">
                        {record.client_status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600">{record.offering}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600 truncate max-w-[200px]">{record.offering_details}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(record)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(record.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3 px-3 pb-10">
          {isLoading ? (
            <div className="py-20 text-center animate-pulse">
              <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Memuat Data...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-20 text-center opacity-20">
              <Icons.Database className="w-12 h-12 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Belum Ada Data Kunjungan</p>
            </div>
          ) : (
            filteredRecords.map((record, index) => (
              <div key={record.id} className="bg-white rounded-[32px] p-5 border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-slate-400">#{index + 1}</span>
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-slate-500 uppercase tracking-tight">
                        {record.company_id}
                      </span>
                    </div>
                    <h4 className="text-[13px] font-black text-slate-900 uppercase leading-tight line-clamp-2">{record.company_name}</h4>
                  </div>
                  <span className={`text-[7px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm border ${
                    record.client_status === 'Closed Won' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    record.client_status === 'Closed Lost' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {record.client_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-50">
                  <div className="space-y-1">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Contact Person</p>
                    <p className="text-[10px] font-bold text-slate-700 uppercase truncate">{record.contact_person}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Waktu Visit</p>
                    <p className="text-[10px] font-bold text-slate-700">{new Date(record.visit_time).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Visit Result</p>
                  <p className="text-[11px] font-medium text-slate-600 line-clamp-3 leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 italic">
                    "{record.visit_result || 'Tidak ada catatan'}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    {record.gmaps_link && (
                      <a 
                        href={record.gmaps_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-9 h-9 flex items-center justify-center bg-blue-50 rounded-xl text-blue-500 border border-blue-100 active:scale-90 transition-transform"
                      >
                        <Icons.MapPin className="w-4 h-4" />
                      </a>
                    )}
                    {record.phone_number && (
                      <a 
                        href={`tel:${record.phone_number}`}
                        className="w-9 h-9 flex items-center justify-center bg-emerald-50 rounded-xl text-emerald-500 border border-emerald-100 active:scale-90 transition-transform"
                      >
                        <Icons.Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(record)} 
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(record.id)} 
                      className="w-9 h-9 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl border border-rose-100 active:scale-90 transition-transform"
                    >
                      <Icons.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingRecord ? 'Edit Kunjungan' : 'Tambah Kunjungan Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 sm:p-10 overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-140px)]">
              <div className="space-y-10">
                {/* Section: Identitas Perusahaan */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Icons.Building className="w-4 h-4 text-[#FFC000]" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Identitas Perusahaan</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Hash className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Perusahaan</label>
                      </div>
                      <input 
                        type="text" 
                        required
                        placeholder="Contoh: CMP-001"
                        value={formData.company_id}
                        onChange={(e) => setFormData({...formData, company_id: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Building className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Perusahaan</label>
                      </div>
                      <input 
                        type="text" 
                        required
                        placeholder="Nama PT / Toko"
                        value={formData.company_name}
                        onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Kontak & Lokasi */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Icons.Phone className="w-4 h-4 text-blue-500" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kontak & Lokasi</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.User className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person</label>
                      </div>
                      <input 
                        type="text" 
                        required
                        placeholder="Nama PIC"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Phone className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Telepon / HP</label>
                      </div>
                      <input 
                        type="tel" 
                        required
                        placeholder="0812..."
                        value={formData.phone_number}
                        onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.MapPin className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Google Maps</label>
                      </div>
                      <input 
                        type="url" 
                        placeholder="https://maps.app.goo.gl/..."
                        value={formData.gmaps_link}
                        onChange={(e) => setFormData({...formData, gmaps_link: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Hasil Kunjungan */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Icons.FileText className="w-4 h-4 text-emerald-500" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Hasil Kunjungan</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Clock className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Visit</label>
                      </div>
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.visit_time}
                        onChange={(e) => setFormData({...formData, visit_time: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.RefreshCw className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow Up</label>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Langkah selanjutnya..."
                        value={formData.follow_up}
                        onChange={(e) => setFormData({...formData, follow_up: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.FileText className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visit Result</label>
                      </div>
                      <textarea 
                        rows={4}
                        placeholder="Hasil kunjungan..."
                        value={formData.visit_result}
                        onChange={(e) => setFormData({...formData, visit_result: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all resize-none shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Status & Penawaran */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Icons.Zap className="w-4 h-4 text-indigo-500" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Status & Penawaran</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Sparkles className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Client</label>
                      </div>
                      <div className="relative">
                        <select 
                          value={formData.client_status}
                          onChange={(e) => setFormData({...formData, client_status: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all appearance-none shadow-sm"
                        >
                          <option value="Lead">Lead</option>
                          <option value="Prospect">Prospect</option>
                          <option value="Negotiation">Negotiation</option>
                          <option value="Closed Won">Closed Won</option>
                          <option value="Closed Lost">Closed Lost</option>
                        </select>
                        <Icons.ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Briefcase className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Offering</label>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Produk yang ditawarkan"
                        value={formData.offering}
                        onChange={(e) => setFormData({...formData, offering: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.FileText className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ket Offering</label>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Detail penawaran"
                        value={formData.offering_details}
                        onChange={(e) => setFormData({...formData, offering_details: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 pb-6 sm:pb-0">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-full sm:flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 order-2 sm:order-1"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="w-full sm:flex-[2] py-4 bg-[#FFC000] text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100 order-1 sm:order-2"
                >
                  {editingRecord ? 'Simpan Perubahan' : 'Tambah Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
