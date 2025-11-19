## Scope
- Add a new `License` tab beside `Gate Passes` in `src/components/maintenance-client-page.tsx`.
- Implement full CRUD: list, add, edit, delete driver licenses.
- Support multiple licenses per driver (different vehicle types) and attachments.
- Show expiry status and allow filtering/search; prepare for notifications on upcoming expiries.

## Data Model
- `DriverLicense`:
  - `id: string`
  - `driverId: string` (from `users` list)
  - `vehicleType: string`
  - `licenseNumber: string`
  - `issueDate?: string | null`
  - `expiryDate?: string | null`
  - `attachmentUrl?: string | null`
  - `remarks?: string | null`
- Utility: reuse `expiryStatus()` and `daysUntil()` patterns already present for vehicles/gate passes to compute `Active`, `Expiring Soon`, `Expired`.

## API Endpoints (client-side integration)
- `GET /api/licenses?limit=50&driverId=<id>` → `{ items: DriverLicense[] }`
- `POST /api/licenses` → `{ item: DriverLicense }`
- `PUT /api/licenses/<id>` → `{ item: DriverLicense }`
- `DELETE /api/licenses/<id>` → `{ ok: true }`
- Attachments via Firebase Storage, mirroring vehicle image/attachments flow:
  - Upload license document to Storage, save `attachmentUrl` in record.

## UI Implementation
- Tabs
  - Add `<TabsTrigger value="license">License ({filteredLicenses.length})</TabsTrigger>` after Gate Passes.
  - Add `<TabsContent value="license">` containing listing and dialogs.
- List/Table
  - Columns: Driver, Vehicle Type, License No., Issue Date, Expiry Date, Status, Actions.
  - Status uses `<Badge variant={expiryStatusVariant}>`.
  - Search integrates with existing `searchQuery`.
- Actions (row-level, right-aligned)
  - Dropdown: `Edit License`, `Open Document`, `Delete License`.
  - Tooltips and ARIA labels consistent with current style (Radix DropdownMenu/Tooltip).
- Dialogs
  - Add License:
    - Fields: Driver (Select from `users`), Vehicle Type, License Number, Issue Date, Expiry Date, Attachment (file upload), Remarks.
    - Validation: required `driverId`, `vehicleType`, `licenseNumber`, `issueDate`, `expiryDate`.
  - Edit License: same form, prefilled values.
  - Delete License: AlertDialog with confirm.
- Attachments
  - Upload document (PDF/image) to Firebase Storage using existing helpers (`ref`, `uploadBytesResumable`, `getDownloadURL`).
  - Preview: if image show thumbnail; if PDF, show filename with link.

## State & Hooks
- Add `licenses: DriverLicense[]` state with load on mount similar to vehicles/gate passes.
- Add `filteredLicenses` memoized by `searchQuery` and status filter.
- Dialog state: `addLicenseOpen`, `editingLicenseId`, `deleteLicenseId`.
- Forms: `LicenseForm` component (inline in file, matching style of `VehicleFormPro`).

## Expiry Notifications
- In-tab: show counts of expiring within 30 days; filter chip for `All / Soon / Expired`.
- Optional extension (separate PR): include license expiries in `DashboardNav` maintenance badge by updating the expiring count aggregation.

## Accessibility & UX
- Use ARIA labels consistently: `aria-label="Edit License"`, `role="status"` for badges.
- Keep consistent spacing, card layouts, tooltips, and button variants.
- Provide toast messages on save/update/delete outcomes.

## Testing
- Add unit tests that:
  - Render the License tab and list with mocked `GET /api/licenses`.
  - Open Add dialog, validate required fields, simulate upload, and assert new row appears.
  - Open Edit and Delete flows via dropdown actions.
  - Assert expiry status badges reflect `issueDate/expiryDate` correctly.
- Reuse patterns from `maintenance-actions.test.tsx` for interactions.

## Security & Data Integrity
- Validate file types and max size for attachments (PDF/images only).
- Sanitize displayed fields; avoid logging secrets.

## Estimated Changes
- `src/components/maintenance-client-page.tsx`: add types, state, effects, tab UI, forms, actions.
- Optional: new API route handlers if needed by your backend (not included here).

If this plan matches your expectations, I will implement the License tab and its CRUD UI following the existing component patterns and styling.