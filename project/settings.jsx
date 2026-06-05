/* =========================================================================
   Brand Settings — senders, voice profile, policy toggles + sliders
   ========================================================================= */
const { useState: useSS } = React;

function SettingsScreen({ policy, setPolicy, brandVoices, setBrandVoices, push }) {
  const [brandId, setBrandId] = useSS("trustmatch");
  const brand = window.HUB.brandById[brandId];
  const p = policy[brandId];
  const voiceApproved = brandVoices[brandId];

  function setP(key, val) {
    setPolicy((pol) => ({ ...pol, [brandId]: { ...pol[brandId], [key]: val } }));
  }

  return (
    <div className="set-wrap scroll">
      <div className="set-inner">
        {/* Brand selector */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Configuring</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Settings are per brand — chrome stays neutral, each brand keeps its own voice & policy.</div>
          </div>
          <div className="set-brandbar">
            {window.HUB.brands.map((b) => (
              <button key={b.id} className={"bb" + (b.id === brandId ? " on" : "")} style={{ "--bh": b.hue }} onClick={() => setBrandId(b.id)}>
                <span className="dot"></span>{b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Header card */}
        <div className="set-card">
          <div className="set-card-body" style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <span className="avatar lg" style={{ background: `oklch(0.62 0.15 ${brand.hue})`, borderRadius: 12 }}>
              <Icon name="shield" size={18} strokeWidth={2} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
                {brand.name}<BrandChip brand={brand} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{brand.tagline}</div>
            </div>
            <span className="badge" style={p.autoSend ? { color: "var(--accent)", background: "var(--accent-subtle)", borderColor: "var(--accent-subtle-border)" } : {}}>
              <Icon name={p.autoSend ? "zap" : "user"} size={12} />{p.autoSend ? "Auto-send on" : "Human-in-the-loop"}
            </span>
          </div>
        </div>

        {/* Sender addresses */}
        <div className="set-card">
          <div className="set-card-head">
            <Icon name="mail" size={16} style={{ color: "var(--text-muted)" }} />
            <div><h3>Sender addresses</h3><p>Read-only · managed by your domain admin</p></div>
          </div>
          <div className="set-card-body">
            <div className="set-row">
              <div><div className="lbl">Support address</div><div className="desc">Replies to customers are sent from here.</div></div>
              <div className="readonly-field" style={{ minWidth: 240 }}><Icon name="mail" size={13} />{brand.support}</div>
            </div>
            <div className="set-row">
              <div><div className="lbl">No-reply address</div><div className="desc">Transactional & automated notifications.</div></div>
              <div className="readonly-field" style={{ minWidth: 240 }}><Icon name="bell" size={13} />{brand.noreply}</div>
            </div>
          </div>
        </div>

        {/* Voice profile */}
        <div className="set-card">
          <div className="set-card-head">
            <Icon name="sparkles" size={16} style={{ color: "var(--accent)" }} />
            <div><h3>Voice profile</h3><p>How AI drafts sound for {brand.name}</p></div>
            <div style={{ marginLeft: "auto" }}>
              {voiceApproved ? (
                <span className="badge kb-published"><Icon name="checkCircle" size={12} />Approved</span>
              ) : (
                <span className="badge kb-draft"><Icon name="alertCircle" size={12} />Needs review</span>
              )}
            </div>
          </div>
          <div className="set-card-body">
            <div className="set-row">
              <div><div className="lbl">Tone</div></div>
              <div style={{ fontSize: 13, color: "var(--text)", textAlign: "right", maxWidth: 360 }}>{brand.voice.tone}</div>
            </div>
            <div className="set-row">
              <div><div className="lbl">Traits</div></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 360 }}>
                {brand.voice.traits.map((t) => <span className="badge" key={t}>{t}</span>)}
              </div>
            </div>
            <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 14, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-muted)", fontStyle: "italic" }}>
              “{brand.voice.summary}”
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn sm"><Icon name="edit" size={13} />Edit profile</button>
              {voiceApproved ? (
                <button className="btn sm" onClick={() => { setBrandVoices((v) => ({ ...v, [brandId]: false })); push("Voice profile set to needs-review"); }}>
                  <Icon name="refresh" size={13} />Re-open for review
                </button>
              ) : (
                <button className="btn primary sm" onClick={() => { setBrandVoices((v) => ({ ...v, [brandId]: true })); push(brand.name + " voice profile approved", "checkCircle"); }}>
                  <Icon name="check" size={14} />Approve voice profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Policy */}
        <div className="set-card">
          <div className="set-card-head">
            <Icon name="settings" size={16} style={{ color: "var(--text-muted)" }} />
            <div><h3>Reply policy</h3><p>Controls when AI can act without a human</p></div>
          </div>
          <div className="set-card-body">
            {/* Auto-send toggle */}
            <div className="set-row">
              <div>
                <div className="lbl">Auto-send replies</div>
                <div className="desc">When on, replies above all thresholds are sent automatically without a human review. Off by default.</div>
              </div>
              <Toggle checked={p.autoSend} onChange={(v) => { setP("autoSend", v); push(v ? "⚠ Auto-send enabled for " + brand.name : "Auto-send disabled", v ? "alert" : "check"); }} />
            </div>

            {p.autoSend && (
              <div className="caution fade-in">
                <Icon name="alert" size={15} />
                <div>
                  <strong>Replies will send without human review.</strong> Only threads scoring above every threshold below are auto-sent; everything else still routes to <em>Awaiting human</em>. Review your thresholds carefully — this is irreversible once a message is sent.
                </div>
              </div>
            )}

            <div style={{ height: 1, background: "var(--border)" }}></div>

            <Slider label="Confidence threshold" value={p.confidence} onChange={(v) => setP("confidence", v)} min={50} max={99} />
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -8 }}>Minimum draft confidence required to {p.autoSend ? "auto-send" : "surface a draft"}.</div>

            <Slider label="Retrieval coverage threshold" value={p.retrieval} onChange={(v) => setP("retrieval", v)} min={40} max={99} />
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -8 }}>How much of the answer must be grounded in the knowledge base.</div>

            <Slider label="Sentiment floor" value={p.sentiment} onChange={(v) => setP("sentiment", v)} min={0} max={100} />
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -8 }}>Threads below this calm-sentiment score always route to a human, regardless of confidence.</div>
          </div>
        </div>

        <div style={{ height: 20 }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
