/* =========================================================================
   Mock data + helpers for Resend Hub
   Exposed on window.HUB
   ========================================================================= */
(function () {
  // ---- Brands (per-brand accent hue drives the chip/dot color slot) ----
  const brands = [
    {
      id: "trustmatch", name: "TrustMatch", hue: 252,
      tagline: "Identity verification for dating & B2C interactions",
      support: "support@trustmatch.io", noreply: "no-reply@trustmatch.io",
      voiceApproved: true,
      voice: {
        tone: "Reassuring, plain-spoken, safety-first",
        traits: ["Warm", "Concise", "Non-technical", "Empathetic"],
        summary:
          "Speak like a trusted safety concierge. Lead with reassurance, avoid jargon, and never imply blame when a verification fails. Keep replies under 120 words. Always offer a clear next step.",
      },
    },
    {
      id: "cleariq", name: "ClearIQ", hue: 168,
      tagline: "Identity safety for high-value private sales",
      support: "help@cleariq.com", noreply: "no-reply@cleariq.com",
      voiceApproved: true,
      voice: {
        tone: "Precise, professional, discreet",
        traits: ["Formal", "Detailed", "Discreet", "Confident"],
        summary:
          "Audience is high-net-worth sellers and buyers. Be precise and discreet, reference compliance where relevant, and project competence. Avoid casual language. Confirm next steps explicitly.",
      },
    },
    {
      id: "personiq", name: "PersonIQ", hue: 300,
      tagline: "Consumer people-search website",
      support: "support@personiq.com", noreply: "no-reply@personiq.com",
      voiceApproved: false,
      voice: {
        tone: "Friendly, helpful, transparent about data",
        traits: ["Casual", "Helpful", "Direct", "Privacy-aware"],
        summary:
          "Consumers, often confused about billing or data sources. Be friendly and direct, explain data-opt-out clearly, and de-escalate billing frustration quickly. Mention the self-serve opt-out link when relevant.",
      },
    },
    {
      id: "ringserve", name: "RingServe", hue: 38,
      tagline: "AI phone agents with billing-platform connectors",
      support: "support@ringserve.ai", noreply: "no-reply@ringserve.ai",
      voiceApproved: true,
      voice: {
        tone: "Technical, crisp, builder-friendly",
        traits: ["Technical", "Crisp", "Solution-oriented"],
        summary:
          "Audience is developers and ops teams integrating phone agents. Be technical and exact, link to docs, and give code/config specifics. Acknowledge severity for outages immediately.",
      },
    },
  ];
  const brandById = Object.fromEntries(brands.map((b) => [b.id, b]));

  const INTENTS = {
    refund: "Refund",
    billing: "Billing",
    cancel: "Cancellation",
    access: "Account access",
    verify: "Verification",
    bug: "Bug report",
    integration: "Integration",
    optout: "Data opt-out",
    feature: "Feature request",
    outage: "Outage",
    abuse: "Trust & safety",
  };
  const SENTIMENT = {
    frustrated: { label: "Frustrated", cls: "sent-neg" },
    angry: { label: "Angry", cls: "sent-neg" },
    anxious: { label: "Anxious", cls: "sent-warn" },
    urgent: { label: "Urgent", cls: "sent-warn" },
    neutral: { label: "Neutral", cls: "sent-neu" },
    positive: { label: "Positive", cls: "sent-pos" },
  };

  // helper to build a message
  const m = (dir, author, time, body, opts = {}) => ({
    dir, author, time, body, ...opts,
  });

  // ---- Threads ----
  // statuses: awaiting | open | auto | snoozed | closed
  const threads = [
    {
      id: "T-4821", brand: "trustmatch", status: "awaiting", unread: true,
      customer: { name: "Maya Iverson", email: "maya.iverson@gmail.com" },
      subject: "Verification keeps failing on my new phone",
      snippet: "I've tried three times and it says my selfie doesn't match. I really need this for a date tonight…",
      intent: "verify", sentiment: "anxious", time: "4m", ts: 4,
      assignee: null, hasDraft: true, confidence: 0.86,
      draft:
        "Hi Maya,\n\nSorry for the trouble — let's get you verified. A selfie mismatch is almost always a lighting or angle issue, not anything wrong on your end.\n\nPlease try once more in a well-lit room, holding the phone at eye level and removing glasses or hats. If it still fails, reply here and I'll manually review your photo within the hour.\n\nYou'll be set well before tonight.\n\n— TrustMatch Support",
      messages: [
        m("in", "Maya Iverson", "Today, 2:18 PM",
          ["I just got a new phone and now verification keeps failing.", "I've tried three times and it says my selfie doesn't match my ID. I really need this working for a date tonight and I'm getting nervous. Can you help?"],
          { attachments: [{ name: "error-screenshot.png", size: "248 KB" }] }),
      ],
    },
    {
      id: "T-4820", brand: "ringserve", status: "awaiting", unread: true,
      customer: { name: "Dev Okafor", email: "dev@northstar-saas.com" },
      subject: "Stripe connector dropped all webhooks at 2am",
      snippet: "Our phone agent stopped logging charges overnight. Webhooks return 410. This is affecting billing…",
      intent: "outage", sentiment: "urgent", time: "11m", ts: 11,
      assignee: null, hasDraft: true, confidence: 0.64,
      draft:
        "Hi Dev,\n\nThanks for flagging — a 410 on the Stripe connector points to a rotated webhook signing secret on our side during last night's maintenance window.\n\nPlease re-issue the connector token in Settings → Connectors → Stripe → \"Rotate secret\", then replay the missed events from your Stripe dashboard. I'm escalating to on-call in parallel to confirm there's no data loss on our end.\n\nWill update you within 15 minutes.\n\n— RingServe",
      messages: [
        m("in", "Dev Okafor", "Today, 2:11 PM",
          ["Our RingServe phone agent stopped logging charges overnight. The Stripe connector webhooks are all returning 410 Gone since about 2am.", "This is directly affecting our billing reconciliation. Need eyes on this ASAP."],
          { attachments: [{ name: "webhook-log.txt", size: "12 KB" }, { name: "trace-410.har", size: "1.1 MB" }] }),
      ],
    },
    {
      id: "T-4818", brand: "personiq", status: "awaiting", unread: false,
      customer: { name: "Carol Brennan", email: "carolbrennan54@yahoo.com" },
      subject: "I was charged $39.90 and never signed up",
      snippet: "There is a charge from PersonIQ on my card. I never created an account. Take it off now.",
      intent: "billing", sentiment: "angry", time: "26m", ts: 26,
      assignee: null, hasDraft: true, confidence: 0.91,
      draft:
        "Hi Carol,\n\nI'm sorry for the surprise charge — I can help right away. The $39.90 is a PersonIQ report subscription, often started during a one-time report lookup.\n\nI've cancelled the subscription so you won't be billed again, and I've issued a full refund of $39.90 — it'll appear in 5–7 business days. You'll get a confirmation email shortly.\n\nIf you'd also like your information removed from our directory, here's the opt-out link: personiq.com/opt-out.\n\n— PersonIQ Support",
      messages: [
        m("in", "Carol Brennan", "Today, 1:53 PM",
          ["There is a charge from PERSONIQ on my credit card for $39.90 and I have NEVER created an account with you people.", "Take it off now and tell me how you got my card."]),
      ],
    },
    {
      id: "T-4815", brand: "cleariq", status: "awaiting", unread: false,
      customer: { name: "Jonathan Mercer", email: "j.mercer@mercerprivate.com" },
      subject: "Need verification cleared before $180k watch sale closes Friday",
      snippet: "The buyer's identity check is pending manual review. We have a deadline. Can this be expedited?",
      intent: "verify", sentiment: "urgent", time: "1h", ts: 62,
      assignee: null, hasDraft: true, confidence: 0.78,
      draft:
        "Dear Mr. Mercer,\n\nThank you for the details. The buyer's verification is currently in manual review due to a name mismatch between the submitted ID and the payment instrument.\n\nI have flagged the case for expedited review by our compliance team; the standard turnaround is reduced to within 4 business hours for cases like yours. Please ask the buyer to confirm the legal name on file matches the card exactly.\n\nI will personally confirm the moment clearance is issued.\n\nRegards,\nClearIQ Verification",
      messages: [
        m("in", "Jonathan Mercer", "Today, 1:02 PM",
          ["We have a $180,000 watch sale scheduled to close this Friday and the buyer's ClearIQ identity check is stuck in pending manual review.", "Is there any way to expedite? This is time-sensitive."]),
      ],
    },
    {
      id: "T-4812", brand: "trustmatch", status: "awaiting", unread: false,
      customer: { name: "Priya Nair", email: "priya.nair@outlook.com" },
      subject: "How do I delete my verification data?",
      snippet: "I matched with someone who turned out to be sketchy. I want all my data removed.",
      intent: "optout", sentiment: "anxious", time: "2h", ts: 120,
      assignee: "You", hasDraft: false, confidence: null, draft: "",
      messages: [
        m("in", "Priya Nair", "Today, 12:04 PM",
          ["I used TrustMatch to verify someone I matched with and the situation turned out badly. I'm uncomfortable with you holding my photo and ID.", "How do I delete all of my verification data, permanently?"]),
      ],
    },
    {
      id: "T-4809", brand: "ringserve", status: "open", unread: false,
      customer: { name: "Liang Wu", email: "liang@voicworks.io" },
      subject: "Can the agent transfer to a human mid-call?",
      snippet: "Looking to add a warm-transfer step when sentiment drops. Is there a config for that?",
      intent: "feature", sentiment: "neutral", time: "3h", ts: 190,
      assignee: "Sam Reyes", hasDraft: true, confidence: 0.88,
      draft:
        "Hi Liang,\n\nYes — warm transfer is supported. Add a `transfer` action to your flow with a `trigger: sentiment_below` threshold (0–1). When the live sentiment score drops under that value, the agent bridges to the number in `transfer.destination`.\n\nDocs with a full example: docs.ringserve.ai/flows/warm-transfer.\n\nHappy to review your flow config if you paste it here.\n\n— RingServe",
      messages: [
        m("in", "Liang Wu", "Today, 11:20 AM", ["We'd like the AI agent to hand off to a human when the caller gets frustrated. Is there a config for a warm transfer triggered by sentiment?"]),
        m("out", "Sam Reyes", "Today, 11:38 AM", ["Hi Liang — great question, let me confirm the exact config and get back to you shortly."]),
      ],
    },
    {
      id: "T-4805", brand: "personiq", status: "auto", unread: false,
      customer: { name: "Greg Holloway", email: "gholloway@gmail.com" },
      subject: "How accurate is the address history?",
      snippet: "Auto-replied with sourcing explanation + accuracy disclaimer.",
      intent: "billing", sentiment: "neutral", time: "4h", ts: 250,
      assignee: null, hasDraft: false, confidence: 0.94,
      messages: [
        m("in", "Greg Holloway", "Today, 10:02 AM", ["How accurate is the address history shown in a PersonIQ report? Where does it come from?"]),
        m("auto", "PersonIQ Assistant", "Today, 10:02 AM",
          ["Thanks for asking! PersonIQ aggregates address history from public records, property filings, and licensed data providers.", "Records are typically 90%+ accurate but can lag recent moves by 30–60 days. You can report an inaccuracy from any report page and we'll review it."],
          { confidence: 0.94 }),
      ],
    },
    {
      id: "T-4801", brand: "cleariq", status: "auto", unread: false,
      customer: { name: "Helena Voss", email: "h.voss@vossgalerie.de" },
      subject: "What documents does the seller need to provide?",
      snippet: "Auto-replied with the seller document checklist.",
      intent: "verify", sentiment: "neutral", time: "5h", ts: 320,
      assignee: null, hasDraft: false, confidence: 0.9,
      messages: [
        m("in", "Helena Voss", "Today, 9:11 AM", ["For a private art sale, what documents does the seller need to provide for ClearIQ verification?"]),
        m("auto", "ClearIQ Assistant", "Today, 9:11 AM",
          ["For seller verification, please provide: a government-issued photo ID, proof of address dated within 90 days, and provenance documentation for items valued above $50,000.", "Upload these from your case dashboard under \"Seller Documents.\""],
          { confidence: 0.90 }),
      ],
    },
    {
      id: "T-4799", brand: "trustmatch", status: "snoozed", unread: false,
      customer: { name: "Tomás Rivera", email: "tomas.r@protonmail.com" },
      subject: "Is the verified badge permanent?",
      snippet: "Snoozed until tomorrow — awaiting product confirmation.",
      intent: "feature", sentiment: "neutral", time: "Snoozed · 1d", ts: 1400,
      assignee: "You", hasDraft: false, confidence: null,
      snoozeUntil: "Tomorrow, 9:00 AM",
      messages: [
        m("in", "Tomás Rivera", "Yesterday, 4:30 PM", ["Once I get the verified badge, is it permanent or do I need to re-verify periodically?"]),
        m("out", "You", "Yesterday, 4:52 PM", ["Hi Tomás — checking with the product team on the exact re-verification window and will follow up tomorrow."]),
      ],
    },
    {
      id: "T-4796", brand: "ringserve", status: "snoozed", unread: false,
      customer: { name: "Aisha Bello", email: "aisha@calltrust.co" },
      subject: "Invoice PDF shows wrong VAT rate",
      snippet: "Snoozed — finance to confirm corrected rate.",
      intent: "billing", sentiment: "neutral", time: "Snoozed · 2d", ts: 2880,
      assignee: "Sam Reyes", hasDraft: false, confidence: null,
      snoozeUntil: "Mon, 8:00 AM",
      messages: [
        m("in", "Aisha Bello", "2 days ago", ["The VAT rate on our latest RingServe invoice looks wrong — it shows 15% but we're a UK entity (should be 20%)."]),
      ],
    },
    {
      id: "T-4790", brand: "personiq", status: "closed", unread: false,
      customer: { name: "Bill Tran", email: "billtran@icloud.com" },
      subject: "Refund processed — thank you",
      snippet: "Resolved. Refund of $24.95 issued and confirmed by customer.",
      intent: "refund", sentiment: "positive", time: "1d", ts: 1500,
      assignee: "You", hasDraft: false, confidence: null,
      messages: [
        m("in", "Bill Tran", "Yesterday, 10:00 AM", ["I'd like a refund for a report I didn't mean to buy."]),
        m("out", "You", "Yesterday, 10:14 AM", ["Done — I've refunded $24.95, you'll see it in 5–7 business days. Sorry for the mix-up!"]),
        m("in", "Bill Tran", "Yesterday, 10:40 AM", ["That was fast, thank you so much."]),
      ],
    },
    {
      id: "T-4788", brand: "cleariq", status: "closed", unread: false,
      customer: { name: "Marcus Feld", email: "mfeld@feldcapital.com" },
      subject: "Verification cleared for jewelry consignment",
      snippet: "Resolved. Buyer cleared and sale completed.",
      intent: "verify", sentiment: "positive", time: "2d", ts: 3000,
      assignee: "Sam Reyes", hasDraft: false, confidence: null,
      messages: [
        m("in", "Marcus Feld", "2 days ago", ["Following up on the pending verification for our consignment buyer."]),
        m("out", "Sam Reyes", "2 days ago", ["Cleared as of this morning — you're good to proceed. Thanks for your patience."]),
      ],
    },
    {
      id: "T-4786", brand: "trustmatch", status: "open", unread: true,
      customer: { name: "Sofia Lindqvist", email: "sofia.l@gmail.com" },
      subject: "Match's profile shows verified but photo looks off",
      snippet: "The badge says verified but the photos don't seem like the same person…",
      intent: "abuse", sentiment: "anxious", time: "6h", ts: 360,
      assignee: null, hasDraft: true, confidence: 0.71,
      draft:
        "Hi Sofia,\n\nThank you for flagging this — your safety is the priority. A verified badge confirms the person passed an ID + liveness check at signup, but profile photos can be older or edited.\n\nI've opened a trust & safety review of this account. If you can share the profile link or username, I'll fast-track it. In the meantime, trust your instincts and feel free to pause contact.\n\n— TrustMatch Support",
      messages: [
        m("in", "Sofia Lindqvist", "Today, 8:30 AM", ["Someone I matched with has a TrustMatch verified badge, but their photos look like a different person than their videos. Should I be worried?"]),
      ],
    },
    {
      id: "T-4782", brand: "ringserve", status: "open", unread: false,
      customer: { name: "Owen Pierce", email: "owen@pierce-dental.com" },
      subject: "Agent mispronounces our clinic name",
      snippet: "Can I add a phonetic override for the business name?",
      intent: "bug", sentiment: "neutral", time: "7h", ts: 420,
      assignee: null, hasDraft: true, confidence: 0.83,
      draft:
        "Hi Owen,\n\nYes — you can add a phonetic override. In Settings → Voice → Pronunciations, add an entry mapping \"Pierce\" to your preferred phonetic spelling (e.g. \"peerss\"). Changes take effect on the next call.\n\nLet me know the exact pronunciation and I can add it for you.\n\n— RingServe",
      messages: [
        m("in", "Owen Pierce", "Today, 7:05 AM", ["The RingServe agent keeps mispronouncing our clinic name on calls. Is there a way to fix the pronunciation?"]),
      ],
    },
    {
      id: "T-4780", brand: "personiq", status: "open", unread: false,
      customer: { name: "Denise Park", email: "denisepark@gmail.com" },
      subject: "Opt-out didn't remove my listing",
      snippet: "I submitted the opt-out form a week ago but my info is still showing.",
      intent: "optout", sentiment: "frustrated", time: "8h", ts: 480,
      assignee: null, hasDraft: true, confidence: 0.8,
      draft:
        "Hi Denise,\n\nApologies for the delay — opt-out removals can take up to 7 business days to propagate across our cached results, which may be what you're seeing.\n\nI've manually expedited the removal of your listing; it should clear within 24 hours. I've also suppressed it from search immediately. You'll get a confirmation email.\n\n— PersonIQ Support",
      messages: [
        m("in", "Denise Park", "Today, 6:10 AM", ["I submitted the opt-out form over a week ago but my information is still showing up in search results. Why?"]),
      ],
    },
    {
      id: "T-4778", brand: "cleariq", status: "open", unread: false,
      customer: { name: "Ravi Anand", email: "ravi@anandestates.com" },
      subject: "Can we white-label the verification emails?",
      snippet: "We'd like the buyer-facing emails to use our brokerage branding.",
      intent: "feature", sentiment: "neutral", time: "9h", ts: 540,
      assignee: "Sam Reyes", hasDraft: false, confidence: null,
      messages: [
        m("in", "Ravi Anand", "Today, 5:00 AM", ["Is white-labeling the buyer-facing verification emails available on our plan? We'd like our brokerage branding on them."]),
      ],
    },
    {
      id: "T-4775", brand: "trustmatch", status: "auto", unread: false,
      customer: { name: "Nadia Haddad", email: "nadia.h@gmail.com" },
      subject: "How long does verification take?",
      snippet: "Auto-replied with typical verification timing.",
      intent: "verify", sentiment: "neutral", time: "10h", ts: 600,
      assignee: null, hasDraft: false, confidence: 0.96,
      messages: [
        m("in", "Nadia Haddad", "Yesterday, 9:00 PM", ["How long does TrustMatch verification usually take?"]),
        m("auto", "TrustMatch Assistant", "Yesterday, 9:00 PM",
          ["Most verifications complete in under 2 minutes! You'll take a quick photo of your ID and a selfie, and our system matches them automatically.", "If anything needs manual review, it's typically done within an hour."],
          { confidence: 0.96 }),
      ],
    },
  ];

  // attach brand object + intent/sentiment labels
  threads.forEach((t) => {
    t.brandObj = brandById[t.brand];
    t.intentLabel = INTENTS[t.intent] || t.intent;
    t.sentimentObj = SENTIMENT[t.sentiment];
  });

  // ---- Customer directory (derived + enriched) ----
  function customerFor(thread) {
    const email = thread.customer.email;
    const others = threads.filter(
      (t) => t.customer.email === email && t.id !== thread.id
    );
    // a couple of synthetic prior threads for key customers
    const synthetic = {
      "maya.iverson@gmail.com": [
        { id: "T-3902", subject: "Password reset link expired", status: "closed", brand: "trustmatch", time: "Mar 2" },
      ],
      "dev@northstar-saas.com": [
        { id: "T-4410", subject: "Rate limits on the calls API", status: "closed", brand: "ringserve", time: "Apr 18" },
        { id: "T-4002", subject: "Onboarding: sandbox keys", status: "closed", brand: "ringserve", time: "Feb 9" },
      ],
      "carolbrennan54@yahoo.com": [
        { id: "T-4791", subject: "Where did you get my information?", status: "closed", brand: "personiq", time: "May 30" },
      ],
    };
    const extra = synthetic[email] || [];
    return {
      ...thread.customer,
      firstSeen: thread.customer.firstSeen || pickFirstSeen(email),
      lastSeen: "Today",
      brand: thread.brandObj,
      otherThreads: [
        ...others.map((t) => ({ id: t.id, subject: t.subject, status: t.status, brand: t.brand, time: t.time })),
        ...extra,
      ],
    };
  }
  function pickFirstSeen(email) {
    const map = {
      "maya.iverson@gmail.com": "Jan 14, 2026",
      "dev@northstar-saas.com": "Aug 2, 2025",
      "carolbrennan54@yahoo.com": "May 28, 2026",
      "j.mercer@mercerprivate.com": "Nov 3, 2025",
    };
    return map[email] || "Apr 22, 2026";
  }

  // ---- KB articles ----
  const kbArticles = [
    { id: "KB-101", brand: "trustmatch", title: "Why did my selfie verification fail?", status: "published", views: 4210, updated: "2d ago", helpful: 92 },
    { id: "KB-102", brand: "trustmatch", title: "How to permanently delete your verification data", status: "published", views: 1880, updated: "5d ago", helpful: 88 },
    { id: "KB-118", brand: "personiq", title: "How to opt out of PersonIQ search results", status: "published", views: 9320, updated: "1d ago", helpful: 79 },
    { id: "KB-119", brand: "personiq", title: "Understanding your PersonIQ subscription & billing", status: "published", views: 6740, updated: "3d ago", helpful: 71 },
    { id: "KB-204", brand: "ringserve", title: "Setting up the Stripe connector", status: "published", views: 3110, updated: "6h ago", helpful: 95 },
    { id: "KB-205", brand: "ringserve", title: "Warm transfer to a human agent", status: "draft", views: 0, updated: "1h ago", helpful: null },
    { id: "KB-301", brand: "cleariq", title: "Seller document checklist for private sales", status: "published", views: 1450, updated: "4d ago", helpful: 90 },
    { id: "KB-302", brand: "cleariq", title: "Expedited verification for time-sensitive deals", status: "draft", views: 0, updated: "2h ago", helpful: null },
    { id: "KB-099", brand: "trustmatch", title: "Legacy: SMS verification (deprecated)", status: "archived", views: 210, updated: "120d ago", helpful: 44 },
    { id: "KB-117", brand: "personiq", title: "Accuracy of address & phone records", status: "published", views: 2890, updated: "8d ago", helpful: 68 },
  ];

  // ---- Gap inbox: clusters of unanswered questions from escalations ----
  const gapClusters = [
    {
      id: "GAP-1", brand: "ringserve", count: 14,
      question: "Does the Stripe connector retry failed webhooks automatically?",
      sub: "Surfaced from 14 escalations in the last 7 days",
      examples: [
        "Will RingServe replay webhooks if Stripe is down?",
        "Do I need to manually retry 410 errors?",
        "Is there automatic backoff on connector failures?",
      ],
    },
    {
      id: "GAP-2", brand: "personiq", count: 9,
      question: "How long does an opt-out take to fully propagate?",
      sub: "Surfaced from 9 escalations in the last 7 days",
      examples: [
        "I opted out a week ago and I'm still showing.",
        "Why is my info still in Google after opt-out?",
        "Is removal instant or delayed?",
      ],
    },
    {
      id: "GAP-3", brand: "trustmatch", count: 6,
      question: "What should I do if a verified profile looks fake?",
      sub: "Surfaced from 6 escalations in the last 7 days",
      examples: [
        "Badge says verified but photos look edited.",
        "How do I report a suspicious verified match?",
      ],
    },
    {
      id: "GAP-4", brand: "cleariq", count: 4,
      question: "Can verification be expedited for a hard deadline?",
      sub: "Surfaced from 4 escalations in the last 7 days",
      examples: [
        "Sale closes Friday — can you rush the check?",
        "Is there a priority review option?",
      ],
    },
  ];

  // ---- Canned responses ----
  const cannedResponses = [
    { id: "c1", title: "Refund issued", body: "I've issued a full refund — you'll see it in 5–7 business days. Sorry for the trouble!" },
    { id: "c2", title: "Opt-out instructions", body: "You can remove your information using our self-serve opt-out form. Removals take up to 7 business days to fully propagate." },
    { id: "c3", title: "Verification retry tips", body: "Please try again in a well-lit room, hold the phone at eye level, and remove glasses or hats. That resolves most selfie mismatches." },
    { id: "c4", title: "Escalating to engineering", body: "I've escalated this to our engineering team and flagged it as urgent. I'll keep you updated here." },
    { id: "c5", title: "Asking for more detail", body: "To help me investigate, could you share the affected account email and the approximate time this happened?" },
  ];

  const team = [
    { id: "you", name: "You", initials: "YO", hue: 255 },
    { id: "sam", name: "Sam Reyes", initials: "SR", hue: 168 },
    { id: "nora", name: "Nora Diallo", initials: "ND", hue: 300 },
    { id: "kai", name: "Kai Mueller", initials: "KM", hue: 38 },
  ];

  // default per-brand policy config
  const defaultPolicy = {
    trustmatch: { autoSend: false, confidence: 90, retrieval: 70, sentiment: 60 },
    cleariq: { autoSend: false, confidence: 95, retrieval: 80, sentiment: 50 },
    personiq: { autoSend: false, confidence: 85, retrieval: 65, sentiment: 65 },
    ringserve: { autoSend: false, confidence: 88, retrieval: 75, sentiment: 55 },
  };

  window.HUB = {
    brands, brandById, threads, INTENTS, SENTIMENT,
    customerFor, kbArticles, gapClusters, cannedResponses, team, defaultPolicy,
    STATUS_LABELS: {
      awaiting: "Awaiting human", open: "Open", auto: "Auto-replied",
      snoozed: "Snoozed", closed: "Closed",
    },
    STATUS_CLS: {
      awaiting: "awaiting", open: "open", auto: "auto", snoozed: "snoozed", closed: "closed",
    },
  };
})();
