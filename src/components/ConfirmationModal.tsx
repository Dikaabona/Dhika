
import React from 'react';
import { Icons } from '../constants';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'YA, LANJUTKAN',
  cancelText = 'BATAL',
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          bg: 'bg-rose-50',
          icon: 'text-rose-500',
          button: 'bg-rose-500 hover:bg-rose-600'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          icon: 'text-amber-500',
          button: 'bg-amber-500 hover:bg-amber-600'
        };
      default:
        return {
          bg: 'bg-blue-50',
          icon: 'text-blue-500',
          button: 'bg-slate-900 hover:bg-black'
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[40px] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 sm:p-10 text-center">
          <div className={`w-20 h-20 ${colors.bg} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {type === 'danger' ? (
              <Icons.Trash className={`w-10 h-10 ${colors.icon}`} />
            ) : type === 'warning' ? (
              <Icons.AlertTriangle className={`w-10 h-10 ${colors.icon}`} />
            ) : (
              <Icons.Info className={`w-10 h-10 ${colors.icon}`} />
            )}
          </div>
          
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">{title}</h3>
          <p className="text-slate-500 font-medium leading-relaxed mb-10">
            {message}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={onCancel}
              className="flex-1 px-8 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-8 py-4 rounded-2xl ${colors.button} text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
