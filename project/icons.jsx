/* =========================================================================
   Icons — simple stroke-based line icons (feather-ish)
   <Icon name="..." size={16} />
   ========================================================================= */
const ICON_PATHS = {
  inbox: '<path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M5.5 5h13l2 8v5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-5z"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15.5H6.5A1.5 1.5 0 0 0 5 20z"/><path d="M5 17.5V4.5"/>',
  settings: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3v2.2M12 18.8V21M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M3 12h2.2M18.8 12H21M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="m20 20-3.4-3.4"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  paperclip: '<path d="M21 11.5 12.5 20a4.5 4.5 0 0 1-6.4-6.4l8.5-8.5a3 3 0 0 1 4.3 4.3l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1l7.8-7.8"/>',
  send: '<path d="M21 4 3 11l6 2.5L11.5 20z"/><path d="M21 4 9.5 13.5"/>',
  sparkles: '<path d="M12 3.2 13.5 10.5 20.8 12 13.5 13.5 12 20.8 10.5 13.5 3.2 12 10.5 10.5z"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.5V12l3 2"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M21 19c0-2.4-1.6-4-3.8-4.5"/>',
  check: '<path d="M5 12.5 10 17.5 19 6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.4"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  x: '<path d="M6 6 18 18M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  filter: '<path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 5.5L20 7"/>',
  alert: '<path d="M12 4 21 19H3z"/><path d="M12 10v4M12 16.5v.5"/>',
  alertCircle: '<circle cx="12" cy="12" r="8.4"/><path d="M12 8v4.5M12 15.5v.4"/>',
  escalate: '<path d="M12 19V6"/><path d="m6 11 6-6 6 6"/>',
  snooze: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/><path d="M14.5 3.5h5l-5 5h5"/>',
  archive: '<rect x="3.5" y="5" width="17" height="4" rx="1"/><path d="M5 9v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
  tag: '<path d="M3.5 11V4.5a1 1 0 0 1 1-1H11l9 9-7.5 7.5z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  smile: '<circle cx="12" cy="12" r="8.4"/><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8"/><path d="M9 9.5v.4M15 9.5v.4"/>',
  frown: '<circle cx="12" cy="12" r="8.4"/><path d="M8.5 15.8s1.3-1.8 3.5-1.8 3.5 1.8 3.5 1.8"/><path d="M9 9.5v.4M15 9.5v.4"/>',
  meh: '<circle cx="12" cy="12" r="8.4"/><path d="M8.5 15h7"/><path d="M9 9.5v.4M15 9.5v.4"/>',
  flame: '<path d="M12 3c2.5 3 4.5 5 4.5 8.5A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.5C7.5 9 9 7 12 3z"/>',
  zap: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  shield: '<path d="M12 3.5 19 6v5c0 4.3-3 7.3-7 8.5-4-1.2-7-4.2-7-8.5V6z"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17z"/><path d="M14 8l2.8 2.8"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  trash: '<path d="M4.5 7h15M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 12.5a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9L18 7"/>',
  bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  command: '<path d="M9 6a2.5 2.5 0 1 0-2.5 2.5H9zm0 0v12m0 0a2.5 2.5 0 1 1-2.5-2.5H9m0 0h6m0 0a2.5 2.5 0 1 0 2.5 2.5H15m0 0V6m0 0a2.5 2.5 0 1 1 2.5 2.5H15m0 0H9"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5L15.5 12l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A14 14 0 0 1 5 5.6 1.5 1.5 0 0 1 6.5 4z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 15.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5v.5"/>',
  reply: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6v1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  logomark: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
};

function Icon({ name, size = 16, className = "", style = {}, strokeWidth = 1.6 }) {
  const d = ICON_PATHS[name];
  return (
    <svg
      className={"ic " + className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="square" strokeLinejoin="round" style={style} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}

Object.assign(window, { Icon, ICON_PATHS });
