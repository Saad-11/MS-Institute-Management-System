/**
 * Navigation types for the sidebar and routing
 */

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  implemented: boolean;
  description?: string;
}
