import type { IncomingMessage, ServerResponse } from "node:http";
import { sendInvalidRequest, sendJson, readJsonBodyOrError } from "../gateway/http-common.js";
import {
  addCard,
  deleteCard,
  getCards,
  loadDashboard,
  pinCard,
  unpinCard,
  updateCard,
} from "./storage.js";
import type { DashboardCard, DashboardFilters } from "./types.js";

const DASHBOARD_BODY_MAX_BYTES = 512 * 1024;

const DASHBOARD_CARDS_PATH = "/api/dashboard/cards";
const DASHBOARD_SYNC_CRON_PATH = "/api/dashboard/sync-cron";
const DASHBOARD_CARD_ID_PATTERN = /^\/api\/dashboard\/cards\/([^/]+)$/;
const DASHBOARD_CARD_PIN_PATTERN = /^\/api\/dashboard\/cards\/([^/]+)\/pin$/;

function resolveCardIdFromPath(pathname: string): string | null {
  const match = pathname.match(DASHBOARD_CARD_ID_PATTERN);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1] ?? "").trim() || null;
  } catch {
    return null;
  }
}

function resolveCardPinIdFromPath(pathname: string): string | null {
  const match = pathname.match(DASHBOARD_CARD_PIN_PATTERN);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1] ?? "").trim() || null;
  } catch {
    return null;
  }
}

function parseFiltersFromUrl(url: URL): DashboardFilters {
  const filters: DashboardFilters = {};

  const date = url.searchParams.get("date");
  if (date && date.trim()) {
    filters.date = date.trim();
  }

  const pinned = url.searchParams.get("pinned");
  if (pinned !== null) {
    filters.pinned = pinned === "true" || pinned === "1";
  }

  const tag = url.searchParams.get("tag");
  if (tag && tag.trim()) {
    filters.tag = tag.trim();
  }

  const search = url.searchParams.get("search");
  if (search && search.trim()) {
    filters.search = search.trim();
  }

  return filters;
}

function isValidCreateCardBody(
  body: unknown,
): body is Omit<DashboardCard, "id" | "createdAt" | "updatedAt"> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const b = body as Record<string, unknown>;
  if (typeof b.title !== "string" || !b.title.trim()) {
    return false;
  }
  if (typeof b.content !== "string") {
    return false;
  }
  if (b.contentType !== "text" && b.contentType !== "markdown" && b.contentType !== "json") {
    return false;
  }
  if (!b.source || typeof b.source !== "object" || Array.isArray(b.source)) {
    return false;
  }
  const source = b.source as Record<string, unknown>;
  if (typeof source.skillId !== "string" || !source.skillId.trim()) {
    return false;
  }
  if (typeof source.skillName !== "string" || !source.skillName.trim()) {
    return false;
  }
  if (!Array.isArray(b.tags)) {
    return false;
  }
  if (typeof b.isPinned !== "boolean") {
    return false;
  }
  if (typeof b.isSubscribed !== "boolean") {
    return false;
  }
  return true;
}

export async function handleDashboardHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  // POST /api/dashboard/sync-cron
  if (pathname === DASHBOARD_SYNC_CRON_PATH && method === "POST") {
    const body = await readJsonBodyOrError(req, res, DASHBOARD_BODY_MAX_BYTES);
    if (body === undefined) {
      return true;
    }
    // body.jobs is an optional array of { id, name?, label?, enabled? }
    const jobs: Array<{ id: string; name?: string; label?: string; enabled?: boolean }> =
      Array.isArray((body as Record<string, unknown>).jobs)
        ? ((body as Record<string, unknown>).jobs as Array<{
            id: string;
            name?: string;
            label?: string;
            enabled?: boolean;
          }>)
        : [];
    const data = loadDashboard();
    const syncedCards: DashboardCard[] = [];
    for (const job of jobs) {
      if (typeof job.id !== "string" || !job.id.trim()) {
        continue;
      }
      if (job.enabled === false) {
        continue;
      }
      const alreadyExists = data.cards.some((c) => c.isSubscribed && c.source.cronJobId === job.id);
      if (!alreadyExists) {
        const jobLabel = job.name?.trim() || job.label?.trim() || job.id;
        const newCard = addCard({
          title: `\u5b9a\u65f6\u4efb\u52a1 ${jobLabel}`,
          content: "\u7b49\u5f85\u9996\u6b21\u6267\u884c...",
          contentType: "markdown",
          source: {
            skillId: `cron-${job.id}`,
            skillName: "\u5b9a\u65f6\u4efb\u52a1",
            cronJobId: job.id,
          },
          tags: ["\u5b9a\u65f6\u4efb\u52a1"],
          isPinned: false,
          isSubscribed: true,
        });
        syncedCards.push(newCard);
        // Reload data after each addCard to keep the check accurate
        data.cards.push(newCard);
      }
    }
    sendJson(res, 200, { ok: true, synced: syncedCards.length, cards: syncedCards });
    return true;
  }

  // GET /api/dashboard/cards
  if (pathname === DASHBOARD_CARDS_PATH && method === "GET") {
    const filters = parseFiltersFromUrl(url);
    const cards = getCards(filters);
    sendJson(res, 200, { ok: true, cards });
    return true;
  }

  // POST /api/dashboard/cards
  if (pathname === DASHBOARD_CARDS_PATH && method === "POST") {
    const body = await readJsonBodyOrError(req, res, DASHBOARD_BODY_MAX_BYTES);
    if (body === undefined) {
      return true;
    }
    if (!isValidCreateCardBody(body)) {
      sendInvalidRequest(
        res,
        "Invalid card body: title, content, contentType, source (skillId, skillName), tags, isPinned, isSubscribed are required.",
      );
      return true;
    }
    const card = addCard(body);
    sendJson(res, 201, { ok: true, card });
    return true;
  }

  // Routes with card ID
  const cardId = resolveCardIdFromPath(pathname);
  if (cardId !== null) {
    // PATCH /api/dashboard/cards/:id
    if (method === "PATCH") {
      const body = await readJsonBodyOrError(req, res, DASHBOARD_BODY_MAX_BYTES);
      if (body === undefined) {
        return true;
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        sendInvalidRequest(res, "Invalid update body");
        return true;
      }
      const updated = updateCard(cardId, body as Partial<Omit<DashboardCard, "id" | "createdAt">>);
      if (!updated) {
        sendJson(res, 404, {
          ok: false,
          error: { type: "not_found", message: `Card not found: ${cardId}` },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, card: updated });
      return true;
    }

    // DELETE /api/dashboard/cards/:id
    if (method === "DELETE") {
      const deleted = deleteCard(cardId);
      if (!deleted) {
        sendJson(res, 404, {
          ok: false,
          error: { type: "not_found", message: `Card not found: ${cardId}` },
        });
        return true;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    return false;
  }

  // Pin routes
  const pinCardId = resolveCardPinIdFromPath(pathname);
  if (pinCardId !== null) {
    // POST /api/dashboard/cards/:id/pin
    if (method === "POST") {
      const card = pinCard(pinCardId);
      if (!card) {
        sendJson(res, 404, {
          ok: false,
          error: { type: "not_found", message: `Card not found: ${pinCardId}` },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, card });
      return true;
    }

    // DELETE /api/dashboard/cards/:id/pin
    if (method === "DELETE") {
      const card = unpinCard(pinCardId);
      if (!card) {
        sendJson(res, 404, {
          ok: false,
          error: { type: "not_found", message: `Card not found: ${pinCardId}` },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, card });
      return true;
    }

    return false;
  }

  return false;
}
