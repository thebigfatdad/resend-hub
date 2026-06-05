/* =========================================================================
   Thread view — timeline + customer panel + composer (all states)
   ========================================================================= */
const { useState: useST, useEffect: useET, useRef: useRT } = React;

/* ---------- Message bubble ---------- */
function Message({ msg, brand }) {
  const dirClass = msg.dir === "in" ? "in" : msg.dir === "auto" ? "out auto" : "out";
  const body = Array.isArray(msg.body) ? msg.body : [msg.body];
  return (
    <div className={"msg " + dirClass}>
      {msg.dir === "in" ? (
        <Avatar name={msg.author} hue={brand.hue} size="md" />
      ) : (
        <span className="avatar" style={{ background: msg.dir === "auto" ? "var(--st-auto-dot)" : "var(--accent)" }}>
          {msg.dir === "auto" ? <Icon name="sparkles" size={14} strokeWidth={2} /> : (msg.author === "You" ? "YO" : msg.author.split(" ").map((w) => w[0]).join("").slice(0, 2))}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="meta">
          <span className="nm">{msg.author}</span>
          {msg.dir === "auto" && <span className="tag-auto"><Icon name="zap" size={11} />Auto-reply · {Math.round((msg.confidence || 0) * 100)}%</span>}
          <span className="tm">{msg.time}</span>
        </div>
        <div className="bubble">
          <div className="body">
            {body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {msg.attachments && (
            <div className="attachments">
              {msg.attachments.map((a, i) => (
                <span className="att-chip" key={i}>
                  <Icon name="paperclip" size={13} />
                  <span>{a.name}</span>
                  <span className="sz">· {a.size}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Composer ---------- */
function Composer({ thread, brand, policy, updateThread, push }) {
  const hasDraft = thread.hasDraft;
  const closed = thread.status === "closed";
  const [body, setBody] = useST(hasDraft ? thread.draft : "");
  const [sendState, setSendState] = useST("idle"); // idle | sending | failed
  const [regenerating, setRegenerating] = useST(false);
  const [generating, setGenerating] = useST(false);
  const [draftShown, setDraftShown] = useST(hasDraft);
  const [cannedOpen, setCannedOpen] = useST(false);
  const taRef = useRT(null);
  const cannedAnchor = useRT(null);

  useET(() => {
    setBody(thread.hasDraft ? thread.draft : "");
    setDraftShown(thread.hasDraft);
    setSendState("idle");
  }, [thread.id]);

  const conf = thread.confidence;
  const autoSendOn = policy[thread.brand]?.autoSend;

  function doRegenerate() {
    setRegenerating(true);
    setTimeout(() => {
      const variants = [
        thread.draft,
        thread.draft.replace(/^(Hi|Dear|Hello)[^\n]*/m, (s) => s) + "\n\nLet me know if there's anything else I can help with.",
      ];
      const next = body.trim() === thread.draft.trim() ? variants[1] : thread.draft;
      setBody(next);
      setRegenerating(false);
      push("Draft regenerated", "sparkles");
    }, 1300);
  }

  function doGenerate() {
    setGenerating(true);
    setTimeout(() => {
      const generated =
        "Hi " + thread.customer.name.split(" ")[0] + ",\n\nThanks for reaching out. I've reviewed your request and I'm on it — here's what happens next.\n\n[ AI-drafted from the " + brand.name + " voice profile and your knowledge base. Edit before sending. ]\n\n— " + brand.name + " Support";
      setBody(generated);
      setGenerating(false);
      setDraftShown(true);
      push("AI draft generated", "sparkles");
    }, 1500);
  }

  function doSend() {
    if (!body.trim()) return;
    setSendState("sending");
    setTimeout(() => {
      // demo: a specific outage thread fails once to showcase send-failed state
      if (thread.id === "T-4820" && sendState !== "retry-ok") {
        setSendState("failed");
        return;
      }
      // append outbound message, mark open->closed? keep as open/handled
      updateThread(thread.id, (t) => ({
        messages: [...t.messages, {
          dir: "out", author: "You", time: "Just now",
          body: body.trim().split(/\n{2,}/),
        }],
        status: t.status === "awaiting" ? "open" : t.status,
        hasDraft: false, draft: "", assignee: t.assignee || "You",
      }));
      setSendState("idle");
      setDraftShown(false);
      setBody("");
      push("Reply sent to " + thread.customer.name.split(" ")[0], "send");
    }, 1400);
  }

  function retrySend() {
    setSendState("retry-ok");
    setTimeout(() => {
      updateThread(thread.id, (t) => ({
        messages: [...t.messages, {
          dir: "out", author: "You", time: "Just now",
          body: body.trim().split(/\n{2,}/),
        }],
        status: "open", hasDraft: false, draft: "",
      }));
      setSendState("idle");
      setDraftShown(false);
      setBody("");
      push("Reply sent on retry", "send");
    }, 1200);
  }

  if (closed) {
    return (
      <div className="composer">
        <div className="composer-empty">
          <Icon name="checkCircle" size={22} style={{ color: "var(--st-auto-dot)" }} />
          <div style={{ fontWeight: 600, color: "var(--text)" }}>This thread is closed</div>
          <div style={{ fontSize: 12.5 }}>Reopen it to send another reply.</div>
          <button className="btn" onClick={() => updateThread(thread.id, { status: "open" })}>
            <Icon name="refresh" size={14} />Reopen thread
          </button>
        </div>
      </div>
    );
  }

  const sending = sendState === "sending" || sendState === "retry-ok";

  return (
    <div className="composer">
      {/* AI draft / no draft banner row */}
      <div className="composer-bar">
        {draftShown && body ? (
          <span className="ai-tag">
            <Icon name="sparkles" size={12} />
            AI draft · {brand.name} voice
            {conf != null && <span className="conf">· {Math.round(conf * 100)}% confidence</span>}
          </span>
        ) : (
          <span className="badge" style={{ height: 24 }}>
            <Icon name="edit" size={12} />No AI draft — confidence below threshold
          </span>
        )}
        <div className="spacer"></div>
        {draftShown && body ? (
          <button className="btn sm" onClick={doRegenerate} disabled={regenerating || sending}>
            <Icon name="refresh" size={13} className={regenerating ? "spin" : ""} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        ) : (
          <button className="btn sm" onClick={doGenerate} disabled={generating || sending}>
            <Icon name="sparkles" size={13} className={generating ? "spin" : ""} />
            {generating ? "Drafting…" : "Draft with AI"}
          </button>
        )}
        <div className="popwrap" ref={cannedAnchor}>
          <button className="btn sm" onClick={() => setCannedOpen((o) => !o)}>
            <Icon name="copy" size={13} />Canned<Icon name="chevronDown" size={12} style={{ color: "var(--text-faint)" }} />
          </button>
          <Popover open={cannedOpen} onClose={() => setCannedOpen(false)} anchorRef={cannedAnchor} align="right" width={300}>
            <div className="menu">
              <div className="menu-label">Canned responses</div>
              {window.HUB.cannedResponses.map((c) => (
                <button key={c.id} className="menu-item" style={{ alignItems: "flex-start" }}
                  onClick={() => { setBody((b) => (b ? b + "\n\n" : "") + c.body); setDraftShown(true); setCannedOpen(false); push("Inserted: " + c.title, "copy"); }}>
                  <Icon name="reply" size={14} style={{ marginTop: 2 }} />
                  <span style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.4, marginTop: 1 }} className="truncate">{c.body}</div>
                  </span>
                </button>
              ))}
            </div>
          </Popover>
        </div>
      </div>

      {/* Editable body */}
      <div className={"composer-box" + (draftShown && body ? " ai-filled" : "")}>
        <textarea
          ref={taRef} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={generating ? "AI is drafting a reply…" : "Write a reply…  Markdown supported"}
          disabled={sending || generating}
        ></textarea>
        <div className="composer-foot">
          <div className="hint">
            <Icon name="mail" size={12} />
            From <span className="mono">{brand.support}</span>
          </div>
          {sendState === "failed" && (
            <div className="send-err" style={{ marginLeft: 12 }}>
              <Icon name="alertCircle" size={13} />Send failed — connection lost
            </div>
          )}
          <div className="right">
            <button className="iconbtn" title="Attach file"><Icon name="paperclip" size={15} /></button>
            {sendState === "failed" ? (
              <>
                <button className="btn sm" onClick={() => setSendState("idle")}>Discard</button>
                <button className="btn primary" onClick={retrySend}>
                  <Icon name="refresh" size={14} />Retry send
                </button>
              </>
            ) : (
              <button className="btn primary" onClick={doSend} disabled={!body.trim() || sending}>
                {sending ? <><Icon name="refresh" size={14} className="spin" />Sending…</> : <><Icon name="send" size={14} />Send reply</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Customer panel ---------- */
function CustomerPanel({ thread, onOpenOther }) {
  const c = window.HUB.customerFor(thread);
  return (
    <aside className="cpanel scroll">
      <div className="cpanel-head">
        <Avatar name={c.name} hue={c.brand.hue} size="lg" />
        <div>
          <div style={{ fontWeight: 650, fontSize: 14.5 }}>{c.name}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.email}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span className="badge"><BrandDot brand={c.brand} /> {c.brand.name}</span>
        </div>
      </div>

      <div className="cpanel-sec">
        <h4>Customer</h4>
        <div className="kv"><span className="k"><Icon name="mail" size={13} />Email</span><span className="v mono" style={{ fontSize: 11.5 }}>{c.email}</span></div>
        <div className="kv"><span className="k"><Icon name="clock" size={13} />First seen</span><span className="v">{c.firstSeen}</span></div>
        <div className="kv"><span className="k"><Icon name="eye" size={13} />Last seen</span><span className="v">{c.lastSeen}</span></div>
        <div className="kv"><span className="k"><Icon name="inbox" size={13} />Total threads</span><span className="v">{c.otherThreads.length + 1}</span></div>
      </div>

      <div className="cpanel-sec">
        <h4>This thread</h4>
        <div className="kv"><span className="k">Intent</span><span className="v"><IntentBadge intent={thread.intent} label={thread.intentLabel} /></span></div>
        <div className="kv"><span className="k">Sentiment</span><span className="v"><SentimentBadge sentiment={thread.sentimentObj} /></span></div>
        <div className="kv"><span className="k">Assignee</span><span className="v">{thread.assignee || "Unassigned"}</span></div>
        {thread.snoozeUntil && <div className="kv"><span className="k">Snoozed until</span><span className="v">{thread.snoozeUntil}</span></div>}
      </div>

      <div className="cpanel-sec" style={{ borderBottom: "none" }}>
        <h4>Other threads · {c.otherThreads.length}</h4>
        {c.otherThreads.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No other threads from this customer.</div>
        ) : c.otherThreads.map((o) => {
          const ob = window.HUB.brandById[o.brand];
          const inHub = window.HUB.threads.some((t) => t.id === o.id);
          return (
            <div className="other-thread" key={o.id} onClick={() => inHub && onOpenOther(o.id)} style={{ cursor: inHub ? "pointer" : "default" }}>
              <div className="ot-subj truncate">{o.subject}</div>
              <div className="ot-meta">
                <BrandDot brand={ob} />
                <span className="mono">{o.id}</span>
                <StatusPill status={o.status} />
                <span style={{ marginLeft: "auto" }}>{o.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/* ---------- Thread head / quick actions ---------- */
function QuickActions({ thread, updateThread, push }) {
  const assignAnchor = useRT(null);
  const moreAnchor = useRT(null);
  const [assignOpen, setAssignOpen] = useST(false);
  const [moreOpen, setMoreOpen] = useST(false);
  const escalated = thread.escalated;

  return (
    <div className="thread-actions">
      <button className={"btn sm" + (escalated ? " danger" : "")}
        onClick={() => { updateThread(thread.id, { escalated: !escalated, status: !escalated ? "open" : thread.status }); push(escalated ? "Escalation cleared" : "Escalated to Tier 2", escalated ? "check" : "escalate"); }}>
        <Icon name="escalate" size={14} />{escalated ? "Escalated" : "Escalate"}
      </button>

      <div className="popwrap" ref={assignAnchor}>
        <button className="btn sm" onClick={() => setAssignOpen((o) => !o)}>
          <Icon name="user" size={14} />Assign<Icon name="chevronDown" size={12} style={{ color: "var(--text-faint)" }} />
        </button>
        <Popover open={assignOpen} onClose={() => setAssignOpen(false)} anchorRef={assignAnchor} align="right" width={200}>
          <div className="menu">
            <div className="menu-label">Assign to</div>
            {window.HUB.team.map((m) => (
              <button key={m.id} className="menu-item" onClick={() => { updateThread(thread.id, { assignee: m.name }); setAssignOpen(false); push("Assigned to " + m.name); }}>
                <Avatar name={m.name} hue={m.hue} size="sm" />
                <span style={{ flex: 1 }}>{m.name}</span>
                {thread.assignee === m.name && <Icon name="check" size={14} style={{ color: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        </Popover>
      </div>

      <button className="btn sm" onClick={() => { updateThread(thread.id, { status: "snoozed", snoozeUntil: "Tomorrow, 9:00 AM" }); push("Snoozed until tomorrow", "snooze"); }}>
        <Icon name="snooze" size={14} />Snooze
      </button>

      <button className="btn sm" onClick={() => { updateThread(thread.id, { status: "closed" }); push("Thread closed", "checkCircle"); }}>
        <Icon name="check" size={14} />Close
      </button>

      <div className="popwrap" ref={moreAnchor}>
        <button className="iconbtn bordered" onClick={() => setMoreOpen((o) => !o)} style={{ width: 30 }}>
          <Icon name="more" size={16} />
        </button>
        <Popover open={moreOpen} onClose={() => setMoreOpen(false)} anchorRef={moreAnchor} align="right" width={190}>
          <div className="menu">
            <button className="menu-item"><Icon name="tag" size={14} />Change intent</button>
            <button className="menu-item"><Icon name="link" size={14} />Copy thread link</button>
            <button className="menu-item"><Icon name="archive" size={14} />Mark as spam</button>
            <div className="menu-sep"></div>
            <button className="menu-item danger"><Icon name="trash" size={14} />Delete thread</button>
          </div>
        </Popover>
      </div>
    </div>
  );
}

function ThreadScreen({ thread, updateThread, onClose, onOpenOther, policy, push }) {
  const brand = thread.brandObj;
  const timelineRef = useRT(null);

  useET(() => {
    if (timelineRef.current) timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
  }, [thread.messages.length, thread.id]);

  return (
    <div className="thread">
      <div className="thread-main">
        {/* Head */}
        <div className="thread-head">
          <div className="row1">
            <h2 className="truncate">{thread.subject}</h2>
            <QuickActions thread={thread} updateThread={updateThread} push={push} />
          </div>
          <div className="tags">
            <BrandChip brand={brand} />
            <StatusPill status={thread.status} />
            <IntentBadge intent={thread.intent} label={thread.intentLabel} />
            <SentimentBadge sentiment={thread.sentimentObj} />
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-faint)" }} className="mono">{thread.id}</span>
          </div>
        </div>

        {/* State banners */}
        {thread.escalated && (
          <div className="banner escalated">
            <Icon name="escalate" size={15} />
            <span>Escalated to Tier 2 · a senior agent has been notified and will pick this up.</span>
            <div className="b-act"><button className="btn sm" onClick={() => updateThread(thread.id, { escalated: false })}>Clear</button></div>
          </div>
        )}
        {thread.status === "snoozed" && (
          <div className="banner snoozed">
            <Icon name="snooze" size={15} />
            <span>Snoozed until {thread.snoozeUntil || "later"} · it will return to Awaiting human automatically.</span>
            <div className="b-act"><button className="btn sm" onClick={() => updateThread(thread.id, { status: "awaiting", snoozeUntil: null })}>Wake now</button></div>
          </div>
        )}
        {thread.status === "closed" && (
          <div className="banner closed">
            <Icon name="checkCircle" size={15} />
            <span>This thread is closed. The customer was last replied to successfully.</span>
            <div className="b-act"><button className="btn sm" onClick={() => updateThread(thread.id, { status: "open" })}>Reopen</button></div>
          </div>
        )}

        {/* Timeline */}
        <div className="timeline scroll" ref={timelineRef}>
          <div className="day-sep">{thread.messages[0]?.time?.startsWith("Today") ? "Today" : "Conversation"}</div>
          {thread.messages.map((m, i) => <Message key={i} msg={m} brand={brand} />)}
        </div>

        {/* Composer */}
        <Composer thread={thread} brand={brand} policy={policy} updateThread={updateThread} push={push} />
      </div>

      <CustomerPanel thread={thread} onOpenOther={onOpenOther} />
    </div>
  );
}

Object.assign(window, { ThreadScreen });
