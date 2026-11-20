'use client';

/* Set de iconos SVG inline (stroke currentColor) para Orbit Next. */

interface IcProps { size?: number; className?: string }

function base(size: number, children: React.ReactNode, className?: string) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IcChat = (p: IcProps) => base(p.size ?? 18, <><path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12Z" /><path d="M9 11h.01M12.5 11h.01M16 11h.01" /></>, p.className);
export const IcRepo = (p: IcProps) => base(p.size ?? 18, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></>, p.className);
export const IcPR = (p: IcProps) => base(p.size ?? 18, <><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M6 8.6v6.8M13 4h2a2 2 0 0 1 2 2v9.4M13 4 15 2m-2 2 2 2" /></>, p.className);
export const IcIssue = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /></>, p.className);
export const IcUpload = (p: IcProps) => base(p.size ?? 18, <><path d="M12 16V4m0 0 4 4m-4-4L8 8" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>, p.className);
export const IcSettings = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>, p.className);
export const IcSearch = (p: IcProps) => base(p.size ?? 18, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, p.className);
export const IcSend = (p: IcProps) => base(p.size ?? 18, <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></>, p.className);
export const IcShield = (p: IcProps) => base(p.size ?? 18, <><path d="M12 2 4 5.5v5.7c0 4.9 3.4 8.6 8 10.3 4.6-1.7 8-5.4 8-10.3V5.5Z" /><path d="m9 11.5 2 2 4-4.5" /></>, p.className);
export const IcKey = (p: IcProps) => base(p.size ?? 18, <><circle cx="8" cy="15" r="4.5" /><path d="m11 12 8-8m-2 2 2.5 2.5M15 7l2.5 2.5" /></>, p.className);
export const IcSun = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>, p.className);
export const IcMoon = (p: IcProps) => base(p.size ?? 18, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />, p.className);
export const IcTrash = (p: IcProps) => base(p.size ?? 18, <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>, p.className);
export const IcPlus = (p: IcProps) => base(p.size ?? 18, <path d="M12 5v14M5 12h14" />, p.className);
export const IcBranch = (p: IcProps) => base(p.size ?? 18, <><circle cx="6" cy="5" r="2.5" /><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 7.5v9M18 11.5a7 7 0 0 1-7 5H9.5" /></>, p.className);
export const IcZap = (p: IcProps) => base(p.size ?? 18, <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />, p.className);
export const IcDownload = (p: IcProps) => base(p.size ?? 18, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>, p.className);
export const IcRefresh = (p: IcProps) => base(p.size ?? 18, <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>, p.className);
export const IcX = (p: IcProps) => base(p.size ?? 18, <path d="M18 6 6 18M6 6l12 12" />, p.className);
export const IcCheck = (p: IcProps) => base(p.size ?? 18, <path d="m4 12.5 5 5L20 6.5" />, p.className);
export const IcWarn = (p: IcProps) => base(p.size ?? 18, <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4m0 3h.01" /></>, p.className);
export const IcUser = (p: IcProps) => base(p.size ?? 18, <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></>, p.className);
export const IcFolder = (p: IcProps) => base(p.size ?? 18, <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />, p.className);
export const IcFile = (p: IcProps) => base(p.size ?? 18, <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>, p.className);
export const IcCloud = (p: IcProps) => base(p.size ?? 18, <path d="M17.5 19a4.5 4.5 0 1 0-.9-8.9A6 6 0 1 0 5.7 17.7" />, p.className);
export const IcExternal = (p: IcProps) => base(p.size ?? 18, <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></>, p.className);
export const IcLock = (p: IcProps) => base(p.size ?? 18, <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, p.className);
export const IcMenu = (p: IcProps) => base(p.size ?? 18, <path d="M4 7h16M4 12h16M4 17h16" />, p.className);
