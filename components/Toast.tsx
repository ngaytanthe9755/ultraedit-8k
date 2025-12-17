
import React, { useEffect } from 'react';
import { ToastMessage } from '../types';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 w-80 backdrop-blur-md border p-4 rounded-xl shadow-2xl animate-[slideIn_0.3s_ease-out] relative overflow-hidden ${
            toast.type === 'success' ? 'bg-zinc-900/90 border-green-500/30' :
            toast.type === 'error' ? 'bg-zinc-900/90 border-red-500/30' :
            toast.type === 'warning' ? 'bg-zinc-900/90 border-yellow-500/30' :
            'bg-zinc-900/90 border-blue-500/30'
          }`}
        >
          {/* Progress Bar Animation (Optional Enhancement Idea) */}
          <div className={`absolute bottom-0 left-0 h-0.5 animate-[widthOut_5s_linear_forwards] ${
             toast.type === 'success' ? 'bg-green-500' :
             toast.type === 'error' ? 'bg-red-500' :
             toast.type === 'warning' ? 'bg-yellow-500' :
             'bg-blue-500'
          }`} style={{ width: '100%' }}></div>

          <div className={`mt-0.5 shrink-0 ${
            toast.type === 'success' ? 'text-green-500' : 
            toast.type === 'error' ? 'text-red-500' : 
            toast.type === 'warning' ? 'text-yellow-500' :
            'text-blue-500'
          }`}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'warning' && <AlertTriangle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-bold ${
                toast.type === 'success' ? 'text-green-100' : 
                toast.type === 'error' ? 'text-red-100' : 
                toast.type === 'warning' ? 'text-yellow-100' :
                'text-blue-100'
            }`}>{toast.title}</h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed break-words">{toast.message}</p>
          </div>
          <button 
            onClick={() => removeToast(toast.id)}
            className="text-zinc-500 hover:text-white transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
