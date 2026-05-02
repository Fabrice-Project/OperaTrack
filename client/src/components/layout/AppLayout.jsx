import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children, title, breadcrumbs }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-page">
      {/* Overlay mobile — ferme la sidebar au clic */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenu principal — marge gauche uniquement sur md+ */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-[240px] print:ml-0">
        <div className="print:hidden">
          <Header
            title={title}
            breadcrumbs={breadcrumbs}
            onMenuClick={() => setSidebarOpen(v => !v)}
          />
        </div>
        <main className="flex-1 p-4 md:p-6 animate-fade-in print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
