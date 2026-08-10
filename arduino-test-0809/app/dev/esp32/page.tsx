'use client';

/**
 * ============================================================================
 * ESP32 Connectivity Test — DEVELOPMENT ONLY
 * ============================================================================
 *
 * Not part of the EasyBlot product. Deliberately kept outside the (app) route
 * group so it needs no account: blinking an LED should not require signing in.
 *
 * To remove the whole feature later: delete app/dev/, lib/easyblotDevice.ts,
 * esp32-test-firmware/, and the one link in Settings → Device.
 *
 * All hardware calls go through lib/easyblotDevice.ts — no fetch() here.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Btn, Card, Field, Item, Page } from '../../../components/ui';
import { ease } from '../../../components/motion';
import {
  BLINK_MAX, BLINK_MIN, DeviceError, blinkLed, looksLikeHost,
  normaliseHost, testConnection, validateBlinkCount,
} from '../../../lib/easyblotDevice';

/** Own storage key, separate from the app's `easyblot:v1:` namespace. */
const IP_KEY = 'easyblot:dev:esp32-host';

type Phase = 'idle' | 'busy' | 'ok' | 'error';
interface Result { phase: Phase; message: string }

const IDLE: Result = { phase: 'idle', message: '' };

export default function Esp32TestPage() {
  const [host, setHost] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [conn, setConn] = useState<Result>(IDLE);
  const [blink, setBlink] = useState<Result>(IDLE);
  const [count, setCount] = useState('5');
  const [countError, setCountError] = useState<string | null>(null);

  // Remembered across reloads so the IP is not retyped every test cycle.
  useEffect(() => {
    try {
      setHost(window.localStorage.getItem(IP_KEY) ?? '');
    } catch {
      /* private mode — the field simply starts empty */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(IP_KEY, host);
    } catch { /* ignore */ }
  }, [host, loaded]);

  const hostValid = looksLikeHost(host);

  const onTest = useCallback(async () => {
    setConn({ phase: 'busy', message: 'Contacting device…' });
    setBlink(IDLE);
    try {
      const status = await testConnection(host);
      setConn({
        phase: 'ok',
        message: `Connected — ${status.device ?? 'device'} reports "${status.status}".`,
      });
    } catch (err) {
      setConn({
        phase: 'error',
        message: err instanceof DeviceError ? err.message : 'Unable to connect.',
      });
    }
  }, [host]);

  const onBlink = useCallback(async () => {
    const check = validateBlinkCount(count);
    setCountError(check.ok ? null : check.message);
    if (!check.ok) return;

    setBlink({ phase: 'busy', message: 'Sending command…' });
    try {
      const res = await blinkLed(host, check.value);
      setBlink({
        phase: 'ok',
        message: `EasyBlot received command: ${res.blink_count} blinks.`,
      });
    } catch (err) {
      setBlink({
        phase: 'error',
        message: err instanceof DeviceError ? err.message : 'The blink command failed.',
      });
    }
  }, [host, count]);

  const busy = conn.phase === 'busy' || blink.phase === 'busy';

  return (
    <div className="main" style={{ paddingBottom: 64 }}>
      <Page>
        <Item className="page-head">
          <div>
            <div className="caption">Development tool</div>
            <h1>ESP32 Connectivity Test</h1>
          </div>
          <span className="pill dashed">DEV ONLY</span>
        </Item>

        <Item>
          <p className="sub" style={{ marginTop: 0 }}>
            Proves the chain: this page → your Wi-Fi → ESP32 → built-in LED → response back here.
            No pumps, no MQTT, no cloud. Both devices must be on the same network.
          </p>
        </Item>

        {/* ---------------- Device address ---------------- */}
        <Item>
          <div className="eyebrow" style={{ marginTop: 22 }}>Device address</div>
          <Card>
            <Field
              label="ESP32 IP address"
              error={host && !hostValid ? 'That does not look like an IP address or hostname.' : null}
              hint="Shown in the Arduino Serial Monitor after the board joins Wi-Fi. Saved in this browser."
            >
              <input
                className={`input${host && !hostValid ? ' error' : ''}`}
                value={host}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder="192.168.1.73"
                onChange={(e) => { setHost(e.target.value); setConn(IDLE); setBlink(IDLE); }}
                onBlur={() => setHost((h) => normaliseHost(h))}
              />
            </Field>

            <Btn
              variant="ghost"
              onClick={onTest}
              disabled={!hostValid || busy}
            >
              {conn.phase === 'busy' ? 'Testing…' : 'Test Connection'}
            </Btn>

            <StatusLine result={conn} />
          </Card>
        </Item>

        {/* ---------------- Blink test ---------------- */}
        <Item>
          <div className="eyebrow" style={{ marginTop: 22 }}>Blink test</div>
          <Card>
            <Field
              label="Blink count"
              error={countError}
              hint={`Whole numbers, ${BLINK_MIN} to ${BLINK_MAX}. The LED blinks roughly twice a second.`}
            >
              <input
                className={`input${countError ? ' error' : ''}`}
                style={{ maxWidth: 140 }}
                type="number"
                min={BLINK_MIN}
                max={BLINK_MAX}
                step={1}
                value={count}
                onChange={(e) => { setCount(e.target.value); setCountError(null); setBlink(IDLE); }}
              />
            </Field>

            <Btn onClick={onBlink} disabled={!hostValid || busy}>
              {blink.phase === 'busy' ? 'Sending command…' : 'Send Blink Command'}
            </Btn>

            <StatusLine result={blink} />

            <div className="caption" style={{ marginTop: 14 }}>
              The device answers only after the LED has finished, so success here means the
              hardware actually ran the sequence — not just that a request was sent.
            </div>
          </Card>
        </Item>

        {/* ---------------- Help ---------------- */}
        <Item>
          <div className="eyebrow" style={{ marginTop: 22 }}>If it will not connect</div>
          <Card flat>
            <ul className="dev-list">
              <li>Serve this page over <strong>http://localhost</strong>. An https page cannot call a plain-http device — the browser blocks it as mixed content.</li>
              <li>Laptop and ESP32 must be on the <strong>same Wi-Fi</strong>, and it must not be a guest or campus network that isolates clients. A phone hotspot is the quickest way to rule that out.</li>
              <li>Re-check the IP in the Serial Monitor — routers reassign it on reboot.</li>
              <li>Open <code>http://{normaliseHost(host) || '<esp32-ip>'}/status</code> directly in a tab. If that fails too, the problem is the network, not this page.</li>
              <li>Full setup and troubleshooting: <strong>ESP32-TEST-README.md</strong> in the project root.</li>
            </ul>
            <div className="caption" style={{ marginTop: 12 }}>
              Detailed request and response logs are in the browser console (F12).
            </div>
          </Card>
        </Item>

        <Item>
          <div className="caption" style={{ textAlign: 'center', padding: '10px 0 0' }}>
            <Link href="/settings" className="linkbtn">Back to EasyBlot</Link>
          </div>
        </Item>
      </Page>
    </div>
  );
}

function StatusLine({ result }: { result: Result }) {
  return (
    <AnimatePresence mode="wait">
      {result.phase !== 'idle' && (
        <motion.div
          key={result.phase + result.message}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={ease}
          className={`dev-status dev-status-${result.phase}`}
        >
          <span className={`pill${result.phase === 'ok' ? ' ok' : result.phase === 'busy' ? ' dashed' : ''}`}>
            {result.phase === 'ok' ? 'Connected' : result.phase === 'busy' ? 'Working' : 'Failed'}
          </span>
          <span>{result.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
