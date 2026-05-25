/**
 * ImportFeuxModal
 * Téléchargement du gabarit Excel et import pour les armoires feux et feux tricolores.
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react';

const BASE_URL = '/api/v1';

function getToken() {
  return localStorage.getItem('opera_token');
}

export function ImportFeuxModal({ open, onClose, onSuccess }) {
  const [file, setFile]             = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [clearFirst, setClearFirst] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef();

  if (!open) return null;

  // ── Téléchargement du gabarit ─────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    setDownloadLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/import/feux/template`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Erreur lors du téléchargement');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'gabarit_feux_tricolores.xlsx';
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

  // ── Toggle purge ──────────────────────────────────────────────────────────
  const handleToggleClear = (checked) => {
    if (checked) setConfirmClear(true);
    else { setClearFirst(false); setConfirmClear(false); }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const url = `${BASE_URL}/import/feux${clearFirst ? '?clearFirst=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Erreur ${res.status}`);
      setResults(json.data);
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
    setClearFirst(false);
    setConfirmClear(false);
    onClose();
  };

  const hasErrors = results &&
    (results.armoires.errors.length > 0 || results.feux.errors.length > 0);

  // ── Modale de confirmation purge ──────────────────────────────────────────
  if (confirmClear) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <h3 className="font-heading font-semibold text-text-main">Confirmer la suppression</h3>
          </div>
          <p className="text-sm text-text-muted leading-relaxed">
            Toutes les <strong>armoires feux</strong> et tous les <strong>feux tricolores</strong> existants seront
            définitivement supprimés avant l'import. Cette action est <strong>irréversible</strong>.
          </p>
          <div className="flex gap-3 justify-end mt-1">
            <button onClick={() => { setClearFirst(false); setConfirmClear(false); }} className="btn-secondary text-sm">
              Annuler
            </button>
            <button
              onClick={() => { setClearFirst(true); setConfirmClear(false); }}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white transition-colors"
              style={{ backgroundColor: '#C0392B' }}
            >
              Oui, supprimer
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* En-tête */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-red-500" />
            <h2 className="font-heading font-semibold text-text-main text-base">
              Import Excel — Feux tricolores
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
              Le fichier contient deux feuilles : <strong>Armoires</strong> et <strong>Feux tricolores</strong>,
              ainsi qu'un onglet <strong>Guide</strong> avec les valeurs acceptées.
            </p>
            <div className="ml-7">
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadLoading}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Download size={14} />
                {downloadLoading ? 'Téléchargement…' : 'Télécharger gabarit_feux_tricolores.xlsx'}
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
              <>
                <div
                  className={`ml-7 border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    dragging ? 'border-red-400 bg-red-50' : 'border-border hover:border-red-300'
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

                {/* Option purge */}
                <label className={`ml-7 mt-3 flex items-start gap-2.5 cursor-pointer rounded-xl border p-3 transition-colors ${
                  clearFirst ? 'border-red-300 bg-red-50' : 'border-border hover:border-red-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={clearFirst}
                    onChange={e => handleToggleClear(e.target.checked)}
                    className="mt-0.5 accent-red-600 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      Vider les données existantes avant l'import
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Supprime toutes les armoires et tous les feux tricolores actuels,
                      puis importe les données du fichier. Recommandé pour un chargement initial.
                    </p>
                    {clearFirst && (
                      <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                        <Trash2 size={11} /> Les données existantes seront supprimées à l'import
                      </p>
                    )}
                  </div>
                </label>
              </>
            )}
          </div>

          {/* Résultats */}
          {results && (
            <div className="flex flex-col gap-3">
              {results.purged && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs text-orange-700 flex items-center gap-2">
                  <Trash2 size={13} /> Données existantes supprimées avant l'import
                </div>
              )}
              <ResultBlock
                label="Armoires feux"
                created={results.armoires.created}
                updated={results.armoires.updated}
                errors={results.armoires.errors}
              />
              <ResultBlock
                label="Feux tricolores"
                created={results.feux.created}
                updated={results.feux.updated}
                errors={results.feux.errors}
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
              {hasErrors && (
                <p className="text-xs text-red-600 flex items-center gap-1 mr-auto">
                  <AlertCircle size={14} /> Import terminé avec des erreurs
                </p>
              )}
              <button
                onClick={() => { onSuccess?.(); handleClose(); }}
                className="btn-primary text-sm px-4"
              >
                Fermer et actualiser
              </button>
            </>
          ) : (
            <>
              <button onClick={handleClose} className="btn-secondary text-sm">Annuler</button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className={`text-sm flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 ${
                  clearFirst ? 'bg-red-600 hover:bg-red-700' : 'btn-primary'
                }`}
              >
                <Upload size={14} />
                {loading
                  ? (clearFirst ? 'Suppression puis import…' : 'Import en cours…')
                  : (clearFirst ? 'Vider et importer' : 'Lancer l\'import')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Bloc résultat par catégorie ───────────────────────────────────────────────
function ResultBlock({ label, created, updated, errors }) {
  const hasErr = errors.length > 0;
  return (
    <div className={`rounded-xl border p-4 ${hasErr ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
      <p className="font-medium text-sm text-text-main mb-2">{label}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
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
