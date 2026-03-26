import React, { useState, useMemo } from 'react';
import { Icons } from '../constants';
import * as XLSX from 'xlsx';

interface SalesRecord {
  id: string;
  companyId: string;
  companyName: string;
  contactPerson: string;
  phoneNumber: string;
  visitTime: string;
  gmapsLink: string;
  visitResult: string;
  followUp: string;
  clientStatus: string;
  offering: string;
  offeringDetails: string;
  company: string; // Internal company filter
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

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.companyId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const handleExport = () => {
    const dataToExport = filteredRecords.map((r, index) => ({
      'NO': index + 1,
      'ID PERUSAHAAN': r.companyId,
      'PERUSAHAAN': r.companyName,
      'CONTACT PERSON': r.contactPerson,
      'NO TELEPON / HP': r.phoneNumber,
      'WAKTU VISIT': r.visitTime,
      'LINK GMAPS': r.gmapsLink,
      'VISIT RESULT': r.visitResult,
      'FOLLOW UP': r.followUp,
      'STATUS CLIENT': r.clientStatus,
      'OFFERING': r.offering,
      'KET OFFERING': r.offeringDetails
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visit Report");
    XLSX.writeFile(workbook, `Visit_Report_${company}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
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
            <button onClick={() => setIsFormOpen(true)} className="bg-[#FFC000] text-black px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95 shadow-lg shadow-amber-100 flex items-center gap-2">
              <Icons.Plus className="w-4 h-4" /> TAMBAH DATA
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1500px]">
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
            {filteredRecords.length === 0 ? (
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
                  <td className="px-6 py-5 text-xs font-black text-slate-900 uppercase">{record.companyId}</td>
                  <td className="px-6 py-5 text-xs font-black text-slate-900 uppercase">{record.companyName}</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase">{record.contactPerson}</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600">{record.phoneNumber}</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600">{record.visitTime}</td>
                  <td className="px-6 py-5 text-xs font-bold text-blue-600 underline truncate max-w-[150px]">
                    <a href={record.gmapsLink} target="_blank" rel="noopener noreferrer">{record.gmapsLink}</a>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600 truncate max-w-[200px]">{record.visitResult}</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600 truncate max-w-[150px]">{record.followUp}</td>
                  <td className="px-6 py-5">
                    <span className="text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-slate-100 text-slate-600">
                      {record.clientStatus}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600">{record.offering}</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600 truncate max-w-[200px]">{record.offeringDetails}</td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Icons.Edit className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
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
    </div>
  );
};

export default SalesReport;
