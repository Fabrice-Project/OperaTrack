import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';
import { Skeleton } from '../../../components/ui/Skeleton';

const NIVEAUX = [
  { value: 'non_renseigne', label: 'Non renseigné', color: '#9CA3AF', bg: '#F3F4F6' },
  { value: 'non_concerne',  label: 'Non concerné',  color: '#6B7280', bg: '#F9FAFB' },
  { value: 'partiel',       label: 'Partiel',        color: '#D97706', bg: '#FEF3C7' },
  { value: 'significatif',  label: 'Significatif',   color: '#2563EB', bg: '#DBEAFE' },
  { value: 'structurant',   label: 'Structurant',    color: '#1E7E45', bg: '#D1FAE5' },
];
const NIVEAU_MAP = Object.fromEntries(NIVEAUX.map(n => [n.value, n]));
const SCORE_MAP = { non_renseigne: 0, non_concerne: 0, partiel: 1, significatif: 2, structurant: 3 };

const VOLETS = [
  { num: 1, key: 'resilience_v1', label: 'Climatique', emoji: '🌿', description: 'Adaptation au changement climatique, gestion des eaux pluviales, végétalisation' },
  { num: 2, key: 'resilience_v2', label: 'Énergétique', emoji: '⚡', description: 'Performance énergétique, sobriété, énergies renouvelables' },
  { num: 3, key: 'resilience_v3', label: 'Social', emoji: '👥', description: 'Confort d\'usage, accessibilité, protection des publics vulnérables' },
  { num: 4, key: 'resilience_v4', label: 'Économique', emoji: '💶', description: 'Réduction des coûts, éligibilité aux financements, retour sur investissement' },
];

function NiveauBadge({ niveau }) {
  const cfg = NIVEAU_MAP[niveau] || NIVEAU_MAP.non_renseigne;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function ScoreIndicator({ score }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="w-3 h-3 rounded-full border"
          style={{ backgroundColor: i < score ? '#1A3A5C' : 'transparent', borderColor: '#1A3A5C' }} />
      ))}
      <span className="text-xs text-text-muted ml-1">{score}/4</span>
    </div>
  );
}

function VoletCard({ volet, niveau, leviers, leviersActifs, onChange, onLeviersChange, isReadOnly }) {
  const [open, setOpen] = useState(true);
  const voletLeviers = leviers.filter(l => l.volet === volet.num);
  const activeCount = voletLeviers.filter(l => leviersActifs.includes(l.id)).length;
  const cfg = NIVEAU_MAP[niveau] || NIVEAU_MAP.non_renseigne;

  const toggleLevier = (id) => {
    const newIds = leviersActifs.includes(id)
      ? leviersActifs.filter(l => l !== id)
      : [...leviersActifs, id];

    onLeviersChange(newIds);

    // Recalculer le niveau selon la proportion de leviers actifs dans ce volet
    // (non_concerne est préservé : c'est un choix explicite indépendant des leviers)
    if (niveau === 'non_concerne') return;

    const actifs = newIds.filter(lid => voletLeviers.some(l => l.id === lid)).length;
    const total  = voletLeviers.length;

    let newNiveau;
    if (actifs === 0) {
      newNiveau = 'non_renseigne';
    } else if (total === 0 || actifs / total < 0.34) {
      newNiveau = 'partiel';
    } else if (actifs / total < 0.67) {
      newNiveau = 'significatif';
    } else {
      newNiveau = 'structurant';
    }

    if (newNiveau !== niveau) onChange(volet.key, newNiveau);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(o => !o)}>
        <span className="text-xl">{volet.emoji}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-text-main">Volet {volet.num} — {volet.label}</div>
          <div className="text-xs text-text-muted mt-0.5">{volet.description}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <NiveauBadge niveau={niveau} />
          {activeCount > 0 && (
            <span className="text-xs text-text-muted">{activeCount} levier{activeCount > 1 ? 's' : ''}</span>
          )}
          {open ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-border p-4">
          {/* Niveau de concordance */}
          {!isReadOnly && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-muted mb-2">Niveau de concordance</label>
              <div className="flex flex-wrap gap-2">
                {NIVEAUX.map(n => (
                  <button key={n.value} onClick={() => onChange(volet.key, n.value)}
                    className="px-3 py-1 rounded-full text-xs font-medium border-2 transition-all"
                    style={{
                      backgroundColor: niveau === n.value ? n.bg : 'white',
                      color: niveau === n.value ? n.color : '#6B7280',
                      borderColor: niveau === n.value ? n.color : '#E5E7EB',
                    }}>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leviers */}
          {voletLeviers.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-text-muted mb-2">
                Leviers activés ({activeCount}/{voletLeviers.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {voletLeviers.map(l => (
                  <label key={l.id} className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-gray-50 ${isReadOnly ? 'cursor-default' : ''}`}>
                    <input type="checkbox" checked={leviersActifs.includes(l.id)}
                      onChange={() => !isReadOnly && toggleLevier(l.id)}
                      disabled={isReadOnly}
                      className="rounded" />
                    <span className="text-sm text-text-main">{l.libelle}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TabResilience({ op }) {
  const operationId = op.id;
  const { isReadOnly } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    resilience_v1: 'non_renseigne', resilience_v2: 'non_renseigne',
    resilience_v3: 'non_renseigne', resilience_v4: 'non_renseigne',
    resilience_commentaire: '', financements_resilience: '',
    leviers_actifs: [],
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/operations/${operationId}/resilience`);
      setData(d);
      setForm({
        resilience_v1: d.resilience_v1 || 'non_renseigne',
        resilience_v2: d.resilience_v2 || 'non_renseigne',
        resilience_v3: d.resilience_v3 || 'non_renseigne',
        resilience_v4: d.resilience_v4 || 'non_renseigne',
        resilience_commentaire: d.resilience_commentaire || '',
        financements_resilience: d.financements_resilience || '',
        leviers_actifs: d.leviers_actifs || [],
      });
      setDirty(false);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [operationId]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/operations/${operationId}/resilience`, form);
      toast.success('Résilience enregistrée');
      setDirty(false);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24 rounded-xl" />{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const score = [1,2,3,4].filter(v => {
    const n = form[`resilience_v${v}`];
    return n && n !== 'non_renseigne' && n !== 'non_concerne';
  }).length;

  const scoreLabelMap = { 0: 'Non évalué', 1: 'Concordance faible', 2: 'Concordance partielle', 3: 'Bonne concordance', 4: 'Concordance maximale' };
  const scoreColorMap = { 0: '#9CA3AF', 1: '#C0392B', 2: '#E8920A', 3: '#2563EB', 4: '#1E7E45' };

  return (
    <div>
      {/* Score global */}
      <div className="card p-5 mb-5 flex items-center gap-5">
        <div>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Score de concordance résilience</div>
          <ScoreIndicator score={score} />
        </div>
        <div className="flex-1">
          <span className="text-lg font-bold font-heading" style={{ color: scoreColorMap[score] }}>
            {scoreLabelMap[score]}
          </span>
          <div className="text-xs text-text-muted mt-0.5">{score} volet{score > 1 ? 's' : ''} activé{score > 1 ? 's' : ''} sur 4</div>
        </div>
        {!isReadOnly && dirty && (
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 shrink-0">
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>

      {/* 4 volets */}
      <div className="flex flex-col gap-3 mb-5">
        {VOLETS.map(v => (
          <VoletCard key={v.num} volet={v}
            niveau={form[v.key]}
            leviers={data?.leviers || []}
            leviersActifs={form.leviers_actifs}
            onChange={(key, val) => handleChange(key, val)}
            onLeviersChange={ids => { setForm(f => ({ ...f, leviers_actifs: ids })); setDirty(true); }}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>

      {/* Commentaire et financements */}
      <div className="card p-5 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Mesures concrètes retenues dans le projet</label>
          <textarea value={form.resilience_commentaire}
            onChange={e => handleChange('resilience_commentaire', e.target.value)}
            disabled={isReadOnly}
            className="input w-full resize-none" rows={3}
            placeholder="Décrivez les actions concrètes de résilience intégrées au projet…" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Financements résilience mobilisés ou envisagés</label>
          <textarea value={form.financements_resilience}
            onChange={e => handleChange('financements_resilience', e.target.value)}
            disabled={isReadOnly}
            className="input w-full resize-none" rows={2}
            placeholder="Ex : Fonds vert : 80 000 € — dossier déposé le 15/03/2025" />
        </div>
        {!isReadOnly && dirty && (
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
