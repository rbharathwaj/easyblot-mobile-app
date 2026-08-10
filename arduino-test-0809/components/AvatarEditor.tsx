'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, Modal } from './ui';
import {
  AvatarError, clampOffsets, coverScale, panLimits, readImageFile, renderCroppedAvatar,
  type CropParams, type LoadedImage,
} from '../lib/avatar';

const BOX = 260;      // on-screen crop box, CSS px
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Crop editor: drag to recentre, slider or wheel to resize.
 *
 * The image is never allowed to pan away from the crop box, so the circle can
 * never contain empty space — the alternative is letting people save avatars
 * with a white wedge in the corner.
 */
export default function AvatarEditor({ file, onCancel, onSave }: {
  file: File | null;
  onCancel(): void;
  onSave(dataUrl: string): void;
}) {
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Decode whenever a new file arrives; release the object URL on teardown.
  useEffect(() => {
    if (!file) return;
    let live = true;
    let loaded: LoadedImage | null = null;
    setError(null); setImg(null); setZoom(1); setOffset({ x: 0, y: 0 });

    readImageFile(file)
      .then((res) => {
        if (!live) { res.release(); return; }
        loaded = res;
        setImg(res);
      })
      .catch((e) => { if (live) setError(e instanceof AvatarError ? e.message : 'Could not read that image.'); });

    return () => { live = false; loaded?.release(); };
  }, [file]);

  const params: CropParams = { box: BOX, zoom, offsetX: offset.x, offsetY: offset.y };

  const applyZoom = useCallback((next: number) => {
    if (!img) return;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    // Re-clamp pan at the new zoom, otherwise zooming out strands the image
    // off-centre with a visible gap.
    const clamped = clampOffsets(img, { box: BOX, zoom: z, offsetX: offset.x, offsetY: offset.y });
    setZoom(z);
    setOffset({ x: clamped.offsetX, y: clamped.offsetY });
  }, [img, offset]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!img) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !img) return;
    const next = {
      offsetX: drag.current.ox + (e.clientX - drag.current.px),
      offsetY: drag.current.oy + (e.clientY - drag.current.py),
    };
    const c = clampOffsets(img, { ...params, ...next });
    setOffset({ x: c.offsetX, y: c.offsetY });
  };

  const endDrag = () => { drag.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    if (!img) return;
    applyZoom(zoom - e.deltaY * 0.0016);
  };

  const recenter = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const save = () => {
    if (!img) return;
    setBusy(true);
    try {
      onSave(renderCroppedAvatar(img, params));
    } catch (e) {
      setError(e instanceof AvatarError ? e.message : 'Could not save that image.');
    } finally {
      setBusy(false);
    }
  };

  // Display geometry for the preview layer.
  const scale = img ? coverScale(img, BOX) * zoom : 1;
  const dw = img ? img.width * scale : 0;
  const dh = img ? img.height * scale : 0;
  const limits = img ? panLimits(img, params) : { x: 0, y: 0 };
  const canPan = limits.x > 0.5 || limits.y > 0.5;

  return (
    <Modal open={!!file} onClose={onCancel}>
      <h2>Position your photo</h2>
      <p className="sub">Drag to recentre, and use the slider to resize.</p>

      {error ? (
        <>
          <div className="err" style={{ marginTop: 16 }}>{error}</div>
          <div className="modal-actions">
            <Btn variant="ghost" onClick={onCancel}>Close</Btn>
          </div>
        </>
      ) : (
        <>
          <div className="crop-stage" style={{ width: BOX, height: BOX }}>
            {img ? (
              <div
                className={`crop-box${canPan ? ' pannable' : ''}`}
                style={{ width: BOX, height: BOX }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={onWheel}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL */}
                <img
                  src={img.el.src}
                  alt=""
                  draggable={false}
                  style={{
                    width: dw, height: dh,
                    left: (BOX - dw) / 2 + offset.x,
                    top: (BOX - dh) / 2 + offset.y,
                  }}
                />
                <div className="crop-mask" />
              </div>
            ) : (
              <div className="crop-box" style={{ width: BOX, height: BOX }}>
                <div className="caption" style={{ margin: 'auto' }}>Reading image…</div>
              </div>
            )}
          </div>

          <div className="crop-controls">
            <span className="caption">Size</span>
            <input
              className="crop-range"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!img}
              onChange={(e) => applyZoom(parseFloat(e.target.value))}
              aria-label="Resize photo"
            />
            <button className="linkbtn tiny" onClick={recenter} disabled={!img}>Recenter</button>
          </div>

          <div className="modal-actions">
            <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
            <Btn onClick={save} disabled={!img || busy}>{busy ? 'Saving…' : 'Save photo'}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
