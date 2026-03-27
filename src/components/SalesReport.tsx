import React, { useState, useMemo, useEffect, useRef } from 'react';
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

interface SalesCompany {
  id: string;
  company_id: string;
  name: string;
  contact_person: string;
  phone_number: string;
  company: string;
}

interface SalesReportProps {
  company: string;
  onClose: () => void;
}

const SalesReport: React.FC<SalesReportProps> = ({ company, onClose }) => {
  const [activeSubTab, setActiveSubTab] = useState<'LOG' | 'DATABASE'>('LOG');
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [companies, setCompanies] = useState<SalesCompany[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCompanyFormOpen, setIsCompanyFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null);
  const [editingCompany, setEditingCompany] = useState<SalesCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const getLocalISOString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Form State for Visit
  const [formData, setFormData] = useState<Partial<SalesRecord>>({
    company_id: '',
    company_name: '',
    contact_person: '',
    phone_number: '',
    visit_time: getLocalISOString(),
    gmaps_link: '',
    visit_result: '',
    follow_up: '',
    client_status: 'Lead',
    offering: '',
    offering_details: '',
    company: company
  });

  // Form State for Company Database
  const [companyFormData, setCompanyFormData] = useState<Partial<SalesCompany>>({
    company_id: '',
    name: '',
    contact_person: '',
    phone_number: '',
    company: company
  });

  useEffect(() => {
    fetchRecords();
    fetchCompanies();
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

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_companies')
        .select('*')
        .eq('company', company)
        .order('name', { ascending: true });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUploading(true);
      let photoUrl = formData.photo_url;

      if (capturedPhoto) {
        // Convert base64 to blob
        const res = await fetch(capturedPhoto);
        const blob = await res.blob();
        
        const fileName = `visit_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('sales-visits')
          .upload(fileName, blob);

        if (uploadError) {
          console.error('Error uploading photo:', uploadError);
          if (uploadError.message === 'Bucket not found') {
            alert('Error: Bucket storage "sales-visits" belum dibuat di Supabase. Silakan buat bucket dengan nama "sales-visits" di menu Storage Supabase Anda.');
            setIsUploading(false);
            return;
          }
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('sales-visits')
            .getPublicUrl(fileName);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const payload = { ...formData, company, photo_url: photoUrl };
      
      if (editingRecord) {
        const { error } = await supabase
          .from('sales_visit_records')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
      } else {
        // Ensure id is not in payload for new records
        const { id, ...insertPayload } = payload as any;
        const { error } = await supabase
          .from('sales_visit_records')
          .insert([insertPayload]);
        if (error) throw error;
      }

      setIsFormOpen(false);
      setEditingRecord(null);
      setCapturedPhoto(null);
      setFormData({
        company_id: '',
        company_name: '',
        contact_person: '',
        phone_number: '',
        visit_time: getLocalISOString(),
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
      alert('Gagal menyimpan data. Pastikan tabel sales_visit_records dan bucket storage "sales-visits" sudah dibuat di Supabase.');
    } finally {
      setIsUploading(false);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoData);
        // Update visit_time to current local time on check-in
        setFormData(prev => ({ ...prev, visit_time: getLocalISOString() }));
        stopCamera();
      }
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...companyFormData, company };
      
      if (editingCompany) {
        const { error } = await supabase
          .from('sales_companies')
          .update(payload)
          .eq('id', editingCompany.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_companies')
          .insert([payload]);
        if (error) throw error;
      }

      setIsCompanyFormOpen(false);
      setEditingCompany(null);
      setCompanyFormData({
        company_id: '',
        name: '',
        contact_person: '',
        phone_number: '',
        company: company
      });
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Gagal menyimpan data perusahaan. Pastikan tabel sales_companies sudah dibuat di Supabase.');
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

  const handleDeleteCompany = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus data perusahaan ini?')) return;
    try {
      const { error } = await supabase
        .from('sales_companies')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  };

  const handleEdit = (record: SalesRecord) => {
    setEditingRecord(record);
    setFormData(record);
    setIsFormOpen(true);
  };

  const handleEditCompany = (comp: SalesCompany) => {
    setEditingCompany(comp);
    setCompanyFormData(comp);
    setIsCompanyFormOpen(true);
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [companies, searchQuery]);

  const handleSelectCompany = (compId: string) => {
    const comp = companies.find(c => c.id === compId);
    if (comp) {
      setFormData({
        ...formData,
        company_id: comp.company_id,
        company_name: comp.name,
        contact_person: comp.contact_person,
        phone_number: comp.phone_number
      });
    }
  };

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const companiesToInsert = data.map(item => ({
          company_id: item['ID PERUSAHAAN'] || item['id_perusahaan'] || '',
          name: item['PERUSAHAAN'] || item['perusahaan'] || '',
          contact_person: item['CONTACT PERSON'] || item['contact_person'] || '',
          phone_number: String(item['NO TELEPON / HP'] || item['no_telepon'] || ''),
          company: company
        })).filter(c => c.name && c.company_id);

        if (companiesToInsert.length === 0) {
          alert('Tidak ada data valid untuk diimpor. Pastikan kolom ID PERUSAHAAN dan PERUSAHAAN ada.');
          return;
        }

        const { error } = await supabase
          .from('sales_companies')
          .insert(companiesToInsert);

        if (error) throw error;
        alert(`Berhasil mengimpor ${companiesToInsert.length} data perusahaan.`);
        fetchCompanies();
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Gagal mengimpor data. Pastikan format file benar.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-6 py-8 sm:px-12 sm:py-10 border-b border-slate-50">
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
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              {activeSubTab === 'DATABASE' && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex-1 sm:flex-none flex justify-center items-center p-4 sm:p-3 bg-emerald-600 text-white rounded-2xl sm:rounded-full hover:bg-emerald-700 transition-all active:scale-95 shadow-lg"
                  title="Import Excel"
                >
                  <Icons.Upload className="w-5 h-5" />
                </button>
              )}
              <button onClick={handleExport} className="flex-1 sm:flex-none flex justify-center items-center p-4 sm:p-3 bg-slate-900 text-white rounded-2xl sm:rounded-full hover:bg-black transition-all active:scale-95 shadow-lg">
                <Icons.Download className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { 
                  if (activeSubTab === 'LOG') {
                    setEditingRecord(null); 
                    setFormData({
                      company_id: '',
                      company_name: '',
                      contact_person: '',
                      phone_number: '',
                      visit_time: getLocalISOString(),
                      gmaps_link: '',
                      visit_result: '',
                      follow_up: '',
                      client_status: 'Lead',
                      offering: '',
                      offering_details: '',
                      company: company
                    });
                    setIsFormOpen(true); 
                  } else {
                    setEditingCompany(null);
                    setCompanyFormData({
                      company_id: '',
                      name: '',
                      contact_person: '',
                      phone_number: '',
                      company: company
                    });
                    setIsCompanyFormOpen(true);
                  }
                }} 
                className="flex-[3] sm:flex-none bg-[#FFC000] text-black px-8 py-4 sm:py-3 rounded-2xl sm:rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
              >
                <Icons.Plus className="w-4 h-4" /> TAMBAH {activeSubTab === 'LOG' ? 'VISIT' : 'DATABASE'}
              </button>
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex gap-4 mt-8">
          <button 
            onClick={() => setActiveSubTab('LOG')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'LOG' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            Visit Log
          </button>
          <button 
            onClick={() => setActiveSubTab('DATABASE')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'DATABASE' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            Database
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-0 sm:p-8">
        {activeSubTab === 'LOG' ? (
          <>
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
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Selfie</th>
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
                        <td className="px-6 py-5">
                          {record.photo_url ? (
                            <a href={record.photo_url} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:scale-110 transition-transform">
                              <img src={record.photo_url} alt="Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                              <Icons.Camera className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </td>
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
                      {record.photo_url && (
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md flex-shrink-0">
                          <img src={record.photo_url} alt="Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
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
          </>
        ) : (
          <>
            {/* Database View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">No</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Perusahaan</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Perusahaan</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">No Telepon / Hp</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-20">
                          <Icons.Database className="w-12 h-12" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em]">Belum Ada Data Perusahaan</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((comp, index) => (
                      <tr key={comp.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5 text-xs font-bold text-slate-400">{index + 1}</td>
                        <td className="px-6 py-5 text-xs font-black text-slate-900 uppercase">{comp.company_id}</td>
                        <td className="px-6 py-5 text-xs font-black text-slate-900 uppercase">{comp.name}</td>
                        <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase">{comp.contact_person}</td>
                        <td className="px-6 py-5 text-xs font-bold text-slate-600">{comp.phone_number}</td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditCompany(comp)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                              <Icons.Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteCompany(comp.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
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

            {/* Mobile Database View */}
            <div className="md:hidden space-y-3 px-3 pb-10">
              {filteredCompanies.length === 0 ? (
                <div className="py-20 text-center opacity-20">
                  <Icons.Database className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Belum Ada Data Perusahaan</p>
                </div>
              ) : (
                filteredCompanies.map((comp, index) => (
                  <div key={comp.id} className="bg-white rounded-[32px] p-5 border border-slate-100 shadow-sm space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black text-slate-400">#{index + 1}</span>
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-slate-500 uppercase tracking-tight">
                            {comp.company_id}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-black text-slate-900 uppercase leading-tight line-clamp-2">{comp.name}</h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-50">
                      <div className="space-y-1">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Contact Person</p>
                        <p className="text-[10px] font-bold text-slate-700 uppercase truncate">{comp.contact_person}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">No Telepon / HP</p>
                        <p className="text-[10px] font-bold text-slate-700">{comp.phone_number}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 gap-2">
                      <button 
                        onClick={() => handleEditCompany(comp)} 
                        className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteCompany(comp.id)} 
                        className="w-9 h-9 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl border border-rose-100 active:scale-90 transition-transform"
                      >
                        <Icons.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
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
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Database className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Dari Database (Opsional)</label>
                      </div>
                      <select 
                        onChange={(e) => handleSelectCompany(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                      >
                        <option value="">-- PILIH PERUSAHAAN --</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.company_id})</option>
                        ))}
                      </select>
                    </div>
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
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Camera className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Check-in Selfie</label>
                      </div>
                      
                      <div className="relative group">
                        {capturedPhoto ? (
                          <div className="relative w-full aspect-video rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                            <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={() => setCapturedPhoto(null)}
                              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                            >
                              <Icons.RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        ) : isCameraOpen ? (
                          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-xl">
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                              <button 
                                type="button"
                                onClick={stopCamera}
                                className="px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/30 transition-all"
                              >
                                Batal
                              </button>
                              <button 
                                type="button"
                                onClick={capturePhoto}
                                className="w-16 h-16 bg-[#FFC000] rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform border-4 border-white"
                              >
                                <div className="w-12 h-12 rounded-full border-2 border-black/20" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            type="button"
                            onClick={startCamera}
                            className="w-full aspect-video rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 hover:bg-slate-100 hover:border-slate-300 transition-all group"
                          >
                            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Icons.Camera className="w-8 h-8 text-slate-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Klik untuk Check-in</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ambil Selfie & Waktu Otomatis</p>
                            </div>
                          </button>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 ml-1">
                        <Icons.Clock className="w-3 h-3 text-slate-400" />
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Check-in</label>
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
                  disabled={isUploading}
                  className={`w-full sm:flex-[2] py-4 bg-[#FFC000] text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100 order-1 sm:order-2 flex items-center justify-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? (
                    <>
                      <Icons.RefreshCw className="w-4 h-4 animate-spin" />
                      MEMPROSES...
                    </>
                  ) : (
                    editingRecord ? 'Simpan Perubahan' : 'Tambah Data'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Company Database Form Modal */}
      {isCompanyFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {editingCompany ? 'Edit Data Perusahaan' : 'Tambah Perusahaan Baru'}
              </h3>
              <button onClick={() => setIsCompanyFormOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSaveCompany} className="p-6 sm:p-10 overflow-y-auto">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Perusahaan</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: CMP-001"
                    value={companyFormData.company_id}
                    onChange={(e) => setCompanyFormData({...companyFormData, company_id: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Perusahaan</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nama PT / Toko"
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData({...companyFormData, name: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nama PIC"
                    value={companyFormData.contact_person}
                    onChange={(e) => setCompanyFormData({...companyFormData, contact_person: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No Telepon / HP</label>
                  <input 
                    type="tel" 
                    required
                    placeholder="0812..."
                    value={companyFormData.phone_number}
                    onChange={(e) => setCompanyFormData({...companyFormData, phone_number: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFC000] focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div className="pt-6 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsCompanyFormOpen(false)}
                    className="flex-1 px-8 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-[#FFC000] text-black px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-lg shadow-amber-100"
                  >
                    {editingCompany ? 'Simpan Perubahan' : 'Simpan Perusahaan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
