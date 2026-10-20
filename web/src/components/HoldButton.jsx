import { useRef, useState, useCallback } from 'react';

// 长按确认按钮：按住 holdMs 毫秒后触发，防手滑。用于高危 SQL 执行确认。
export default function HoldButton({ holdMs = 1200, onComplete, children, disabled }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    timerRef.current = null;
    setProgress(0);
  }, []);

  const start = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    doneRef.current = false;
    startRef.current = performance.now();
    const tick = () => {
      const p = Math.min((performance.now() - startRef.current) / holdMs, 1);
      setProgress(p);
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        stop();
        onComplete?.();
        return;
      }
      timerRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = requestAnimationFrame(tick);
  }, [disabled, holdMs, onComplete, stop]);

  return (
    <button
      className="holdbtn"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
    >
      <div className="fill" style={{ width: `${progress * 100}%` }} />
      <span className="lab">
        {progress > 0 ? `继续按住 ${Math.ceil((1 - progress) * (holdMs / 1000))}s…` : children}
      </span>
    </button>
  );
}
