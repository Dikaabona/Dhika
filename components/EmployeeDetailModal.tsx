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
    { id: 'employment', label: 'Employment' },
    { id: 'personal', label: 'Personal' },
  ];

  const DetailRow = ({ label, value, icon: Icon }: { label: string; value: string | number; icon?: any }) => (
    <div className="group flex items-center justify-between py-5 px-2 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors rounded-xl">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:text-[#FFC000] transition-all">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <span className="text-sm font-black text-black text-right uppercase tracking-tight">{value || '-'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[250] flex items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full max-w-xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[48px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-500">
        
        {/* Dynamic Header Section */}
        <div className="relative shrink-0">
          <div className="h-40 bg-black relative overflow-hidden">
            {/* Decorative Grid Pattern */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#FFC000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="absolute top-6 left-6 z-20">
              <button 
                onClick={onClose} 
                className="bg-white/10 hover:bg-[#FFC000] text-white hover:text-black p-3 rounded-2xl transition-all active:scale-90 backdrop-blur-md border border-white/10"
              >
                <Icons.ArrowLeft className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Profile Overlap */}
          <div className="px-8 -mt-20 relative z-10 flex flex-col items-center sm:items-start sm:flex-row sm:gap-8">
            <div className="w-40 h-40 rounded-[40px] overflow-hidden border-[6px] border-white shadow-2xl bg-slate-100 flex items-center justify-center shrink-0 rotate-3 hover:rotate-0 transition-transform duration-500">
              {employee.photoBase64 || employee.avatarUrl ? (
                <img src={employee.photoBase64 || employee.avatarUrl} className="w-full h-full object-cover" alt={employee.nama} />
              ) : (
                <Icons.Users className="w-16 h-16 text-slate-300" />
              )}
            </div>
            
            <div className="mt-6 sm:mt-24 text-center sm:text-left flex-grow">
              <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tighter leading-none uppercase">
                {employee.nama}
              </h2>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
                <span className="bg-[#FFC000] text-black text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                  {employee.jabatan}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                  {employee.idKaryawan}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto no-scrollbar px-8 mt-10 pb-12">
          {/* Quick Action Bar */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <a href={`tel:${employee.noHandphone}`} className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-[32px] hover:bg-black group transition-all active:scale-95">
              <div className="text-black group-hover:text-[#FFC000] transition-colors">
                <Icons.Phone className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest">Call</span>
            </a>
            <a href={`mailto:${employee.email}`} className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-[32px] hover:bg-black group transition-all active:scale-95">
              <div className="text-black group-hover:text-[#FFC000] transition-colors">
                <Icons.Mail className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest">Email</span>
            </a>
            <a href={`https://wa.me/${employee.noHandphone}`} target="_blank" className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-[32px] hover:bg-black group transition-all active:scale-95">
              <div className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all">
                <img src="https://lh3.googleusercontent.com/d/1c4UQAJIWS0-U2newQ6D8n-m0pd1f1vGJ" className="w-full h-full object-contain" alt="WA" />
              </div>
              <span className="text-[8px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest">WhatsApp</span>
            </a>
          </div>

          {/* Tab Navigation - Brutalist Style */}
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[24px] mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  activeTab === tab.id 
                    ? 'bg-black text-[#FFC000] shadow-lg' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'employment' && (
              <div className="bg-white rounded-[32px] border border-slate-100 p-4 shadow-sm">
                <DetailRow label="Company" value={employee.company} icon={Icons.Briefcase} />
                <DetailRow label="Position" value={employee.jabatan} icon={Icons.Shield} />
                <DetailRow label="Join Date" value={employee.tanggalMasuk} icon={Icons.Calendar} />
                <DetailRow label="Tenure" value={calculateTenure(employee.tanggalMasuk)} icon={Icons.Clock} />
                
                {employee.resigned_at && (
                  <div className="mt-4 p-6 bg-rose-50 rounded-[28px] border border-rose-100">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Resignation Date</span>
                      <span className="text-sm font-black text-rose-600 uppercase">{employee.resigned_at}</span>
                    </div>
                    {employee.resign_reason && (
                      <div className="pt-4 border-t border-rose-100">
                        <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-2">Reason</p>
                        <p className="text-xs font-bold text-rose-700 leading-relaxed italic">"{employee.resign_reason}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'personal' && (
              <div className="bg-white rounded-[32px] border border-slate-100 p-4 shadow-sm">
                <DetailRow label="Full Name" value={employee.nama} icon={Icons.User} />
                <DetailRow label="Identity (KTP)" value={employee.noKtp} icon={Icons.FileText} />
                <DetailRow label="Birth Info" value={`${employee.tempatLahir}, ${employee.tanggalLahir}`} icon={Icons.Cake} />
                <DetailRow label="Address" value={employee.alamat} icon={Icons.MapPin} />
                <DetailRow label="Bank Info" value={`${employee.bank} - ${employee.noRekening}`} icon={Icons.CreditCard} />
              </div>
            )}
          </div>
        </div>

        {/* Footer Accent */}
        <div className="h-2 bg-[#FFC000] w-full shrink-0"></div>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;