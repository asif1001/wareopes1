# WareOps - Warehouse Operations Management System

A modern warehouse management application built with Next.js 16.1.6, Firebase, and TypeScript. WareOps provides comprehensive tools for managing shipments, inventory, analytics, and warehouse operations.

## 🚀 Features

- **Shipment Management** - Track and manage warehouse shipments
- **Inventory Control** - Real-time inventory tracking and management
- **Analytics Dashboard** - Comprehensive analytics and reporting
- **Modern UI** - Built with Tailwind CSS and shadcn/ui components
- **Firebase Integration** - Real-time database and authentication
- **Responsive Design** - Mobile-friendly interface
- **TypeScript** - Full type safety and better development experience
- **Maintenance & Operations Reminders** - Unified notifications for vehicles, MHEs, and gate passes
- **Oil Status Monitoring** - Real-time visualization of oil tank levels and alerts

## 🛠️ Tech Stack

- **Frontend**: Next.js 16.1.6, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Server**: Firebase Admin SDK for server-only operations

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
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id.firebaseio.com
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id_here
FIREBASE_ADMIN_CREDENTIALS_BASE64=base64_json_or_leave_empty
FIREBASE_ADMIN_CREDENTIALS=json_string_or_leave_empty
GOOGLE_APPLICATION_CREDENTIALS=path_to_service_account_json
```

### 4. Optional: OneDelivery (Oil Status) Firebase Project

If you use the secondary OneDelivery project for oil tank levels, add:

```env
NEXT_PUBLIC_ONEDELIVERY_API_KEY=your_api_key_here
NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_ONEDELIVERY_PROJECT_ID=oneplace-b5fc3
NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_ONEDELIVERY_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_ONEDELIVERY_APP_ID=your_app_id_here
NEXT_PUBLIC_ONEDELIVERY_MEASUREMENT_ID=your_measurement_id_here
```

### 5. Set up Firestore Collections

Create the following collections in your Firestore database:
- `shipments` - For shipment data
- `inventory` - For inventory items
- `analytics` - For analytics data
- `Users` - For user management (canonical; app also falls back to `users`)

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000). In development, the build output uses `.next_v3` to avoid Windows file-locking issues. Production builds use the default `.next` directory.

## 🛠 Maintenance & Operations Reminders

## 🧩 Troubleshooting (Windows)

- If `npm run build` fails with `EISDIR: illegal operation on a directory, readlink ... route.ts`, the project is likely on a non-NTFS drive. Move the repo to an NTFS volume (e.g., `C:\wareopes`) and retry the build.

## 📣 Recent Changes

### Stability & Lint Fixes (Feb 2026)
- **Role Permissions Form Reset**: Added a scoped permissions editor that resets cleanly after role creation, avoiding effect-driven state resets.
- **Settings Edit Dialog Flow**: Updated edit dialog state handling to close on successful submit without triggering effect-based setState warnings.
- **Export Dialog CSV Flow**: Switched to action-driven CSV handling with explicit error state and dialog resets.
- **Productivity Page Error Rendering**: Moved data fetch errors to conditional render output instead of try/catch JSX.
- **Admin Route Guard Cleanup**: Simplified admin access checks and normalized UI copy for lint compliance.
- **Static Rendering Cleanups**: Removed impure calls in server pages and normalized apostrophes across UI strings.

### Dashboard Chart Enhancements
- **Multi-Period Analysis**: Added "Week", "Months", and "Years" period selectors to both Container Overview and Shipment Overview charts.
  - Weekly view: Aggregates data by week number (W1-W52) for detailed short-term analysis.
  - Monthly view: Aggregates data by month (MMM yy) for standard trend analysis.
  - Yearly view: Aggregates data by year (yyyy) for long-term trend analysis.
- **Advanced Source Filtering**:
  - Added multi-select dropdown for filtering data by specific sources (e.g., "China", "Europe").
  - Supports dynamic aggregation of selected sources.
  - Includes "All Sources" quick reset.
- **Data Granularity**:
  - Enhanced backend aggregation logic to support 5-year historical data.
  - Optimized data fetching to return pre-aggregated weekly, monthly, and yearly datasets in a single request.

### Windows Environment & Build Output (Feb 2026)
- **Development Build Output**: Uses `.next_v3` during `npm run dev` to avoid EPERM/file-locking errors on Windows.
- **Production Build Output**: Keeps the default `.next` directory for Vercel compatibility.

### Next.js 16 Upgrade & Security Fixes
- **Framework Upgrade**: Upgraded core framework to Next.js 16.1.1.
- **Security Patch**: Resolved critical security vulnerability CVE-2025-66478.
- **Dependency Resolution**: 
  - Updated `@genkit-ai/next` and related Genkit packages to v1.27.0 to resolve peer dependency conflicts with Next.js 16.
  - Removed deprecated `eslint` and `webpack` configurations from `next.config.ts`.
- **API Route Compatibility**: Updated all dynamic API routes (`[id]`, `[slug]`) to correctly await `params` as required by Next.js 16 async route param behavior.
- **Build System**: Fully migrated to Turbopack as the default development bundler in Next.js 16.

### Oil Status Monitoring Enhancements
- **Enhanced 3D Tank Visualization**
  - Switched from WebGL (Three.js) to a lightweight CSS-based 3D capsule design.
  - Improves performance and eliminates "broken image" / context-loss errors on pages with many tanks.
  - Adds realistic liquid levels, color coding (Green/Yellow/Red), and glass-like effects.
- **Detailed Low Level Alerts**
  - Updated "Low Level Alerts" card to display a scrollable list of specific branches and oil types below 30% capacity, instead of just a summary count.
- **Current Stock Breakdown**
  - Added a detailed breakdown of total current stock by oil type in the "Current Stock" summary card.
- **Stability Fixes**
  - Fixed React "unique key prop" errors in branch and tank lists.
