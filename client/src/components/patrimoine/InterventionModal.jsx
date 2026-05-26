import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

const CATEGORIES_GENERIC = [
  'Entretien courant',
  'Dépannage',
  'Inspection',
  'Contrôle réglementaire',
  'Maintenance préventive',
  'Travaux',
];

const CATEGORIES_VOIRIE = [
  { value: 'investissement', label: 'Investissement' },
  { value: 'gros_entretien', label: 'Gros entretien' },
];

const STATUTS = [
  { value: 'signalee',   label: 'Signalée' },
  { value: 'programmee', label: 'Programmée' },
  { value: 'en_cours',   label: 'En cours' },
  { value: 'realisee',   label: 'Réalisée' },
  { value: 'cloturee',   label: 'Clôturée' },
];

const EMPTY_FORM = {
  type_intervenant: 'prestataire',
  prestataire_nom:  '',
  numero_bc:        '',
  reference_marche: '',
  marche_id:        null,
  montant_ht:       '',
  agent_nom:        '',
  nombre_heures:    '',
  montant_achat:    '',
  categorie:        '',
  nature:           '',
  statut:           'signalee',
  type_maintenance: 'corrective',
  date_signalement: '',
  date_prevue:      '',
  date_realisee:    '',
  commentaire:      '',
};

export function InterventionModal({ open, onClose, onSaved, theme, elementId, typeElement, intervention }) {
  const toast = useToast();
  const isEdit        = !!intervention?.id;
  const isVoirie      = theme === 'voirie';
  const isMobilier    = theme === 'mobilier';
  const isEclairage   = theme === 'eclairage';
  const isArmoire     = theme === 'armoire';
  const isBatiment    = theme === 'batiment';
  const isFeux        = theme === 'feux';
  const isArmoireFeux = theme === 'armoire_feux';
  // Feux partagent les marchés/prestataires de l'éclairage public
  const hasMarches  = isVoirie || isMobilier || isEclairage || isArmoire || isBatiment || isFeux || isArmoireFeux;

  const defaultCategorie = hasMarches ? 'investissement' : 'Entretien courant';

  const [form, setForm] = useState(() => {
    const base = intervention
      ? { ...EMPTY_FORM, ...intervention }
      : { ...EMPTY_FORM, theme, element_id: elementId, categorie: defaultCategorie };
    return base;
  });
  const [saving, setSaving]   = useState(false);
  const [marches, setMarches] = useState([]);
  const [marcheId, setMarcheId] = useState('');

  // Charger les marchés du bon domaine
  // Feux tricolores → même domaine que l'éclairage (prestataires partagés)
  useEffect(() => {
    if (!hasMarches || !open) return;
    const domaine = isMobilier                          ? 'mobilier'
      : isEclairage || isArmoire || isFeux || isArmoireFeux ? 'eclairage'
      : isBatiment                                      ? 'batiment'
      : 'voirie';
    api.get(`/patrimoine/voirie/marches?domaine=${domaine}`)
      .then(data => setMarches(data || []))
      .catch(() => {});
  }, [hasMarches, isMobilier, isEclairage, isArmoire, isFeux, isArmoireFeux, isBatiment, open]);

  if (!open) return null;

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // Marchés filtrés selon le type de travaux sélectionné
  const marchesFiltres = marches.filter(m => m.type_travaux === form.categorie && m.statut === 'en_cours');

  // Quand on sélectionne un marché → pré-remplit prestataire, référence et marche_id
  const handleSelectMarche = (id) => {
    setMarcheId(id);
    const m = marches.find(m => m.id === id);
    setForm(f => ({
      ...f,
      marche_id:        id || null,
      prestataire_nom:  m ? (m.prestataire || f.prestataire_nom) : f.prestataire_nom,
      reference_marche: m ? (m.numero_marche ? `${m.intitule} — N° ${m.numero_marche}` : m.intitule) : f.reference_marche,
    }));
  };

  // Quand le type de travaux change → réinitialiser la sélection de marché
  const handleCategorieVoirie = (val) => {
    set('categorie', val);
    setMarcheId('');
    // Réinitialiser prestataire si ce champ avait été pré-rempli
    setForm(f => ({ ...f, categorie: val, prestataire_nom: '', reference_marche: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const TYPE_ELEMENT_MAP = { voirie: 'troncon', eclairage: 'point_lumineux', batiment: 'batiment', mobilier: 'mobilier', armoire: 'armoire_eclairage' };
      const resolvedTheme = theme || form.theme;
      const payload = {
        ...form,
        theme:            resolvedTheme,
        element_id:       elementId || form.element_id,
        type_element:     TYPE_ELEMENT_MAP[resolvedTheme] || resolvedTheme,
        montant_ht:       form.montant_ht    ? parseFloat(form.montant_ht)    : null,
        nombre_heures:    form.nombre_heures ? parseFloat(form.nombre_heures) : null,
        montant_achat:    form.montant_achat ? parseFloat(form.montant_achat) : null,
        nature:           form.nature        || null,
        date_signalement: form.date_signalement || null,
        date_prevue:      form.date_prevue      || null,
        date_realisee:    form.date_realisee    || null,
      };
      if (isEdit) {
        await api.put(`/patrimoine/interventions/${intervention.id}`, payload);
        toast.success('Intervention mise à jour');
      } else {
        await api.post('/patrimoine/interventions', payload);
        toast.success('Intervention créée');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h3 className="font-heading font-semibold text-text-main">
            {isEdit ? "Modifier l'intervention" : '+ Nouvelle intervention'}
            {typeElement && <span className="ml-2 text-sm text-text-muted font-normal">— {typeElement}</span>}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto">

          {/* ── TYPE DE TRAVAUX + MARCHÉ (voirie ou mobilier, prestataire uniquement) ── */}
          {hasMarches && form.type_intervenant === 'prestataire' && (
            <div className="rounded-lg border border-border bg-gray-50 p-3 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">
                  Type de travaux
                </label>
                <div className="flex gap-3">
                  {CATEGORIES_VOIRIE.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleCategorieVoirie(value)}
                      className="flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors"
                      style={form.categorie === value ? {
                        borderColor: value === 'investissement' ? '#1A3A5C' : '#E8920A',
                        backgroundColor: (value === 'investissement' ? '#1A3A5C' : '#E8920A') + '12',
                        color: value === 'investissement' ? '#1A3A5C' : '#E8920A',
                      } : {
                        borderColor: '#E5E7EB',
                        backgroundColor: 'white',
                        color: '#6B7280',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélecteur de marché */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Marché en cours{' '}
                  <span className="text-text-muted/60">(optionnel — pré-remplit le prestataire)</span>
                </label>
                {marchesFiltres.length === 0 ? (
                  <p className="text-xs text-text-muted italic">
                    Aucun marché "{form.categorie === 'investissement' ? 'Investissement' : 'Gros entretien'}" en cours.
                  </p>
                ) : (
                  <select
                    value={marcheId}
                    onChange={e => handleSelectMarche(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">— Sélectionner un marché —</option>
                    {marchesFiltres.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.intitule}{m.numero_marche ? ` — N° ${m.numero_marche}` : ''}{m.prestataire ? ` (${m.prestataire})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* ── TYPE INTERVENANT ── */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2">Type d'intervenant</label>
            <div className="flex gap-4">
              {['prestataire', 'agent_interne'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={t}
                    checked={form.type_intervenant === t}
                    onChange={() => set('type_intervenant', t)}
                  />
                  <span className="text-sm text-text-main">
                    {t === 'prestataire' ? 'Prestataire' : 'Agent interne'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── CHAMPS PRESTATAIRE ── */}
          {form.type_intervenant === 'prestataire' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Nom du prestataire</label>
                <input
                  type="text"
                  value={form.prestataire_nom}
                  onChange={e => set('prestataire_nom', e.target.value)}
                  className="input w-full"
                  placeholder="Entreprise ABC"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">N° BC</label>
                <input
                  type="text"
                  value={form.numero_bc}
                  onChange={e => set('numero_bc', e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Référence marché</label>
                <input
                  type="text"
                  value={form.reference_marche}
                  onChange={e => set('reference_marche', e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Montant HT (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.montant_ht}
                  onChange={e => set('montant_ht', e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
          )}

          {/* ── AGENT INTERNE ── */}
          {form.type_intervenant === 'agent_interne' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Nom de l'agent</label>
                <input
                  type="text"
                  value={form.agent_nom}
                  onChange={e => set('agent_nom', e.target.value)}
                  className="input w-full"
                  placeholder="Prénom NOM"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Nombre d'heures</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.nombre_heures}
                    onChange={e => set('nombre_heures', e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Montant achat HT (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.montant_achat}
                    onChange={e => set('montant_achat', e.target.value)}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── CATÉGORIE (thèmes sans marchés) + TYPE MAINTENANCE ── */}
          <div className="grid grid-cols-2 gap-3">
            {!hasMarches && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Catégorie</label>
                <select
                  value={form.categorie}
                  onChange={e => set('categorie', e.target.value)}
                  className="input w-full"
                >
                  {CATEGORIES_GENERIC.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={hasMarches ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-text-muted mb-2">Type de maintenance</label>
              <div className="flex gap-4 mt-1">
                {['corrective', 'preventive'].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={t}
                      checked={form.type_maintenance === t}
                      onChange={() => set('type_maintenance', t)}
                    />
                    <span className="text-sm text-text-main">
                      {t === 'preventive' ? 'Préventive' : 'Corrective'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── NATURE ── */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Nature de l'intervention</label>
            <textarea
              value={form.nature}
              onChange={e => set('nature', e.target.value)}
              className="input w-full resize-none"
              rows={2}
              placeholder="Décrire la nature des travaux ou de l'intervention…"
            />
          </div>

          {/* ── STATUT + DATES ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Statut</label>
              <select
                value={form.statut}
                onChange={e => set('statut', e.target.value)}
                className="input w-full"
              >
                {STATUTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date de signalement</label>
              <input
                type="date"
                value={form.date_signalement}
                onChange={e => set('date_signalement', e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date prévue</label>
              <input
                type="date"
                value={form.date_prevue}
                onChange={e => set('date_prevue', e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Date réalisée</label>
              <input
                type="date"
                value={form.date_realisee}
                onChange={e => set('date_realisee', e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          {/* ── COMMENTAIRE ── */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Commentaire</label>
            <textarea
              value={form.commentaire}
              onChange={e => set('commentaire', e.target.value)}
              className="input w-full resize-none"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
