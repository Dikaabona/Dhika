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
    <div className="flex items-center justify-between py-5 px-6 bg-white rounded-[32px] mb-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-5">
        {Icon && (
          <div className="w-12 h-12 rounded-[20px] bg-[#f1f5f9] flex items-center justify-center text-[#64748b]">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-[0.2em] leading-none mb-1.5">{label}</span>
          <span className="text-[15px] font-black text-black uppercase tracking-tight leading-none">{value || '-'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white z-[250] flex flex-col animate-in fade-in duration-500">
      {/* Black Header */}
      <div className="h-[25vh] bg-black relative shrink-0">
        <button 
          onClick={onClose} 
          className="absolute top-8 left-8 z-30 bg-white/10 hover:bg-white/20 text-white p-4 rounded-[20px] transition-all active:scale-90 backdrop-blur-md"
        >
          <Icons.ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Profile Section Overlap */}
      <div className="flex-grow flex flex-col -mt-24 relative z-10 bg-white rounded-t-[48px] px-8 pb-32 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center">
          <div className="w-44 h-44 rounded-[48px] overflow-hidden border-[8px] border-white shadow-2xl bg-slate-100 flex items-center justify-center shrink-0">
            {employee.photoBase64 || employee.avatarUrl ? (
              <img src={employee.photoBase64 || employee.avatarUrl} className="w-full h-full object-cover" alt={employee.nama} />
            ) : (
              <Icons.Users className="w-16 h-16 text-slate-300" />
            )}
          </div>
          
          <div className="mt-8 text-center">
            <h2 className="text-4xl font-black text-black tracking-tighter leading-[0.9] uppercase max-w-[300px] mx-auto">
              {employee.nama}
            </h2>
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className="bg-[#FFC000] text-black text-[11px] font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-sm">
                {employee.jabatan}
              </span>
              <span className="text-[11px] font-black text-[#cbd5e1] uppercase tracking-[0.2em]">
                {employee.idKaryawan}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 p-0 bg-[#f1f5f9] rounded-[28px] mt-12 mb-8 overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-6 text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-black text-[#FFC000] rounded-[28px] shadow-xl z-10' 
                  : 'text-[#94a3b8] hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'employment' && (
            <div className="bg-[#f8fafc] rounded-[48px] p-8">
              <DetailRow label="Company" value={employee.company} icon={Icons.Briefcase} />
              <DetailRow label="Division" value={employee.division || 'OPERATIONAL'} icon={Icons.Layers} />
              <DetailRow label="Position" value={employee.jabatan} icon={Icons.Shield} />
              <DetailRow label="Join Date" value={employee.tanggalMasuk} icon={Icons.Calendar} />
              <DetailRow label="Tenure" value={calculateTenure(employee.tanggalMasuk)} icon={Icons.Clock} />
              
              {employee.resigned_at && (
                <div className="mt-6 p-8 bg-rose-50 rounded-[40px] border border-rose-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[11px] font-black text-rose-400 uppercase tracking-widest">Resignation Date</span>
                    <span className="text-base font-black text-rose-600 uppercase">{employee.resigned_at}</span>
                  </div>
                  {employee.resign_reason && (
                    <div className="pt-6 border-t border-rose-100">
                      <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-2">Reason</p>
                      <p className="text-sm font-bold text-rose-700 leading-relaxed italic">"{employee.resign_reason}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'personal' && (
            <div className="bg-[#f8fafc] rounded-[48px] p-8">
              <DetailRow label="Full Name" value={employee.nama} icon={Icons.User} />
              <DetailRow label="Gender" value={employee.gender || '-'} icon={Icons.Users} />
              <DetailRow label="Email" value={employee.email} icon={Icons.Mail} />
              <DetailRow label="Phone Number" value={employee.noHandphone} icon={Icons.Phone} />
              <DetailRow label="Identity (KTP)" value={employee.noKtp} icon={Icons.FileText} />
              <DetailRow label="Birth Info" value={`${employee.tempatLahir}, ${employee.tanggalLahir}`} icon={Icons.Cake} />
              <DetailRow label="Address" value={employee.alamat} icon={Icons.MapPin} />
              <DetailRow label="Bank Info" value={`${employee.bank} - ${employee.noRekening}`} icon={Icons.CreditCard} />
              <DetailRow label="Account Name" value={employee.namaDiRekening} icon={Icons.UserCheck} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;