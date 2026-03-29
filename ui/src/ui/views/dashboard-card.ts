import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardCard {
  id: string;
  title: string;
  content: string;
  contentType: "text" | "markdown" | "json";
  source: {
    skillId: string;
    skillName: string;
    agentId?: string;
    cronJobId?: string;
  };
  tags: string[];
  isPinned: boolean;
  pinOrder?: number;
  isSubscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardFilters {
  date?: string;
  pinned?: boolean;
  tag?: string;
  search?: string;
  preset?: "all" | "pinned" | "today" | "week";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) {
    return `${diff} 秒前`;
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)} 分钟前`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)} 小时前`;
  }
  if (diff < 86400 * 7) {
    return `${Math.floor(diff / 86400)} 天前`;
  }
  return new Date(isoDate).toLocaleDateString();
}

function renderMarkdown(text: string): string {
  // Simple markdown: **bold**, `code`, line breaks
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// ---------------------------------------------------------------------------
// Web Component
// ---------------------------------------------------------------------------

@customElement("dashboard-card-item")
export class DashboardCardItem extends LitElement {
  // No Shadow DOM – match project convention
  override createRenderRoot() {
    return this;
  }

  @property({ type: Object }) card!: DashboardCard;
  @property({ type: Boolean }) pinned = false;
  @state() private menuOpen = false;

  private _dispatchPin() {
    this.dispatchEvent(
      new CustomEvent("dashboard-pin", {
        detail: { id: this.card.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _dispatchUnpin() {
    this.dispatchEvent(
      new CustomEvent("dashboard-unpin", {
        detail: { id: this.card.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _dispatchDelete() {
    this.menuOpen = false;
    this.dispatchEvent(
      new CustomEvent("dashboard-delete", {
        detail: { id: this.card.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderContent() {
    const { contentType, content } = this.card;
    if (contentType === "json") {
      let formatted = content;
      try {
        formatted = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        // fallback to raw
      }
      return html`<pre class="dashboard-card__pre">${formatted}</pre>`;
    }
    if (contentType === "markdown") {
      // eslint-disable-next-line lit/no-inner-html
      return html`<div
        class="dashboard-card__markdown"
        .innerHTML=${renderMarkdown(content)}
      ></div>`;
    }
    return html`<p class="dashboard-card__text">${content}</p>`;
  }

  override render() {
    if (!this.card) {
      return nothing;
    }
    const { card, pinned } = this;

    return html`
      <article class="dashboard-card${pinned ? " dashboard-card--pinned" : ""}">
        <div class="dashboard-card__header">
          <span class="dashboard-card__source">
            <svg
              class="dashboard-card__source-icon"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"
              />
            </svg>
            ${card.source.skillName}
          </span>
          <div class="dashboard-card__actions">
            <button
              class="dashboard-card__pin-btn${pinned ? " dashboard-card__pin-btn--pinned" : ""}"
              title=${pinned ? "取消固定" : "固定卡片"}
              aria-pressed=${pinned}
              @click=${pinned ? () => this._dispatchUnpin() : () => this._dispatchPin()}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill=${pinned ? "currentColor" : "none"}
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 2L9 9H3l5.5 4L6 21l6-4 6 4-2.5-8L21 9h-6z" />
              </svg>
            </button>
            <button
              class="dashboard-card__delete-btn"
              title="删除卡片"
              @click=${() => this._dispatchDelete()}
            >
              ✕
            </button>
          </div>
        </div>

        <h3 class="dashboard-card__title">${card.title}</h3>

        <div class="dashboard-card__body">${this._renderContent()}</div>

        <footer class="dashboard-card__footer">
          <div class="dashboard-card__tags">
            ${card.tags.map((tag) => html`<span class="dashboard-card__tag">${tag}</span>`)}
          </div>
          <time class="dashboard-card__time" title=${card.createdAt}>
            ${timeAgo(card.createdAt)}
          </time>
        </footer>
      </article>
    `;
  }
}
