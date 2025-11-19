# WareOps - Warehouse Operations Management System

A modern warehouse management application built with Next.js 15.3.3, Firebase, and TypeScript. WareOps provides comprehensive tools for managing shipments, inventory, analytics, and warehouse operations.

## 🚀 Features

- **Shipment Management** - Track and manage warehouse shipments
- **Inventory Control** - Real-time inventory tracking and management
- **Analytics Dashboard** - Comprehensive analytics and reporting
- **Modern UI** - Built with Tailwind CSS and shadcn/ui components
- **Firebase Integration** - Real-time database and authentication
- **Responsive Design** - Mobile-friendly interface
- **TypeScript** - Full type safety and better development experience
- **Maintenance & Operations Reminders** - Unified notifications for vehicles, MHEs, and gate passes

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.3.3, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Firestore, Authentication)
- **Development**: Turbopack for fast development builds

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Git**

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/asif1001/wareopes1.git
cd wareopes1
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Get your Firebase configuration from Project Settings
4. Create a `.env` file in the root directory:

```env
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
FIREBASE_APP_ID=your_app_id_here
```

### 4. Set up Firestore Collections

Create the following collections in your Firestore database:
- `shipments` - For shipment data
- `inventory` - For inventory items
- `analytics` - For analytics data
- `Users` - For user management (canonical; app also falls back to `users`)

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 🛠 Maintenance & Operations Reminders

## 📣 Recent Changes (last 24 hours)

- Event-driven refresh model across the app
  - Removed automatic polling on the Maintenance page; vehicles list refreshes only on user actions and initial view load (`src/components/maintenance-client-page.tsx`).
  - Dashboard navigation performs an immediate refresh on load, a one-time refresh after 20 seconds, then disables automatic refreshes; no manual refresh button is shown (`src/components/dashboard-nav.tsx`).

- Modal behavior consistency
  - Data entry/modification modals auto-close after successful saves (e.g., Gate Pass Add and Maintenance record modals) (`src/components/maintenance-client-page.tsx`).
  - View-only modals remain open until explicitly closed by the user.

- Dashboard navigation badges
  - Tasks and Maintenance badges only appear when counts are greater than 0; hidden completely when counts are 0.
  - Accessibility: badges include `aria-live="polite"` and `aria-atomic="true"`.
  - Tests added: `src/__tests__/dashboard-nav-badge.test.tsx`, `src/__tests__/dashboard-nav-maintenance-badge.test.tsx`.

- Add/Edit Vehicle workflow hardening
  - Stable previews for Vehicle Image and document attachments; validations for file types and sizes.
  - Draft persistence for Add Vehicle fields to prevent accidental data loss during re-renders.
  - Year input now preserves empty edits without forcing `0` (`src/components/maintenance-client-page.tsx:696`).
  - Client uploads use progress tracking with resilient fallbacks to server if Storage rules block client writes.

- Server-side improvements
  - Atomic history updates when editing vehicles; merges attachment URLs safely (`src/app/api/vehicles/[id]/route.ts`).

- Documentation updates
  - Architecture doc updated with the new event-driven refresh policy and the dashboard’s one-time follow-up refresh (`docs/blueprint.md`).

Notes
- Typecheck succeeds for the changes (`npm run typecheck`).
- Lint warnings remain unrelated to these updates.

A new dashboard card named "Maintenance & Operations Reminders" aggregates upcoming maintenance and compliance dates from Vehicles, MHEs, and Gate Passes and surfaces them in one place.

What it shows
- Vehicle: insurance expiry, registration expiry, next service due
- MHE: certification expiry (when available), next service due
- Gate Pass: expiry date

Behavior
- Sorts reminders by urgency and color-codes due dates (red/orange/yellow/blue for 0–3/4–7/8–14/15–30 days)
- Interactive actions: View details, Mark as done, Snooze
- Friendly labels: shows vehicle `plateNo` and MHE `equipmentInfo`/`name` instead of raw IDs
- Robust error handling: detects sign-in and permission issues and displays helpful messages

Data sources (Firestore-backed APIs)
- `GET /api/vehicles` → `vehicles` collection
- `GET /api/mhes` → `mhes` collection
- `GET /api/gatepasses` → `gatepasses` collection
- `GET /api/vehicle-maintenance` → vehicle maintenance records
- `GET /api/mhe-maintenance` → MHE maintenance records

File references
- Component: `src/components/maintenance-notifications-card.tsx`
- Integrated in dashboard: `src/components/dashboard-client.tsx` (rendered below `ContainerOverview`)

Previewing the card
- Start dev server: `npm run dev`
- Open dashboard: `http://localhost:3000/dashboard` (or whichever dev port is active)
- The card appears under "Container Overview"

Permissions & errors
- If you see “Please sign in to view maintenance data”, sign in and refresh.
- If you see “Insufficient permissions to view maintenance data”, grant the user appropriate view permissions (or admin) for maintenance.
- If “Unable to load maintenance notifications” appears, check server logs for endpoint errors.

## 🔧 Maintenance Page & Workflow

Route
- `GET /dashboard/maintenance` — Server Component that renders the client page.

Permissions
- Requires `Admin` role or `maintenance:view` permission.
- Gate: reads the `session` cookie, loads the user via Admin SDK, normalizes permissions from `Roles` when explicit user permissions are missing.

Data Flow
- Server-side: loads `Users` and `Branches` and passes them as props to the client page to ensure availability regardless of client Firestore rules.
- Client-side: fetches operational data via APIs:
  - `GET /api/mhes` — MHE master data
  - `GET /api/gatepasses` — Gate pass records
  - `GET /api/vehicle-maintenance` — Vehicle maintenance records
  - `GET /api/mhe-maintenance` — MHE maintenance records

UI & Actions
- Filtering and search for Vehicles, MHEs, Gate Passes, and maintenance records.
- Add/Edit dialogs for Vehicles and MHEs (local state backed by Firestore via API routes).
- Attachments: upload/delete files to/from Firebase Storage for records (e.g., maintenance attachments, images).
- Expiry statuses for gate passes and certifications (Active/Expiring Soon/Expired).

Key Files
- Page: `src/app/dashboard/maintenance/page.tsx` (server-side gate, data hydration, layout)
- Client: `src/components/maintenance-client-page.tsx` (UI, fetches, dialogs, uploads)

Preview
- Start: `npm run dev`
- Open: `http://localhost:3000/dashboard/maintenance` (or your active dev port)

## 📤 Reports Page & Operational Exports

Route
- `GET /dashboard/reports` — Tabbed page with Operational Reports and AI Generator.

Preview
- Start: `npm run dev`
- Open: `http://localhost:3001/dashboard/reports` (dev server may use `3000` or `3001`).

Operational Exports
- Export Vehicles (Excel): downloads `vehicles-report.csv`.
  - Loads vehicles from `/api/vehicles`. If data is not yet loaded, the export performs an on-demand fetch to avoid empty files.
  - Exports even when empty (headers-only) so the button is always usable.
- Export MHE (Excel): downloads `mhe-report.csv` with equipment details, battery, and certification info.
- Export Maintenance (Excel): downloads `maintenance-report.csv` combining Vehicles and MHE maintenance records.
- Export Shipments (Excel) — Date-wise: opens a date range dialog and downloads `shipments-report.csv`.
  - Select `From` and `To` dates, then click `Export`.
  - Branch names: if shipments contain branch IDs or codes, they are mapped to human-readable names via `/api/branches`.
  - Columns include: `Invoice`, `B/L`, `Source`, `Branch`, `Status`, `Num Containers`, `Container Sizes`, `Bookings`, `Bahrain ETA`, `Original Doc Receipt`, `Actual Bahrain ETA`, `WH ETA Requested by Parts`, `WH ETA Confirmed by Logistics`, `Cleared`, `Actual Cleared Date`, `Last Storage Day`, `Total Cases`, `DOM Lines`, `Bulk Lines`, `Total Lines`, `General Remark`, `Remark`, `Arrived Date`, `Completed Date`, `Status Update Date`, `Created At`, `Updated At`.

API Routes (added)
- `GET /api/shipments/by-date-range` → `src/app/api/shipments/by-date-range/route.ts` — returns `{ items: SerializableShipment[] }` filtered by `bahrainEta` within the provided date range (`from`, `to` as `YYYY-MM-DD`).
- `GET /api/branches` → `src/app/api/branches/route.ts` — returns `{ items: Branch[] }` used to map branch IDs/codes to names during export.

Known behaviors
- If a chosen date range has no shipments, the CSV downloads with headers only.
- If your browser blocks automatic downloads, allow downloads for the local dev site.
- If an error occurs during export, an alert displays the error text returned by the API.

## ⚙️ Settings Page Workflow

Route
- `GET /dashboard/settings` — Server Component with a tabbed settings UI.

Permissions
- Requires `Admin` role or `settings:view` permission.
- Server-side gate: validates `session` → loads user via Admin SDK → allows if admin or `settings:view`; otherwise redirects.
- Client-side: wrapped with `<AdminRoute>` for defense-in-depth.

Tabs & Features
- Users: add users (`AddUserDialog`) and view/manage users (`ExistingUsersCard`).
- Sources: create/edit/delete sources.
- Container Sizes: create/edit/delete container size records.
- Departments: create/edit/delete departments, linked to branches.
- Branches: create/edit/delete branches.
- Role-Based Forms: manage form templates per role.
- Roles: manage roles and inspect permissions.

Data Flow
- Server-side: loads Departments, Branches, Roles; serializes data for client safety.
- Actions: deletion operations performed via server actions (e.g., `deleteUserAction`, `deleteSourceAction`, etc.).

Key Files
- Page: `src/app/dashboard/settings/page.tsx`
- Forms: `src/components/settings-forms.tsx`, `src/components/settings-edit-forms.tsx`
- Users table: `src/components/settings-users-table.tsx`
- Actions: `src/app/actions.ts`

Preview
- Start: `npm run dev`
- Open: `http://localhost:3000/dashboard/settings` (or your active dev port)

## 📜 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code linting

## 🔧 Environment Variables

Create a `.env` file with the following variables:

| Variable | Description |
|----------|-------------|
| `FIREBASE_API_KEY` | Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `FIREBASE_APP_ID` | Firebase app ID |

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app directory
├── components/          # Reusable UI components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
│   ├── firebase/       # Firebase configuration and utilities
│   ├── types.ts        # TypeScript type definitions
│   └── utils.ts        # General utility functions
└── ai/                 # AI-related functionality
```

## 🔒 Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already included in `.gitignore`
- Use environment variables for all sensitive configuration

## 👤 Authentication & Sessions

This project uses a custom login flow based on Firestore, not Firebase Auth email/password, to support users identified by employee number.

How it works
- Client submits employee number + password from the login page (`src/app/page.tsx` → `AuthContext.login`).
- Server verifies credentials in `/api/login` using the Firebase Admin SDK, querying the `Users` collection:
	- On success, the route sets a secure HTTP-only `session` cookie with the user id. This cookie is used by middleware to protect `/dashboard/*`.
	- The user object is returned to the client and stored in a simple local session (localStorage) for UI state.
- Middleware (`src/middleware.ts`) checks the `session` cookie and redirects non-authenticated users away from `/dashboard/*`.

Why Admin SDK?
- Admin SDK bypasses Firestore security rules, so login verification doesn’t depend on the client’s auth state.
- Keeps passwords and verification logic server-side. For production, store hashed passwords instead of plaintext and verify with a hashing library (e.g., bcrypt).

Client queries and rules
- Some client features read Firestore directly. Firestore rules require `request.auth != null`.
- `AuthContext` signs the client in anonymously on mount to satisfy rules for reads, without using email/password Firebase Auth.

Environment variables
- Client SDK: `NEXT_PUBLIC_FIREBASE_*` are required for the Firebase Web SDK.
- Admin SDK: Provide service account credentials via `FIREBASE_ADMIN_CREDENTIALS` (JSON string) or `GOOGLE_APPLICATION_CREDENTIALS` path.

Key files
- `src/app/api/login/route.ts` — Server login via Admin SDK and session cookie.
- `src/contexts/AuthContext.tsx` — Login/logout, anonymous sign-in for client reads, local session hydration.
- `src/lib/auth.ts` — Client-side authentication helpers and session utilities.
- `src/lib/firebase/admin.ts` — Admin SDK bootstrap.
- `src/lib/firebase/firebase.ts` — Client SDK bootstrap.
- `src/middleware.ts` — Protects `/dashboard/*` via the `session` cookie.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Firebase Connection Issues
- Ensure your Firebase configuration is correct in the `.env` file
- Check that Firestore is enabled in your Firebase project
- Verify that your Firebase project ID matches the one in `.firebaserc`

### Development Server Issues
- Make sure you're using Node.js version 18 or higher
- Clear the `.next` cache: `rm -rf .next` (or `rmdir /s .next` on Windows)
- Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and Firebase

## 📣 Recent Changes (2025-11-19)
- Shipment Edit modal: displays the updater’s name under `Actual Cleared Date`.
  - While editing, shows `Updated by <current user>`; after save, shows `Last updated by <persisted user>`.
  - Files: `src/components/shipment-form.tsx:439-451`.
- Server actions: persist real user names for provenance on shipments.
  - Resolves `createdBy` and `updatedBy` from the `session` cookie and Admin SDK; falls back gracefully.
  - File: `src/app/dashboard/shipments/actions.ts:71-108`.
- Dev note: Turbopack/webpack cache warning `Pack: Error: incorrect header check` is non-fatal.
  - Fix: delete `.next/cache` and `node_modules/.cache` (if present), reinstall deps (`npm ci`), then `npm run dev`.

## 📣 Recent Changes (2025-10-22)
- Navigation now filters by explicit `view` permissions using `pageKey` in `src/components/dashboard-nav.tsx`.
- `AuthContext` exposes `permissions` and refreshes user via `/api/me` on session restore and post-login for up-to-date nav rendering.
- Added `PermissionRoute` for client-side gating and implemented server-side gates on Shipments and Tasks pages.
- Settings page gate requires `settings:view` (admin alone does not grant view).

- New `GET /api/me` endpoint at `src/app/api/me/route.ts`:
  - Reads `session` cookie to identify the current user.
  - Fetches user via Admin SDK and returns normalized permissions (explicit user permissions or fallback from `Roles`).
  - Response includes: `id`, `employeeNo`, `fullName`, `name`, `role`, `department`, `email`, `redirectPage`, `permissions`.

- `AuthContext.refreshUser` now uses `/api/me` instead of client Firestore:
  - Avoids client-side Firestore reads for refresh.
  - Updates local session (`wareopes_session`) with server-sourced user and permissions.
  - File: `src/contexts/AuthContext.tsx`.

- Server-side permission gate on Settings page:
  - In `src/app/dashboard/settings/page.tsx`, access requires `admin` role or `settings:view` permission.
  - The gate reads the `session` cookie, loads the user via Admin SDK, normalizes permissions from `Roles` when explicit permissions are missing, and redirects unauthorized users to `/dashboard`.
  - Client `<AdminRoute>` remains for defense-in-depth.

- Shipments page data flow confirmed:
  - `src/app/dashboard/shipments/page.tsx` loads data server-side and passes props to client; no direct client Firestore calls for initial load.

- Dev server note:
  - If port `3000` is busy, the dev server runs on `http://localhost:3001`.

### Testing the Changes
- Start dev server: `npm run dev`, then open `http://localhost:3001` (or `3000` if free).
- Verify `/dashboard/settings` redirects when unauthorized and loads when authorized (`admin` or `settings:view`).
- In the UI, trigger a user refresh (e.g., navigate to dashboard); the client should reflect server-normalized permissions and profile from `/api/me`.

### Implementation References
- API: `src/app/api/me/route.ts`
- Auth: `src/contexts/AuthContext.tsx`, `src/lib/auth.ts`
- Permissions: `src/lib/role-utils.ts`, `src/app/dashboard/shipments/actions.ts`
- Settings: `src/app/dashboard/settings/page.tsx`

## Permissions & Navigation
- Permission model: `UserPermissions` maps a page key (`shipments`, `tasks`, `settings`) to actions (`view`, `add`, `edit`, `delete`). See `src/lib/types.ts`.
- Navigation visibility: the sidebar only shows items when the user has explicit `view` permission for that page.
- Implementation: `src/components/dashboard-nav.tsx` adds `pageKey` to nav items and filters using `useAuth().permissions`.
- Page protection: use `PermissionRoute` for client-side gating, and server-side gates in page components for defense-in-depth.

### Usage: PermissionRoute
```tsx
// Client component usage (inside a page component)
import { PermissionRoute } from "@/components/PermissionRoute";

export default function Shipments() {
  return (
    <PermissionRoute pageKey="shipments" action="view">
      {/* shipments UI here */}
    </PermissionRoute>
  );
}
```

### Server-side Gates (Next.js App Router)
```tsx
// Example: tasks page gate (simplified)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function TasksPage() {
  const c = await cookies();
  const raw = c.get("session")?.value;
  const userId = raw ? JSON.parse(raw)?.id ?? raw : null;
  if (!userId) redirect("/");

  const { getAdminDb } = await import("@/lib/firebase/admin");
  const adb = await getAdminDb();
  const snap = await adb.collection("Users").doc(userId).get();
  const udata = snap.exists ? (snap.data() as any) : {};

  // Normalize permissions (explicit or from Roles)
  let permissions = udata?.permissions as any | undefined;
  if (!permissions && udata?.role) {
    const rolesSnap = await adb.collection("Roles").where("name", "==", String(udata.role)).get();
    const arr = rolesSnap.empty ? [] : (rolesSnap.docs[0].data()?.permissions ?? []);
    const normalized: any = {};
    for (const item of arr) {
      const [page, action] = String(item).split(":");
      if (page && action) (normalized[page] ||= []).push(action);
    }
    permissions = Object.keys(normalized).length ? normalized : undefined;
  }

  const canView = Array.isArray(permissions?.tasks) && permissions.tasks.includes("view");
  if (!canView) redirect("/dashboard");

  // render page... 
}
```

### AuthContext & Permissions Hydration
- `src/contexts/AuthContext.tsx` now exposes `permissions` via `useAuth()`.
- On session restore and after successful login, the context calls `/api/me` to hydrate the latest user object including `permissions`.
- This ensures navigation renders correctly without a hard refresh.

### Troubleshooting Sidebar Visibility
- If the sidebar only shows Dashboard/Feedback/Reports:
  - Confirm the user has `view` permission for Shipments/Tasks/Settings.
  - Refresh the page or log out and back in to hydrate permissions.
  - Check localStorage key `wareopes_session` includes `user.permissions`.
  - Verify `/api/me` responds with `permissions` for the current user.

- New `GET /api/me` endpoint at `src/app/api/me/route.ts`:
  - Reads `session` cookie to identify the current user.
  - Fetches user via Admin SDK and returns normalized permissions (explicit user permissions or fallback from `Roles`).
  - Response includes: `id`, `employeeNo`, `fullName`, `name`, `role`, `department`, `email`, `redirectPage`, `permissions`.

- `AuthContext.refreshUser` now uses `/api/me` instead of client Firestore:
  - Avoids client-side Firestore reads for refresh.
  - Updates local session (`wareopes_session`) with server-sourced user and permissions.
  - File: `src/contexts/AuthContext.tsx`.

- Server-side permission gate on Settings page:
  - In `src/app/dashboard/settings/page.tsx`, access requires `admin` role or `settings:view` permission.
  - The gate reads the `session` cookie, loads the user via Admin SDK, normalizes permissions from `Roles` when explicit permissions are missing, and redirects unauthorized users to `/dashboard`.
  - Client `<AdminRoute>` remains for defense-in-depth.

- Shipments page data flow confirmed:
  - `src/app/dashboard/shipments/page.tsx` loads data server-side and passes props to client; no direct client Firestore calls for initial load.

- Dev server note:
  - If port `3000` is busy, the dev server runs on `http://localhost:3001`.

### Testing the Changes
- Start dev server: `npm run dev`, then open `http://localhost:3001` (or `3000` if free).
- Verify `/dashboard/settings` redirects when unauthorized and loads when authorized (`admin` or `settings:view`).
- In the UI, trigger a user refresh (e.g., navigate to dashboard); the client should reflect server-normalized permissions and profile from `/api/me`.

### Implementation References
- API: `src/app/api/me/route.ts`
- Auth: `src/contexts/AuthContext.tsx`, `src/lib/auth.ts`
- Permissions: `src/lib/role-utils.ts`, `src/app/dashboard/shipments/actions.ts`
- Settings: `src/app/dashboard/settings/page.tsx`
