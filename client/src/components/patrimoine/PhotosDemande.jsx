import { useState, useEffect, useCallback } from 'react';
import { Image, X, Trash2, ZoomIn, Loader } from 'lucide-react';
import { api } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photo, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white"
        >
          <X size={24} />
        </button>
        <img
          src={photo.url}
          alt={photo.nom}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        {photo.nom && (
          <div className="text-center text-white/60 text-xs mt-2">{photo.nom}</div>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function PhotosDemande({ demandeId, refreshTrigger }) {
  const toast = useToast();
  const { isAdmin, isGestPatrim } = useAuth();
  const canDelete = isAdmin || isGestPatrim;

  const [photos,   setPhotos]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [lightbox, setLightbox] = useState(null); // photo en cours de visualisation
  const [deleting, setDeleting] = useState(null); // id en cours de suppression

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/demandes/${demandeId}/photos`);
      setPhotos(data || []);
    } catch (err) {
      toast.error('Erreur chargement photos : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [demandeId]);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleDelete = async (photo) => {
    if (!window.confirm(`Supprimer la photo « ${photo.nom || 'photo'} » ?`)) return;
    setDeleting(photo.id);
    try {
      await api.delete(`/demandes/${demandeId}/photos/${photo.id}`);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted py-1">
      <Loader size={12} className="animate-spin" /> Chargement photos…
    </div>
  );

  if (photos.length === 0) return null;

  return (
    <>
      {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />}

      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
          <Image size={12} />
          Photos ({photos.length})
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square">
              <img
                src={photo.url}
                alt={photo.nom}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setLightbox(photo)}
                loading="lazy"
              />
              {/* Overlay hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1">
                <button
                  onClick={() => setLightbox(photo)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/20 rounded-full text-white hover:bg-white/40"
                  title="Agrandir"
                >
                  <ZoomIn size={14} />
                </button>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(photo)}
                    disabled={deleting === photo.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-500/70 rounded-full text-white hover:bg-red-600"
                    title="Supprimer"
                  >
                    {deleting === photo.id
                      ? <Loader size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
