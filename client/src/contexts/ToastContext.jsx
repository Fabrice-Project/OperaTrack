import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info')
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2" style={{ maxWidth: 380 }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const config = {
    success: { icon: CheckCircle, bg: '#1E7E45', border: '#165a32' },
    error:   { icon: XCircle,     bg: '#C0392B', border: '#96281b' },
    info:    { icon: Info,         bg: '#2E75B6', border: '#1d5a8a' }
  }[toast.type] || { icon: Info, bg: '#2E75B6', border: '#1d5a8a' };

  const Icon = config.icon;

  return (
    <div
      className="animate-fade-in flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-white"
      style={{ backgroundColor: config.bg, borderLeft: `4px solid ${config.border}` }}
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
