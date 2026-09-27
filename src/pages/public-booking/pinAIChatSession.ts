import type { ChatMessage } from "./GuestPinAIChat";

const TTL = 24 * 60 * 60 * 1000;
const MAX_BYTES = 160_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = (bytes: Uint8Array) => {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 1024));
  }
  return btoa(text);
};
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown) => typeof v === "string" && v.length <= 32_000;

// Treat browser data as untrusted. Malformed cards must never become confirmable.
function validMessage(v: unknown): v is ChatMessage {
  if (!record(v) || !string(v.id) || !string(v.text) || !["guest", "assistant"].includes(String(v.role))) return false;
  if (v.requiresHumanReview !== undefined && typeof v.requiresHumanReview !== "boolean") return false;
  if (v.actionProposal !== undefined) {
    const p = v.actionProposal;
    if (v.role !== "assistant" || !record(p) || p.actionType !== "RESERVATION_MODIFICATION" ||
        p.requiresGuestConfirmation !== true || !string(p.proposalId) || !string(p.confirmationToken) ||
        !string(p.expiresAt) || !record(p.quote)) return false;
    const q = p.quote;
    if (q.availabilityHeld !== false || !["quotedAt", "quoteExpiresAt", "quoteExpiresAtLocal",
      "priceGuaranteedUntil", "propertyTimezone", "availabilityCheckedAt", "currency", "financialAction"]
      .every(k => string(q[k])) || !["currentTotalAmount", "proposedTotalAmount", "amountDifference", "amountDifferenceCents"]
      .every(k => typeof q[k] === "number" && Number.isFinite(q[k]))) return false;
  }
  if (v.actionResult !== undefined) {
    const r = v.actionResult;
    if (!record(r) || !record(v.actionProposal) || r.proposalId !== v.actionProposal.proposalId ||
        r.actionType !== "RESERVATION_MODIFICATION" || typeof r.actionExecuted !== "boolean" ||
        !["EXECUTED", "WAITING_FOR_PAYMENT", "WAITING_FOR_HOST", "REVIEW_REQUIRED"].includes(String(r.outcome))) return false;
    if (r.checkoutUrl != null && (typeof r.checkoutUrl !== "string" || !r.checkoutUrl.startsWith("https://"))) return false;
  }
  return true;
}

export type GuestChatSession = Readonly<{
  load: () => Promise<ChatMessage[]>;
  save: (messages: readonly ChatMessage[]) => Promise<void>;
}>;

/** Same-tab recovery only; no localStorage, cookies, server mutation or automatic request.
 * Encryption keeps guest dialogue and confirmation credentials out of plaintext storage.
 * It does not protect against scripts already executing in this origin.
 */
export async function createGuestChatSession(apiBase: string, guestToken: string): Promise<GuestChatSession> {
  const crypto = window.crypto;
  const digest = async (label: string) => new Uint8Array(await crypto.subtle.digest(
    "SHA-256", encoder.encode(JSON.stringify([label, apiBase, guestToken])),
  ));
  const scope = encode(await digest("pin-ai-tab-scope-v1"));
  const storageKey = `pin-ai-chat-v1:${scope}`;
  const key = await crypto.subtle.importKey("raw", await digest("pin-ai-tab-key-v1"), "AES-GCM", false, ["encrypt", "decrypt"]);
  const storage = window.sessionStorage;
  const aad = encoder.encode(scope);
  let writes = Promise.resolve();

  return {
    async load() {
      const raw = storage.getItem(storageKey);
      if (!raw) return [];
      try {
        if (raw.length > MAX_BYTES * 2) throw new Error("oversized");
        const envelope = JSON.parse(raw);
        if (!record(envelope) || typeof envelope.iv !== "string" || typeof envelope.data !== "string") throw new Error("invalid");
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(envelope.iv), additionalData: aad }, key, decode(envelope.data));
        if (plain.byteLength > MAX_BYTES) throw new Error("oversized");
        const saved = JSON.parse(decoder.decode(plain));
        if (!record(saved) || saved.version !== 1 || typeof saved.savedAt !== "number" ||
            !Number.isFinite(saved.savedAt) || saved.savedAt > Date.now() || Date.now() - saved.savedAt >= TTL ||
            !Array.isArray(saved.messages) || saved.messages.length > 40 || !saved.messages.every(validMessage)) throw new Error("invalid");
        return saved.messages;
      } catch {
        storage.removeItem(storageKey);
        return [];
      }
    },
    save(messages) {
      // Serial writes prevent an older encryption operation from overwriting a newer reply.
      writes = writes.catch(() => {}).then(async () => {
        const bounded: ChatMessage[] = [];
        let length = 0;
        for (const message of messages.slice(-40).reverse()) {
          const size = JSON.stringify(message).length;
          if (length + size > 32_000) break;
          bounded.unshift(message);
          length += size;
        }
        if (!bounded.every(validMessage)) throw new Error("Invalid chat snapshot");
        const plain = encoder.encode(JSON.stringify({ version: 1, savedAt: Date.now(), messages: bounded }));
        if (plain.byteLength > MAX_BYTES) throw new Error("Chat snapshot too large");
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, plain);
        storage.setItem(storageKey, JSON.stringify({ iv: encode(iv), data: encode(new Uint8Array(data)) }));
      });
      return writes;
    },
  };
}
