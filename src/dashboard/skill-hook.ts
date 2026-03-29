import type { CronEvent } from "../cron/service/state.js";
import type { GatewayBroadcastFn } from "../gateway/server-broadcast.js";
import { loadDashboard, updateCard, addCard } from "./storage.js";
import type { DashboardCard } from "./types.js";

export interface DashboardSkillHookParams {
  broadcast: GatewayBroadcastFn;
  getJob?: (
    id: string,
  ) => { id: string; name?: string; label?: string; payload?: { message?: string } } | undefined;
  getJobs?: () => Array<{ id: string; name?: string; label?: string; enabled?: boolean }>;
}

function getOrCreateSubscribedCard(
  params: DashboardSkillHookParams,
  jobId: string,
  initialContent: string,
): DashboardCard {
  const data = loadDashboard();
  const existing = data.cards.find((c) => c.isSubscribed && c.source.cronJobId === jobId);
  if (existing) {
    return existing;
  }
  const job = params.getJob?.(jobId);
  const jobLabel = job?.name?.trim() || job?.label?.trim() || jobId;
  const newCard = addCard({
    title: `定时任务 ${jobLabel}`,
    content: initialContent,
    contentType: "markdown",
    source: {
      skillId: `cron-${jobId}`,
      skillName: "定时任务",
      cronJobId: jobId,
    },
    tags: ["定时任务"],
    isPinned: false,
    isSubscribed: true,
  });
  params.broadcast("dashboard.card-added", { card: newCard });
  return newCard;
}

export function createDashboardSkillHook(
  params: DashboardSkillHookParams,
): (evt: CronEvent) => void {
  return function onCronEvent(evt: CronEvent): void {
    try {
      // When a cron job is added, auto-create a dashboard card
      if (evt.action === "added") {
        getOrCreateSubscribedCard(params, evt.jobId, "等待首次执行...");
        return;
      }

      // When a cron job is removed, mark its card as stopped
      if (evt.action === "removed") {
        const data = loadDashboard();
        const cards = data.cards.filter((c) => c.isSubscribed && c.source.cronJobId === evt.jobId);
        for (const card of cards) {
          const updated = updateCard(card.id, { content: "⏹ 定时任务已停止" });
          if (updated) {
            params.broadcast("dashboard.card-updated", { card: updated });
          }
        }
        return;
      }

      // Handle finished events
      if (evt.action === "finished") {
        if (evt.status === "ok") {
          const summary = evt.summary;
          if (!summary) {
            return;
          }
          const data = loadDashboard();
          const subscribedCards = data.cards.filter(
            (c) => c.isSubscribed && c.source.cronJobId === evt.jobId,
          );
          if (subscribedCards.length > 0) {
            for (const card of subscribedCards) {
              const updated: DashboardCard | null = updateCard(card.id, { content: summary });
              if (updated) {
                params.broadcast("dashboard.card-updated", { card: updated });
              }
            }
          } else {
            // Card was not found (e.g. restarted gateway), auto-create
            getOrCreateSubscribedCard(params, evt.jobId, summary);
          }
        } else if (evt.status === "error") {
          const errorMsg = evt.error ? `❌ 执行失败: ${evt.error}` : "❌ 执行失败";
          const data = loadDashboard();
          const subscribedCards = data.cards.filter(
            (c) => c.isSubscribed && c.source.cronJobId === evt.jobId,
          );
          if (subscribedCards.length > 0) {
            for (const card of subscribedCards) {
              const updated: DashboardCard | null = updateCard(card.id, { content: errorMsg });
              if (updated) {
                params.broadcast("dashboard.card-updated", { card: updated });
              }
            }
          } else {
            getOrCreateSubscribedCard(params, evt.jobId, errorMsg);
          }
        }
      }
    } catch {
      // skill hook errors must not affect cron normal execution
    }
  };
}

/**
 * Sync all configured cron jobs to the dashboard on gateway startup.
 * Ensures every enabled cron job has a card, without creating duplicates.
 */
export function syncCronJobsToDashboard(params: DashboardSkillHookParams): void {
  try {
    const jobs = params.getJobs?.() ?? [];
    const data = loadDashboard();
    for (const job of jobs) {
      if (job.enabled === false) {
        continue;
      }
      const alreadyExists = data.cards.some((c) => c.isSubscribed && c.source.cronJobId === job.id);
      if (!alreadyExists) {
        const jobLabel = job.name?.trim() || job.label?.trim() || job.id;
        const newCard = addCard({
          title: `定时任务 ${jobLabel}`,
          content: "等待首次执行...",
          contentType: "markdown",
          source: {
            skillId: `cron-${job.id}`,
            skillName: "定时任务",
            cronJobId: job.id,
          },
          tags: ["定时任务"],
          isPinned: false,
          isSubscribed: true,
        });
        params.broadcast("dashboard.card-added", { card: newCard });
      }
    }
  } catch {
    // sync errors must not affect gateway startup
  }
}
