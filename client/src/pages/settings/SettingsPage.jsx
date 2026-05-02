import { useState, useEffect } from 'react';
import { Users, Leaf, Target, Settings2, Plus, Edit2, Trash2, Check, X, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Skeleton } from '../../components/ui/Skeleton';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const TABS = [
  { id: 'users',       label: 'Utilisateurs',         icon: Users    },
  { id: 'engagements', label: 'Engagements de mandat', icon: Target  },
  { id: 'resilience',  label: 'Leviers résilience',    icon: Leaf    },
  { id: 'config',      label: 'Configuration',         icon: Settings2 },
];

const ROLE_LABELS = {
  administrateur:           'Administrateur',
  admin:                    'Administrateur',
  charge_operation:         'Chargé d\'opération',
  write:                    'Chargé d\'opération',
  gestionnaire_patrimonial: 'Gestionnaire patrimonial',
  directeur:                'Directeur / DGA / Élus',
  read:                     'Directeur / DGA / Élus',
  administratif:            'Administratif',
  compta:                   'Administratif',
};
const ROLE_COLORS = {
  administrateur: '#C0392B', admin: '#C0392B',
  charge_operation: '#2563EB', write: '#2563EB',
  gestionnaire_patrimonial: '#0E7490',
  directeur: '#1E7E45', read: '#1E7E45',
  administratif: '#7B3FA0', compta: '#7B3FA0',
};

// Options du menu déroulant (nouveaux noms)
const ROLE_OPTIONS = [
  { value: 'administrateur',           label: 'Administrateur' },
  { value: 'charge_operation',         label: 'Chargé d\'opération' },
  { value: 'gestionnaire_patrimonial', label: 'Gestionnaire patrimonial' },
  { value: 'directeur',                label: 'Directeur / DGA / Élus' },
  { value: 'administratif',            label: 'Administratif' },
];

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#6B7280';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + '18', color }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

/* ── Réinitialisation mot de passe ──────────────────────── */
function PasswordReset({ userId, onSave }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (pwd.length < 6) return;
    setSaving(true);
    try { await onSave(userId, pwd); setOpen(false); setPwd(''); }
    finally { setSaving(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs text-text-muted hover:text-primary flex items-center gap-1">
      🔑 Mot de passe
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus type="password" value={pwd} onChange={e => setPwd(e.target.value)}
        placeholder="Nouveau (6 car. min.)" className="input text-xs py-0.5 w-36"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setOpen(false); setPwd(''); } }}
        minLength={6}
      />
      <button onClick={handleSave} disabled={saving || pwd.length < 6} className="text-green-600 hover:text-green-700 disabled:opacity-40"><Check size={14} /></button>
      <button onClick={() => { setOpen(false); setPwd(''); }} className="text-text-muted"><X size={14} /></button>
    </div>
  );
}

/* ── Édition inline du nom ───────────────────────────────── */
function NameEditor({ userId, initialName, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);

  const confirm = () => {
    if (value.trim() !== initialName) onSave(value.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setValue(initialName); setEditing(false); } }}
          className="input text-sm py-0.5 w-40"
          placeholder="Prénom Nom"
        />
        <button onClick={confirm} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
        <button onClick={() => { setValue(initialName); setEditing(false); }} className="text-text-muted"><X size={14} /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1 text-left"
      title="Cliquer pour modifier"
    >
      <span className="font-medium text-sm text-text-main">{initialName || <span className="text-text-muted italic">Sans nom</span>}</span>
      <Edit2 size={11} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/* ════════════════════════════════════════════
   ONGLET UTILISATEURS
════════════════════════════════════════════ */
function TabUsers() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('directeur');
  const [inviteHabilitation, setInviteHabilitation] = useState(false);
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUsers(await api.get('/settings/users')); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post('/settings/users/invite', {
        email:                    inviteEmail.trim(),
        full_name:                inviteName.trim(),
        role:                     inviteRole,
        habilitation_patrimoniale: inviteRole === 'charge_operation' ? inviteHabilitation : false,
      });
      toast.success(`Invitation envoyée à ${inviteName.trim() || inviteEmail}`);
      setInviteEmail('');
      setInviteName('');
      setInviteHabilitation(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setInviting(false); }
  };

  const handleRoleChange = async (userId, role, currentHabilitation) => {
    try {
      // Si on change vers un profil autre que charge_operation, forcer habilitation à false
      const habilitation_patrimoniale = role === 'charge_operation' ? currentHabilitation : false;
      await api.put(`/settings/users/${userId}`, { role, habilitation_patrimoniale });
      toast.success('Profil mis à jour');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleHabilitationChange = async (userId, habilitation_patrimoniale) => {
    try {
      await api.put(`/settings/users/${userId}`, { habilitation_patrimoniale });
      toast.success(habilitation_patrimoniale ? 'Habilitation patrimoniale activée' : 'Habilitation patrimoniale retirée');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleActive = async (userId, active) => {
    try {
      await api.put(`/settings/users/${userId}`, { active: !active });
      toast.success(active ? 'Compte désactivé' : 'Compte activé');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleNameChange = async (userId, full_name) => {
    try {
      await api.put(`/settings/users/${userId}`, { full_name });
      toast.success('Nom mis à jour');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handlePasswordChange = async (userId, password) => {
    try {
      await api.put(`/settings/users/${userId}`, { password });
      toast.success('Mot de passe modifié');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="flex flex-col gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;

  return (
    <div className="flex flex-col gap-5">
      {isAdmin && (
        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Créer un compte utilisateur</h3>
          <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Prénom et nom</label>
              <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                placeholder="Thomas Duval" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Adresse email *</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="thomas.duval@denain.fr" className="input w-full" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Profil</label>
              <select value={inviteRole} onChange={e => { setInviteRole(e.target.value); setInviteHabilitation(false); }} className="input w-full">
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* Habilitation patrimoniale — visible uniquement pour charge_operation */}
            {inviteRole === 'charge_operation' && (
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={inviteHabilitation}
                    onChange={e => setInviteHabilitation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-main">Habilitation patrimoniale</span>
                    <p className="text-xs text-text-muted mt-0.5">
                      Permet à ce chargé d'opération de créer et modifier les fiches du module Gestion patrimoniale
                    </p>
                  </div>
                </label>
              </div>
            )}
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={inviting} className="btn-primary flex items-center gap-1.5">
                <Plus size={14} /> {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-gray-50">
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Utilisateur</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Profil</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Habilitation</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Statut</th>
              {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <NameEditor userId={u.id} initialName={u.full_name || ''} onSave={name => handleNameChange(u.id, name)} />
                  ) : (
                    <>
                      <div className="font-medium text-sm text-text-main">{u.full_name || '—'}</div>
                      <div className="text-xs text-text-muted">{u.email}</div>
                    </>
                  )}
                  {isAdmin && <div className="text-xs text-text-muted mt-0.5">{u.email}</div>}
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value, u.habilitation_patrimoniale)}
                      className="input text-xs py-1 w-52"
                    >
                      {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : <RoleBadge role={u.role} />}
                </td>
                {/* Habilitation patrimoniale — visible seulement pour charge_operation */}
                <td className="px-4 py-3">
                  {(u.role === 'charge_operation' || u.role === 'write') ? (
                    isAdmin ? (
                      <label className="flex items-center gap-2 cursor-pointer" title="Habilitation patrimoniale">
                        <input
                          type="checkbox"
                          checked={u.habilitation_patrimoniale || false}
                          onChange={e => handleHabilitationChange(u.id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-text-muted">Patrimoine</span>
                      </label>
                    ) : (
                      u.habilitation_patrimoniale
                        ? <span className="text-xs text-cyan-700 font-medium">✓ Patrimoine</span>
                        : <span className="text-xs text-text-muted">—</span>
                    )
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <button onClick={() => handleToggleActive(u.id, u.active)}
                        className="text-xs text-text-muted hover:text-text-main flex items-center gap-1">
                        {u.active
                          ? <><ToggleRight size={16} className="text-green-600" /> Désactiver</>
                          : <><ToggleLeft size={16} /> Activer</>}
                      </button>
                      <PasswordReset userId={u.id} onSave={handlePasswordChange} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">Aucun utilisateur.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ONGLET ENGAGEMENTS DE MANDAT
════════════════════════════════════════════ */

const EMPTY_ENG = { intitule: '', description: '', cible: '', unite: '', date_echeance: '', ordre: 99 };

function EngagementRow({ eng, onSave, onDelete, isAdmin }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...eng });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(eng.id, form);
      setEditing(false);
    } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <>
        <tr className="bg-blue-50 border-b border-border">
          <td className="px-4 py-2">
            <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))}
              className="input text-sm w-full" placeholder="Intitulé…" />
          </td>
          <td className="px-4 py-2">
            <input type="number" value={form.cible} onChange={e => setForm(f => ({ ...f, cible: e.target.value }))}
              className="input text-sm w-24" placeholder="0" min="0" step="1" />
          </td>
          <td className="px-4 py-2">
            <input value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
              className="input text-sm w-28" placeholder="logements…" />
          </td>
          <td className="px-4 py-2">
            <input type="date" value={form.date_echeance || ''} onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
              className="input text-sm w-36" />
          </td>
          <td className="px-4 py-2">
            <input type="number" value={form.ordre} onChange={e => setForm(f => ({ ...f, ordre: Number(e.target.value) }))}
              className="input text-sm w-16" min="1" />
          </td>
          <td className="px-4 py-2">
            <div className="flex items-center gap-2 justify-end">
              <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-700" title="Enregistrer">
                {saving ? <span className="text-xs">…</span> : <Check size={15} />}
              </button>
              <button onClick={() => { setEditing(false); setForm({ ...eng }); }} className="text-text-muted hover:text-text-main" title="Annuler">
                <X size={15} />
              </button>
            </div>
          </td>
        </tr>
        {form.description !== undefined && (
          <tr className="bg-blue-50 border-b border-border">
            <td colSpan={6} className="px-4 pb-2">
              <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input text-sm w-full" placeholder="Description (optionnel)…" />
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      <tr className="border-b border-border hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-text-main">{eng.intitule}</div>
          {eng.description && <div className="text-xs text-text-muted mt-0.5">{eng.description}</div>}
        </td>
        <td className="px-4 py-3 font-mono text-sm text-text-main text-right">{eng.cible ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-text-muted">{eng.unite || '—'}</td>
        <td className="px-4 py-3 text-sm text-text-muted">
          {eng.date_echeance ? new Date(eng.date_echeance).toLocaleDateString('fr-FR') : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-text-muted text-center">{eng.ordre}</td>
        <td className="px-4 py-3">
          {isAdmin && (
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setEditing(true)} className="text-text-muted hover:text-primary" title="Modifier">
                <Edit2 size={14} />
              </button>
              <button onClick={() => setConfirmDelete(true)} className="text-text-muted hover:text-red-600" title="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </td>
      </tr>
      <ConfirmModal
        open={confirmDelete}
        title="Supprimer l'engagement"
        message={`Supprimer "${eng.intitule}" ? Les contributions des opérations associées seront également supprimées.`}
        onConfirm={() => { setConfirmDelete(false); onDelete(eng.id); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function TabEngagements() {
  const toast = useToast();
  const { canWriteStrategic: isAdmin } = useAuth();
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_ENG });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setEngagements(await api.get('/mandat/engagements')); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (id, form) => {
    try {
      await api.put(`/mandat/engagements/${id}`, {
        intitule: form.intitule,
        description: form.description || null,
        cible: form.cible !== '' ? parseFloat(form.cible) : null,
        unite: form.unite || null,
        date_echeance: form.date_echeance || null,
        ordre: Number(form.ordre) || 99,
      });
      toast.success('Engagement mis à jour');
      load();
    } catch (err) { toast.error(err.message); throw err; }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/mandat/engagements/${id}`);
      toast.success('Engagement supprimé');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newForm.intitule.trim()) return;
    setAdding(true);
    try {
      await api.post('/mandat/engagements', {
        intitule: newForm.intitule.trim(),
        description: newForm.description || null,
        cible: newForm.cible !== '' ? parseFloat(newForm.cible) : null,
        unite: newForm.unite || null,
        date_echeance: newForm.date_echeance || null,
        ordre: Number(newForm.ordre) || 99,
      });
      toast.success('Engagement créé');
      setNewForm({ ...EMPTY_ENG });
      setShowAdd(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setAdding(false); }
  };

  if (loading) return <div className="flex flex-col gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>;

  return (
    <div className="flex flex-col gap-5">
      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        Les engagements de mandat définissent les objectifs quantitatifs du programme 2020-2026.
        Chaque opération peut y contribuer depuis son onglet <strong>Résilience</strong>.
      </div>

      {/* Tableau des engagements */}
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-gray-50">
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Intitulé</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-right">Cible</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Unité</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Échéance</th>
              <th className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide text-center">Ordre</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {engagements.map(eng => (
              <EngagementRow key={eng.id} eng={eng} onSave={handleSave} onDelete={handleDelete} isAdmin={isAdmin} />
            ))}
            {engagements.length === 0 && !showAdd && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">Aucun engagement défini.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulaire d'ajout */}
      {isAdmin && (
        showAdd ? (
          <div className="card p-5">
            <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Nouvel engagement</h3>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Intitulé *</label>
                  <input value={newForm.intitule} onChange={e => setNewForm(f => ({ ...f, intitule: e.target.value }))}
                    className="input w-full" placeholder="Ex : Réhabilitation de logements…" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
                  <input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                    className="input w-full" placeholder="Description courte (optionnel)" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Objectif (cible)</label>
                  <input type="number" value={newForm.cible} onChange={e => setNewForm(f => ({ ...f, cible: e.target.value }))}
                    className="input w-full" placeholder="0" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Unité</label>
                  <input value={newForm.unite} onChange={e => setNewForm(f => ({ ...f, unite: e.target.value }))}
                    className="input w-full" placeholder="logements, M€, km…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Date d'échéance</label>
                  <input type="date" value={newForm.date_echeance} onChange={e => setNewForm(f => ({ ...f, date_echeance: e.target.value }))}
                    className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Ordre d'affichage</label>
                  <input type="number" value={newForm.ordre} onChange={e => setNewForm(f => ({ ...f, ordre: e.target.value }))}
                    className="input w-full" min="1" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowAdd(false); setNewForm({ ...EMPTY_ENG }); }}
                  className="btn-secondary">Annuler</button>
                <button type="submit" disabled={adding} className="btn-primary flex items-center gap-1.5">
                  <Save size={14} /> {adding ? 'Enregistrement…' : 'Créer l\'engagement'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="btn-secondary flex items-center gap-2 self-start">
            <Plus size={15} /> Ajouter un engagement
          </button>
        )
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   ONGLET LEVIERS RÉSILIENCE
════════════════════════════════════════════ */
const VOLET_LABELS = { 1: '🌿 Climatique', 2: '⚡ Énergétique', 3: '👥 Social', 4: '💶 Économique' };

function TabResilience() {
  const toast = useToast();
  const { canWriteStrategic: isAdmin } = useAuth();
  const [leviers, setLeviers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [newVolet, setNewVolet] = useState(1);
  const [newLibelle, setNewLibelle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setLeviers(await api.get('/leviers-resilience?all=true')); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (levier) => {
    try {
      await api.put(`/leviers-resilience/${levier.id}`, { actif: !levier.actif });
      setLeviers(prev => prev.map(l => l.id === levier.id ? { ...l, actif: !l.actif } : l));
    } catch (err) { toast.error(err.message); }
  };

  const handleEdit = async (id) => {
    if (!editVal.trim()) return;
    try {
      await api.put(`/leviers-resilience/${id}`, { libelle: editVal.trim() });
      setLeviers(prev => prev.map(l => l.id === id ? { ...l, libelle: editVal.trim() } : l));
      setEditId(null);
    } catch (err) { toast.error(err.message); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newLibelle.trim()) return;
    setAdding(true);
    try {
      await api.post('/leviers-resilience', { volet: newVolet, libelle: newLibelle.trim() });
      setNewLibelle('');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setAdding(false); }
  };

  if (loading) return <div className="flex flex-col gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const byVolet = [1, 2, 3, 4].map(v => ({
    volet: v,
    leviers: leviers.filter(l => l.volet === v),
  }));

  return (
    <div className="flex flex-col gap-5">
      {isAdmin && (
        <div className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Ajouter un levier</h3>
          <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
            <select value={newVolet} onChange={e => setNewVolet(Number(e.target.value))} className="input w-44">
              {[1,2,3,4].map(v => <option key={v} value={v}>{VOLET_LABELS[v]}</option>)}
            </select>
            <input type="text" value={newLibelle} onChange={e => setNewLibelle(e.target.value)}
              placeholder="Intitulé du levier…" className="input flex-1 min-w-48" required />
            <button type="submit" disabled={adding} className="btn-primary flex items-center gap-1.5">
              <Plus size={14} /> {adding ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </div>
      )}

      {byVolet.map(({ volet, leviers: vl }) => (
        <div key={volet} className="card p-5">
          <h3 className="font-heading font-semibold text-sm text-text-main mb-3">{VOLET_LABELS[volet]}</h3>
          <div className="flex flex-col gap-1.5">
            {vl.length === 0 && <p className="text-xs text-text-muted">Aucun levier.</p>}
            {vl.map(l => (
              <div key={l.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                  l.actif ? 'border-border bg-white' : 'border-dashed border-gray-200 bg-gray-50'
                }`}>
                {editId === l.id ? (
                  <>
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                      className="input flex-1 text-sm py-1"
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(l.id); if (e.key === 'Escape') setEditId(null); }} />
                    <button onClick={() => handleEdit(l.id)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="text-text-muted hover:text-text-main"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${l.actif ? 'text-text-main' : 'text-text-muted line-through'}`}>
                      {l.libelle}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => { setEditId(l.id); setEditVal(l.libelle); }}
                          className="text-text-muted hover:text-text-main" title="Renommer">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleToggle(l)}
                          className="text-text-muted hover:text-text-main"
                          title={l.actif ? 'Désactiver' : 'Activer'}>
                          {l.actif
                            ? <ToggleRight size={16} className="text-green-600" />
                            : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════
   ONGLET CONFIGURATION
════════════════════════════════════════════ */
function TabConfig() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState({ collectivite: '', libelle_mandat: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/config')
      .then(data => setForm({ collectivite: data.collectivite || '', libelle_mandat: data.libelle_mandat || '' }))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/config', form);
      toast.success('Configuration enregistrée');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        Ces valeurs apparaissent dans le <strong>Tableau de bord Programme de Mandat</strong> et dans le rapport PDF exporté.
      </div>

      <div className="card p-6">
        <h3 className="font-heading font-semibold text-sm text-text-main mb-4">Identité de la collectivité</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Nom de la collectivité</label>
            <input
              type="text"
              value={form.collectivite}
              onChange={e => setForm(f => ({ ...f, collectivite: e.target.value }))}
              className="input w-full max-w-sm"
              placeholder="Ville de Denain"
              disabled={!isAdmin}
            />
            <p className="text-xs text-text-muted mt-1">Apparaît dans l'en-tête du tableau de bord et dans le pied de page du rapport.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Libellé du mandat</label>
            <input
              type="text"
              value={form.libelle_mandat}
              onChange={e => setForm(f => ({ ...f, libelle_mandat: e.target.value }))}
              className="input w-full max-w-sm"
              placeholder="Mandat 2020-2026"
              disabled={!isAdmin}
            />
            <p className="text-xs text-text-muted mt-1">Exemple : "Mandat 2026-2032" si vous démarrez un nouveau cycle.</p>
          </div>
          {isAdmin && (
            <div className="flex justify-start pt-1">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
                <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </form>

        {/* Aperçu */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Aperçu</div>
          <div className="rounded-lg border border-border bg-gray-50 px-4 py-3">
            <p className="font-heading font-bold text-base text-text-main">Tableau de bord — Programme de Mandat</p>
            <p className="text-text-muted text-xs mt-0.5">
              {form.collectivite || 'Ville de Denain'} · {form.libelle_mandat || 'Mandat 2020-2026'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════ */
export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const visibleTabs = isAdmin ? TABS : TABS.filter(t => t.id !== 'users');
  const [tab, setTab] = useState(() => isAdmin ? 'users' : 'engagements');

  return (
    <AppLayout breadcrumbs={[{ label: 'Paramètres' }]}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading font-bold text-2xl text-text-main">Paramètres</h1>
            <p className="text-text-muted text-sm mt-0.5">Gestion des utilisateurs et de la configuration</p>
          </div>
        </div>

        <div className="border-b border-border mb-6 flex gap-0">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
              }`}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users'       && isAdmin && <TabUsers />}
        {tab === 'engagements' && <TabEngagements />}
        {tab === 'resilience'  && <TabResilience />}
        {tab === 'config'      && <TabConfig />}
      </div>
    </AppLayout>
  );
}
