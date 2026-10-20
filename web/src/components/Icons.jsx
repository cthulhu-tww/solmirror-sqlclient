// 内联 SVG 图标（stroke 风格，24x24）
const I = (props, children) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" {...props}>{children}</svg>
);

export const IconDb = (p) => I(p, <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>);
export const IconQuery = (p) => I(p, <><path d="M5 7h14M5 12h9M5 17h6" /><path d="M17 15l3 3 3-3" transform="translate(-3 0)" /></>);
export const IconHistory = (p) => I(p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>);
export const IconGear = (p) => I(p, <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.09A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.09A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 1 1.51 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9c.14.62.68 1.06 1.47 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.51 1z" /></>);
export const IconPlay = (p) => I(p, <><path d="M7 5v14l12-7z" fill="currentColor" stroke="none" /></>);
export const IconBolt = (p) => I(p, <><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></>);
export const IconChevron = (p) => I(p, <><path d="M9 6l6 6-6 6" /></>);
export const IconBack = (p) => I(p, <><path d="M15 6l-6 6 6 6" /></>);
export const IconTrash = (p) => I(p, <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></>);
export const IconEdit = (p) => I(p, <><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></>);
export const IconPlus = (p) => I(p, <><path d="M12 5v14M5 12h14" /></>);
export const IconStar = ({ on, ...p }) => (
  <svg viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" width="20" height="20" {...p}>
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
  </svg>
);
export const IconCopy = (p) => I(p, <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>);
export const IconSearch = (p) => I(p, <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
export const IconTable = (p) => I(p, <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10M15 10v10" /></>);
export const IconWarn = (p) => I(p, <><path d="M12 3l10 17H2z" /><path d="M12 10v4M12 17.5v.01" /></>);
export const IconShield = (p) => I(p, <><path d="M12 2l8 3v6c0 5.2-3.4 9.6-8 11-4.6-1.4-8-5.8-8-11V5z" /><path d="M9 12l2 2 4-4" /></>);
export const IconClose = (p) => I(p, <><path d="M6 6l12 12M18 6L6 18" /></>);
export const IconWand = (p) => I(p, <><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M3 21l9-9" /></>);
export const IconBook = (p) => I(p, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>);
export const IconKey = (p) => I(p, <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3l1 1-2 2 2 2-3 3-2-2-2 2" /></>);
