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
      <div className="px-8 py-10 sm:px-12 sm:py-14 border-b border-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Icons.ChevronDown className="w-5 h-5 rotate-90 text-slate-400" />
              </button>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight">Sales Visit Report</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                type="text" 
                placeholder="CARI DATA..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-full text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FFC000] transition-all w-full sm:w-64"
              />
            </div>
            <button onClick={handleExport} className="p-3 bg-slate-900 text-white rounded-full hover:bg-black transition-all active:scale-95 shadow-lg">
              <Icons.Download className="w-5 h-5" />
            </button>
            <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="bg-[#FFC000] text-black px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100 flex items-center gap-2">
              <Icons.Plus className="w-4 h-4" /> TAMBAH DATA
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
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

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingRecord ? 'Edit Kunjungan' : 'Tambah Kunjungan Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Perusahaan</label>
                  <input 
                    type="text" 
                    required
                    value={formData.company_id}
                    onChange={(e) => setFormData({...formData, company_id: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Perusahaan</label>
                  <input 
                    type="text" 
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                  <input 
                    type="text" 
                    required
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No Telepon / HP</label>
                  <input 
                    type="text" 
                    required
                    value={formData.phone_number}
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Visit</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.visit_time}
                    onChange={(e) => setFormData({...formData, visit_time: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link Google Maps</label>
                  <input 
                    type="url" 
                    value={formData.gmaps_link}
                    onChange={(e) => setFormData({...formData, gmaps_link: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visit Result</label>
                  <textarea 
                    rows={3}
                    value={formData.visit_result}
                    onChange={(e) => setFormData({...formData, visit_result: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Follow Up</label>
                  <input 
                    type="text" 
                    value={formData.follow_up}
                    onChange={(e) => setFormData({...formData, follow_up: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Client</label>
                  <select 
                    value={formData.client_status}
                    onChange={(e) => setFormData({...formData, client_status: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all appearance-none"
                  >
                    <option value="Lead">Lead</option>
                    <option value="Prospect">Prospect</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Offering</label>
                  <input 
                    type="text" 
                    value={formData.offering}
                    onChange={(e) => setFormData({...formData, offering: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ket Offering</label>
                  <input 
                    type="text" 
                    value={formData.offering_details}
                    onChange={(e) => setFormData({...formData, offering_details: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFC000] transition-all"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-[#FFC000] text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100"
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
