import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children, title, breadcrumbs }) {
  return (
    <div className="flex min-h-screen bg-bg-page">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-h-screen ml-[240px] print:ml-0">
        <div className="print:hidden">
          <Header title={title} breadcrumbs={breadcrumbs} />
        </div>
        <main className="flex-1 p-6 animate-fade-in print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
