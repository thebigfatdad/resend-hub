/* =========================================================================
   Primitive components
   ========================================================================= */
const { useState, useRef, useEffect, useLayoutEffect, useCallback } = React;

/* ---- Brand chip & dot ---- */
function BrandChip({ brand, size = "md" }) {
  if (!brand) return null;
  return (
    <span className="brand-chip" style={{ "--bh": brand.hue }}>
      <span className="dot"></span>
      {brand.name}
    </span>
  );
}
function BrandDot({ brand, title }) {
  if (!brand) return null;
  return <span className="brand-dot" style={{ "--bh": brand.hue }} title={title || brand.name}></span>;
}

/* ---- Status pill ---- */
function StatusPill({ status }) {
  const cls = window.HUB.STATUS_CLS[status];
  const label = window.HUB.STATUS_LABELS[status];
  return (
    <span className={"pill " + cls}>
      <span className="dot"></span>
      {label}
    </span>
  );
}

/* ---- Intent + sentiment badges ---- */
const INTENT_ICON = {
  refund: "tag", billing: "tag", cancel: "x", access: "user", verify: "shield",
  bug: "alertCircle", integration: "link", optout: "trash", feature: "sparkles",
  outage: "flame", abuse: "shield",
};
function IntentBadge({ intent, label }) {
  return (
    <span className="badge intent" title={"Intent · " + label}>
      <Icon name={INTENT_ICON[intent] || "tag"} size={12} />
      {label}
    </span>
  );
}
const SENT_ICON = {
  "sent-neg": "frown", "sent-warn": "alertCircle", "sent-neu": "meh", "sent-pos": "smile",
};
function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  return (
    <span className={"badge " + sentiment.cls} title={"Sentiment · " + sentiment.label}>
      <Icon name={SENT_ICON[sentiment.cls]} size={12} />
      {sentiment.label}
    </span>
  );
}

/* ---- Avatar ---- */
function Avatar({ name, hue = 255, size = "md" }) {
  const initials = (name || "?")
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const bg = `linear-gradient(140deg, oklch(0.62 0.15 ${hue}), oklch(0.52 0.16 ${(hue + 40) % 360}))`;
  return (
    <span className={"avatar " + (size === "md" ? "" : size)} style={{ background: bg }}>
      {initials}
    </span>
  );
}

/* ---- Toggle ---- */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      className={"toggle " + (checked ? "on" : "")} disabled={disabled}
      onClick={() => onChange && onChange(!checked)}
    ></button>
  );
}

/* ---- Slider ---- */
function Slider({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "%" }) {
  return (
    <div className="slider-row">
      <div className="slider-top">
        <span className="lbl">{label}</span>
        <span className="slider-val">{value}{suffix}</span>
      </div>
      <input
        type="range" className="slider" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ---- Popover (click-outside, anchored) ---- */
function Popover({ open, onClose, children, anchorRef, align = "left", width }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    }
    function onEsc(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);
  if (!open) return null;
  const style = { position: "absolute", top: "calc(100% + 6px)", zIndex: 90 };
  if (align === "right") style.right = 0; else style.left = 0;
  if (width) style.width = width;
  return (
    <div ref={ref} style={style} className="fade-in">
      {children}
    </div>
  );
}

/* ---- Dropdown button (label + menu) ---- */
function Dropdown({ trigger, children, align = "left", width }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  return (
    <div className="popwrap" ref={anchor}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} align={align} width={width}>
        <div className="menu" onClick={(e) => { if (e.target.closest(".menu-item")) setOpen(false); }}>
          {children}
        </div>
      </Popover>
    </div>
  );
}

/* ---- Empty state ---- */
function EmptyState({ icon = "checkCircle", title, children, action }) {
  return (
    <div className="empty">
      <div className="ill"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ---- Toast manager ---- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, icon = "check") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  const node = (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <Icon name={t.icon} size={15} />
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { push, node };
}

/* ---- Relative-time helper for display ---- */
function timeLabel(t) {
  return t.time;
}

Object.assign(window, {
  BrandChip, BrandDot, StatusPill, IntentBadge, SentimentBadge, Avatar,
  Toggle, Slider, Popover, Dropdown, EmptyState, useToasts, timeLabel,
  INTENT_ICON, SENT_ICON,
});
