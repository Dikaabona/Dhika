import React, { useState } from 'react';
import { Employee } from '../types';
import { Icons } from '../constants';
import { calculateTenure } from '../utils/dateUtils';

interface EmployeeDetailModalProps {
  employee: Employee;
  onClose: () => void;
}

const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState<'employment' | 'personal'>('employment');

  const tabs = [
    { id: 'employment', label: 'Employment Info' },
    { id: 'personal', label: 'Personal Info' },
  ];

  const DetailRow = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-800 text-right">{value || '-'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md z-[250] flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[40px] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-500">
        {/* Header Bar - White background with overlap support */}
        <div className="bg-white h-32 shrink-0 relative">
           <div className="absolute top-4 left-4 z-20">
              <button onClick={onClose} className="text-slate-900 hover:bg-slate-100 p-2 rounded-xl transition-all active:scale-90">
                <Icons.ArrowLeft className="w-6 h-6" />
              </button>
           </div>
           {/* Profile Picture overlapping the header bar */}
           <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 z-10">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-slate-100 flex items-center justify-center">
                {employee.photoBase64 || employee.avatarUrl ? (
                  <img src={employee.photoBase64 || employee.avatarUrl} className="w-full h-full object-cover" alt={employee.nama} />
                ) : (
                  <Icons.Users className="w-12 h-12 text-slate-300" />
                )}
              </div>
           </div>
        </div>

        <div className="flex-grow overflow-y-auto no-scrollbar pb-24 mt-16">
          {/* Profile Section */}
          <div className="flex flex-col items-center pb-4 text-center px-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{employee.nama}</h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{employee.jabatan}</p>
          </div>

          {/* Action Icons */}
          <div className="flex justify-center gap-10 py-6">
            <a href={`tel:${employee.noHandphone}`} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Icons.Phone />
              </div>
            </a>
            <a href={`mailto:${employee.email}`} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-amber-500 shadow-sm group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Icons.Mail />
              </div>
            </a>
            <a href={`https://wa.me/${employee.noHandphone}`} target="_blank" className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-all overflow-hidden p-3">
                <img src="https://lh3.googleusercontent.com/d/1c4UQAJIWS0-U2newQ6D8n-m0pd1f1vGJ" className="w-full h-full object-contain" alt="WA" />
              </div>
            </a>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-6 sticky top-0 bg-white z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                  activeTab === tab.id ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFC000] rounded-t-full"></div>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="px-8 py-4 animate-in fade-in duration-300">
            {activeTab === 'employment' && (
              <div className="divide-y divide-slate-50">
                <DetailRow label="Company Name" value={employee.company} />
                <DetailRow label="Employee ID" value={employee.idKaryawan} />
                <DetailRow label="Job Position" value={employee.jabatan} />
                <DetailRow label="Join Date" value={employee.tanggalMasuk} />
                <DetailRow label="Tenure" value={calculateTenure(employee.tanggalMasuk)} />
                {/* Baris Status telah dihapus sesuai permintaan */}
              </div>
            )}
            {activeTab === 'personal' && (
              <div className="divide-y divide-slate-50">
                <DetailRow label="Full Name" value={employee.nama} />
                <DetailRow label="Email" value={employee.email} />
                <DetailRow label="Phone Number" value={employee.noHandphone} />
                <DetailRow label="Identity Number (KTP)" value={employee.noKtp} />
                <DetailRow label="Birth Place" value={employee.tempatLahir} />
                <DetailRow label="Birth Date" value={employee.tanggalLahir} />
                <DetailRow label="Address" value={employee.alamat} />
                <DetailRow label="Bank" value={employee.bank} />
                <DetailRow label="Account Number" value={employee.noRekening} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;