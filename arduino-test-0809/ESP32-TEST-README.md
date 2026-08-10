# ESP32 Connectivity Test

**Development / bring-up only.** This proves the EasyBlot dashboard can talk to
an ESP32 over your local Wi-Fi before any real hardware is connected. No pumps,
no MQTT, no cloud.

What it proves:

```
This website  →  your Wi-Fi  →  ESP32  →  built-in LED blinks
                                  ↓
        "5 blinks done"  ←  response  ←
```

Total time if nothing goes wrong: about 20 minutes.

---

## Part A — ESP32 setup

### 1. Install the Arduino IDE

Download from <https://www.arduino.cc/en/software> and install it. Version 2.x
is fine.

### 2. Add ESP32 board support

The IDE does not know about ESP32 chips until you tell it.

1. Open the Arduino IDE.
2. **File → Preferences** (macOS: **Arduino IDE → Settings**).
3. Find **Additional boards manager URLs** and paste this in:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**.
5. Open **Tools → Board → Boards Manager**.
6. Search for `esp32`, find **"esp32" by Espressif Systems**, click **Install**.
   It is a large download — a few minutes is normal.

### 3. Open the firmware

Open `esp32-test-firmware/esp32-test-firmware.ino` in the Arduino IDE.

### 4. Enter your Wi-Fi details

1. In `esp32-test-firmware/`, make a copy of `arduino_secrets.example.h`.
2. Rename the copy to exactly `arduino_secrets.h`.
3. Open it and replace the placeholders:
   ```c
   #define SECRET_WIFI_SSID     "MyHomeWiFi"
   #define SECRET_WIFI_PASSWORD "my-actual-password"
   ```
4. Save.

`arduino_secrets.h` is git-ignored, so your password never gets committed.

> **The ESP32 only works on 2.4 GHz Wi-Fi.** It cannot join a 5 GHz network.
> If your router uses one name for both bands, this usually still works; if it
> does not, connect to the 2.4 GHz network specifically.

### 5. Plug the ESP32 into your computer

Use a USB cable that carries **data**, not a charge-only cable. If no port
appears in the next step, a charge-only cable is the most common reason.

### 6. Select the board

**Tools → Board → esp32 → "ESP32 Dev Module"**

That works for most common boards. If you know your exact board (for example
"NodeMCU-32S" or "LOLIN D32"), pick that instead.

### 7. Select the port

**Tools → Port** and pick the one that appeared when you plugged the board in.

- Windows: `COM3`, `COM4`, …
- macOS: `/dev/cu.usbserial-…` or `/dev/cu.SLAB_USBtoUART`
- Linux: `/dev/ttyUSB0`

If nothing appears, you likely need a USB-to-serial driver:
[CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) or
[CH340](https://www.wch-ic.com/downloads/CH341SER_ZIP.html). Check which chip
your board has, install the driver, then replug.

### 8. Upload

Click the **→** (Upload) arrow. It compiles first — the first build takes a
minute or two.

If it stalls at `Connecting........___`, hold the **BOOT** button on the board
while it connects, then release. Some boards need this every upload.

### 9. Open the Serial Monitor

**Tools → Serial Monitor**, and set the baud rate (bottom right) to
**115200**. If you see garbled characters, the baud rate is wrong.

Press the **EN**/**RST** button on the board to restart it.

### 10. Find the IP address

You should see something like:

```
[boot] EasyBlot ESP32 connectivity test
[boot] LED pin GPIO 2 (active HIGH)
[wifi] connecting to "MyHomeWiFi"....
[wifi] connected
[wifi] IP address: 192.168.1.73

=============================================
  Enter this IP in the dashboard:  192.168.1.73
=============================================

[http] server listening on port 80
```

The board also blinks its LED **twice** at startup to show the firmware is
running. Write down that IP address.

---

## Part B — Website setup

### Run the site locally

Open a terminal in this folder and run:

```bash
npm install     # first time only
npm run dev
```

Then open <http://localhost:3000>.

> **Run it on `http://localhost`, not a deployed `https://` URL.**
> Browsers block an https page from calling a plain-http device on your
> network ("mixed content"), and the ESP32 only speaks http. The dev server
> serves plain http, so it works. This is why the test is local-only for now.

### Reach the test page

Either:

- go straight to <http://localhost:3000/dev/esp32>, or
- sign in, then **Settings → Development → ESP32 Connectivity Test → Open**

You do not need an account for the direct link — it deliberately sits outside
the logged-in area.

---

## Part C — Run the test

1. Power the ESP32 and confirm the Serial Monitor shows its IP.
2. Open <http://localhost:3000/dev/esp32>.
3. Type the IP into **ESP32 IP address** (for example `192.168.1.73`).
   It is saved in your browser, so you only type it once.
4. Click **Test Connection**.
5. You should see **Connected — EasyBlot-Test reports "online"**.
6. Enter `5` in **Blink count**.
7. Click **Send Blink Command**.
8. Watch the board: the LED blinks **exactly five times**, about twice a second.
9. The page shows **EasyBlot received command: 5 blinks**.

Then try `2` (two blinks) and `10` (ten blinks) to confirm the count is really
being obeyed rather than a fixed animation.

The website waits for the board to finish before showing success, so the
message appears a moment *after* the blinking stops. That is intentional — it
means success reflects what the hardware did, not just that a message was sent.

---

## Troubleshooting

### Nothing blinks, but the website says success

The LED pin is wrong for your board. Open the `.ino`, find:

```c
#define LED_BUILTIN 2
```

Try `5`, then `13`, then `22`. Re-upload after each change.

If the LED is lit constantly and goes *dark* when blinking, your board wires it
backwards — set `LED_ACTIVE_LOW = true` near the top of the sketch.

### "Unable to connect" / "Could not reach …"

Work through these in order:

1. **Open `http://<esp32-ip>/status` directly in a browser tab.**
   You should see `{"device":"EasyBlot-Test","status":"online"}`. If this
   fails too, the problem is the network — not the website.
2. **Same Wi-Fi?** The laptop and the ESP32 must be on the same network. A
   laptop on 5 GHz and an ESP32 on 2.4 GHz is fine *if* they are the same
   router and it does not isolate bands.
3. **Right IP?** Routers hand out a new IP after a reboot. Re-check the Serial
   Monitor.
4. **Still on `http://localhost`?** An `https://` page cannot reach it.

### Campus, office, hotel, or guest Wi-Fi (very common)

Most university and enterprise networks enable **client isolation** (also
called AP isolation), which stops devices on the same Wi-Fi from talking to
each other. Your laptop and ESP32 will both have working internet and still be
unable to see one another. Nothing you change in the code will fix this.

**Workaround:** use a phone hotspot or a home router. Connect both the laptop
and the ESP32 to it, re-check the IP in the Serial Monitor, and try again.
This is the single most likely cause of failure on a university network, and
the quickest thing to test.

### CORS error in the browser console

Message looks like *"blocked by CORS policy"*. The firmware sends
`Access-Control-Allow-Origin: *`, so this normally means an older firmware is
still on the board. Re-upload and retry.

### Mixed content error

Message looks like *"Mixed Content: The page at 'https://…' was loaded over
HTTPS, but requested an insecure resource 'http://192.168…'"*.

You are on a deployed https site. Use `npm run dev` and `http://localhost:3000`
instead. Solving this properly for production needs certificates on the device
or a local gateway — deliberately out of scope for this test.

### Firewall

Windows Defender or a corporate firewall can block outgoing requests to LAN
addresses. If the direct `http://<ip>/status` tab also fails while the board's
Serial Monitor shows no incoming request, temporarily allow your browser
through the firewall, or test from a different machine.

### ESP32 will not connect to Wi-Fi

The Serial Monitor loops with dots and retries. Check, in order:

- The network is **2.4 GHz**, not 5 GHz only.
- SSID and password in `arduino_secrets.h` are exact — they are case-sensitive.
- The network has no captive portal (hotel/campus sign-in pages). The ESP32
  cannot fill in a web login form.
- The board is close enough to the router. `[wifi] signal:` below about
  `-80 dBm` is weak.

---

## What is where

| Path | Purpose |
| --- | --- |
| `lib/easyblotDevice.ts` | All hardware HTTP calls. The only file that talks to the device. |
| `app/dev/esp32/page.tsx` | The test page UI. |
| `esp32-test-firmware/` | Arduino sketch for the board. |
| `app/(app)/settings/page.tsx` | One link into the test page, under "Development". |
| `app/globals.css` | A small `.dev-*` style block at the end. |

Nothing else in the EasyBlot app was changed.

## Removing this later

Delete `app/dev/`, `lib/easyblotDevice.ts`, `esp32-test-firmware/`, this file,
the "Development" card in Settings, and the `.dev-*` CSS block. That is the
whole feature.

## What replaces it

`lib/easyblotDevice.ts` is the seam. When real control arrives, `blinkLed()`
is replaced by `startPump()`, `stopPump()`, `sendProtocol()`,
`pauseProtocol()`, `stopProtocol()`, and `testConnection()` becomes
`getDeviceStatus()` — most likely over MQTT rather than HTTP. Because the UI
only ever calls these functions, the screens do not need to change.

Two things this test deliberately does not solve, which the real design must:

- **Security.** `Access-Control-Allow-Origin: *` lets any website in your
  browser command the board. Fine on a private network for a bring-up test,
  unacceptable in production.
- **HTTPS.** A hosted dashboard cannot reach a plain-http device on a LAN.
  That is the constraint that pushes the real product toward MQTT over
  WebSockets with TLS, or a local gateway.
