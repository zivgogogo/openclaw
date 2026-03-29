import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * A draggable floating panel component.
 * Dispatches 'panel-close' event when the close button is clicked.
 */
@customElement("floating-panel")
export class FloatingPanel extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ type: String }) panelTitle = "Dashboard";
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) panelContent: TemplateResult | typeof nothing = nothing;

  @state() private _x = 0;
  @state() private _y = 0;
  @state() private _pinned = false;
  @state() private _dragging = false;

  private _dragStartX = 0;
  private _dragStartY = 0;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;

  override connectedCallback() {
    super.connectedCallback();
    // Initial position: right side, near bottom
    const panelWidth = 420;
    const panelHeight = window.innerHeight * 0.7;
    this._x = window.innerWidth - panelWidth - 24;
    this._y = window.innerHeight - panelHeight - 100;

    document.addEventListener("mousemove", this._handleMouseMove);
    document.addEventListener("mouseup", this._handleMouseUp);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousemove", this._handleMouseMove);
    document.removeEventListener("mouseup", this._handleMouseUp);
  }

  private _handleHeaderMouseDown = (e: MouseEvent) => {
    if (this._pinned) {
      return;
    }
    this._dragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._dragOffsetX = this._x;
    this._dragOffsetY = this._y;
    e.preventDefault();
  };

  private _handleMouseMove = (e: MouseEvent) => {
    if (!this._dragging) {
      return;
    }

    const panelWidth = 420;
    const panelHeight = window.innerHeight * 0.7;

    const deltaX = e.clientX - this._dragStartX;
    const deltaY = e.clientY - this._dragStartY;

    const newX = this._dragOffsetX + deltaX;
    const newY = this._dragOffsetY + deltaY;

    // Clamp to viewport
    this._x = Math.max(0, Math.min(window.innerWidth - panelWidth, newX));
    this._y = Math.max(0, Math.min(window.innerHeight - panelHeight, newY));
  };

  private _handleMouseUp = () => {
    if (!this._dragging) {
      return;
    }
    this._dragging = false;
  };

  private _togglePin = (e: MouseEvent) => {
    e.stopPropagation();
    this._pinned = !this._pinned;
  };

  private _close = (e: MouseEvent) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("panel-close", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  override render() {
    if (!this.open) {
      return nothing;
    }

    return html`
      <div
        class="floating-panel${this._pinned ? " floating-panel--pinned" : ""}${this._dragging
          ? " floating-panel--dragging"
          : ""}"
        style="left:${this._x}px; top:${this._y}px"
      >
        <div class="floating-panel__header" @mousedown=${this._handleHeaderMouseDown}>
          <span class="floating-panel__title">${this.panelTitle}</span>
          <button
            class="floating-panel__pin-btn${this._pinned ? " floating-panel__pin-btn--pinned" : ""}"
            @click=${this._togglePin}
            title="${this._pinned ? "取消固定" : "固定位置"}"
          >
            ${this._pinned
              ? html`<svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M16 3H8v2l2 2v5l-3 2v2h5v5h2v-5h5v-2l-3-2V7l2-2V3z" />
                </svg>`
              : html`<svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 17v5" />
                  <path
                    d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1V5H8v2h1v3.76z"
                  />
                </svg>`}
          </button>
          <button class="floating-panel__close-btn" @click=${this._close} title="关闭">✕</button>
        </div>
        <div class="floating-panel__body">
          <slot></slot>
          ${this.panelContent}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "floating-panel": FloatingPanel;
  }
}
