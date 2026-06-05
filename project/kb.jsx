/* =========================================================================
   Knowledge Base tab — articles list + gap inbox
   ========================================================================= */
const { useState: useSK, useMemo: useMK } = React;

function KBStatusBadge({ status }) {
  const map = { published: "kb-published", draft: "kb-draft", archived: "kb-archived" };
  const label = { published: "Published", draft: "Draft", archived: "Archived" };
  return <span className={"badge " + map[status]}>{label[status]}</span>;
}

function KBScreen({ kbArticles, setKbArticles, gaps, setGaps, push }) {
  const [brandFilter, setBrandFilter] = useSK("all");
  const [statusFilter, setStatusFilter] = useSK("all");

  const articles = useMK(() =>
    kbArticles
      .filter((a) => brandFilter === "all" || a.brand === brandFilter)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
  , [kbArticles, brandFilter, statusFilter]);

  const openGaps = gaps.filter((g) => !g.resolved);

  function approveGap(g) {
    // create a draft article + resolve the gap
    const brand = window.HUB.brandById[g.brand];
    const newId = "KB-" + (400 + Math.floor(Math.random() * 99));
    setKbArticles((arts) => [
      { id: newId, brand: g.brand, title: g.question, status: "draft", views: 0, updated: "Just now", helpful: null, fromGap: true },
      ...arts,
    ]);
    setGaps((gs) => gs.map((x) => (x.id === g.id ? { ...x, resolved: true } : x)));
    push("Draft created for " + brand.name + " · " + newId, "doc");
  }

  const STATUS_TABS = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "draft", label: "Drafts" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <div className="kb-wrap scroll">
      <div className="kb-grid">
        {/* Articles list */}
        <section className="panel-card">
          <div className="panel-card-head">
            <Icon name="book" size={16} style={{ color: "var(--accent)" }} />
            <div>
              <h3>Help-center articles</h3>
              <div className="sub">{articles.length} of {kbArticles.length} across all brands</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Dropdown align="right" width={210} trigger={({ toggle }) => (
                <button className="btn sm" onClick={toggle}>
                  {brandFilter === "all" ? "All brands" : window.HUB.brandById[brandFilter].name}
                  <Icon name="chevronDown" size={12} style={{ color: "var(--text-faint)" }} />
                </button>
              )}>
                <button className="menu-item" onClick={() => setBrandFilter("all")}><Icon name="inbox" size={14} />All brands{brandFilter === "all" && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--accent)" }} />}</button>
                <div className="menu-sep"></div>
                {window.HUB.brands.map((b) => (
                  <button key={b.id} className="menu-item" onClick={() => setBrandFilter(b.id)}>
                    <span className="brand-dot" style={{ "--bh": b.hue, width: 9, height: 9 }}></span>{b.name}
                    {brandFilter === b.id && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--accent)" }} />}
                  </button>
                ))}
              </Dropdown>
              <button className="btn primary sm"><Icon name="plus" size={14} />New</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 2, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
            <div className="segmented">
              {STATUS_TABS.map((s) => {
                const n = s.id === "all" ? kbArticles.length : kbArticles.filter((a) => a.status === s.id).length;
                return (
                  <button key={s.id} className={statusFilter === s.id ? "on" : ""} onClick={() => setStatusFilter(s.id)}>
                    {s.label}<span className="cnt">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {articles.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No articles in this view.</div>
            ) : articles.map((a) => {
              const b = window.HUB.brandById[a.brand];
              return (
                <div className="kb-art" key={a.id}>
                  <BrandDot brand={b} />
                  <div className="ka-main">
                    <div className="ka-title truncate">{a.title} {a.fromGap && <span className="badge" style={{ marginLeft: 4, color: "var(--accent)", background: "var(--accent-subtle)", borderColor: "var(--accent-subtle-border)" }}><Icon name="sparkles" size={10} />from gap</span>}</div>
                    <div className="ka-meta">
                      <span className="mono">{a.id}</span>
                      <span>·</span>
                      <span>{a.status === "draft" ? "edited" : "updated"} {a.updated}</span>
                      {a.status === "published" && <><span>·</span><span>{a.views.toLocaleString()} views</span><span>·</span><span>{a.helpful}% helpful</span></>}
                    </div>
                  </div>
                  <KBStatusBadge status={a.status} />
                  <button className="iconbtn"><Icon name="chevronRight" size={16} /></button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gap inbox */}
        <section className="panel-card" style={{ position: "sticky", top: 0 }}>
          <div className="panel-card-head" style={{ background: "var(--sent-warn-bg)", borderColor: "transparent" }}>
            <Icon name="zap" size={16} style={{ color: "oklch(0.5 0.13 60)" }} />
            <div>
              <h3>Gap inbox</h3>
              <div className="sub">Unanswered clusters from escalations</div>
            </div>
            <span className="badge" style={{ marginLeft: "auto", background: "var(--surface)" }}>{openGaps.length} open</span>
          </div>

          {openGaps.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
              <Icon name="checkCircle" size={26} style={{ color: "var(--st-auto-dot)" }} />
              <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 8 }}>All gaps triaged</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>New question clusters appear here as escalations come in.</div>
            </div>
          ) : openGaps.map((g) => {
            const b = window.HUB.brandById[g.brand];
            return (
              <div className="gap-item" key={g.id}>
                <div className="gap-head">
                  <div className="gap-count">{g.count}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="gap-q">{g.question}</div>
                    <div className="gap-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <BrandChip brand={b} /> {g.sub}
                    </div>
                  </div>
                </div>
                <div className="gap-examples">
                  {g.examples.map((ex, i) => <div className="gap-ex" key={i}>“{ex}”</div>)}
                </div>
                <div className="gap-foot">
                  <button className="btn primary sm" onClick={() => approveGap(g)}>
                    <Icon name="check" size={14} />Approve → create draft
                  </button>
                  <button className="btn sm" onClick={() => { setGaps((gs) => gs.map((x) => x.id === g.id ? { ...x, resolved: true } : x)); push("Gap dismissed"); }}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { KBScreen });
