/**
 * MainLayout Component
 * 
 * The root layout that wraps all pages with the Sidebar, TopBar,
 * and a scrollable content area.
 * 
 * Uses react-router-dom <Outlet> to render the matched child route.
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { TopBar } from '../../components/TopBar/TopBar';
import '../../styles/layout.css';
import '../../styles/app-footer.css';

export function MainLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <TopBar />
        <main className="content-area">
          <Outlet />
        </main>
        <footer className="app-footer">
          Developed by <strong>Muhammad Saad</strong>
        </footer>
      </div>
    </div>
  );
}
