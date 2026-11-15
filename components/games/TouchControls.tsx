'use client';

import { useEffect, useRef } from 'react';

export type TouchButton = {
  label: string;
  key: string;
  code: string;
  area: 'up' | 'down' | 'left' | 'right' | 'a' | 'b';
  repeatMs?: number;
};

function fire(type: 'keydown' | 'keyup', btn: TouchButton) {
  document.dispatchEvent(
    new KeyboardEvent(type, { key: btn.key, code: btn.code, bubbles: true }),
  );
}

export default function TouchControls({ buttons }: { buttons: TouchButton[] }) {
  const active = useRef(new Map<string, ReturnType<typeof setInterval> | null>());

  function press(btn: TouchButton) {
    if (active.current.has(btn.area)) return;
    fire('keydown', btn);
    active.current.set(
      btn.area,
      btn.repeatMs ? setInterval(() => fire('keydown', btn), btn.repeatMs) : null,
    );
  }

  function release(btn: TouchButton) {
    if (!active.current.has(btn.area)) return;
    const timer = active.current.get(btn.area);
    if (timer) clearInterval(timer);
    active.current.delete(btn.area);
    fire('keyup', btn);
  }

  useEffect(() => {
    const map = active.current;
    return () => {
      map.forEach((timer) => timer && clearInterval(timer));
      map.clear();
      buttons.forEach((b) => fire('keyup', b));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="touch-controls" aria-label="Controles táctiles">
      {buttons.map((btn) => (
        <button
          key={btn.area}
          type="button"
          className={`touch-btn touch-${btn.area}${btn.label.length > 1 ? ' touch-text' : ''}`}
          style={{ gridArea: btn.area }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            press(btn);
          }}
          onPointerUp={() => release(btn)}
          onPointerCancel={() => release(btn)}
          onLostPointerCapture={() => release(btn)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
