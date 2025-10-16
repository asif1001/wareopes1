// Client-side wrappers that call server-side API routes for actions
// These avoid importing server-only code into client components.
export async function changePasswordClient(formData: FormData) {
  const res = await fetch('/api/actions/change-password', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function updateNotificationPreferencesClient(formData: FormData) {
  const res = await fetch('/api/actions/notification-preferences', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function submitSupportTicketClient(formData: FormData) {
  const res = await fetch('/api/actions/support-ticket', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function logoutClient() {
  const res = await fetch('/api/actions/logout', { method: 'POST' });
  return res.json();
}

export async function updateUserProfileClient(userId: string, profile: Record<string, any>) {
  const res = await fetch('/api/actions/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, profile }),
  });
  return res.json();
}
