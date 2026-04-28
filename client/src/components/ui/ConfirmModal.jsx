import { AlertTriangle, X } from 'lucide-react';

export function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-lg ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
            <AlertTriangle size={20} className={danger ? 'text-danger' : 'text-accent'} />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-text-main text-base">{title}</h3>
            <p className="text-text-muted text-sm mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-main transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onCancel}>Annuler</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
