import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, GripVertical, Download, Zap } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Skeleton } from '../../../components/ui/Skeleton';

const STATUT_CONFIG = {
  realise:      { label: 'Réalisé',      color: '#1E7E45', bg: '#D1FAE5', dot: '#1E7E45' },
  a_venir:      { label: 'À venir',      color: '#1A3A5C', bg: '#DBEAFE', dot: '#2563EB' },
  en_retard:    { label: 'En retard',    color: '#C0392B', bg: '#FEE2E2', dot: '#C0392B' },
  non_planifie: { label: 'Non planifié', color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatutBadge({ statut, ecart }) {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.non_planifie;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
      {statut === 'en_retard' && ecart > 0 && <span className="opacity-70">+{ecart}j</span>}
      {statut === 'realise' && ecart !== 0 && (
        <span className="opacity-70">{ecart > 0 ? `+${ecart}j` : `${ecart}j`}</span>
      )}
    </span>
  );
}

function KpiBar({ jalons }) {
  const total = jalons.length;
  const realises = jalons.filter(j => j.statut === 'realise').length;
  const retards = jalons.filter(j => j.statut === 'en_retard');
  const prochain = jalons.find(j => j.statut === 'a_venir' && j.date_prevue);
  const pct = total > 0 ? Math.round((realises / total) * 100) : 0;
  const maxRetard = retards.reduce((m, j) => Math.max(m, j.ecart_jours), 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="card p-4 text-center">
        <div className="text-2xl font-bold font-heading" style={{ color: '#1E7E45' }}>{pct}%</div>
        <div className="text-xs text-text-muted mt-0.5">{realises}/{total} jalons réalisés</div>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#1E7E45' }} />
        </div>
      </div>
      <div className="card p-4 text-center">
        <div className="text-2xl font-bold font-heading" style={{ color: retards.length > 0 ? '#C0392B' : '#6B7280' }}>
          {retards.length}
        </div>
        <div className="text-xs text-text-muted mt-0.5">jalon{retards.length > 1 ? 's' : ''} en retard</div>
        {retards.length > 0 && (
          <div className="mt-1 text-xs font-medium" style={{ color: '#C0392B' }}>+{maxRetard}j max</div>
        )}
      </div>
      <div className="card p-4 text-center">
        {prochain ? (
          <>
            <div className="text-xs font-semibold text-text-main leading-snug line-clamp-2">{prochain.intitule}</div>
            <div className="text-xs text-text-muted mt-1 font-mono">{fmtDate(prochain.date_prevue)}</div>
            <div className="mt-1 text-xs" style={{ color: '#1A3A5C' }}>Prochain jalon</div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold font-heading text-text-muted">—</div>
            <div className="text-xs text-text-muted mt-0.5">Aucun jalon à venir</div>
          </>
        )}
      </div>
    </div>
  );
}

function Timeline({ jalons }) {
  const planified = jalons.filter(j => j.date_prevue).sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue));
  if (planified.length < 2) return null;

  const times = planified.map(j => new Date(j.date_prevue).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const range = maxT - minT || 1;

  return (
    <div className="card p-5 mb-4">
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Frise chronologique</h4>
      <div className="relative mx-4" style={{ height: 120 }}>
        {/* axe horizontal centré */}
        <div className="absolute left-0 right-0 bg-gray-200 rounded-full" style={{ top: 52, height: 2 }} />
        {planified.map((j, i) => {
          const pct = ((new Date(j.date_prevue).getTime() - minT) / range) * 100;
          const cfg = STATUT_CONFIG[j.statut] || STATUT_CONFIG.non_planifie;
          const above = i % 2 === 0; // alternance haut / bas
          return (
            <div key={j.id} className="absolute flex flex-col items-center"
              style={{ left: `${pct}%`, top: 0, transform: 'translateX(-50%)', width: 76 }}>
              {/* étiquette au-dessus */}
              {above && (
                <div className="text-center mb-1" style={{ height: 36 }}>
                  <div style={{ fontSize: 9, lineHeight: 1.3 }} className="font-medium text-text-main line-clamp-2">
                    {j.intitule}
                  </div>
                  <div style={{ fontSize: 8 }} className="text-text-muted">
                    {new Date(j.date_prevue + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                  </div>
                </div>
              )}
              {!above && <div style={{ height: 36 }} />}

              {/* point sur l'axe */}
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow z-10 shrink-0"
                style={{ backgroundColor: cfg.dot, marginTop: above ? 14 : 0 }} title={j.intitule} />

              {/* étiquette en dessous */}
              {!above && (
                <div className="text-center mt-1" style={{ height: 36 }}>
                  <div style={{ fontSize: 9, lineHeight: 1.3 }} className="font-medium text-text-main line-clamp-2">
                    {j.intitule}
                  </div>
                  <div style={{ fontSize: 8 }} className="text-text-muted">
                    {new Date(j.date_prevue + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-text-muted mt-1">
        <span className="font-mono">{fmtDate(planified[0].date_prevue)}</span>
        <span className="font-mono">{fmtDate(planified[planified.length - 1].date_prevue)}</span>
      </div>
    </div>
  );
}

function JalonRowContent({ jalon, onSave, onDelete, isReadOnly }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    date_prevue: jalon.date_prevue || '',
    date_reelle: jalon.date_reelle || '',
    commentaire: jalon.commentaire || '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(jalon.id, {
        date_prevue: form.date_prevue || null,
        date_reelle: form.date_reelle || null,
        commentaire: form.commentaire || null,
      });
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ date_prevue: jalon.date_prevue || '', date_reelle: jalon.date_reelle || '', commentaire: jalon.commentaire || '' });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-text-muted w-5 shrink-0">{jalon.ordre}.</span>
            <span className="text-sm font-medium text-text-main">{jalon.intitule}</span>
            <StatutBadge statut={jalon.statut} ecart={jalon.ecart_jours} />
          </div>

          {editing ? (
            <div className="mt-2 flex flex-wrap gap-2 items-end">
              <div>
                <div className="text-xs text-text-muted mb-0.5">Date prévue</div>
                <input type="date" value={form.date_prevue}
                  onChange={e => setForm(f => ({ ...f, date_prevue: e.target.value }))}
                  className="input py-1 text-xs w-36" />
              </div>
              <div>
                <div className="text-xs text-text-muted mb-0.5">Date réelle</div>
                <input type="date" value={form.date_reelle}
                  onChange={e => setForm(f => ({ ...f, date_reelle: e.target.value }))}
                  className="input py-1 text-xs w-36" />
              </div>
              <div className="flex-1 min-w-44">
                <div className="text-xs text-text-muted mb-0.5">Commentaire</div>
                <input type="text" value={form.commentaire}
                  onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))}
                  placeholder="Note…" className="input py-1 text-xs w-full" />
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-3">
                  {saving ? '…' : 'Enregistrer'}
                </button>
                <button onClick={handleCancel} className="btn-secondary text-xs py-1 px-3">Annuler</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 mt-0.5 text-xs text-text-muted flex-wrap">
              <span>Prévu : <span className="font-mono">{fmtDate(jalon.date_prevue)}</span></span>
              {jalon.date_reelle && <span>Réel : <span className="font-mono">{fmtDate(jalon.date_reelle)}</span></span>}
              {jalon.commentaire && <span className="italic truncate max-w-sm">{jalon.commentaire}</span>}
            </div>
          )}
        </div>

        {!isReadOnly && !editing && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-blue-50 text-blue-400" title="Modifier">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button onClick={() => onDelete(jalon.id)} className="p-1 rounded hover:bg-red-50 text-red-400" title="Supprimer">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddJalonInline({ operationId, onCreated, onCancel }) {
  const [intitule, setIntitule] = useState('');
  const [date_prevue, setDatePrevue] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!intitule.trim()) return;
    setSaving(true);
    try {
      await api.post(`/operations/${operationId}/jalons`, { intitule: intitule.trim(), date_prevue: date_prevue || null });
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end py-1">
      <div className="flex-1 min-w-48">
        <div className="text-xs text-text-muted mb-0.5">Intitulé *</div>
        <input autoFocus type="text" value={intitule} onChange={e => setIntitule(e.target.value)}
          placeholder="Nom du jalon…" className="input py-1 text-sm w-full"
          onKeyDown={e => e.key === 'Escape' && onCancel()} />
      </div>
      <div>
        <div className="text-xs text-text-muted mb-0.5">Date prévue</div>
        <input type="date" value={date_prevue} onChange={e => setDatePrevue(e.target.value)} className="input py-1 text-xs w-36" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !intitule.trim()} className="btn-primary text-xs py-1 px-3">
          {saving ? 'Ajout…' : 'Ajouter'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs py-1 px-3">Annuler</button>
      </div>
    </form>
  );
}

export function TabPlanning({ op }) {
  const operationId = op.id;
  const { isReadOnly } = useAuth();
  const toast = useToast();

  const [jalons, setJalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragOver, setDragOver] = useState(null);

  const loadJalons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/operations/${operationId}/jalons`);
      setJalons(data || []);
    } catch (err) {
      toast.error('Erreur chargement jalons : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => { loadJalons(); }, [loadJalons]);

  const handleSave = useCallback(async (jalonId, updates) => {
    await api.put(`/operations/${operationId}/jalons/${jalonId}`, updates);
    await loadJalons();
  }, [operationId, loadJalons]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/operations/${operationId}/jalons/${deleteId}`);
      toast.success('Jalon supprimé');
      await loadJalons();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api.post(`/operations/${operationId}/jalons/seed`, {});
      toast.success('Jalons types chargés');
      await loadJalons();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/exports/planning`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error('Erreur export'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planning-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  // Native drag & drop reorder
  const [draggingId, setDraggingId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    setDragOver(id);
  };
  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOver(null); return; }
    const list = [...jalons];
    const fromIdx = list.findIndex(j => j.id === draggingId);
    const toIdx = list.findIndex(j => j.id === targetId);
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setJalons(list);
    setDraggingId(null);
    setDragOver(null);
    const order = list.map((j, i) => ({ id: j.id, ordre: i + 1 }));
    try {
      await api.put(`/operations/${operationId}/jalons/reorder`, { order });
      await loadJalons();
    } catch (err) {
      toast.error(err.message);
      await loadJalons();
    }
  };

  if (loading) return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  return (
    <div>
      {jalons.length > 0 && <KpiBar jalons={jalons} />}
      {jalons.length > 1 && <Timeline jalons={jalons} />}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-heading font-semibold text-sm text-text-main">
            Jalons {jalons.length > 0 && <span className="text-text-muted font-normal">({jalons.length})</span>}
          </h4>
          <div className="flex gap-2">
            {!isReadOnly && jalons.length === 0 && (
              <button onClick={handleSeed} disabled={seeding} className="btn-secondary text-xs flex items-center gap-1.5">
                <Zap size={13} /> {seeding ? 'Chargement…' : 'Jalons types'}
              </button>
            )}
            <button onClick={handleExport} disabled={exporting || jalons.length === 0} className="btn-secondary text-xs flex items-center gap-1.5">
              <Download size={13} /> {exporting ? 'Export…' : 'Excel'}
            </button>
            {!isReadOnly && (
              <button onClick={() => setAddOpen(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={13} /> Ajouter
              </button>
            )}
          </div>
        </div>

        {jalons.length === 0 && !addOpen ? (
          <div className="p-10 text-center text-text-muted">
            <p className="text-sm mb-1">Aucun jalon défini.</p>
            {!isReadOnly && (
              <p className="text-xs">Utilisez "Jalons types" pour charger les jalons standards selon le type d'opération, ou ajoutez-les manuellement.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {jalons.map(j => (
              <div
                key={j.id}
                draggable={!isReadOnly}
                onDragStart={e => handleDragStart(e, j.id)}
                onDragOver={e => handleDragOver(e, j.id)}
                onDrop={e => handleDrop(e, j.id)}
                onDragEnd={() => { setDraggingId(null); setDragOver(null); }}
                className={`flex items-start gap-2 px-4 py-3 transition-colors ${dragOver === j.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'} ${draggingId === j.id ? 'opacity-50' : ''}`}
              >
                {!isReadOnly && (
                  <div className="mt-0.5 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0">
                    <GripVertical size={14} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <JalonRowContent jalon={j} onSave={handleSave} onDelete={setDeleteId} isReadOnly={isReadOnly} />
                </div>
              </div>
            ))}
            {addOpen && (
              <div className="px-4 py-3 bg-blue-50/50">
                <AddJalonInline
                  operationId={operationId}
                  onCreated={() => { loadJalons(); setAddOpen(false); }}
                  onCancel={() => setAddOpen(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Supprimer le jalon"
        message="Supprimer ce jalon définitivement ?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
