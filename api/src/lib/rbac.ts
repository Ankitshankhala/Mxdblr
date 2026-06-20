import { Permission } from '@prisma/client';

// ── Permission catalog ────────────────────────────────────────────────────────
// The fixed set of permissions, with human labels for the role-editor UI. New
// permission TYPES are added here (a code change), not created by users at runtime.

export interface PermissionMeta {
  key: Permission;
  label: string;
  description: string;
  group: string;
}

export const PERMISSION_CATALOG: PermissionMeta[] = [
  { key: 'VIEW_DASHBOARD', label: 'View Dashboard', description: 'Access the admin dashboard and overview stats', group: 'General' },
  { key: 'MANAGE_PRODUCTS', label: 'Manage Products', description: 'Create, edit, and delete products, categories, brands, banners, and announcements', group: 'Catalog' },
  { key: 'MANAGE_INVENTORY', label: 'Manage Inventory', description: 'Update stock levels and stock status', group: 'Catalog' },
  { key: 'CREATE_ORDERS', label: 'Create Orders', description: 'Create new orders / inquiries', group: 'Orders' },
  { key: 'EDIT_ORDERS', label: 'Edit Orders', description: 'Update order / inquiry status', group: 'Orders' },
  { key: 'VIEW_REPORTS', label: 'View Reports', description: 'View reports and analytics', group: 'Orders' },
  { key: 'MANAGE_STAFF', label: 'Manage Staff', description: 'Invite Managers and Shop Workers and assign them to roles', group: 'People' },
  { key: 'MANAGE_CUSTOMERS', label: 'Manage Customers', description: 'Manage dealer accounts and customer notifications', group: 'People' },
  { key: 'ACCESS_FINANCIAL_DATA', label: 'Access Financial Data', description: 'View pricing and financial information', group: 'Finance' },
  { key: 'SYSTEM_SETTINGS', label: 'System Settings', description: 'Configure geo-restrictions and system-wide settings', group: 'System' },
  { key: 'MANAGE_ROLES', label: 'Manage Roles', description: 'Create, edit, and delete roles and their permissions', group: 'System' },
  { key: 'MANAGE_ADMINS', label: 'Manage Admins', description: 'Create and manage admin-level accounts', group: 'System' },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_CATALOG.map((p) => p.key);

// ── Default (system) roles ──────────────────────────────────────────────────
// `rank` drives the anti-escalation guard: a user may only manage roles/users at a
// rank strictly greater than (= less privileged than) their own. SUPER_ADMIN = 0.

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export interface DefaultRole {
  name: string;
  description: string;
  rank: number;
  permissions: Permission[];
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full control over the platform, roles, permissions, and admin accounts.',
    rank: 0,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'ADMIN',
    description:
      'Platform administration. Can assign staff to roles but cannot change role definitions, manage admin accounts, or change system settings.',
    rank: 10,
    permissions: [
      'VIEW_DASHBOARD', 'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'CREATE_ORDERS',
      'EDIT_ORDERS', 'VIEW_REPORTS', 'MANAGE_STAFF', 'MANAGE_CUSTOMERS',
    ],
  },
  {
    name: 'MANAGER',
    description: 'Operational management of catalog, inventory, orders, and customers.',
    rank: 20,
    permissions: [
      'VIEW_DASHBOARD', 'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'CREATE_ORDERS',
      'EDIT_ORDERS', 'VIEW_REPORTS', 'MANAGE_CUSTOMERS',
    ],
  },
  {
    name: 'SHOP_WORKER',
    description: 'Basic day-to-day functions: dashboard, inventory updates, and creating orders.',
    rank: 30,
    permissions: ['VIEW_DASHBOARD', 'MANAGE_INVENTORY', 'CREATE_ORDERS'],
  },
];

export const SYSTEM_ROLE_NAMES = DEFAULT_ROLES.map((r) => r.name);
