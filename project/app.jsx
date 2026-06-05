/* =========================================================================
   App shell — sidebar nav, tab routing, global mutable state
   ========================================================================= */
const { useState: useS, useEffect: useE, useMemo: useM, useCallback: useCb } = React;

function Sidebar({ tab, setTab, counts, brandCounts }) {
  const NAV = [
    { id: "queue", label: "Queue", icon: "inbox", count: counts.awaiting },
    { id: "kb", label: "Knowledge Base", icon: "book" },
    { id: "settings", label: "Brand Settings", icon: "settings" },
  ];
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo"><Icon name="logomark" size={15} strokeWidth={2} /></div>
        <div className="sb-wordmark">Resend Hub</div>
      </div>

      <nav className="sb-nav">
        <div className="sb-section-label">Workspace</div>
        {NAV.map((n) => (
          <button key={n.id} className={"sb-item" + (tab === n.id ? " active" : "")} onClick={() => setTab(n.id)}>
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
            {n.count > 0 && <span className="sb-item-count">{n.count}</span>}
          </button>
        ))}
      </nav>

      <div className="sb-brands">
        <div className="sb-section-label">Brands · one inbox</div>
        {window.HUB.brands.map((b) => (
          <div className="sb-brand-row" key={b.id} title={b.tagline}>
            <span className="dot" style={{ background: `oklch(0.62 0.17 ${b.hue})` }}></span>
            <span className="truncate">{b.name}</span>
            <span className="ct mono">{brandCounts[b.id] || 0}</span>
          </div>
        ))}
      </div>

      <div className="sb-user">
        <Avatar name="You" hue={255} size="md" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }} className="truncate">Alex Operator</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }} className="truncate">Support · all brands</div>
        </div>
        <button className="iconbtn"><Icon name="settings" size={15} /></button>
      </div>
    </aside>
  );
}

function App() {
  const [tab, setTab] = useS("queue");
  const [threads, setThreads] = useS(() => window.HUB.threads.map((t) => ({ ...t })));
  const [openThreadId, setOpenThreadId] = useS(null);
  const [loading, setLoading] = useS(true);
  const [policy, setPolicy] = useS(() => JSON.parse(JSON.stringify(window.HUB.defaultPolicy)));
  const [kbArticles, setKbArticles] = useS(() => window.HUB.kbArticles.map((a) => ({ ...a })));
  const [gaps, setGaps] = useS(() => window.HUB.gapClusters.map((g) => ({ ...g, resolved: false })));
  const [brandVoices, setBrandVoices] = useS(() =>
    Object.fromEntries(window.HUB.brands.map((b) => [b.id, b.voiceApproved]))
  );
  const { push, node: toastNode } = useToasts();

  // simulate initial queue load
  useE(() => {
    const t = setTimeout(() => setLoading(false), 1100);
    return () => clearTimeout(t);
  }, []);

  const counts = useM(() => {
    const c = {};
    for (const s of ["awaiting", "open", "auto", "snoozed", "closed"])
      c[s] = threads.filter((t) => t.status === s).length;
    return c;
  }, [threads]);

  const brandCounts = useM(() => {
    const c = {};
    for (const b of window.HUB.brands)
      c[b.id] = threads.filter((t) => t.brand === b.id && (t.status === "awaiting" || t.status === "open")).length;
    return c;
  }, [threads]);

  const state = { threads, policy, kbArticles, gaps };

  const updateThread = useCb((id, patch) => {
    setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }, []);

  const openThread = useCb((id) => {
    setOpenThreadId(id);
    updateThread(id, { unread: false });
  }, [updateThread]);

  const openThreadObj = threads.find((t) => t.id === openThreadId);

  // global keyboard: "/" focuses search when on queue, esc closes thread
  useE(() => {
    function onKey(e) {
      if (e.key === "Escape" && openThreadId) { setOpenThreadId(null); }
      if (e.key === "/" && !openThreadId && tab === "queue") {
        const el = document.querySelector(".queue-toolbar .field input");
        if (el && document.activeElement !== el) { e.preventDefault(); el.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openThreadId, tab]);

  return (
    <div className="app">
      <Sidebar tab={tab} setTab={(t) => { setTab(t); setOpenThreadId(null); }} counts={counts} brandCounts={brandCounts} />

      <div className="main" style={{ flex: 1 }}>
        {/* Top header */}
        <header className="topbar">
          {tab === "queue" && !openThreadObj && (
            <>
              <h1>Unified Queue</h1>
              <span className="badge" style={{ marginLeft: 4 }}>
                <Icon name="users" size={11} />{window.HUB.brands.length} brands
              </span>
              <div style={{ flex: 1 }}></div>
              <button className="iconbtn bordered"><Icon name="bell" size={15} /></button>
            </>
          )}
          {tab === "queue" && openThreadObj && (
            <>
              <button className="btn ghost sm" onClick={() => setOpenThreadId(null)}>
                <Icon name="arrowLeft" size={14} />Queue
              </button>
              <div className="crumbs">
                <Icon name="chevronRight" size={13} />
                <BrandChip brand={openThreadObj.brandObj} />
                <span className="mono" style={{ fontSize: 12 }}>{openThreadObj.id}</span>
              </div>
              <div style={{ flex: 1 }}></div>
            </>
          )}
          {tab === "kb" && <h1>Knowledge Base</h1>}
          {tab === "settings" && <h1>Brand Settings</h1>}
        </header>

        {/* Body */}
        {tab === "queue" && !openThreadObj && (
          <QueueScreen state={state} onOpen={openThread} loading={loading} />
        )}
        {tab === "queue" && openThreadObj && (
          <ThreadScreen
            thread={openThreadObj} state={state} updateThread={updateThread}
            onClose={() => setOpenThreadId(null)} onOpenOther={openThread}
            policy={policy} push={push}
          />
        )}
        {tab === "kb" && (
          <KBScreen kbArticles={kbArticles} setKbArticles={setKbArticles} gaps={gaps} setGaps={setGaps} push={push} />
        )}
        {tab === "settings" && (
          <SettingsScreen policy={policy} setPolicy={setPolicy} brandVoices={brandVoices} setBrandVoices={setBrandVoices} push={push} />
        )}
      </div>

      {toastNode}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
