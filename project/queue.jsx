/* =========================================================================
   Unified Queue screen
   ========================================================================= */
const { useState: useStateQ, useMemo: useMemoQ, useEffect: useEffectQ } = React;

function QueueRow({ thread, onOpen, active }) {
  const t = thread;
  const awaiting = t.status === "awaiting";
  return (
    <div
      className={"qrow" + (t.unread ? " unread" : "") + (awaiting ? " awaiting-accent" : "")}
      onClick={() => onOpen(t.id)}
      role="button"
    >
      <div className="qcheck" onClick={(e) => e.stopPropagation()}>
        <Avatar name={t.customer.name} hue={t.brandObj.hue} size="sm" />
      </div>

      <div className="qcust">
        <div className="who">
          <div className="qname truncate">{t.customer.name}</div>
          <div className="qemail truncate mono">{t.customer.email}</div>
        </div>
      </div>

      <div className="qmid">
        <div className="qsub-line">
          <span className="qsubject truncate">{t.subject}</span>
          {t.hasDraft && t.status === "awaiting" && (
            <span className="draft-tick" title={"AI draft ready · " + Math.round(t.confidence * 100) + "% confidence"}>
              <Icon name="sparkles" size={11} />
            </span>
          )}
        </div>
        <div className="qmeta-tags">
          <IntentBadge intent={t.intent} label={t.intentLabel} />
          <SentimentBadge sentiment={t.sentimentObj} />
          {t.assignee && (
            <span className="badge" title={"Assigned to " + t.assignee}>
              <Icon name="user" size={11} />{t.assignee === "You" ? "You" : t.assignee.split(" ")[0]}
            </span>
          )}
        </div>
      </div>

      <div className="qright">
        <div className="qright-stack">
          <BrandChip brand={t.brandObj} />
          <StatusPill status={t.status} />
        </div>
        <div className="qtime">{t.time}</div>
      </div>
    </div>
  );
}

function QueueSkeletonRow() {
  return (
    <div className="qrow" style={{ cursor: "default", pointerEvents: "none" }}>
      <div className="qcheck"><div className="skel" style={{ width: 22, height: 22, borderRadius: 999 }}></div></div>
      <div className="qcust"><div className="who" style={{ width: "100%" }}>
        <div className="skel" style={{ width: "70%", height: 11, marginBottom: 6 }}></div>
        <div className="skel" style={{ width: "90%", height: 9 }}></div>
      </div></div>
      <div className="qmid">
        <div className="skel" style={{ width: "55%", height: 11, marginBottom: 7 }}></div>
        <div className="skel" style={{ width: 180, height: 16 }}></div>
      </div>
      <div className="qright">
        <div className="skel" style={{ width: 88, height: 18, borderRadius: 999 }}></div>
        <div className="skel" style={{ width: 96, height: 18, borderRadius: 999 }}></div>
        <div className="skel" style={{ width: 32, height: 11 }}></div>
      </div>
    </div>
  );
}

function QueueScreen({ state, onOpen, loading }) {
  const { threads } = state;
  const [brandFilter, setBrandFilter] = useStateQ("all");
  const [statusFilter, setStatusFilter] = useStateQ("awaiting"); // default = job to be done
  const [query, setQuery] = useStateQ("");

  const STATUSES = [
    { id: "awaiting", label: "Awaiting human" },
    { id: "open", label: "Open" },
    { id: "auto", label: "Auto-replied" },
    { id: "snoozed", label: "Snoozed" },
    { id: "closed", label: "Closed" },
  ];

  const counts = useMemoQ(() => {
    const c = { all: threads.length };
    for (const s of STATUSES) c[s.id] = threads.filter((t) => t.status === s.id).length;
    return c;
  }, [threads]);

  const brandCounts = useMemoQ(() => {
    const visible = threads.filter((t) => statusFilter === "all" || t.status === statusFilter);
    const c = { all: visible.length };
    for (const b of window.HUB.brands) c[b.id] = visible.filter((t) => t.brand === b.id).length;
    return c;
  }, [threads, statusFilter]);

  const filtered = useMemoQ(() => {
    const q = query.trim().toLowerCase();
    return threads
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) => brandFilter === "all" || t.brand === brandFilter)
      .filter((t) =>
        !q ||
        t.customer.name.toLowerCase().includes(q) ||
        t.customer.email.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.intentLabel.toLowerCase().includes(q)
      )
      .sort((a, b) => a.ts - b.ts);
  }, [threads, brandFilter, statusFilter, query]);

  return (
    <div className="main">
      {/* Toolbar: brand filter + status filter + search */}
      <div className="queue-toolbar">
        {/* Brand filter */}
        <Dropdown
          width={232}
          trigger={({ toggle, open }) => (
            <button className="btn" onClick={toggle} aria-expanded={open}>
              {brandFilter === "all" ? (
                <><Icon name="inbox" size={14} />All brands</>
              ) : (
                <><span className="brand-dot" style={{ "--bh": window.HUB.brandById[brandFilter].hue, width: 8, height: 8 }}></span>{window.HUB.brandById[brandFilter].name}</>
              )}
              <Icon name="chevronDown" size={13} style={{ marginLeft: 2, color: "var(--text-faint)" }} />
            </button>
          )}
        >
          <div className="menu-label">Filter by brand</div>
          <button className="menu-item" onClick={() => setBrandFilter("all")}>
            <Icon name="inbox" size={15} />
            <span style={{ flex: 1 }}>All brands</span>
            <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11.5 }}>{brandCounts.all}</span>
            {brandFilter === "all" && <Icon name="check" size={14} style={{ color: "var(--accent)" }} />}
          </button>
          <div className="menu-sep"></div>
          {window.HUB.brands.map((b) => (
            <button key={b.id} className="menu-item" onClick={() => setBrandFilter(b.id)}>
              <span className="brand-dot" style={{ "--bh": b.hue, width: 9, height: 9 }}></span>
              <span style={{ flex: 1 }}>{b.name}</span>
              <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11.5 }}>{brandCounts[b.id]}</span>
              {brandFilter === b.id && <Icon name="check" size={14} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </Dropdown>

        <div className="divider-v"></div>

        {/* Status filter (segmented) */}
        <div className="segmented" role="tablist">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              className={statusFilter === s.id ? "on" : ""}
              onClick={() => setStatusFilter(s.id)}
            >
              {s.id === "awaiting" && <span className="brand-dot pulse-dot" style={{ width: 7, height: 7, background: "var(--st-awaiting-dot)", boxShadow: "none" }}></span>}
              {s.label}
              <span className="cnt">{counts[s.id]}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }}></div>

        {/* Search */}
        <div className="field" style={{ width: 240 }}>
          <Icon name="search" size={14} />
          <input
            placeholder="Search threads…" value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => setQuery("")}>
              <Icon name="x" size={13} />
            </button>
          ) : (
            <span className="kbd">/</span>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="queue-meta">
        <span>
          {loading ? "Loading…" : (
            <><strong style={{ color: "var(--text)", fontWeight: 600 }}>{filtered.length}</strong> {filtered.length === 1 ? "thread" : "threads"}
            {statusFilter === "awaiting" && filtered.length > 0 && " need a human"}
            {brandFilter !== "all" && <> · {window.HUB.brandById[brandFilter].name}</>}</>
          )}
        </span>
        {statusFilter === "awaiting" && !loading && filtered.length > 0 && (
          <span className="badge" style={{ color: "var(--st-awaiting-fg)", background: "var(--st-awaiting-bg)", borderColor: "var(--st-awaiting-border)" }}>
            <Icon name="bolt" size={11} />Oldest first
          </span>
        )}
        <div className="sortby">
          <Icon name="inbox" size={13} style={{ color: "var(--text-faint)" }} />
          <span>One pane · all brands</span>
        </div>
      </div>

      {/* List / loading / empty */}
      {loading ? (
        <div className="qlist scroll">
          {Array.from({ length: 7 }).map((_, i) => <QueueSkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <QueueEmpty statusFilter={statusFilter} query={query} brandFilter={brandFilter}
          onReset={() => { setQuery(""); setBrandFilter("all"); }} />
      ) : (
        <div className="qlist scroll">
          {filtered.map((t) => <QueueRow key={t.id} thread={t} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function QueueEmpty({ statusFilter, query, brandFilter, onReset }) {
  if (query || brandFilter !== "all") {
    return (
      <EmptyState icon="search" title="No matching threads"
        action={<button className="btn" onClick={onReset}>Clear filters</button>}>
        Nothing matches your current search and filters. Try broadening them.
      </EmptyState>
    );
  }
  if (statusFilter === "awaiting") {
    return (
      <EmptyState icon="checkCircle" title="Inbox zero — no one's waiting on a human">
        Every thread across all four brands has been handled or auto-replied. New escalations land here the moment AI confidence drops.
      </EmptyState>
    );
  }
  return (
    <EmptyState icon="inbox" title={"No " + window.HUB.STATUS_LABELS[statusFilter].toLowerCase() + " threads"}>
      There's nothing in this view right now.
    </EmptyState>
  );
}

Object.assign(window, { QueueScreen });
