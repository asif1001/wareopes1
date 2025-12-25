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
- **Oil Status Monitoring** - Real-time visualization of oil tank levels and alerts

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

## 📣 Recent Changes

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
  - Fixed filtering logic crashes caused by undefined branch names or locations.
  - Resolved TypeScript and Test configuration errors by installing missing peer dependencies (`@testing-library/dom`, `@fullcalendar/core`).

### Previous Updates
- **Event-driven refresh model**: Removed automatic polling; dashboard refreshes on load and user action.
- **Modal Consistency**: Auto-close on save for data entry; view-only modals remain open.
- **Dashboard Badges**: Tasks/Maintenance badges only show when count > 0; added accessibility attributes.
- **Vehicle Workflow**: Improved file previews, validations, and draft persistence.
