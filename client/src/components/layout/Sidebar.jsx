import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, BarChart3, Settings, Building2, Route, Lightbulb, Zap, X, Bell, PieChart, TrafficCone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

// Rôles exclus de la section Paramètres (admin uniquement pour l'écriture)
const HIDE_SETTINGS_ROLES = ['write', 'charge_operation', 'compta', 'administratif', 'gestionnaire_patrimonial'];
// Rôles sans accès au Module A (Opérations / Mandat)
const HIDE_MODULE_A_ROLES = ['gestionnaire_patrimonial'];

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { to: '/operations', icon: FolderOpen, label: 'Opérations',
    hideForRoles: HIDE_MODULE_A_ROLES,
    children: [
      { to: '/operations', label: 'Toutes les opérations', exact: true },
      { to: '/operations/new', label: 'Nouvelle opération' }
    ]
  },
  { to: '/mandat', icon: BarChart3, label: 'Résilience & Mandat',
    hideForRoles: HIDE_MODULE_A_ROLES,
  },
  { to: '/settings', icon: Settings, label: 'Paramètres',
    hideForRoles: HIDE_SETTINGS_ROLES,
  },
];

const PATRIMOINE_ITEMS = [
  { to: '/patrimoine/voirie',    icon: Route,     label: 'Voirie' },
  { to: '/patrimoine/eclairage', icon: Lightbulb,     label: 'Éclairage public' },
  { to: '/patrimoine/feux',      icon: TrafficCone,   label: 'Feux tricolores' },
  { to: '/patrimoine/batiments', icon: Building2,     label: 'Bâtiments' },
  { to: '/patrimoine/energie',   icon: Zap,       label: 'Tableau de bord énergie' },
  { to: '/patrimoine/demandes',  icon: Bell,      label: 'Demandes d\'intervention' },
  { to: '/patrimoine/bilan',     icon: PieChart,  label: 'Bilan interventions' },
];

function useNouvellesDemandes(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const fetch = () => {
      api.get('/demandes').then(data => {
        if (!cancelled) setCount((data || []).filter(d => d.statut === 'nouvelle').length);
      }).catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 60000); // rafraîchissement toutes les 60s
    return () => { cancelled = true; clearInterval(interval); };
  }, [enabled]);
  return count;
}

export function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, canEditPatrimoineReferentiel } = useAuth();
  const userRole = user?.role || 'directeur';
  const isOpsActive       = location.pathname.startsWith('/operations');
  const isPatrimoineActive = location.pathname.startsWith('/patrimoine');
  const nbNouvelles = useNouvellesDemandes(canEditPatrimoineReferentiel);

  const navItems = NAV_ITEMS.filter(item =>
    !item.hideForRoles || !item.hideForRoles.includes(userRole)
  );

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full z-40 flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      style={{ width: 240, backgroundColor: 'var(--color-primary)' }}
    >
      {/* Logo + bouton fermeture mobile */}
      <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={22} className="text-white" />
          <div>
            <div className="font-heading font-bold text-white text-base leading-tight">OpéraTrack</div>
            <div className="text-white/50 text-xs">Ville de Denain</div>
          </div>
        </div>
        {/* Bouton X visible uniquement sur mobile */}
        <button
          onClick={onClose}
          className="md:hidden text-white/60 hover:text-white transition-colors p-1 rounded"
          aria-label="Fermer le menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(item => (
          <NavSection key={item.to} item={item} isOpsActive={isOpsActive} onClose={onClose} />
        ))}

        {/* Section Gestion Patrimoniale — visible pour tous les profils */}
        <div className="mt-4">
          <div className="px-5 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
            Gestion Patrimoniale
          </div>
          {PATRIMOINE_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg mb-0.5 transition-colors ${
                  isActive ? '' : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) => isActive ? {
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderLeft: '3px solid #E8920A',
                paddingLeft: '17px',
              } : {}}
            >
              <item.icon size={18} className="text-white shrink-0" />
              <span className="text-white text-sm font-medium flex-1">{item.label}</span>
              {item.to === '/patrimoine/demandes' && nbNouvelles > 0 && (
                <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white min-w-[20px] text-center leading-tight">
                  {nbNouvelles}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer — affiche le profil courant */}
      <div className="px-5 py-4 border-t border-white/10">
        <ProfilBadge role={userRole} />
      </div>
    </aside>
  );
}

// Badge profil en pied de sidebar
const PROFIL_LABELS = {
  administrateur:             'Administrateur',
  admin:                      'Administrateur',
  charge_operation:           'Chargé d\'opération',
  write:                      'Chargé d\'opération',
  gestionnaire_patrimonial:   'Gestionnaire patrimonial',
  directeur:                  'Directeur / DGA',
  read:                       'Directeur / DGA',
  administratif:              'Administratif',
  compta:                     'Administratif',
  exploitant:                 'Exploitant',
};

function ProfilBadge({ role }) {
  return (
    <div className="text-white/40 text-xs truncate">
      {PROFIL_LABELS[role] || role}
    </div>
  );
}

function NavSection({ item, isOpsActive, onClose }) {
  if (item.disabled) {
    return (
      <div className="flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg opacity-40 cursor-not-allowed">
        <item.icon size={18} className="text-white shrink-0" />
        <span className="text-white text-sm font-medium">{item.label}</span>
        <span className="ml-auto text-white/40 text-xs">Bientôt</span>
      </div>
    );
  }

  if (item.children) {
    return (
      <div>
        <Link
          to={item.to}
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg mb-0.5 transition-colors hover:bg-white/5"
          style={isOpsActive ? {
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderLeft: '3px solid #E8920A',
            paddingLeft: '17px'
          } : {}}
        >
          <item.icon size={18} className="text-white shrink-0" />
          <span className="text-white text-sm font-medium">{item.label}</span>
        </Link>
        {isOpsActive && (
          <div className="pl-10 pr-4 mb-1">
            {item.children.map(child => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.exact}
                onClick={onClose}
                className={({ isActive }) =>
                  `block py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                    isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
                  }`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.exact}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg mb-0.5 transition-colors ${
          isActive ? '' : 'hover:bg-white/5'
        }`
      }
      style={({ isActive }) => isActive ? {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderLeft: '3px solid #E8920A',
        paddingLeft: '17px'
      } : {}}
    >
      <item.icon size={18} className="text-white shrink-0" />
      <span className="text-white text-sm font-medium">{item.label}</span>
    </NavLink>
  );
}
