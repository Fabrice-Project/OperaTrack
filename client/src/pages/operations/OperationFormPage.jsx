import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, MapPin, Upload, X } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { useOperation } from '../../hooks/useOperations';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

const TYPES = [
  { value: 'construction_neuve', label: 'Construction neuve' },
  { value: 'rehabilitation', label: 'Réhabilitation' },
  { value: 'amenagement_vrd', label: 'Aménagement VRD' }
];

const STATUTS = [
  { value: 'etudes', label: 'Études' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'travaux', label: 'Travaux' },
  { value: 'reception', label: 'Réception' },
  { value: 'soldee', label: 'Soldée' }
];

const MODES = [
  { value: 'enveloppe_globale', label: 'Enveloppe globale' },
  { value: 'ap_cp', label: 'AP/CP' }
];

const EMPTY = {
  intitule: '', type: 'construction_neuve', statut: 'etudes',
  adresse: '', description: '',
  maitre_oeuvre: '', enveloppe_ht: '', mode_financier: 'enveloppe_globale',
  montant_engage: '0', montant_mandate: '0',
  date_debut: '', date_livraison_prev: '', date_reception: '',
  latitude: '', longitude: '', image_url: ''
};

// ── Composant multi-chargés ───────────────────────────────────
function ChargesManager({ charges, users, onChange }) {
  const available = users.filter(u => !charges.find(c => c.user_id === u.id));

  const add = (userId) => {
    if (!userId) return;
    onChange([...charges, { user_id: userId, label: '', ordre: charges.length + 1 }]);
  };
  const remove = (userId) => onChange(charges.filter(c => c.user_id !== userId));
  const setLabel = (userId, label) =>
    onChange(charges.map(c => c.user_id === userId ? { ...c, label } : c));

  return (
    <div className="flex flex-col gap-2">
      {charges.map((c, i) => {
        const user = users.find(u => u.id === c.user_id);
        return (
          <div key={c.user_id} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-border rounded-lg">
              <span className="text-sm font-medium text-text-main min-w-0 truncate">{user?.full_name || c.user_id}</span>
              <input
                value={c.label}
                onChange={e => setLabel(c.user_id, e.target.value)}
                placeholder="Phase (ex : Études, Travaux…)"
                className="input text-xs py-1 flex-1 min-w-0"
              />
            </div>
            <button type="button" onClick={() => remove(c.user_id)}
              className="text-text-muted hover:text-red-500 shrink-0">
              <X size={15} />
            </button>
          </div>
        );
      })}
      {available.length > 0 && (
        <select className="form-select text-sm" onChange={e => { add(e.target.value); e.target.value = ''; }} defaultValue="">
          <option value="">+ Ajouter un chargé d'opération…</option>
          {available.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      )}
      {charges.length === 0 && available.length === 0 && (
        <p className="text-xs text-text-muted">Aucun chargé disponible.</p>
      )}
    </div>
  );
}

export default function OperationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const { operation, loading: opLoading } = useOperation(id);
  const [form, setForm] = useState(EMPTY);
  const [users, setUsers] = useState([]);
  const [charges, setCharges] = useState([]); // [{ user_id, label, ordre }]
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/users/charges').then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (id) api.get(`/operations/${id}/charges`).then(setCharges).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (operation && isEdit) {
      setForm({
        intitule: operation.intitule || '',
        type: operation.type || 'construction_neuve',
        statut: operation.statut || 'etudes',
        adresse: operation.adresse || '',
        description: operation.description || '',
        charged_id: operation.charged_id || '',
        maitre_oeuvre: operation.maitre_oeuvre || '',
        enveloppe_ht: operation.enveloppe_ht?.toString() || '',
        mode_financier: operation.mode_financier || 'enveloppe_globale',
        montant_engage: operation.montant_engage?.toString() || '0',
        montant_mandate: operation.montant_mandate?.toString() || '0',
        date_debut: operation.date_debut?.split('T')[0] || '',
        date_livraison_prev: operation.date_livraison_prev?.split('T')[0] || '',
        date_reception: operation.date_reception?.split('T')[0] || '',
        latitude: operation.latitude?.toString() || '',
        longitude: operation.longitude?.toString() || '',
        image_url: operation.image_url || ''
      });
      if (operation.image_url) setImagePreview(operation.image_url);
    }
  }, [operation, isEdit]);

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.intitule.trim()) e.intitule = 'L\'intitulé est obligatoire';
    if (!form.enveloppe_ht || isNaN(form.enveloppe_ht)) e.enveloppe_ht = 'Montant invalide';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const geocode = async () => {
    if (!form.adresse.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(form.adresse)}&limit=1`);
      const data = await res.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        setForm(prev => ({ ...prev, latitude: lat.toFixed(7), longitude: lng.toFixed(7) }));
        toast.success('Coordonnées géocodées avec succès');
      } else {
        toast.error('Adresse non trouvée — vérifiez la saisie');
      }
    } catch {
      toast.error('Erreur lors du géocodage');
    } finally {
      setGeocoding(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    try {
      const payload = { ...form };
      let savedOp;

      if (isEdit) {
        savedOp = await api.put(`/operations/${id}`, payload);
        toast.success('Opération mise à jour avec succès');
      } else {
        savedOp = await api.post('/operations', payload);
        toast.success('Opération créée avec succès');
      }

      // Sauvegarder les chargés d'opération
      await api.put(`/operations/${savedOp.id}/charges`, {
        charges: charges.map((c, i) => ({ ...c, ordre: i + 1 })),
      });

      if (imageFile && savedOp.id) {
        await api.uploadImage(savedOp.id, imageFile);
      }

      navigate(`/operations/${savedOp.id}`);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbs = [
    { label: 'Opérations', to: '/operations' },
    { label: isEdit ? 'Modifier l\'opération' : 'Nouvelle opération' }
  ];

  if (opLoading && isEdit) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-heading font-bold text-text-main" style={{ fontSize: 26 }}>
            {isEdit ? 'Modifier l\'opération' : 'Nouvelle opération'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Section : Informations générales */}
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-text-main text-base mb-4">Informations générales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="form-label">Intitulé *</label>
                <input className={`form-input ${errors.intitule ? 'border-danger' : ''}`} value={form.intitule} onChange={e => set('intitule', e.target.value)} placeholder="Ex. : Construction de la maison de quartier" />
                {errors.intitule && <p className="text-danger text-xs mt-1">{errors.intitule}</p>}
              </div>

              <div>
                <label className="form-label">Type d'opération *</label>
                <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Statut *</label>
                <select className="form-select" value={form.statut} onChange={e => set('statut', e.target.value)}>
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Chargés d'opération</label>
                <ChargesManager charges={charges} users={users} onChange={setCharges} />
              </div>

              <div>
                <label className="form-label">Maître d'œuvre</label>
                <input className="form-input" value={form.maitre_oeuvre} onChange={e => set('maitre_oeuvre', e.target.value)} placeholder="Ex. : Cabinet Leroy & Associés, Valenciennes" />
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description détaillée de l'opération…" />
              </div>
            </div>
          </div>

          {/* Section : Localisation */}
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-text-main text-base mb-4">Localisation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="form-label">Adresse</label>
                <div className="flex gap-2">
                  <input className="form-input flex-1" value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Ex. : Rue des Acacias, 59220 Denain" />
                  <button type="button" className="btn-secondary flex items-center gap-1.5 shrink-0" onClick={geocode} disabled={geocoding}>
                    <MapPin size={14} />
                    {geocoding ? 'Géocodage…' : 'Géocoder'}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Latitude</label>
                <input className="form-input" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="50.3236" />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input className="form-input" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="3.3952" />
              </div>
            </div>
          </div>

          {/* Section : Finances */}
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-text-main text-base mb-4">Données financières</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Enveloppe HT (€) *</label>
                <input type="number" className={`form-input font-mono ${errors.enveloppe_ht ? 'border-danger' : ''}`} value={form.enveloppe_ht} onChange={e => set('enveloppe_ht', e.target.value)} placeholder="1 250 000" min="0" step="0.01" />
                {errors.enveloppe_ht && <p className="text-danger text-xs mt-1">{errors.enveloppe_ht}</p>}
              </div>
              <div>
                <label className="form-label">Mode de financement *</label>
                <select className="form-select" value={form.mode_financier} onChange={e => set('mode_financier', e.target.value)}>
                  {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Montant engagé (€)</label>
                <input type="number" className="form-input font-mono" value={form.montant_engage} onChange={e => set('montant_engage', e.target.value)} min="0" step="0.01" />
              </div>
              <div>
                <label className="form-label">Montant mandaté (€)</label>
                <input type="number" className="form-input font-mono" value={form.montant_mandate} onChange={e => set('montant_mandate', e.target.value)} min="0" step="0.01" />
              </div>
            </div>
          </div>

          {/* Section : Planning */}
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-text-main text-base mb-4">Planning</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Date de début</label>
                <input type="date" className="form-input" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Livraison prévisionnelle</label>
                <input type="date" className="form-input" value={form.date_livraison_prev} onChange={e => set('date_livraison_prev', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Date de réception</label>
                <input type="date" className="form-input" value={form.date_reception} onChange={e => set('date_reception', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section : Image */}
          <div className="card p-6">
            <h2 className="font-heading font-semibold text-text-main text-base mb-4">Image de l'opération</h2>
            {imagePreview ? (
              <div className="relative mb-3">
                <img src={imagePreview} alt="Aperçu" className="w-full h-48 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); set('image_url', ''); }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50 transition-colors"
                >
                  <X size={16} className="text-danger" />
                </button>
              </div>
            ) : null}
            <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-border rounded-lg p-4 hover:border-secondary hover:bg-blue-50 transition-all">
              <Upload size={20} className="text-text-muted" />
              <div>
                <div className="text-sm font-medium text-text-main">Cliquer pour uploader une image</div>
                <div className="text-xs text-text-muted">JPG, PNG — max 5 Mo</div>
              </div>
              <input type="file" accept="image/jpeg,image/png" onChange={handleImageChange} className="hidden" />
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-6">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Annuler
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
              <Save size={16} />
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer l\'opération'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
