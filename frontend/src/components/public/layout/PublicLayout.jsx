import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Skip-to-content link (a11y): first focusable element, visible only on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] bg-pub-blue-600 text-white px-4 py-2 rounded shadow focus:outline-none focus:ring-2 focus:ring-pub-blue-300"
      >
        Skip to main content
      </a>
      <PublicNavbar />
      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
