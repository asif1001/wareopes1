# **App Name**: WAREOPS

## Core Features:

- Dashboard Overview: Display summary cards and interactive charts for at-a-glance insights into key metrics, focusing on data visualization.
- Data Visualization Tool: Generate custom reports with a drag and drop interface. Allow exporting data in multiple formats (CSV, PDF). Reasoning tool to select the best charts based on user parameters
- Customizable Views: Provide options for configuring data displays, filtering and sorting within all report views, and managing user accounts.
- Shipment Tracking: Real-time tracking of shipments with status updates and detailed logistics information presented clearly.
- Task Assignment System: Manage tasks, assign them to users, and track progress with deadlines.
- Feedback and Complaint System: Submit and track complaints through a structured workflow, providing updates until resolution.

## Style Guidelines:

- Primary color: A saturated blue (#29ABE2) to convey trust and reliability in the data.
- Background color: A very light blue (#EBF5FB) to keep a professional but non-distracting appearance.
- Accent color: A vibrant orange (#F07167) to highlight important actions and metrics.
- Body and headline font: 'Inter' sans-serif, known for its modern and neutral appearance, for both headlines and body text.
- Use a consistent set of line icons throughout the application, with the accent color (#F07167) used selectively to draw attention to key functions.
- Implement a responsive, grid-based layout to ensure the application is usable on devices of all sizes.
- Use subtle transitions and animations to enhance user experience, such as chart loading animations or status update changes.

## Data Refresh Architecture

- Event-driven data operations only; no periodic polling anywhere in the app.
- Data fetches are triggered exclusively by:
  - Explicit Refresh button clicks in modules (e.g., maintenance, tasks badges).
  - Data modifications: Add, Edit, Delete actions dispatch on-demand reads to reconcile state.
- Initial page navigation may load baseline data for the current view; no subsequent automatic re-fetch occurs without user action.
- Dashboard navigation special-case: On first load, perform an immediate refresh, then one more automatic refresh after 20 seconds. After that, automatic refreshes are disabled; manual refresh or user actions must trigger updates.
- Loading states: show spinners or placeholder badges (e.g., '…') during fetch; disable action buttons to prevent duplicate requests.
- Error handling: display non-blocking toasts; keep existing UI state stable; provide retry via Refresh.
- Consistency: Maintenance, Tasks, Vehicles, MHE modules follow this policy; shared helpers centralize fetch and error patterns.