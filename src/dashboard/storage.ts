import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { DashboardCard, DashboardData, DashboardFilters } from "./types.js";

const DASHBOARD_DATA_VERSION = 1;

function resolveDashboardDir(): string {
  return path.join(resolveStateDir(), "dashboard");
}

function resolveDashboardFilePath(): string {
  return path.join(resolveDashboardDir(), "dashboard.json");
}

function ensureDashboardDirExists(): void {
  const dir = resolveDashboardDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadDashboard(): DashboardData {
  ensureDashboardDirExists();
  const filePath = resolveDashboardFilePath();
  if (!fs.existsSync(filePath)) {
    const empty: DashboardData = { cards: [], version: DASHBOARD_DATA_VERSION };
    fs.writeFileSync(filePath, JSON.stringify(empty, null, 2), "utf-8");
    return empty;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as DashboardData;
    if (!Array.isArray(parsed.cards)) {
      return { cards: [], version: DASHBOARD_DATA_VERSION };
    }
    return parsed;
  } catch {
    return { cards: [], version: DASHBOARD_DATA_VERSION };
  }
}

export function saveDashboard(data: DashboardData): void {
  ensureDashboardDirExists();
  const filePath = resolveDashboardFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function addCard(
  input: Omit<DashboardCard, "id" | "createdAt" | "updatedAt">,
): DashboardCard {
  const data = loadDashboard();
  const now = new Date().toISOString();
  const card: DashboardCard = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  data.cards.push(card);
  saveDashboard(data);
  return card;
}

export function updateCard(
  id: string,
  updates: Partial<Omit<DashboardCard, "id" | "createdAt">>,
): DashboardCard | null {
  const data = loadDashboard();
  const idx = data.cards.findIndex((c) => c.id === id);
  if (idx === -1) {
    return null;
  }
  const existing = data.cards[idx];
  if (!existing) {
    return null;
  }
  const updated: DashboardCard = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  data.cards[idx] = updated;
  saveDashboard(data);
  return updated;
}

export function deleteCard(id: string): boolean {
  const data = loadDashboard();
  const idx = data.cards.findIndex((c) => c.id === id);
  if (idx === -1) {
    return false;
  }
  data.cards.splice(idx, 1);
  saveDashboard(data);
  return true;
}

export function getCards(filters: DashboardFilters = {}): DashboardCard[] {
  const data = loadDashboard();
  let cards = data.cards;

  if (filters.pinned !== undefined) {
    cards = cards.filter((c) => c.isPinned === filters.pinned);
  }

  if (filters.tag !== undefined && filters.tag.trim() !== "") {
    const tag = filters.tag.trim();
    cards = cards.filter((c) => c.tags.includes(tag));
  }

  if (filters.date !== undefined && filters.date.trim() !== "") {
    const datePrefix = filters.date.trim();
    cards = cards.filter((c) => c.createdAt.startsWith(datePrefix));
  }

  if (filters.search !== undefined && filters.search.trim() !== "") {
    const searchLower = filters.search.trim().toLowerCase();
    cards = cards.filter(
      (c) =>
        c.title.toLowerCase().includes(searchLower) ||
        c.content.toLowerCase().includes(searchLower),
    );
  }

  return cards;
}

export function pinCard(id: string): DashboardCard | null {
  const data = loadDashboard();
  const pinnedCards = data.cards.filter((c) => c.isPinned);
  const maxOrder = pinnedCards.reduce((max, c) => Math.max(max, c.pinOrder ?? 0), 0);
  return updateCard(id, { isPinned: true, pinOrder: maxOrder + 1 });
}

export function unpinCard(id: string): DashboardCard | null {
  return updateCard(id, { isPinned: false, pinOrder: undefined });
}
