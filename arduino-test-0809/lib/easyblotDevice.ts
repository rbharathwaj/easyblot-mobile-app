/**
 * ============================================================================
 * EasyBlot device transport — DEVELOPMENT / HARDWARE TEST ONLY
 * ============================================================================
 *
 * The single place in the app that talks to hardware over HTTP. UI components
 * call these functions and never call fetch() themselves, so when this proof
 * of concept is replaced the blast radius is one file.
 *
 * Today this speaks plain HTTP to an ESP32 on the local network. Later the
 * same function signatures can be backed by MQTT over WebSockets, and the
 * screens do not change:
 *
 *      blinkLed(ip, count)   →   startPump(deviceId, pump, seconds)
 *                                stopPump(deviceId, pump)
 *                                sendProtocol(deviceId, steps)
 *                                pauseProtocol(deviceId)
 *                                stopProtocol(deviceId)
 *      testConnection(ip)    →   getDeviceStatus(deviceId)
 *
 * Nothing here is imported by the production EasyBlot screens. Deleting this
 * file plus app/dev/esp32 removes the entire test feature.
 */

/* ---------------------------------------------------------------- types --- */

export interface DeviceStatus {
  device: string;
  status: string;
  [key: string]: unknown;
}

export interface BlinkResult {
  success: boolean;
  blink_count: number;
  [key: string]: unknown;
}

/** Thrown for every failure mode, with a message safe to show the user. */
export class DeviceError extends Error {
  readonly kind: 'network' | 'timeout' | 'http' | 'protocol' | 'input';
  readonly detail?: unknown;
  constructor(kind: DeviceError['kind'], message: string, detail?: unknown) {
    super(message);
    this.name = 'DeviceError';
    this.kind = kind;
    this.detail = detail;
  }
}

/* ------------------------------------------------------------ constants --- */

export const BLINK_MIN = 1;
export const BLINK_MAX = 20;

/** A /status round-trip should be near-instant on a LAN. */
const STATUS_TIMEOUT_MS = 6_000;
/**
 * /blink only answers once the LED has finished, which is the point — the UI
 * must not claim success before the hardware acted. 20 blinks at 600 ms is
 * 12 s, so allow generous headroom.
 */
const BLINK_TIMEOUT_MS = 40_000;

/* ------------------------------------------------------------- helpers --- */

/**
 * Accepts what people actually paste: "192.168.1.73", "http://192.168.1.73",
 * "192.168.1.73/", "esp32.local". Returns a bare host[:port].
 */
export function normaliseHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim();
}

/** Loose check — enough to catch typos without rejecting mDNS names. */
export function looksLikeHost(raw: string): boolean {
  const host = normaliseHost(raw);
  if (!host) return false;
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
  const name = /^[a-z0-9][a-z0-9.-]*(:\d{1,5})?$/i;
  if (ipv4.test(host)) {
    return host.split(':')[0].split('.').every((o) => Number(o) >= 0 && Number(o) <= 255);
  }
  return name.test(host);
}

export interface BlinkValidation { ok: boolean; value: number; message: string }

/** Front-end guard: no blanks, decimals, zero, negatives, or > 20. */
export function validateBlinkCount(raw: string): BlinkValidation {
  const text = raw.trim();
  if (!text) return { ok: false, value: NaN, message: 'Enter how many blinks you want.' };
  if (!/^-?\d+$/.test(text)) {
    return { ok: false, value: NaN, message: 'Whole numbers only — no decimals.' };
  }
  const value = Number(text);
  if (value < BLINK_MIN) {
    return { ok: false, value, message: `Enter at least ${BLINK_MIN}.` };
  }
  if (value > BLINK_MAX) {
    return { ok: false, value, message: `${BLINK_MAX} is the maximum for this test.` };
  }
  return { ok: true, value, message: '' };
}

/** Console-only debug trail. Never rendered in the dashboard UI. */
function debug(label: string, payload?: unknown) {
  if (payload === undefined) console.info(`[easyblot-device] ${label}`);
  else console.info(`[easyblot-device] ${label}`, payload);
}

async function request<T>(host: string, path: string, timeoutMs: number): Promise<T> {
  const clean = normaliseHost(host);
  if (!clean) throw new DeviceError('input', 'Enter the ESP32 IP address first.');

  const url = `http://${clean}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  debug('request →', { url, timeoutMs });
  const startedAt = performance.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      // Deliberately no custom headers: that keeps this a CORS "simple
      // request", so the browser skips the preflight entirely.
      mode: 'cors',
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    debug(aborted ? 'timeout ✗' : 'network error ✗', { url, err });

    if (aborted) {
      throw new DeviceError('timeout', `No answer from ${clean} within ${Math.round(timeoutMs / 1000)}s.`, err);
    }
    // A browser-blocked request looks identical to an unreachable host here;
    // the page explains both possibilities rather than guessing.
    throw new DeviceError(
      'network',
      `Could not reach ${clean}. Check the IP, that both devices are on the same Wi-Fi, and that this page is served over http (not https).`,
      err,
    );
  }
  clearTimeout(timer);

  const ms = Math.round(performance.now() - startedAt);
  debug(`response ← ${res.status} ${res.statusText} (${ms}ms)`, { url });

  const text = await res.text();

  if (!res.ok) {
    debug('http error ✗', { status: res.status, body: text });
    throw new DeviceError('http', `Device replied ${res.status}: ${text.slice(0, 200) || res.statusText}`, text);
  }

  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    debug('bad json ✗', { body: text.slice(0, 300) });
    throw new DeviceError('protocol', 'Device replied with something that is not JSON. Is that address really the ESP32?', text);
  }

  debug('payload', json);
  return json;
}

/* ------------------------------------------------------------------ api --- */

/** GET /status — confirms the ESP32 is reachable and is the right device. */
export async function testConnection(host: string): Promise<DeviceStatus> {
  const json = await request<DeviceStatus>(host, '/status', STATUS_TIMEOUT_MS);
  if (!json || typeof json.status !== 'string') {
    throw new DeviceError('protocol', 'That address answered, but not like an EasyBlot test device.', json);
  }
  return json;
}

/**
 * GET /blink?count=N — resolves only after the ESP32 confirms it finished.
 * Success is the device's word, not the fact that a request was sent.
 */
export async function blinkLed(host: string, count: number): Promise<BlinkResult> {
  if (!Number.isInteger(count) || count < BLINK_MIN || count > BLINK_MAX) {
    throw new DeviceError('input', `Blink count must be a whole number from ${BLINK_MIN} to ${BLINK_MAX}.`);
  }

  const json = await request<BlinkResult>(host, `/blink?count=${count}`, BLINK_TIMEOUT_MS);

  if (json?.success !== true) {
    throw new DeviceError('protocol', 'Device did not report success.', json);
  }
  if (json.blink_count !== count) {
    // Worth surfacing: it means the device and the UI disagree about what ran.
    throw new DeviceError(
      'protocol',
      `Asked for ${count} blinks but the device reported ${json.blink_count}.`,
      json,
    );
  }
  return json;
}
