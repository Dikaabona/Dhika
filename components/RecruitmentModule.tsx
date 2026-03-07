
import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../constants.tsx';
import { supabase } from '../services/supabaseClient';
import { Candidate, UserRole } from '../types';
import Papa from 'papaparse';

interface RecruitmentModuleProps {
  company: string;
  userRole: UserRole;
  onClose: () => void;
}

const RecruitmentModule: React.FC<RecruitmentModuleProps> = ({ company, userRole, onClose }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [candidateNote, setCandidateNote] = useState('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
  const itemsPerPage = 10;

  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1yY2WbVzz4iOGB8XII_x2n5cALVQH56dYLZcaMXfylFo/export?format=csv';

  useEffect(() => {
    fetchCandidates();
  }, [company]);

  const fetchCandidates = async () => {
    setIsLoading(true);
    console.log("Fetching candidates for company:", company);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .ilike('company', company.trim())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Supabase Fetch Error:", error);
        if (error.code === 'PGRST116' || error.message.includes('relation "candidates" does not exist')) {
          alert("Tabel 'candidates' belum ditemukan di database. Pastikan Anda sudah menjalankan perintah SQL di Supabase.");
          setCandidates([]);
        } else if (error.code === '42501') {
          alert("Izin ditolak (RLS). Pastikan Row Level Security di Supabase sudah dinonaktifkan atau dikonfigurasi untuk tabel 'candidates'.");
          setCandidates([]);
        } else {
          throw error;
        }
      } else {
        console.log("Fetched candidates from DB:", data?.length, data);
        setCandidates(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      alert(`Gagal mengambil data dari database: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncFromSheet = async () => {
    setIsSyncing(true);
    try {
      // Cleanup old candidates (older than 60 days) ONLY during sync
      const sixtyDaysAgoCleanup = new Date();
      sixtyDaysAgoCleanup.setDate(sixtyDaysAgoCleanup.getDate() - 60);
      
      const { error: deleteError } = await supabase
        .from('candidates')
        .delete()
        .lt('created_at', sixtyDaysAgoCleanup.toISOString())
        .ilike('company', company.trim());

      if (deleteError) console.error("Cleanup error during sync:", deleteError);

      console.log("Fetching from:", SHEET_URL);
      const response = await fetch(SHEET_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const sheetData = results.data as any[];
          console.log("Parsed sheet data:", sheetData.length, "rows");
          
          if (sheetData.length === 0) {
            alert('Spreadsheet kosong atau tidak terbaca.');
            setIsSyncing(false);
            return;
          }

          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

          const newCandidates: Candidate[] = sheetData
            .map((row: any) => {
              const ts = (row['Timestamp'] || row['timestamp'] || row['Waktu'] || row['waktu'] || '').toString().trim();
              let dateObj = new Date(ts);
              
              if (isNaN(dateObj.getTime()) && ts.includes('/')) {
                const [datePart] = ts.split(' ');
                const parts = datePart.split('/');
                if (parts.length === 3) {
                  const [p1, p2, p3] = parts;
                  // Try YYYY-MM-DD (assuming p1 is month)
                  let d = new Date(`${p3}-${p1}-${p2}`);
                  if (isNaN(d.getTime())) {
                    // Try YYYY-MM-DD (assuming p2 is month)
                    d = new Date(`${p3}-${p2}-${p1}`);
                  }
                  dateObj = d;
                }
              }

              return {
                timestamp: ts,
                email: (row['Email Address'] || row['Email'] || row['email'] || row['Alamat Email'] || '').toString().trim(),
                nama: (row['Nama'] || row['nama'] || row['Name'] || row['Nama Lengkap'] || '').toString().trim(),
                ttl: (row['Tempat Tanggal Lahir'] || row['TTL'] || row['Tempat, Tanggal Lahir'] || '').toString().trim(),
                alamat: (row['Alamat Lengkap'] || row['Alamat'] || row['Domisili'] || '').toString().trim(),
                noHp: (row['No HP'] || row['No. HP'] || row['Phone'] || row['Nomor WhatsApp'] || '').toString().trim(),
                gajiHarapan: (row['Gaji yang diharapkan'] || row['Gaji'] || row['Ekspektasi Gaji'] || '').toString().trim(),
                posisi: (row['Posisi yang dilamar'] || row['Posisi'] || row['Jabatan'] || '').toString().trim(),
                videoUrl: (row['Silahkan lampirkan video live streaming (min 1 menit)'] || row['Video'] || row['Link Video'] || '').toString().trim(),
                portfolioUrl: (row['Silahkan lampirkan portfolio'] || row['Portfolio'] || row['Link Portfolio'] || '').toString().trim(),
                status: 'Applied' as const,
                company: company.trim(),
                _dateObj: dateObj
              };
            })
            .filter(cand => cand.email && cand.nama && (isNaN(cand._dateObj.getTime()) || cand._dateObj >= sixtyDaysAgo))
            .map(({ _dateObj, ...rest }) => rest);

          if (newCandidates.length === 0) {
            alert('Tidak ada pelamar baru yang valid dalam 60 hari terakhir di Spreadsheet.');
            setIsSyncing(false);
            return;
          }

          // Try to save to DB
          let successCount = 0;
          let failCount = 0;
          let lastErrorMessage = "";

          for (const cand of newCandidates) {
            try {
              console.log("Processing candidate:", cand.email, cand.company);
              const { data: existing, error: checkError } = await supabase
                .from('candidates')
                .select('id')
                .eq('email', cand.email)
                .eq('timestamp', cand.timestamp)
                .ilike('company', company.trim())
                .maybeSingle();

              if (checkError) throw checkError;

              if (!existing) {
                const { error: insertError } = await supabase.from('candidates').insert([cand]);
                if (insertError) throw insertError;
                successCount++;
              }
            } catch (err: any) {
              console.error("Error processing candidate:", cand.email, err);
              if (!lastErrorMessage) lastErrorMessage = err.message || JSON.stringify(err);
              failCount++;
            }
          }
          
          console.log(`Sync complete. Success: ${successCount}, Failed: ${failCount}`);
          
          await fetchCandidates();
          
          if (failCount > 0) {
            const sqlFix = `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "gajiHarapan" text; ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "noHp" text; ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "videoUrl" text; ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "portfolioUrl" text;`;
            console.error("SQL Fix Suggestion:", sqlFix);
            alert(`Sinkronisasi selesai dengan kendala. Berhasil: ${successCount}, Gagal: ${failCount}.\n\nKEMUNGKINAN PENYEBAB: Kolom di database Supabase tidak lengkap.\n\nSOLUSI: Jalankan perintah SQL berikut di Supabase SQL Editor:\n\n${sqlFix}`);
          } else {
            alert(`Sinkronisasi Berhasil! ${successCount} data baru ditambahkan.`);
          }
          setIsSyncing(false);
        },
        error: (error: any) => {
          console.error("PapaParse error:", error);
          alert('Gagal membaca format CSV.');
          setIsSyncing(false);
        }
      });
    } catch (err: any) {
      console.error("Sync error:", err);
      alert(`Gagal sinkronisasi: ${err.message}`);
      setIsSyncing(false);
    }
  };

  const updateStatus = async (id: string, newStatus: Candidate['status']) => {
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error("Update status error:", err);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedCandidate?.id) return;
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ notes: candidateNote })
        .eq('id', selectedCandidate.id);

      if (error) throw error;
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, notes: candidateNote } : c));
      setIsNoteModalOpen(false);
      setSelectedCandidate(null);
    } catch (err) {
      console.error("Save note error:", err);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCandidate?.email || !emailSubject || !emailBody) return;
    
    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: selectedCandidate.email,
          subject: emailSubject,
          html: `<div style="font-family: sans-serif; padding: 20px;">${emailBody.replace(/\n/g, '<br>')}</div>`,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        alert(`Email berhasil dikirim ke ${selectedCandidate.nama}`);
        setIsEmailModalOpen(false);
        setSelectedCandidate(null);
      } else {
        throw new Error(result.error?.message || result.error || 'Gagal mengirim email');
      }
    } catch (err: any) {
      console.error("Send email error:", err);
      alert(`Gagal mengirim email: ${err.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const openEmailModal = (cand: Candidate) => {
    setSelectedCandidate(cand);
    setEmailSubject(`Update Rekrutmen: ${cand.posisi} - ${company}`);
    setEmailBody(`Halo ${cand.nama},\n\nTerima kasih telah melamar untuk posisi ${cand.posisi} di ${company}.\n\nKami ingin menginformasikan bahwa...`);
    setIsEmailModalOpen(true);
  };

  const filteredCandidates = useMemo(() => {
    let result = candidates.filter(c => {
      const matchesSearch = c.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            c.posisi.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      } else if (sortOrder === 'oldest') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortOrder === 'name_asc') {
        return a.nama.localeCompare(b.nama);
      } else if (sortOrder === 'name_desc') {
        return b.nama.localeCompare(a.nama);
      }
      return 0;
    });

    return result;
  }, [candidates, searchQuery, statusFilter, sortOrder]);

  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCandidates.slice(start, start + itemsPerPage);
  }, [filteredCandidates, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Applied': return 'bg-blue-100 text-blue-700';
      case 'Screening': return 'bg-amber-100 text-amber-700';
      case 'Interview': return 'bg-purple-100 text-purple-700';
      case 'Rejected': return 'bg-rose-100 text-rose-700';
      case 'Hired': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95">
            <Icons.ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Seleksi Kandidat</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Manajemen Rekrutmen {company}</p>
          </div>
        </div>
        <button 
          onClick={fetchCandidates}
          className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 text-slate-400 hover:text-slate-900"
          title="Refresh Data"
        >
          <Icons.RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button 
          onClick={syncFromSheet}
          disabled={isSyncing}
          className="flex items-center justify-center gap-3 bg-[#0f172a] text-[#FFC000] px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
        >
          {isSyncing ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.RefreshCw className="w-4 h-4" />}
          Sinkronisasi Spreadsheet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="CARI NAMA ATAU POSISI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-[#1E6BFF] focus:border-transparent outline-none font-bold text-[10px] uppercase tracking-widest"
          />
        </div>
        <div className="relative">
          <Icons.Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-[#1E6BFF] focus:border-transparent outline-none font-bold text-[10px] uppercase tracking-widest appearance-none"
          >
            <option value="ALL">SEMUA STATUS</option>
            <option value="Applied">APPLIED</option>
            <option value="Screening">SCREENING</option>
            <option value="Interview">INTERVIEW</option>
            <option value="Rejected">REJECTED</option>
            <option value="Hired">HIRED</option>
          </select>
        </div>
        <div className="relative">
          <Icons.Layers className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full pl-14 pr-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-[#1E6BFF] focus:border-transparent outline-none font-bold text-[10px] uppercase tracking-widest appearance-none"
          >
            <option value="newest">TERBARU</option>
            <option value="oldest">TERLAMA</option>
            <option value="name_asc">NAMA (A-Z)</option>
            <option value="name_desc">NAMA (Z-A)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kandidat</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Posisi & Gaji</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kontak</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Icons.Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" />
                  </td>
                </tr>
              ) : paginatedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Tidak ada data kandidat</p>
                  </td>
                </tr>
              ) : (
                paginatedCandidates.map((cand, idx) => (
                  <tr key={cand.id || `${cand.email}-${cand.timestamp}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{cand.nama}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{cand.ttl}</span>
                        <span className="text-[9px] font-medium text-slate-400 mt-1 line-clamp-1 max-w-[200px]">{cand.alamat}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{cand.posisi}</span>
                        <span className="text-[10px] font-bold text-emerald-600 mt-1">Rp {cand.gajiHarapan}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                          <Icons.Mail className="w-3 h-3" /> {cand.email}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                          <Icons.Phone className="w-3 h-3" /> {cand.noHp}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(cand.status)}`}>
                        {cand.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        {cand.videoUrl && (
                          <a href={cand.videoUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm" title="Video Live">
                            <Icons.Video className="w-4 h-4" />
                          </a>
                        )}
                        {cand.portfolioUrl && (
                          <a href={cand.portfolioUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm" title="Portfolio">
                            <Icons.FileText className="w-4 h-4" />
                          </a>
                        )}
                        <button 
                          onClick={() => openEmailModal(cand)}
                          className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                          title="Kirim Email"
                        >
                          <Icons.Mail className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedCandidate(cand);
                            setCandidateNote(cand.notes || '');
                            setIsNoteModalOpen(true);
                          }}
                          className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-amber-600 hover:border-amber-100 transition-all shadow-sm"
                          title="Catatan"
                        >
                          <Icons.MessageSquare className="w-4 h-4" />
                        </button>
                        <div className="relative group/status">
                          <button className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all shadow-sm">
                            <Icons.MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 hidden group-hover/status:block z-50 overflow-hidden">
                            {(['Applied', 'Screening', 'Interview', 'Rejected', 'Hired'] as Candidate['status'][]).map(s => (
                              <button 
                                key={s}
                                onClick={() => updateStatus(cand.id!, s)}
                                className="w-full px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                              >
                                SET {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-10 py-6 bg-white rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Halaman {currentPage} dari {totalPages || 1}
          </span>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            ({filteredCandidates.length} Total Kandidat)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Icons.ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => {
              const pageNum = i + 1;
              // Only show a few page numbers if there are many
              if (totalPages > 5 && Math.abs(pageNum - currentPage) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                if (Math.abs(pageNum - currentPage) === 3) return <span key={pageNum} className="text-slate-300">...</span>;
                return null;
              }
              return (
                <button 
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-[#0f172a] text-[#FFC000] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Icons.ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isNoteModalOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in duration-300">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Catatan Kandidat</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedCandidate.nama}</p>
              </div>
              <button onClick={() => setIsNoteModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <textarea 
                value={candidateNote}
                onChange={(e) => setCandidateNote(e.target.value)}
                placeholder="TULIS CATATAN EVALUASI DI SINI..."
                className="w-full h-40 p-6 bg-slate-50 rounded-3xl border-none focus:ring-2 focus:ring-[#1E6BFF] outline-none font-medium text-sm resize-none"
              />
              <button 
                onClick={handleSaveNote}
                className="w-full bg-[#0f172a] text-white py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95"
              >
                SIMPAN CATATAN
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmailModalOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in duration-300">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Kirim Email</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedCandidate.nama} ({selectedCandidate.email})</p>
              </div>
              <button onClick={() => setIsEmailModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subjek Email</label>
                <input 
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#1E6BFF] outline-none font-bold text-[10px] uppercase tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Isi Email</label>
                <textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full h-40 p-6 bg-slate-50 rounded-3xl border-none focus:ring-2 focus:ring-[#1E6BFF] outline-none font-medium text-sm resize-none"
                />
              </div>
              <button 
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="w-full bg-[#0f172a] text-[#FFC000] py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
              >
                {isSendingEmail ? 'MENGIRIM...' : 'KIRIM EMAIL SEKARANG'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentModule;
