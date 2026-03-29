import { html, type TemplateResult } from "lit";
import { icons } from "../icons.ts";

const PINNED_FOR_MS = 1500;
const ERROR_FOR_MS = 2000;
const PIN_LABEL = "Pin to dashboard";
const PINNED_LABEL = "Pinned";
const ERROR_LABEL = "Pin failed";

function extractTitle(markdown: string): string {
  const firstLine = markdown.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  const title = cleaned || markdown.trim();
  return title.slice(0, 50);
}

function setButtonLabel(button: HTMLButtonElement, label: string) {
  button.title = label;
  button.setAttribute("aria-label", label);
}

async function pinToDashboard(markdown: string): Promise<boolean> {
  if (!markdown) {
    return false;
  }

  try {
    const title = extractTitle(markdown);
    const body = {
      title,
      content: markdown,
      contentType: "markdown",
      source: { skillId: "chat", skillName: "Chat" },
      tags: [],
      isPinned: true,
      isSubscribed: false,
    };

    const response = await fetch("/api/dashboard/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export function renderPinToDashboardButton(markdown: string): TemplateResult {
  const idleLabel = PIN_LABEL;
  return html`
    <button
      class="btn btn--xs chat-pin-btn"
      type="button"
      title=${idleLabel}
      aria-label=${idleLabel}
      @click=${async (e: Event) => {
        const btn = e.currentTarget as HTMLButtonElement | null;

        if (!btn || btn.dataset.pinning === "1") {
          return;
        }

        btn.dataset.pinning = "1";
        btn.setAttribute("aria-busy", "true");
        btn.disabled = true;

        const pinned = await pinToDashboard(markdown);
        if (!btn.isConnected) {
          return;
        }

        delete btn.dataset.pinning;
        btn.removeAttribute("aria-busy");
        btn.disabled = false;

        if (!pinned) {
          btn.dataset.error = "1";
          setButtonLabel(btn, ERROR_LABEL);

          window.setTimeout(() => {
            if (!btn.isConnected) {
              return;
            }
            delete btn.dataset.error;
            setButtonLabel(btn, idleLabel);
          }, ERROR_FOR_MS);
          return;
        }

        btn.dataset.pinned = "1";
        setButtonLabel(btn, PINNED_LABEL);

        window.setTimeout(() => {
          if (!btn.isConnected) {
            return;
          }
          delete btn.dataset.pinned;
          setButtonLabel(btn, idleLabel);
        }, PINNED_FOR_MS);
      }}
    >
      <span class="chat-pin-btn__icon" aria-hidden="true">
        <span class="chat-pin-btn__icon-pin">${icons.pin}</span>
        <span class="chat-pin-btn__icon-check">${icons.check}</span>
      </span>
    </button>
  `;
}
