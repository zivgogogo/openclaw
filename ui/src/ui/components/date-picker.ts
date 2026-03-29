import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface CalendarDay {
  date: number;
  month: number; // relative to _viewMonth: -1 prev, 0 current, 1 next
  year: number;
  fullDate: string; // YYYY-MM-DD
}

/**
 * A calendar date-picker popup component.
 * Dispatches 'date-change' event with { detail: string } (YYYY-MM-DD or "").
 */
@customElement("date-picker-popup")
export class DatePickerPopup extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ type: String }) value: string = new Date().toISOString().split("T")[0] ?? "";

  @state() private _open = false;
  @state() private _viewYear = 0;
  @state() private _viewMonth = 0; // 0-11

  override connectedCallback() {
    super.connectedCallback();
    this._syncViewToValue();
    document.addEventListener("click", this._handleDocumentClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._handleDocumentClick);
  }

  private _syncViewToValue() {
    const d = this.value ? new Date(this.value + "T00:00:00") : new Date();
    this._viewYear = d.getFullYear();
    this._viewMonth = d.getMonth();
  }

  private _handleDocumentClick = (e: MouseEvent) => {
    if (!this._open) {
      return;
    }
    const target = e.target as Node;
    if (!this.contains(target)) {
      this._open = false;
    }
  };

  private _toggleOpen = (e: MouseEvent) => {
    e.stopPropagation();
    if (!this._open) {
      this._syncViewToValue();
    }
    this._open = !this._open;
  };

  private _clear = (e: MouseEvent) => {
    e.stopPropagation();
    this.value = "";
    this._open = false;
    this.dispatchEvent(
      new CustomEvent("date-change", {
        detail: "",
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _prevMonth = (e: MouseEvent) => {
    e.stopPropagation();
    if (this._viewMonth === 0) {
      this._viewMonth = 11;
      this._viewYear -= 1;
    } else {
      this._viewMonth -= 1;
    }
  };

  private _nextMonth = (e: MouseEvent) => {
    e.stopPropagation();
    if (this._viewMonth === 11) {
      this._viewMonth = 0;
      this._viewYear += 1;
    } else {
      this._viewMonth += 1;
    }
  };

  private _selectDate = (e: MouseEvent, day: CalendarDay) => {
    e.stopPropagation();
    this.value = day.fullDate;
    this._open = false;
    this.dispatchEvent(
      new CustomEvent("date-change", {
        detail: day.fullDate,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _buildCalendarDays(): CalendarDay[] {
    const year = this._viewYear;
    const month = this._viewMonth;

    // First day of current month (0=Sun ... 6=Sat), convert to Mon-based (0=Mon ... 6=Sun)
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDayMon = (firstDayRaw + 6) % 7; // shift so Monday=0

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // Fill leading days from previous month
    for (let i = firstDayMon - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        date: d,
        month: -1,
        year: prevYear,
        fullDate: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: d,
        month: 0,
        year,
        fullDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    // Fill trailing days from next month
    const remaining = 42 - days.length; // 6 rows × 7 cols
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: d,
        month: 1,
        year: nextYear,
        fullDate: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    return days;
  }

  override render() {
    const today = new Date().toISOString().split("T")[0] ?? "";
    const displayDate = this.value || "";
    const days = this._open ? this._buildCalendarDays() : [];

    // Build display label
    let displayLabel: string;
    if (!displayDate) {
      displayLabel = "选择日期";
    } else if (displayDate === today) {
      const d = new Date(displayDate + "T00:00:00");
      displayLabel = `今日 (${d.getMonth() + 1}/${d.getDate()})`;
    } else {
      const d = new Date(displayDate + "T00:00:00");
      displayLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
    }

    return html`
      <div class="date-picker">
        <div class="date-picker__input" @click=${this._toggleOpen}>
          <span class="date-picker__input-text">${displayLabel}</span>
          ${this.value
            ? html`<button class="date-picker__clear" @click=${this._clear} title="清除日期">
                ✕
              </button>`
            : nothing}
        </div>
        ${this._open
          ? html`
              <div class="date-picker__dropdown" @click=${(e: MouseEvent) => e.stopPropagation()}>
                <div class="date-picker__nav">
                  <button class="date-picker__nav-btn" @click=${this._prevMonth} title="上个月">
                    ◀
                  </button>
                  <span class="date-picker__nav-label">
                    ${this._viewYear}年${this._viewMonth + 1}月
                  </span>
                  <button class="date-picker__nav-btn" @click=${this._nextMonth} title="下个月">
                    ▶
                  </button>
                </div>
                <div class="date-picker__weekdays">
                  <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span
                  ><span>六</span><span>日</span>
                </div>
                <div class="date-picker__grid">
                  ${days.map(
                    (day) => html`
                      <button
                        class="date-picker__day${day.month !== 0
                          ? " date-picker__day--other-month"
                          : ""}${day.fullDate === today
                          ? " date-picker__day--today"
                          : ""}${day.fullDate === this.value ? " date-picker__day--selected" : ""}"
                        @click=${(e: MouseEvent) => this._selectDate(e, day)}
                      >
                        ${day.date}
                      </button>
                    `,
                  )}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "date-picker-popup": DatePickerPopup;
  }
}
