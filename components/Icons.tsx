'use client';

/* Set de iconos SVG inline (stroke currentColor) para Orbit Next. */

interface IcProps { size?: number; className?: string; style?: React.CSSProperties }

function base(size: number, children: React.ReactNode, className?: string, style?: React.CSSProperties) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IcChat = (p: IcProps) => base(p.size ?? 18, <><path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12Z" /><path d="M9 11h.01M12.5 11h.01M16 11h.01" /></>, p.className, p.style);
export const IcRepo = (p: IcProps) => base(p.size ?? 18, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>, p.className, p.style);
export const IcPR = (p: IcProps) => base(p.size ?? 18, <><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M6 8.6v6.8M13 4h2a2 2 0 0 1 2 2v9.4M13 4 15 2m-2 2 2 2" /></>, p.className, p.style);
export const IcIssue = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /></>, p.className, p.style);
export const IcUpload = (p: IcProps) => base(p.size ?? 18, <><path d="M12 16V4m0 0 4 4m-4-4L8 8" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>, p.className, p.style);
export const IcSettings = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>, p.className, p.style);
export const IcSearch = (p: IcProps) => base(p.size ?? 18, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, p.className, p.style);
export const IcSend = (p: IcProps) => base(p.size ?? 18, <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></>, p.className, p.style);
export const IcShield = (p: IcProps) => base(p.size ?? 18, <><path d="M12 2 4 5.5v5.7c0 4.9 3.4 8.6 8 10.3 4.6-1.7 8-5.4 8-10.3V5.5Z" /><path d="m9 11.5 2 2 4-4.5" /></>, p.className, p.style);
export const IcKey = (p: IcProps) => base(p.size ?? 18, <><circle cx="8" cy="15" r="4.5" /><path d="m11 12 8-8m-2 2 2.5 2.5M15 7l2.5 2.5" /></>, p.className, p.style);
export const IcSun = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>, p.className, p.style);
export const IcMoon = (p: IcProps) => base(p.size ?? 18, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />, p.className, p.style);
export const IcTrash = (p: IcProps) => base(p.size ?? 18, <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>, p.className, p.style);
export const IcPlus = (p: IcProps) => base(p.size ?? 18, <path d="M12 5v14M5 12h14" />, p.className, p.style);
export const IcBranch = (p: IcProps) => base(p.size ?? 18, <><circle cx="6" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 7.5v9M18 11.5a7 7 0 0 1-7 5H9.5" /></>, p.className, p.style);
export const IcZap = (p: IcProps) => base(p.size ?? 18, <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />, p.className, p.style);
export const IcDownload = (p: IcProps) => base(p.size ?? 18, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>, p.className, p.style);
export const IcRefresh = (p: IcProps) => base(p.size ?? 18, <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>, p.className, p.style);
export const IcX = (p: IcProps) => base(p.size ?? 18, <path d="M18 6 6 18M6 6l12 12" />, p.className, p.style);
export const IcCheck = (p: IcProps) => base(p.size ?? 18, <path d="m4 12.5 5 5L20 6.5" />, p.className, p.style);
export const IcWarn = (p: IcProps) => base(p.size ?? 18, <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4m0 3h.01" /></>, p.className, p.style);
export const IcUser = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>, p.className, p.style);
export const IcFolder = (p: IcProps) => base(p.size ?? 18, <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />, p.className, p.style);
export const IcFile = (p: IcProps) => base(p.size ?? 18, <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>, p.className, p.style);
export const IcCloud = (p: IcProps) => base(p.size ?? 18, <path d="M17.5 19a4.5 4.5 0 1 0-.9-8.9A6 6 0 1 0 5.7 17.7" />, p.className, p.style);
export const IcExternal = (p: IcProps) => base(p.size ?? 18, <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></>, p.className, p.style);
export const IcLock = (p: IcProps) => base(p.size ?? 18, <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, p.className, p.style);
export const IcMenu = (p: IcProps) => base(p.size ?? 18, <path d="M4 7h16M4 12h16M4 17h16" />, p.className, p.style);
export const IcCode = (p: IcProps) => base(p.size ?? 18, <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>, p.className, p.style);
export const IcCommit = (p: IcProps) => base(p.size ?? 18, <><line x1="3" y1="12" x2="9" y2="12" /><circle cx="12" cy="12" r="3" /><line x1="15" y1="12" x2="21" y2="12" /></>, p.className, p.style);
export const IcCompare = (p: IcProps) => base(p.size ?? 18, <><circle cx="18" cy="18" r="2.6" /><circle cx="6" cy="6" r="2.6" /><path d="M13 6h3a2 2 0 0 1 2 2v7.4" /><path d="M6 8.6V21" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /></>, p.className, p.style);
export const IcMerge = (p: IcProps) => base(p.size ?? 18, <><circle cx="18" cy="18" r="2.6" /><circle cx="6" cy="6" r="2.6" /><path d="M6 8.6V21" /><path d="M18 15.4A9 9 0 0 0 9 6.5" /></>, p.className, p.style);
export const IcTag = (p: IcProps) => base(p.size ?? 18, <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z" /><circle cx="7" cy="7" r="1.1" /></>, p.className, p.style);
export const IcStar = (p: IcProps) => base(p.size ?? 18, <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" />, p.className, p.style);
export const IcBox = (p: IcProps) => base(p.size ?? 18, <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>, p.className, p.style);
export const IcMore = (p: IcProps) => base(p.size ?? 18, <><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></>, p.className, p.style);
export const IcCopy = (p: IcProps) => base(p.size ?? 18, <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>, p.className, p.style);
export const IcEdit = (p: IcProps) => base(p.size ?? 18, <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>, p.className, p.style);
export const IcEye = (p: IcProps) => base(p.size ?? 18, <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></>, p.className, p.style);
export const IcChevR = (p: IcProps) => base(p.size ?? 18, <path d="m9 18 6-6-6-6" />, p.className, p.style);
export const IcChevD = (p: IcProps) => base(p.size ?? 18, <path d="m6 9 6 6 6-6" />, p.className, p.style);
export const IcFork = (p: IcProps) => base(p.size ?? 18, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>, p.className, p.style);
export const IcGlobe = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></>, p.className, p.style);
export const IcSparkles = (p: IcProps) => base(p.size ?? 18, <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z" />, p.className, p.style);
export const IcTerminal = (p: IcProps) => base(p.size ?? 18, <><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></>, p.className, p.style);
export const IcActivity = (p: IcProps) => base(p.size ?? 18, <path d="M22 12h-4l-3 9L9 3l-3 9H2" />, p.className, p.style);
export const IcBook = (p: IcProps) => base(p.size ?? 18, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8m8 4H8m2-8H8" /></>, p.className, p.style);
export const IcArchive = (p: IcProps) => base(p.size ?? 18, <><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></>, p.className, p.style);
export const IcWifi = (p: IcProps) => base(p.size ?? 18, <><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.82 16a6 6 0 0 1 6.36 0" /><path d="M12 20h.01" /></>, p.className, p.style);
export const IcInfo = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>, p.className, p.style);
export const IcAlert = (p: IcProps) => base(p.size ?? 18, <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></>, p.className, p.style);
export const IcArrowRight = (p: IcProps) => base(p.size ?? 18, <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>, p.className, p.style);
export const IcFileCode = (p: IcProps) => base(p.size ?? 18, <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /><path d="m10 13-2 2 2 2" /><path d="m14 13 2 2-2 2" /></>, p.className, p.style);
export const IcRotate = (p: IcProps) => base(p.size ?? 18, <><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>, p.className, p.style);
export const IcFolderPlus = (p: IcProps) => base(p.size ?? 18, <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v6M9 14h6" /></>, p.className, p.style);
export const IcLayers = (p: IcProps) => base(p.size ?? 18, <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>, p.className, p.style);
export const IcList = (p: IcProps) => base(p.size ?? 18, <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>, p.className, p.style);
export const IcExpand = (p: IcProps) => base(p.size ?? 18, <><path d="m7 15 5-5 5 5" /></>, p.className, p.style);
export const IcCollapse = (p: IcProps) => base(p.size ?? 18, <><path d="m7 9 5 5 5-5" /></>, p.className, p.style);
export const IcLockOpen = (p: IcProps) => base(p.size ?? 18, <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.9-.9" /></>, p.className, p.style);
