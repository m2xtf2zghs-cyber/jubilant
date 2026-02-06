import React from "react";

export const BRAND = {
  name: "Jubilant Capital",
  product: "LIRAS v4.06",
  tz: "Asia/Kolkata",
};

export const BrandMark = ({ size = 42, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <defs>
      <linearGradient id="jcGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6e7b0" />
        <stop offset="0.35" stopColor="#e7c86f" />
        <stop offset="0.7" stopColor="#caa24a" />
        <stop offset="1" stopColor="#f3e2a5" />
      </linearGradient>
      <filter id="jcShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000000" floodOpacity="0.35" />
      </filter>
    </defs>

    {/* Monogram (approximation of JC mark) */}
    <g filter="url(#jcShadow)">
      {/* J */}
      <path
        d="M176 134H260"
        stroke="url(#jcGold)"
        strokeWidth="64"
        strokeLinecap="round"
      />
      <path
        d="M260 134V290c0 66-42 108-106 108-40 0-72-16-92-44"
        stroke="url(#jcGold)"
        strokeWidth="64"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* C */}
      <path
        d="M396 182c-22-32-56-52-96-52-70 0-124 56-124 126s54 126 124 126c40 0 74-20 96-52"
        stroke="url(#jcGold)"
        strokeWidth="64"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  </svg>
);

export const ReportBrandHeader = ({ title, subtitle, metaRight = null }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
    <div className="flex items-center gap-4 min-w-0">
      <div className="shrink-0">
        <BrandMark size={52} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold tracking-[0.24em] uppercase text-slate-500">{BRAND.name}</div>
        <div className="text-2xl font-extrabold text-slate-900 truncate">{title}</div>
        {subtitle && <div className="text-sm text-slate-600 mt-1">{subtitle}</div>}
      </div>
    </div>
    {metaRight && <div className="text-right text-xs text-slate-600 font-bold">{metaRight}</div>}
  </div>
);

