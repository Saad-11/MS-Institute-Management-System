/**
 * PlaceholderPage Component
 * 
 * Shown for all modules that are not yet implemented.
 * Displays the module name and a clear message about future availability.
 * Does NOT pretend features are working or show fake data.
 */

import { useLocation } from 'react-router-dom';
import { Clock, Construction } from 'lucide-react';
import { navigationItems } from '../../config/navigation';
import '../../styles/placeholder.css';

export function PlaceholderPage() {
  const location = useLocation();

  // Find the navigation item for the current route
  const currentNav = navigationItems.find(
    (item) => item.path === location.pathname
  );

  const moduleName = currentNav?.label ?? 'Module';
  const moduleDescription =
    currentNav?.description ?? 'This module is not yet available.';

  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">
        <Construction size={32} />
      </div>

      <h2>{moduleName}</h2>

      <p>{moduleDescription}</p>

      <p>
        This module will be implemented in a later development phase.
      </p>

      <div className="placeholder-phase-note">
        <Clock size={14} />
        Coming in a future update
      </div>
    </div>
  );
}
