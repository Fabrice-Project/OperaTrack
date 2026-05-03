/**
 * ImportEclairageModal
 * Permet de télécharger le gabarit Excel et d'importer un fichier rempli
 * pour les armoires et points lumineux.
 */

import { useState, useRef } from 'react';
import { X, Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

const BASE_URL = '/api/v1';

function getToken() {
  return localStorage.getItem('opera_token');
}

export function ImportEclairageModal({ open, onClose, onSuccess }) {
  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const inputRef = useRef();

  if (!open) return null;

  // ── Téléchargement du gabarit ─────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    setDownloadLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/import/eclairage/template`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Erreur lors du téléchargement');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'gabarit_eclairage.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.xlsx')) setFile(f);
    else alert('Veuillez déposer un fichier .xlsx');
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BASE_URL}/import/eclairage`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Erreur ${res.status}`);
      setResults(json.data);
      onSuccess?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Fermeture & reset ─────────────────────────────────────────────────────
  const handleClose = () => {
    setFile(null);
    setResults(null);
    onClose();
  };

  const hasErrors = results &&
    (results.armoires.errors.length > 0 || results.pointsLumineux.errors.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* En-tête */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-amber-500" />
            <h2 className="font-heading font-semibold text-text-main text-base">
              Import Excel — Éclairage public
            </h2>
          </div>
          <button onClick={handleClose} className="text-text-muted hover:text-text-main transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Étape 1 — Gabarit */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
              <span className="text-sm font-medium text-text-main">Télécharger le gabarit Excel</span>
            </div>
            <p className="text-xs text-text-muted ml-7 mb-3">
              Le fichier contient deux feuilles à remplir : <strong>Armoires</strong> et <strong>Points lumineux</strong>, ainsi qu'un onglet <strong>Guide</strong> avec les valeurs acceptées.
            </p>
            <div className="ml-7">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadLoading}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Download size={14} />
                {downloadLoading ? 'Téléchargement…' : 'Télécharger gabarit_eclairage.xlsx'}
              </button>
            </div>
          </div>

          <hr className="border-border" />

          {/* Étape 2 — Déposer le fichier */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
              <span className="text-sm font-medium text-text-main">Importer votre fichier rempli</span>
            </div>

            {!results && (
              <div
                className={`ml-7 border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  dragging ? 'border-amber-400 bg-amber-50' : 'border-border hover:border-amber-300'
                }`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={24} className="mx-auto mb-2 text-text-muted" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-text-main">{file.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {(file.size / 1024).toFixed(0)} Ko — cliquer pour changer
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-text-muted">Glisser-déposer votre fichier .xlsx ici</p>
                    <p className="text-xs text-text-muted mt-0.5">ou cliquer pour parcourir</p>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }}
                />
              </div>
            )}
          </div>

          {/* Résultats */}
          {results && (
            <div className="flex flex-col gap-3">
              <ResultBlock
                label="Armoires"
                created={results.armoires.created}
                updated={results.armoires.updated}
                errors={results.armoires.errors}
              />
              <ResultBlock
                label="Points lumineux"
                created={results.pointsLumineux.created}
                updated={results.pointsLumineux.updated}
                errors={results.pointsLumineux.errors}
              />
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          {results ? (
            <>
              {!hasErrors && (
                <p className="text-xs text-green-600 flex items-center gap-1 mr-auto">
                  <CheckCircle size={14} /> Import terminé avec succès
                </p>
              )}
              <button onClick={handleClose} className="btn-primary text-sm px-4">
                Fermer
              </button>
            </>
          ) : (
            <>
              <button onClick={handleClose} className="btn-secondary text-sm">
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Upload size={14} />
                {loading ? 'Import en cours…' : 'Lancer l\'import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bloc résultat par catégorie ───────────────────────────────────────────────
function ResultBlock({ label, created, updated, errors }) {
  const hasErr = errors.length > 0;
  return (
    <div className={`rounded-xl border p-4 ${hasErr ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
      <p className="font-medium text-sm text-text-main mb-2">{label}</p>
      <div className="flex gap-4 text-xs mb-2">
        <span className="flex items-center gap-1 text-green-700">
          <CheckCircle size={12} /> {created} créé{created !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1 text-blue-700">
          <CheckCircle size={12} /> {updated} mis à jour
        </span>
        {hasErr && (
          <span className="flex items-center gap-1 text-red-700">
            <AlertCircle size={12} /> {errors.length} erreur{errors.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {hasErr && (
        <ul className="text-xs text-red-700 flex flex-col gap-0.5 max-h-28 overflow-y-auto">
          {errors.map((e, i) => <li key={i} className="font-mono">• {e}</li>)}
        </ul>
      )}
    </div>
  );
}
