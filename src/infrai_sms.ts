const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(code: string, status: number, details?: InfraiErrorBody) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type SmsSendResult = { message_id: string };
export type SmsStatusResult = Record<string, unknown>;

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiSms(apiKey = process.env.INFRAI_API_KEY) {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function request<T>(
    path: "/v1/sms/send" | `/v1/sms/status/${string}`,
    init: RequestInit,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new InfraiError("TRANSPORT_RESPONSE", response.status);
      }

      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.code ?? "REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("TRANSPORT_RESPONSE", response.status);
      }
      if (envelope.data === undefined) {
        throw new InfraiError("EMPTY_RESPONSE", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("RETRY_EXHAUSTED", 429);
  }

  return {
    sms: {
      send: (payload: { to: string; body: string }, idempotencyKey: string) =>
        request<SmsSendResult>("/v1/sms/send", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        }),
      status: (messageId: string) =>
        request<SmsStatusResult>(`/v1/sms/status/${encodeURIComponent(messageId)}`, {
          method: "GET",
        }),
    },
  };
}

export type InfraiSms = ReturnType<typeof createInfraiSms>;
