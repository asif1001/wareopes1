/**
 * Every module that can be granted in Settings → Access control.
 *
 * To add a module: add it here (and to `AppPageKey`). It then appears in the
 * permission matrix automatically and nobody can use it until an admin grants
 * access (deny by default).
 */

export const PERMISSION_ACTIONS = ["view", "add", "edit", "delete", "approve", "export"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  add: "Add",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
};

export const ACTION_HELP: Record<PermissionAction, string> = {
  view: "Can see the page and its data",
  add: "Can create new records",
  edit: "Can change existing records",
  delete: "Can delete records",
  approve: "Can approve or reject records",
  export: "Can download or export data",
};

export type ModuleKey =
  | "dashboard"
  | "shipments"
  | "dispatches"
  | "production"
  | "maintenance"
  | "licenses"
  | "oil_status"
  | "warehouse"
  | "tasks"
  | "productivity"
  | "feedback"
  | "reports"
  | "attendance"
  | "settings"
  | "user_management";

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  group: string;
  description: string;
  /** Actions that mean something for this module; only these appear in the matrix. */
  actions: PermissionAction[];
  /** Page paths (prefix match). */
  paths: string[];
  /** Was open to every logged-in user before access control (migration keeps it). */
  legacyOpen?: boolean;
  /** Added recently: never granted automatically. */
  isNew?: boolean;
};

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    group: "General",
    description: "Home page charts and summaries",
    actions: ["view", "export"],
    paths: ["/dashboard", "/dashboard/employee", "/dashboard/manager"],
    legacyOpen: true,
  },
  {
    key: "shipments",
    label: "Shipments",
    group: "Operations",
    description: "Shipments, container bookings, bulk import",
    actions: ["view", "add", "edit", "delete", "export"],
    paths: ["/dashboard/shipments"],
  },
  {
    key: "dispatches",
    label: "Dispatches",
    group: "Operations",
    description: "Dispatch records and photos",
    actions: ["view", "add", "edit", "delete", "export"],
    paths: ["/dashboard/dispatches", "/dashboard/dispatch"],
    legacyOpen: true,
  },
  {
    key: "production",
    label: "Production",
    group: "Operations",
    description: "Production case uploads and processing",
    actions: ["view", "add", "edit", "delete", "export"],
    paths: ["/dashboard/production"],
  },
  {
    key: "productivity",
    label: "Productivity",
    group: "Operations",
    description: "Productivity entries and summaries",
    actions: ["view", "add", "edit", "export"],
    paths: ["/dashboard/productivity"],
  },
  {
    key: "tasks",
    label: "Tasks",
    group: "Operations",
    description: "Tasks, comments and attachments",
    actions: ["view", "add", "edit", "delete"],
    paths: ["/dashboard/tasks"],
  },
  {
    key: "warehouse",
    label: "Warehouse 3D",
    group: "Operations",
    description: "Branch rack occupancy, snapshots, rack builder (new feature)",
    actions: ["view", "add", "edit", "delete", "export"],
    paths: ["/dashboard/warehouse"],
    isNew: true,
  },
  {
    key: "attendance",
    label: "Attendance",
    group: "People",
    description: "Contract staff GPS attendance, overtime approval, corrections, month reports (new feature)",
    actions: ["view", "add", "edit", "delete", "approve", "export"],
    paths: ["/dashboard/attendance"],
    isNew: true,
  },
  {
    key: "maintenance",
    label: "Maintenance",
    group: "Assets",
    description: "Vehicles, MHE, gate passes and maintenance records",
    actions: ["view", "add", "edit", "delete", "export"],
    paths: ["/dashboard/maintenance"],
  },
  {
    key: "licenses",
    label: "Driver License",
    group: "Assets",
    description: "Driver licences and attachments",
    actions: ["view", "add", "edit", "delete", "export"],
    paths: ["/dashboard/driver-license"],
  },
  {
    key: "oil_status",
    label: "Oil Status",
    group: "Assets",
    description: "Oil tank levels",
    actions: ["view", "export"],
    paths: ["/dashboard/oil-status"],
  },
  {
    key: "reports",
    label: "Reports",
    group: "General",
    description: "Report generator",
    actions: ["view", "export"],
    paths: ["/dashboard/reports"],
    legacyOpen: true,
  },
  {
    key: "feedback",
    label: "Feedback",
    group: "General",
    description: "Feedback and complaints",
    actions: ["view", "add"],
    paths: ["/dashboard/feedback"],
    legacyOpen: true,
  },
  {
    key: "settings",
    label: "Settings — master data & forms",
    group: "Administration",
    description: "Sources, container sizes, departments, branches, role-based forms",
    actions: ["view", "add", "edit", "delete"],
    paths: ["/dashboard/settings"],
  },
  {
    key: "user_management",
    label: "User management",
    group: "Administration",
    description: "Create, edit and delete user accounts. Roles and permissions are always Admin only.",
    actions: ["view", "add", "edit", "delete"],
    paths: [],
  },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

export function getModule(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

/** Pages that only the Admin role may open (not grantable). */
export const ADMIN_ONLY_PATHS = ["/dashboard/admin"];

/** The module that owns a dashboard path (longest matching prefix), or null. */
export function moduleForPath(pathname: string): ModuleDef | null {
  let best: { module: ModuleDef; length: number } | null = null;
  for (const m of MODULES) {
    for (const p of m.paths) {
      const matches = p === "/dashboard" ? pathname === "/dashboard" : pathname === p || pathname.startsWith(`${p}/`);
      if (matches && (!best || p.length > best.length)) best = { module: m, length: p.length };
    }
  }
  return best?.module ?? null;
}
