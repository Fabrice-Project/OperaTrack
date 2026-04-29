import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, BarChart3, Settings, Building2, Route, Lightbulb, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { to: '/operations', icon: FolderOpen, label: 'Opérations', children: [
    { to: '/operations', label: 'Toutes les opérations', exact: true },
    { to: '/operations/new', label: 'Nouvelle opération' }
  ]},
  { to: '/mandat', icon: BarChart3, label: 'Résilience & Mandat' },
  { to: '/settings', icon: Settings, label: 'Paramètres', hideForRoles: ['write', 'charge_operation', 'compta'] },
];

const PATRIMOINE_ITEMS = [
  { to: '/patrimoine/voirie',    icon: Route,     label: 'Voirie' },
  { to: '/patrimoine/eclairage', icon: Lightbulb, label: 'Éclairage public' },
  { to: '/patrimoine/batiments', icon: Building2, label: 'Bâtiments' },
  { to: '/patrimoine/energie',   icon: Zap,       label: 'Tableau de bord énergie' },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const userRole = user?.role || 'read';
  const isOpsActive = location.pathname.startsWith('/operations');
  const isPatrimoineActive = location.pathname.startsWith('/patrimoine');

  const navItems = NAV_ITEMS.filter(item =>
    !item.hideForRoles || !item.hideForRoles.includes(userRole)
  );

  const showPatrimoine = userRole !== 'compta';

  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200"
      style={{ width: 240, backgroundColor: 'var(--color-primary)' }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Building2 size={22} className="text-white" />
          <div>
            <div className="font-heading font-bold text-white text-base leading-tight">OpéraTrack</div>
            <div className="text-white/50 text-xs">Ville de Denain</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(item => (
          <NavSection key={item.to} item={item} isOpsActive={isOpsActive} />
        ))}

        {/* Section Gestion Patrimoniale */}
        {showPatrimoine && (
          <div className="mt-4">
            <div className="px-5 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
              Gestion Patrimoniale
            </div>
            {PATRIMOINE_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
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
                <span className="text-white text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="text-white/30 text-xs">Phase 5b — Avril 2026</div>
      </div>
    </aside>
  );
}

function NavSection({ item, isOpsActive }) {
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
