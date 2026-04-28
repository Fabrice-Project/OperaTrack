import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children, title, breadcrumbs }) {
  return (
    <div className="flex min-h-screen bg-bg-page">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: 240 }}>
        <Header title={title} breadcrumbs={breadcrumbs} />
        <main className="flex-1 p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
