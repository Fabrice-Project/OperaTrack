import { useLocation, Link } from 'react-router-dom';
import { LogOut, User, ChevronRight, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const BREADCRUMBS = {
  '/': [{ label: 'Tableau de bord' }],
  '/operations': [{ label: 'Opérations', to: '/operations' }],
  '/operations/new': [{ label: 'Opérations', to: '/operations' }, { label: 'Nouvelle opération' }]
};

const ROLE_LABELS = {
  admin:                    'Administrateur',
  administrateur:           'Administrateur',
  charge_operation:         'Chargé d\'opération',
  write:                    'Chargé d\'opération',
  gestionnaire_patrimonial: 'Gest. patrimonial',
  directeur:                'Directeur / DGA',
  read:                     'Directeur / DGA',
  administratif:            'Administratif',
  compta:                   'Administratif',
};

export function Header({ title, breadcrumbs: customBreadcrumbs, onMenuClick }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const crumbs = customBreadcrumbs || BREADCRUMBS[location.pathname] || [{ label: title || '' }];

  const handleLogout = async () => {
    await logout();
    toast.info('Vous avez été déconnecté.');
  };

  return (
    <header className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Hamburger — visible uniquement sur mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-gray-100 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-1 text-sm min-w-0">
          <Link to="/" className="text-text-muted hover:text-secondary transition-colors text-xs shrink-0">
            Accueil
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              <ChevronRight size={12} className="text-text-muted shrink-0" />
              {crumb.to ? (
                <Link to={crumb.to} className="text-text-muted hover:text-secondary transition-colors text-xs truncate">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-main text-xs font-semibold truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Utilisateur + déconnexion */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User size={14} className="text-primary" />
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-text-main leading-tight">{user?.full_name}</div>
            <div className="text-xs text-text-muted">{ROLE_LABELS[user?.role] || user?.role}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
          title="Se déconnecter"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
