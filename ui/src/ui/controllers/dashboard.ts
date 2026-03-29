import type { DashboardCard, DashboardFilters } from "../views/dashboard-card.js";

export type { DashboardCard, DashboardFilters };

const API_BASE = "/api/dashboard";

// ---------------------------------------------------------------------------
// State type (duck-typed to match the pattern of other controllers)
// ---------------------------------------------------------------------------

export type DashboardState = {
  dashboardCards: DashboardCard[];
  dashboardFilters: DashboardFilters;
  dashboardLoading: boolean;
};

// ---------------------------------------------------------------------------
// REST API helpers
// ---------------------------------------------------------------------------

export async function loadDashboardCards(filters?: DashboardFilters): Promise<DashboardCard[]> {
  const params = new URLSearchParams();
  if (filters?.date) {
    params.set("date", filters.date);
  }
  if (filters?.pinned !== undefined) {
    params.set("pinned", String(filters.pinned));
  }
  if (filters?.tag) {
    params.set("tag", filters.tag);
  }
  if (filters?.search) {
    params.set("search", filters.search);
  }
  if (filters?.preset) {
    params.set("preset", filters.preset);
  }

  const query = params.toString();
  const url = `${API_BASE}/cards${query ? `?${query}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load dashboard cards: ${res.status}`);
  }
  const data = (await res.json()) as { cards: DashboardCard[] };
  return data.cards ?? [];
}

export async function syncCronJobsToDashboard(
  jobs: Array<{ id: string; name?: string; enabled?: boolean }>,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/sync-cron`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs }),
    });
  } catch {
    // sync errors must not block dashboard loading
  }
}

export async function pinDashboardCard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}/pin`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to pin card: ${res.status}`);
  }
}

export async function unpinDashboardCard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}/unpin`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to unpin card: ${res.status}`);
  }
}

export async function deleteDashboardCard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete card: ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// State controller helpers (used by app.ts / app-gateway.ts)
// ---------------------------------------------------------------------------

export async function refreshDashboard(
  state: DashboardState,
  opts?: { cronJobs?: Array<{ id: string; name?: string; enabled?: boolean }> },
): Promise<void> {
  if (state.dashboardLoading) {
    return;
  }
  state.dashboardLoading = true;
  try {
    // If cron jobs are provided, sync them to dashboard first
    if (opts?.cronJobs && opts.cronJobs.length > 0) {
      await syncCronJobsToDashboard(opts.cronJobs);
    }
    const cards = await loadDashboardCards(state.dashboardFilters);
    state.dashboardCards = cards;
  } catch (err) {
    console.error("[dashboard] refreshDashboard error:", err);
  } finally {
    state.dashboardLoading = false;
  }
}

export async function handleDashboardPin(state: DashboardState, id: string): Promise<void> {
  try {
    await pinDashboardCard(id);
    // Optimistically update local state
    state.dashboardCards = state.dashboardCards.map((c) =>
      c.id === id ? { ...c, isPinned: true } : c,
    );
  } catch (err) {
    console.error("[dashboard] pin error:", err);
    await refreshDashboard(state);
  }
}

export async function handleDashboardUnpin(state: DashboardState, id: string): Promise<void> {
  try {
    await unpinDashboardCard(id);
    state.dashboardCards = state.dashboardCards.map((c) =>
      c.id === id ? { ...c, isPinned: false } : c,
    );
  } catch (err) {
    console.error("[dashboard] unpin error:", err);
    await refreshDashboard(state);
  }
}

export async function handleDashboardDelete(state: DashboardState, id: string): Promise<void> {
  try {
    await deleteDashboardCard(id);
    state.dashboardCards = state.dashboardCards.filter((c) => c.id !== id);
  } catch (err) {
    console.error("[dashboard] delete error:", err);
    await refreshDashboard(state);
  }
}
