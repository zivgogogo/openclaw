import { html, nothing } from "lit";
import "./dashboard-card.js";
import "../components/date-picker.js";
import type { DashboardCard, DashboardFilters } from "./dashboard-card.js";

export type { DashboardCard, DashboardFilters };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type DashboardProps = {
  cards: DashboardCard[];
  pinnedCards: DashboardCard[];
  filters: DashboardFilters;
  loading: boolean;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onDelete: (id: string) => void;
  onFilterChange: (filters: DashboardFilters) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) {
    return "今天";
  }
  if (sameDay(d, yesterday)) {
    return "昨天";
  }
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

function groupByDate(cards: DashboardCard[]): Map<string, DashboardCard[]> {
  const groups = new Map<string, DashboardCard[]>();
  // Sort newest first
  const sorted = [...cards].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const card of sorted) {
    const label = toDateLabel(card.createdAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(card);
    } else {
      groups.set(label, [card]);
    }
  }
  return groups;
}

function applyLocalFilters(cards: DashboardCard[], filters: DashboardFilters): DashboardCard[] {
  let result = cards;
  const { preset, search, tag, pinned, date } = filters;

  if (preset === "pinned" || pinned) {
    result = result.filter((c) => c.isPinned);
  } else if (preset === "today") {
    const todayStr = new Date().toDateString();
    result = result.filter((c) => new Date(c.createdAt).toDateString() === todayStr);
  } else if (preset === "week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    result = result.filter((c) => new Date(c.createdAt).getTime() >= weekAgo);
  }

  if (date) {
    result = result.filter((c) => new Date(c.createdAt).toISOString().split("T")[0] === date);
  }

  if (tag) {
    result = result.filter((c) => c.tags.includes(tag));
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.source.skillName.toLowerCase().includes(q),
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function renderDashboardFilters(props: DashboardProps) {
  const { filters, onFilterChange } = props;

  return html`
    <div class="dashboard__filters">
      <div class="dashboard__filter-controls">
        <date-picker-popup
          .value=${filters.date ?? ""}
          @date-change=${(e: CustomEvent) => {
            onFilterChange({ ...filters, date: (e.detail as string) || undefined });
          }}
        ></date-picker-popup>
        <input
          type="search"
          class="dashboard__search-input"
          placeholder="搜索卡片…"
          .value=${filters.search ?? ""}
          @input=${(e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            onFilterChange({ ...filters, search: v || undefined });
          }}
        />
      </div>
    </div>
  `;
}

function renderPinnedSection(props: DashboardProps) {
  const { pinnedCards, onUnpin } = props;
  if (!pinnedCards.length) {
    return nothing;
  }

  return html`
    <section class="dashboard__pinned-section">
      <div class="dashboard__section-header">
        <span class="dashboard__section-title">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            style="vertical-align: middle; margin-right: 4px;"
          >
            <path d="M12 2L9 9H3l5.5 4L6 21l6-4 6 4-2.5-8L21 9h-6z" />
          </svg>
          已固定 (${pinnedCards.length})
        </span>
      </div>
      <div class="dashboard__cards-grid">
        ${pinnedCards.map(
          (card) => html`
            <dashboard-card-item
              .card=${card}
              .pinned=${true}
              @dashboard-unpin=${(e: CustomEvent) => onUnpin(e.detail.id)}
              @dashboard-delete=${(e: CustomEvent) => props.onDelete(e.detail.id)}
            ></dashboard-card-item>
          `,
        )}
      </div>
    </section>
  `;
}

function renderCardsByDate(props: DashboardProps) {
  const { cards, filters, onPin, onUnpin, onDelete } = props;

  // Exclude already-pinned from the main stream (they show in pinned section)
  const unpinned = cards.filter((c) => !c.isPinned);
  const visible = applyLocalFilters(unpinned, filters);

  if (!visible.length) {
    return html`
      <div class="dashboard__empty">
        <p class="muted">没有匹配的卡片</p>
      </div>
    `;
  }

  const groups = groupByDate(visible);

  return html`
    <div class="dashboard__date-groups">
      ${[...groups.entries()].map(
        ([label, groupCards]) => html`
          <section class="dashboard__date-group">
            <div class="dashboard__section-header">
              <span class="dashboard__section-title">${label}</span>
              <span class="dashboard__section-count muted">${groupCards.length} 条</span>
            </div>
            <div class="dashboard__cards-grid">
              ${groupCards.map(
                (card) => html`
                  <dashboard-card-item
                    .card=${card}
                    .pinned=${false}
                    @dashboard-pin=${(e: CustomEvent) => onPin(e.detail.id)}
                    @dashboard-unpin=${(e: CustomEvent) => onUnpin(e.detail.id)}
                    @dashboard-delete=${(e: CustomEvent) => onDelete(e.detail.id)}
                  ></dashboard-card-item>
                `,
              )}
            </div>
          </section>
        `,
      )}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderDashboard(props: DashboardProps) {
  if (props.loading && !props.cards.length) {
    return html`
      <div class="dashboard dashboard--loading">
        <div class="dashboard__spinner muted">加载看板数据…</div>
      </div>
    `;
  }

  return html`
    <div class="dashboard">
      ${renderDashboardFilters(props)} ${renderPinnedSection(props)} ${renderCardsByDate(props)}
    </div>
  `;
}
