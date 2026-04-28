import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Download, Trash2, ChevronDown, ChevronRight, FileText, Search, X, History, Archive } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../utils/api';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Skeleton } from '../../../components/ui/Skeleton';

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function iconForMime(mime) {
  if (!mime) return '📄';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('excel') || mime.includes('sheet')) return '📊';
  if (mime.includes('image')) return '🖼️';
  if (mime.includes('zip') || mime.includes('archive')) return '📦';
  if (mime.includes('text')) return '📃';
  return '📄';
}

function VersionsModal({ docId, operationId, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get(`/operations/${operationId}/documents/${docId}/versions`)
      .then(data => setVersions(data || []))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [docId, operationId]);

  const downloadVersion = async (vDocId, nom) => {
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/documents/${vDocId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error('Erreur téléchargement'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nom; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main flex items-center gap-2">
            <History size={16} /> Historique des versions
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="p-4">
          {loading ? <Skeleton className="h-20 w-full rounded" /> : versions.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">Aucune version.</p>
          ) : (
            <div className="divide-y divide-border">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm font-medium text-text-main">v{v.version}</span>
                    <span className="text-xs text-text-muted ml-2">{v.nom_affichage}</span>
                    <div className="text-xs text-text-muted">{fmtDate(v.created_at)} · {fmtSize(v.taille_octets)}</div>
                  </div>
                  <button onClick={() => downloadVersion(v.id, v.nom_affichage)} className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5">
                    <Download size={12} /> Télécharger
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadModal({ operationId, categories, onUploaded, onClose }) {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ nom_affichage: '', categorie_id: '', description: '', fichier_parent_id: '' });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const handleFile = (f) => {
    setFile(f);
    if (!form.nom_affichage) setForm(prev => ({ ...prev, nom_affichage: f.name.replace(/\.[^.]+$/, '') }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Sélectionnez un fichier'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('nom_affichage', form.nom_affichage || file.name);
      if (form.categorie_id) fd.append('categorie_id', form.categorie_id);
      if (form.description) fd.append('description', form.description);
      if (form.fichier_parent_id) fd.append('fichier_parent_id', form.fichier_parent_id);

      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erreur upload');
      toast.success('Document ajouté');
      onUploaded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-main flex items-center gap-2">
            <Upload size={16} /> Ajouter un document
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {/* Zone drop */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file ? 'border-primary bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input ref={fileRef} type="file" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            {file ? (
              <div>
                <div className="text-2xl mb-1">{iconForMime(file.type)}</div>
                <div className="text-sm font-medium text-text-main">{file.name}</div>
                <div className="text-xs text-text-muted">{fmtSize(file.size)}</div>
              </div>
            ) : (
              <div>
                <Upload size={24} className="mx-auto mb-2 text-gray-300" />
                <div className="text-sm text-text-muted">Cliquez ou glissez un fichier ici</div>
                <div className="text-xs text-text-muted mt-0.5">50 Mo max</div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Nom affiché *</label>
            <input type="text" value={form.nom_affichage} onChange={e => setForm(f => ({ ...f, nom_affichage: e.target.value }))}
              className="input w-full" placeholder="Nom du document…" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Catégorie</label>
            <select value={form.categorie_id} onChange={e => setForm(f => ({ ...f, categorie_id: e.target.value }))} className="input w-full">
              <option value="">— Sans catégorie —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input w-full resize-none" rows={2} placeholder="Description optionnelle…" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={uploading || !file} className="btn-primary flex items-center gap-1.5">
              <Upload size={14} /> {uploading ? 'Envoi…' : 'Téléverser'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentRow({ doc, operationId, onDelete, isReadOnly }) {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const toast = useToast();

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error('Erreur téléchargement'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.nom_affichage; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 group transition-colors">
        <span className="text-lg shrink-0">{iconForMime(doc.type_mime)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-main truncate">{doc.nom_affichage}</span>
            {doc.version > 1 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-text-muted font-mono">v{doc.version}</span>
            )}
          </div>
          {doc.description && <p className="text-xs text-text-muted truncate mt-0.5">{doc.description}</p>}
          <div className="flex gap-3 text-xs text-text-muted mt-0.5">
            <span>{fmtSize(doc.taille_octets)}</span>
            <span>{fmtDate(doc.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {doc.version > 1 && (
            <button onClick={() => setVersionsOpen(true)} className="p-1.5 rounded hover:bg-gray-100 text-text-muted" title="Versions">
              <History size={14} />
            </button>
          )}
          <button onClick={handleDownload} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Télécharger">
            <Download size={14} />
          </button>
          {!isReadOnly && (
            <button onClick={() => setDeleteOpen(true)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Supprimer">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {versionsOpen && (
        <VersionsModal docId={doc.id} operationId={operationId} onClose={() => setVersionsOpen(false)} />
      )}
      <ConfirmModal
        open={deleteOpen}
        title="Supprimer le document"
        message={`Supprimer "${doc.nom_affichage}" ? Cette action est irréversible.`}
        onConfirm={() => { onDelete(doc.id); setDeleteOpen(false); }}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

function CategoryAccordion({ category, docs, operationId, onDelete, isReadOnly }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-base">{categoryIcon(category?.icone)}</span>
        <span className="flex-1 text-sm font-semibold text-text-main">{category?.libelle || 'Autres'}</span>
        <span className="text-xs text-text-muted">{docs.length} fichier{docs.length > 1 ? 's' : ''}</span>
        {open ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {docs.map(doc => (
            <DocumentRow key={doc.id} doc={doc} operationId={operationId} onDelete={onDelete} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function categoryIcon(icone) {
  const icons = {
    FileSearch: '🔍', FileText: '📄', FileSignature: '✍️', ClipboardCheck: '✅',
    Mail: '✉️', Image: '🖼️', Archive: '📦', Banknote: '💶', File: '📁',
  };
  return icons[icone] || '📁';
}

export function TabDocuments({ operationId }) {
  const { isReadOnly } = useAuth();
  const toast = useToast();

  const [docs, setDocs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [docsData, catsData] = await Promise.all([
        api.get(`/operations/${operationId}/documents`),
        api.get(`/operations/${operationId}/documents/categories`),
      ]);
      setDocs(docsData || []);
      setCategories(catsData || []);
    } catch (err) {
      toast.error('Erreur chargement documents : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDelete = async (docId) => {
    try {
      await api.delete(`/operations/${operationId}/documents/${docId}`);
      toast.success('Document supprimé');
      await loadDocs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleZip = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('opera_token');
      const res = await fetch(`/api/v1/operations/${operationId}/documents/zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error('Erreur export ZIP'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents-${operationId}-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.nom_affichage.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || d.categorie_id === filterCat;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = {};
  filtered.forEach(doc => {
    const catId = doc.categorie_id || '__sans__';
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(doc);
  });

  // Order by category ordre
  const catOrder = [...categories].sort((a, b) => (a.ordre || 99) - (b.ordre || 99));

  if (loading) return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un document…"
            className="input pl-8 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={12} />
            </button>
          )}
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input w-44 text-sm">
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
        </select>
        <button onClick={handleZip} disabled={downloading || docs.length === 0} className="btn-secondary text-sm flex items-center gap-1.5">
          <Archive size={14} /> {downloading ? 'Export…' : 'ZIP'}
        </button>
        {!isReadOnly && (
          <button onClick={() => setUploadOpen(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Upload size={14} /> Ajouter
          </button>
        )}
      </div>

      {/* Stats */}
      {docs.length > 0 && (
        <div className="flex gap-4 text-sm text-text-muted mb-4">
          <span><strong className="text-text-main">{docs.length}</strong> document{docs.length > 1 ? 's' : ''}</span>
          <span>{(docs.reduce((s, d) => s + (d.taille_octets || 0), 0) / (1024 * 1024)).toFixed(1)} Mo total</span>
          {filtered.length !== docs.length && <span className="text-primary">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Document list */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-muted">
          <Upload size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{docs.length === 0 ? 'Aucun document déposé.' : 'Aucun résultat pour cette recherche.'}</p>
          {docs.length === 0 && !isReadOnly && (
            <button onClick={() => setUploadOpen(true)} className="btn-primary text-sm mt-3 inline-flex items-center gap-1.5">
              <Upload size={14} /> Ajouter le premier document
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {catOrder.map(cat => {
            const catDocs = grouped[cat.id];
            if (!catDocs?.length) return null;
            return (
              <CategoryAccordion key={cat.id} category={cat} docs={catDocs}
                operationId={operationId} onDelete={handleDelete} isReadOnly={isReadOnly} />
            );
          })}
          {grouped['__sans__']?.length > 0 && (
            <CategoryAccordion
              key="__sans__"
              category={{ libelle: 'Sans catégorie', icone: 'File' }}
              docs={grouped['__sans__']}
              operationId={operationId}
              onDelete={handleDelete}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      )}

      {uploadOpen && (
        <UploadModal
          operationId={operationId}
          categories={categories}
          onUploaded={() => { loadDocs(); setUploadOpen(false); }}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  );
}
