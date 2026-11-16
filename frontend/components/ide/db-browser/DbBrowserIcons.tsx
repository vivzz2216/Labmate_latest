"use client";

import React, { useId } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function useSvgUid(prefix: string): string {
  const raw = useId();
  return prefix + "_" + raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function Db4sAppIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("db4s_app");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={uid + "_cyl"} x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9EC3E6" />
          <stop offset="45%" stopColor="#5B8AC0" />
          <stop offset="100%" stopColor="#355A87" />
        </linearGradient>
      </defs>
      <path d="M3 3.5C3 2.1 5.2 1 8 1C10.8 1 13 2.1 13 3.5V12.5C13 13.9 10.8 15 8 15C5.2 15 3 13.9 3 12.5V3.5Z" fill={"url(#" + uid + "_cyl)"} stroke="#2E4C70" strokeWidth="1" />
      <ellipse cx="8" cy="3.5" rx="5" ry="2" fill="#C4DDF4" stroke="#2E4C70" strokeWidth="0.9" />
      <path d="M3 6.5C3 7.7 5.2 8.7 8 8.7C10.8 8.7 13 7.7 13 6.5" stroke="#2E4C70" strokeWidth="0.9" fill="none" />
      <path d="M3 9.5C3 10.7 5.2 11.7 8 11.7C10.8 11.7 13 10.7 13 9.5" stroke="#2E4C70" strokeWidth="0.9" fill="none" />
      <path d="M5 4.8V13" stroke="#E5F1FC" strokeWidth="1" strokeOpacity="0.65" />
    </svg>
  );
}

/* Official sqlitebrowser database_add.svg */
export function NewDatabaseIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("db_add");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopOpacity=".28" />
        <stop offset="1" stopOpacity=".46" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".5" stopColor="#fff" />
        <stop offset="1" stopColor="#dedede" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#eaeaea" />
        <stop offset=".25" stopColor="#d9d9d9" />
        <stop offset=".5" stopColor="#e3e3e3" />
        <stop offset=".75" stopColor="#bfbfbf" />
        <stop offset="1" stopColor="#bfbfbf" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6e9458" />
        <stop offset="1" stopColor="#376b19" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b1d390" />
        <stop offset="1" stopColor="#8fbc67" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m6-5v10a10 10 0 0 1 -12 0v-10a10 10 0 0 1 12 0" fill={"url(#" + uid + "_a)"} />
        <path d="m5-4.25v8.5a8 8 0 0 1 -10 0v-8.5a8 8 0 0 1 10 0" fill={"url(#" + uid + "_b)"} />
        <path d="m4-3.25v7a7 7 0 0 1 -8 0v-7a7 7 0 0 0 8 0" fill={"url(#" + uid + "_c)"} />
        <path d="m4-3.25v1a7 7 0 0 1 -8 0v-1a7 7 0 0 0 8 0" opacity=".1" />
        <g transform="translate(4.5 4.5)">
          <circle fill={"url(#" + uid + "_d)"} r="3.5" />
          <circle fill={"url(#" + uid + "_e)"} r="2.5" />
          <path d="m-.5-.5v-1h1v1h1v1h-1v1h-1v-1h-1v-1z" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser database_go.svg */
export function OpenDatabaseIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("db_go");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopOpacity=".28" />
        <stop offset="1" stopOpacity=".46" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".5" stopColor="#fff" />
        <stop offset="1" stopColor="#dedede" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#eaeaea" />
        <stop offset=".25" stopColor="#d9d9d9" />
        <stop offset=".5" stopColor="#e3e3e3" />
        <stop offset=".75" stopColor="#bfbfbf" />
        <stop offset="1" stopColor="#bfbfbf" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6fa53d" />
        <stop offset="1" stopColor="#1e7b03" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b0ce96" />
        <stop offset="1" stopColor="#96c180" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m6-5v10a10 10 0 0 1 -12 0v-10a10 10 0 0 1 12 0" fill={"url(#" + uid + "_a)"} />
        <path d="m5-4.25v8.5a8 8 0 0 1 -10 0v-8.5a8 8 0 0 1 10 0" fill={"url(#" + uid + "_b)"} />
        <path d="m4-3.25v7a7 7 0 0 1 -8 0v-7a7 7 0 0 0 8 0" fill={"url(#" + uid + "_c)"} />
        <path d="m4-3.25v1a7 7 0 0 1 -8 0v-1a7 7 0 0 0 8 0" opacity=".1" />
        <g transform="translate(3 3)">
          <path d="m-1-2v-2h1l4.5 4.5-4.5 4.5h-1v-2h-4v-5z" fill={"url(#" + uid + "_d)"} />
          <path d="m0-1v-1.5l3 3-3 3v-1.5h-4v-3z" fill={"url(#" + uid + "_e)"} />
          <path d="m.5 0v-.5l1 1-1 1v-.5h-3.5v-1z" fill="#8eba6f" />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser database_save.svg */
export function WriteChangesIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("db_save");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopOpacity=".28" />
        <stop offset="1" stopOpacity=".46" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".5" stopColor="#fff" />
        <stop offset="1" stopColor="#dedede" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#eaeaea" />
        <stop offset=".25" stopColor="#d9d9d9" />
        <stop offset=".5" stopColor="#e3e3e3" />
        <stop offset=".75" stopColor="#bfbfbf" />
        <stop offset="1" stopColor="#bfbfbf" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6e97d4" />
        <stop offset="1" stopColor="#5884c3" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b0cdf3" />
        <stop offset="1" stopColor="#85a2dd" />
      </linearGradient>
      <linearGradient id={uid + "_f"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#a8d782" />
        <stop offset="1" stopColor="#d7f4a2" />
      </linearGradient>
      <g transform="translate(6 7)">
        <path d="m6-5v10a10 10 0 0 1 -12 0v-10a10 10 0 0 1 12 0" fill={"url(#" + uid + "_a)"} />
        <path d="m5-4.25v8.5a8 8 0 0 1 -10 0v-8.5a8 8 0 0 1 10 0" fill={"url(#" + uid + "_b)"} />
        <path d="m4-3.25v7a7 7 0 0 1 -8 0v-7a7 7 0 0 0 8 0" fill={"url(#" + uid + "_c)"} />
        <path d="m4-3.25v1a7 7 0 0 1 -8 0v-1a7 7 0 0 0 8 0" opacity=".1" />
        <g transform="translate(6 4)">
          <path d="m0-5h-5a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7l-2-2z" fill={"url(#" + uid + "_d)"} />
          <path d="m-5-4h8v8h-8z" fill={"url(#" + uid + "_e)"} />
          <path d="m-4-4h6v3h-6z" fill="#fff" />
          <path d="m-3-4h1v2h-1z" fill={"url(#" + uid + "_e)"} />
          <path d="m-4 1h6v3h-6z" fill="#fff" />
          <path id={uid + "_g"} d="m-3 2h2v2h-2z" fill={"url(#" + uid + "_f)"} />
          <use transform="matrix(-1 0 0 -1 -2 6)" href={"#" + uid + "_g"} />
          <path d="m-6-3h10v6h-10z" opacity=".05" />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser database_refresh.svg */
export function RevertChangesIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("db_ref");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopOpacity=".28" />
        <stop offset="1" stopOpacity=".46" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".5" stopColor="#fff" />
        <stop offset="1" stopColor="#dedede" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#eaeaea" />
        <stop offset=".25" stopColor="#d9d9d9" />
        <stop offset=".5" stopColor="#e3e3e3" />
        <stop offset=".75" stopColor="#bfbfbf" />
        <stop offset="1" stopColor="#bfbfbf" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#7ccb72" />
        <stop offset="1" stopColor="#22601e" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a7d69e" />
        <stop offset="1" stopColor="#78bd72" />
      </linearGradient>
      <g transform="translate(6 8)">
        <path d="m6-5v10a10 10 0 0 1 -12 0v-10a10 10 0 0 1 12 0" fill={"url(#" + uid + "_a)"} />
        <path d="m5-4.25v8.5a8 8 0 0 1 -10 0v-8.5a8 8 0 0 1 10 0" fill={"url(#" + uid + "_b)"} />
        <path d="m4-3.25v7a7 7 0 0 1 -8 0v-7a7 7 0 0 0 8 0" fill={"url(#" + uid + "_c)"} />
        <path d="m4-3.25v1a7 7 0 0 1 -8 0v-1a7 7 0 0 0 8 0" opacity=".1" />
        <g transform="translate(6 1)">
          <path d="m-6 0a4 4 0 0 1 4-4h2v-2l3.5 3.5-3.5 3.5v-2h-2a1 1 0 0 0 -1 1h-4m7 1h4a4 4 0 0 1 -4 4h-2v2l-3.5-3.5 3.5-3.5v2h2a1 1 0 0 0 1-1z" fill={"url(#" + uid + "_d)"} />
          <path d="m-5-1a3 3 0 0 1 3-2h2.5v-1.5l2 2-2 2v-1.5h-2.5a1.5 1.5 0 0 0 -1.5 1h-2m6.5 3h2a3 3 0 0 1 -3 2h-2.5v1.5l-2-2 2-2v1.5h2.5a1.5 1.5 0 0 0 1.5-1h2z" fill={"url(#" + uid + "_e)"} />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser package_go.svg */
export function OpenProjectIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("pkg_go");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#d9b74f" />
        <stop offset="1" stopColor="#c88e2c" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#d7b04a" />
        <stop offset="1" stopColor="#c58726" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fef8e1" />
        <stop offset="1" stopColor="#e8e8e8" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#f7e4b2" />
        <stop offset="1" stopColor="#ecc483" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset=".2" stopColor="#fff3d4" />
        <stop offset="1" stopColor="#fee094" />
      </linearGradient>
      <linearGradient id={uid + "_f"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset=".2" stopColor="#efc748" />
        <stop offset="1" stopColor="#de9f32" />
      </linearGradient>
      <linearGradient id={uid + "_g"} x1="0%" x2="100%" y1="100%" y2="0%">
        <stop offset="0" stopColor="#f7d589" />
        <stop offset="1" stopColor="#f5cf7f" />
      </linearGradient>
      <linearGradient id={uid + "_h"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fef8e1" />
        <stop offset="1" stopColor="#fef8e1" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={uid + "_i"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fef8e1" stopOpacity="0" />
        <stop offset="1" stopColor="#fef8e1" />
      </linearGradient>
      <linearGradient id={uid + "_j"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6fa53d" />
        <stop offset="1" stopColor="#1e7b03" />
      </linearGradient>
      <linearGradient id={uid + "_k"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b0ce96" />
        <stop offset="1" stopColor="#96c180" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m0-8-8 4v8l8 4z" fill={"url(#" + uid + "_a)"} />
        <path d="m0-8 8 4v8l-8 4z" fill={"url(#" + uid + "_b)"} />
        <path d="m0-7-7 3.5v7l7 3.5z" fill={"url(#" + uid + "_c)"} />
        <path d="m0-7 7 3.5v7l-7 3.5z" fill={"url(#" + uid + "_d)"} />
        <path d="m-6-2.5v5.5l6 3v-5.5" fill={"url(#" + uid + "_e)"} />
        <path d="m6-2.5v5.5l-6 3v-5.5" fill={"url(#" + uid + "_f)"} />
        <path d="m-6-3 6 3 6-3-6-3z" fill={"url(#" + uid + "_g)"} />
        <path d="m0 0v-3.5h6.5" fill={"url(#" + uid + "_h)"} />
        <path d="m-6-3 6-1v-2" fill={"url(#" + uid + "_i)"} />
        <path d="m-6-3h5l1 3v-4-2l1 2.5h-1v-.5" fill="#765219" opacity=".5" />
        <g transform="translate(3 3)">
          <path d="m-1-2v-2h1l4.5 4.5-4.5 4.5h-1v-2h-4v-5z" fill={"url(#" + uid + "_j)"} />
          <path d="m0-1v-1.5l3 3-3 3v-1.5h-4v-3z" fill={"url(#" + uid + "_k)"} />
          <path d="m.5 0v-.5l1 1-1 1v-.5h-3.5v-1z" fill="#8eba6f" />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser package_save.svg */
export function SaveProjectIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("pkg_save");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={uid + "_backing_disk"} x1="-6" y1="-5" x2="-6" y2="5">
          <stop offset="0%" stopColor="#6e97d4" />
          <stop offset="100%" stopColor="#5884c3" />
        </linearGradient>
        <linearGradient id={uid + "_center_disk"} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b0cdf3" />
          <stop offset="100%" stopColor="#85a2dd" />
        </linearGradient>
        <linearGradient id={uid + "_label_disk"} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a8d782" />
          <stop offset="100%" stopColor="#d7f4a2" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" y2="4" x2="3" y1="-4" x1="-5" id={uid + "_lg1196"} href={"#" + uid + "_center_disk"} />
        <linearGradient gradientUnits="userSpaceOnUse" gradientTransform="scale(0.70710678,1.4142136)" y2="-1.4142136" x2="-2.8284271" y1="-2.8284271" x1="-4.2426407" id={uid + "_lg1198"} href={"#" + uid + "_center_disk"} />
        <linearGradient y2="2" x2="-1" y1="2" x1="-3" gradientUnits="userSpaceOnUse" id={uid + "_lg1220"} href={"#" + uid + "_label_disk"} />
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_bright"}>
          <stop stopColor="#d9b74f" offset="0%" />
          <stop stopColor="#c88e2c" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_bleft"}>
          <stop stopColor="#d7b04a" offset="0%" />
          <stop stopColor="#c58726" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_iright"}>
          <stop stopColor="#fef8e1" offset="0%" />
          <stop stopColor="#e8e8e8" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_ileft"}>
          <stop stopColor="#f7e4b2" offset="0%" />
          <stop stopColor="#ecc483" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_cright"}>
          <stop stopColor="#fff3d4" offset="20%" />
          <stop stopColor="#fee094" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_cleft"}>
          <stop stopColor="#efc748" offset="20%" />
          <stop stopColor="#de9f32" offset="100%" />
        </linearGradient>
        <linearGradient y2="0%" x2="100%" y1="100%" x1="0%" id={uid + "_top"}>
          <stop stopColor="#f7d589" offset="0%" />
          <stop stopColor="#f5cf7f" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_lflap"}>
          <stop stopOpacity="1" stopColor="#fef8e1" offset="0%" />
          <stop stopOpacity="0" stopColor="#fef8e1" offset="100%" />
        </linearGradient>
        <linearGradient y2="100%" x2="100%" y1="0%" x1="0%" id={uid + "_uflap"}>
          <stop stopOpacity="0" stopColor="#fef8e1" offset="0%" />
          <stop stopOpacity="1" stopColor="#fef8e1" offset="100%" />
        </linearGradient>
      </defs>
      <g transform="translate(8,8)">
        <path d="M0,-8 l-8,4 v8 l8,4 z" fill={"url(#" + uid + "_bright)"} />
        <path d="M0,-8 l8,4 v8 l-8,4 z" fill={"url(#" + uid + "_bleft)"} />
        <path d="M0,-7 l-7,3.5 v7 l7,3.5 z" fill={"url(#" + uid + "_iright)"} />
        <path d="M0,-7 l7,3.5 v7 l-7,3.5 z" fill={"url(#" + uid + "_ileft)"} />
        <path d="M-6,-2.5 v5.5 l6,3 v-5.5" fill={"url(#" + uid + "_cright)"} />
        <path d="M6,-2.5 v5.5 l-6,3 v-5.5" fill={"url(#" + uid + "_cleft)"} />
        <path d="M-6,-3 l6,3 l6,-3 l-6,-3 l-6,3" fill={"url(#" + uid + "_top)"} />
        <path d="M0,0 v-3.5 h6.5" fill={"url(#" + uid + "_lflap)"} />
        <path d="M-6,-3 l6,-1 v-2" fill={"url(#" + uid + "_uflap)"} />
        <path d="M-6,-3 h5 l1,3 v-4 v-2 l1,2.5 h-1 v-0.5" opacity="0.5" fill="#765219" />
      </g>
      <g transform="translate(9,8)">
        <g transform="translate(3,3)">
          <path fill={"url(#" + uid + "_backing_disk)"} d="m 0,-5 h -5 a 1,1 0 0 0 -1,1 v 8 a 1,1 0 0 0 1,1 H 3 A 1,1 0 0 0 4,4 V -3 L 2,-5 Z" />
          <rect fill={"url(#" + uid + "_lg1196)"} x="-5" y="-4" width="8" height="8" />
          <rect fill="#ffffff" x="-4" y="-4" width="6" height="3" />
          <rect fill={"url(#" + uid + "_lg1198)"} x="-3" y="-4" width="1" height="2" />
          <rect fill="#ffffff" x="-4" y="1" width="6" height="3" />
          <rect fill={"url(#" + uid + "_lg1220)"} id={uid + "_label_part"} x="-3" y="2" width="2" height="2" />
          <use height="100%" width="100%" y="0" x="0" href={"#" + uid + "_label_part"} transform="rotate(180,-1,3)" />
          <rect opacity="0.05" fill="#000000" x="-6" y="-3" width="10" height="6" />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser database_link.svg */
export function AttachDatabaseIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("db_link");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopOpacity=".28" />
        <stop offset="1" stopOpacity=".46" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".5" stopColor="#fff" />
        <stop offset="1" stopColor="#dedede" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#eaeaea" />
        <stop offset=".25" stopColor="#d9d9d9" />
        <stop offset=".5" stopColor="#e3e3e3" />
        <stop offset=".75" stopColor="#bfbfbf" />
        <stop offset="1" stopColor="#bfbfbf" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#858585" />
        <stop offset="1" stopColor="#4a4a4a" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#ddd" />
        <stop offset="1" stopColor="#aeaeae" />
      </linearGradient>
      <radialGradient id={uid + "_f"} cx="50%" cy="0%" r="70%">
        <stop offset="0" stopColor="#929292" />
        <stop offset="1" stopColor="#414141" />
      </radialGradient>
      <radialGradient id={uid + "_g"} cx="50%" cy="50%" r="70%">
        <stop offset="0" stopColor="#cecece" />
        <stop offset="1" stopColor="#bdbdbd" />
      </radialGradient>
      <g transform="translate(7 8)">
        <path d="m6-5v10a10 10 0 0 1 -12 0v-10a10 10 0 0 1 12 0" fill={"url(#" + uid + "_a)"} />
        <path d="m5-4.25v8.5a8 8 0 0 1 -10 0v-8.5a8 8 0 0 1 10 0" fill={"url(#" + uid + "_b)"} />
        <path d="m4-3.25v7a7 7 0 0 1 -8 0v-7a7 7 0 0 0 8 0" fill={"url(#" + uid + "_c)"} />
        <path d="m4-3.25v1a7 7 0 0 1 -8 0v-1a7 7 0 0 0 8 0" opacity=".1" />
        <g transform="translate(2.5 4)">
          <g id={uid + "_h"}>
            <path d="m-1.5-3h-1.5a3.5 3.5 0 0 0 0 7h1.5a1.5 1.5 0 0 0 0-3h-2a.5.5 0 0 1 0-1h2a1.5 1.5 0 0 0 0-3z" fill={"url(#" + uid + "_d)"} />
            <path d="m-1.5-2h-1.5a2.5 2.5 0 0 0 0 5h1.5a.5.5 0 0 0 0-1h-1.5a1.5 1.5 0 0 1 0-3h1.5a.5.5 0 0 0 0-1z" fill={"url(#" + uid + "_e)"} />
          </g>
          <use transform="matrix(-1 0 0 -1 0 1)" href={"#" + uid + "_h"} />
          <path d="m-3.25-1h6v3h-6z" fill={"url(#" + uid + "_f)"} />
          <path d="m-2.25 0h4v1h-4z" fill={"url(#" + uid + "_g)"} />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser folder_page.svg (Open SQL / Import) */
export function OpenSqlIcon({ size = 16, className }: IconProps) {
  return <CellImportIcon size={size} className={className} />;
}

/* Official sqlitebrowser page_save.svg (Save SQL / Export) */
export function SaveSqlIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("page_save");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a0bedc" />
        <stop offset=".1" stopColor="#b3d2f1" />
        <stop offset=".5" stopColor="#d5e5fe" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="100%" y2="0%">
        <stop offset="0" stopColor="#cde6fc" />
        <stop offset="1" stopColor="#7db2e2" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#4f8cc8" />
        <stop offset="1" stopColor="#2e62b7" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="100%" y2="0%">
        <stop offset="0" stopColor="#68bffd" />
        <stop offset="1" stopColor="#4fb2f7" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="100%" y2="0%">
        <stop offset="0" stopColor="#a0d8ff" />
        <stop offset="1" stopColor="#93d4ff" />
      </linearGradient>
      <linearGradient id={uid + "_f"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#eaf1f8" />
      </linearGradient>
      <linearGradient id={uid + "_g"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6e97d4" />
        <stop offset="1" stopColor="#5884c3" />
      </linearGradient>
      <linearGradient id={uid + "_h"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b0cdf3" />
        <stop offset="1" stopColor="#85a2dd" />
      </linearGradient>
      <linearGradient id={uid + "_i"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#a8d782" />
        <stop offset="1" stopColor="#d7f4a2" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m0-8h-6a1 1 0 0 0 -1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-11.5l-3.5-3.5h-4.5z" fill={"url(#" + uid + "_c)"} />
        <path d="m0-7h-6v14h12v-11l-3-3z" fill={"url(#" + uid + "_f)"} />
        <path d="m0-6h-5v9h10v-7l-2-2h-2z" fill={"url(#" + uid + "_a)"} />
        <path d="m2-7h1l3 3v1h-4z" fill="#fff" />
        <path d="m3-7h.1l3 3h-3.1z" fill={"url(#" + uid + "_b)"} />
        <path d="m-5 3h10v3h-10z" fill={"url(#" + uid + "_d)"} />
        <path d="m-4 4h8v1h-8z" fill={"url(#" + uid + "_e)"} />
        <g transform="translate(3 3)">
          <path d="m0-5h-5a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7l-2-2z" fill={"url(#" + uid + "_g)"} />
          <path d="m-5-4h8v8h-8z" fill={"url(#" + uid + "_h)"} />
          <path d="m-4-4h6v3h-6z" fill="#fff" />
          <path d="m-3-4h1v2h-1z" fill={"url(#" + uid + "_h)"} />
          <path d="m-4 1h6v3h-6z" fill="#fff" />
          <path id={uid + "_j"} d="m-3 2h2v2h-2z" fill={"url(#" + uid + "_i)"} />
          <use transform="matrix(-1 0 0 -1 -2 6)" href={"#" + uid + "_j"} />
          <path d="m-6-3h10v6h-10z" opacity=".05" />
        </g>
      </g>
    </svg>
  );
}

export function SaveSqlAsIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("page_save_as");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_d"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6e97d4" />
        <stop offset="1" stopColor="#5884c3" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b0cdf3" />
        <stop offset="1" stopColor="#85a2dd" />
      </linearGradient>
      <linearGradient id={uid + "_f"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#a8d782" />
        <stop offset="1" stopColor="#d7f4a2" />
      </linearGradient>
      <g transform="translate(7 7)">
        <path d="m0-5h-5a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7l-2-2z" fill={"url(#" + uid + "_d)"} />
        <path d="m-5-4h8v8h-8z" fill={"url(#" + uid + "_e)"} />
        <path d="m-4-4h6v3h-6z" fill="#fff" />
        <path d="m-3-4h1v2h-1z" fill={"url(#" + uid + "_e)"} />
        <path d="m-4 1h6v3h-6z" fill="#fff" />
        <path id={uid + "_g"} d="m-3 2h2v2h-2z" fill={"url(#" + uid + "_f)"} />
        <use transform="matrix(-1 0 0 -1 -2 6)" href={"#" + uid + "_g"} />
        <circle cx="4.5" cy="4.5" r="3" fill="#fff" stroke="#4682c4" strokeWidth="1" />
        <path d="M3.2 4.5H5.8M4.5 3.2V5.8" stroke="#4682c4" strokeWidth="1" />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser printer.svg */
export function PrintIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("prn");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#457ec2" />
        <stop offset="1" stopColor="#6195c8" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#ecf1f9" />
        <stop offset="1" stopColor="#f6f7f9" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#457ec2" />
        <stop offset=".3" stopColor="#457ec2" />
        <stop offset="1" stopColor="#cde6fc" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b5d4f3" />
        <stop offset=".3" stopColor="#bbd6f5" />
        <stop offset="1" stopColor="#d8e8fe" />
      </linearGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#ecf1f9" />
        <stop offset="1" stopColor="#d8e8fe" />
      </linearGradient>
      <linearGradient id={uid + "_f"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#9a9a9a" />
        <stop offset="1" stopColor="#232323" />
      </linearGradient>
      <linearGradient id={uid + "_g"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#cbcbcb" />
        <stop offset=".25" stopColor="#fff" />
        <stop offset="1" stopColor="#d7d7d7" />
      </linearGradient>
      <linearGradient id={uid + "_h"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopOpacity=".05" />
        <stop offset=".2" stopOpacity=".1" />
        <stop offset="1" stopOpacity=".3" />
      </linearGradient>
      <linearGradient id={uid + "_i"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#7d7d7d" />
        <stop offset=".25" stopColor="#d8d8d8" />
        <stop offset="1" stopColor="#616161" />
      </linearGradient>
      <linearGradient id={uid + "_j"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#f2f2f2" />
        <stop offset="1" stopColor="#d7d7d7" />
      </linearGradient>
      <linearGradient id={uid + "_k"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#cbcbcb" />
        <stop offset="1" stopColor="#b9b9b9" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-8 0 2-3h12l2 3v6a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1-1z" fill={"url(#" + uid + "_f)"} />
        <path d="m-7 0 1.33-2h11.33l1.33 2v6h-14v-6" fill={"url(#" + uid + "_g)"} />
        <path d="m-4-8h6l3 3v12a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1-1v-14a1 1 0 0 1 1-1z" fill={"url(#" + uid + "_a)"} />
        <path d="m-4-7h6l2 2v12h-8z" fill={"url(#" + uid + "_b)"} />
        <path d="m2-7 2 2h-2z" fill={"url(#" + uid + "_c)"} />
        <path d="m-3-6h4v2h2v3h-6" fill={"url(#" + uid + "_d)"} />
        <path d="m-3 5h6v2h-6z" fill={"url(#" + uid + "_e)"} />
        <path d="m-5-1h10v6h-10z" fill={"url(#" + uid + "_i)"} />
        <path d="m-4 0h8v4h-8z" fill={"url(#" + uid + "_j)"} />
        <path d="m-3 1h6v3h-6z" fill={"url(#" + uid + "_k)"} />
        <path d="m-8 2h16v4h-16z" fill={"url(#" + uid + "_h)"} />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser resultset_next.svg */
export function ExecuteSqlIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("res_next");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#5a90db" />
        <stop offset="1" stopColor="#1233b4" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b4cef2" />
        <stop offset="1" stopColor="#699bdc" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#72a1df" />
        <stop offset="1" stopColor="#528fdb" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-3 6v-12h1l6 6-6 6z" fill={"url(#" + uid + "_a)"} />
        <path d="m-2 4.5v-9l4.5 4.5z" fill={"url(#" + uid + "_b)"} />
        <path d="m-1 2v-4l2 2 2-2z" fill={"url(#" + uid + "_c)"} />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser resultset_last.svg */
export function ExecuteCurrentLineIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("res_last");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#5a90db" />
        <stop offset="1" stopColor="#1233b4" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b4cef2" />
        <stop offset="1" stopColor="#699bdc" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#72a1df" />
        <stop offset="1" stopColor="#528fdb" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-5 6v-12h1l6 6-6 6z" fill={"url(#" + uid + "_a)"} />
        <path d="m-4 4.5v-9l4.5 4.5z" fill={"url(#" + uid + "_b)"} />
        <path d="m-3 2v-4l2 2 2-2z" fill={"url(#" + uid + "_c)"} />
        <path d="m1-6h4v12h-4z" fill={"url(#" + uid + "_a)"} />
        <path d="m2-5h2v10h-2z" fill={"url(#" + uid + "_b)"} />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser cancel.svg (red octagon + white cross) */
export function StopExecutionIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("cancel");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#eba39e" />
        <stop offset="1" stopColor="#d12e25" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fcd4c4" />
        <stop offset="1" stopColor="#f49486" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#ffaf8b" />
        <stop offset="1" stopColor="#fa4225" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-2.89949-7h5.79898l4.10051 4.10051v5.79898l-4.10051 4.10051h-5.79898l-4.10051-4.10051v-5.79898l4.10051-4.10051h5.79898z" fill={"url(#" + uid + "_a)"} />
        <path d="m-2.48528-6h4.97056l3.51472 3.51472v4.97056l-3.51472 3.51472h-4.97056l-3.51472-3.51472v-4.97056l3.51472-3.51472h4.97056z" fill={"url(#" + uid + "_b)"} />
        <path d="m-2.07107-5h4.14214l2.92893 2.92893v4.14214l-2.92893 2.92893h-4.14214l-2.92893-2.92893v-4.14214l2.92893-2.92893h4.14214z" fill={"url(#" + uid + "_c)"} />
        <path d="m1-1h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" fill="#fff" transform="matrix(.70710678 .70710678 -.70710678 .70710678 0 0)" />
      </g>
    </svg>
  );
}

export function ExportResultsIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="9" height="11" fill="#FFFFFF" stroke="#6B7E91" strokeWidth="1" />
      <rect x="2" y="2" width="9" height="2.8" fill="#5D8EC4" stroke="#456E9C" strokeWidth="0.8" />
      <path d="M5 4.8V13M8 4.8V13M2 7.5H11M2 10.2H11" stroke="#B6C6D6" strokeWidth="0.8" />
      <path d="M9.5 11.2H12.5V9.5L15.2 12.1L12.5 14.7V13H9.5V11.2Z" fill="#5294E2" stroke="#2D5F9A" strokeWidth="0.7" strokeLinejoin="round" />
    </svg>
  );
}

export function FindBinocularsIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M4 4.5L2.8 11.2C2.7 12 3.3 12.7 4.2 12.7H5.8C6.5 12.7 7.1 12.1 7.1 11.4V5.8H8.9V11.4C8.9 12.1 9.5 12.7 10.2 12.7H11.8C12.7 12.7 13.3 12 13.2 11.2L12 4.5H9.6V6.7H6.4V4.5H4Z" fill="#3B5B82" stroke="#1E3148" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="4.8" cy="11" r="1.3" fill="#9BC6F5" stroke="#1E3148" strokeWidth="0.8" />
      <circle cx="11.2" cy="11" r="1.3" fill="#9BC6F5" stroke="#1E3148" strokeWidth="0.8" />
      <rect x="4.1" y="2.9" width="2.1" height="1.6" fill="#4E6D92" stroke="#1E3148" strokeWidth="0.8" />
      <rect x="9.8" y="2.9" width="2.1" height="1.6" fill="#4E6D92" stroke="#1E3148" strokeWidth="0.8" />
    </svg>
  );
}

export function SqlTabHourglassIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="1.5" width="8" height="1.5" rx="0.4" fill="#B8844A" stroke="#7A5226" strokeWidth="0.7" />
      <rect x="3" y="11" width="8" height="1.5" rx="0.4" fill="#B8844A" stroke="#7A5226" strokeWidth="0.7" />
      <path d="M4 3C4 5.2 6.5 6.4 6.5 7C6.5 7.6 4 8.8 4 11H10C10 8.8 7.5 7.6 7.5 7C7.5 6.4 10 5.2 10 3H4Z" fill="#EFE4CC" stroke="#8C6B3F" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M5 10.6L7 8.8L9 10.6H5Z" fill="#D5A65A" />
    </svg>
  );
}

export function TabCloseSquareIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" rx="1.5" fill="#EB7144" stroke="#C84E24" strokeWidth="0.8" />
      <path d="M3.7 3.7L8.3 8.3M8.3 3.7L3.7 8.3" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M7 1.8H9L9.4 3.4C9.9 3.6 10.3 3.8 10.7 4.1L12.2 3.3L13.6 4.7L12.8 6.2C13.1 6.6 13.3 7 13.5 7.5L15.1 7.9V9.9L13.5 10.3C13.3 10.8 13.1 11.2 12.8 11.6L13.6 13.1L12.2 14.5L10.7 13.7C10.3 14 9.9 14.2 9.4 14.4L9 16H7L6.6 14.4C6.1 14.2 5.7 14 5.3 13.7L3.8 14.5L2.4 13.1L3.2 11.6C2.9 11.2 2.7 10.8 2.5 10.3L0.9 9.9V7.9L2.5 7.5C2.7 7 2.9 6.6 3.2 6.2L2.4 4.7L3.8 3.3L5.3 4.1C5.7 3.8 6.1 3.6 6.6 3.4L7 1.8Z" fill="#BDBDBD" stroke="#858585" strokeWidth="0.9" strokeLinejoin="round" />
      <circle cx="8" cy="8.9" r="2.3" fill="#F0F0F0" stroke="#858585" strokeWidth="0.9" />
    </svg>
  );
}

/* Official sqlitebrowser page_white_text.svg (Word Wrap) */
export function CellPlainTextIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("pwt");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#cacaca" />
        <stop offset=".1" stopColor="#e9e9e9" />
        <stop offset=".5" stopColor="#fff" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="100%" y2="0%">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#c1c1c1" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a5a5a5" />
        <stop offset="1" stopColor="#ddd" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m0-8h-6a1 1 0 0 0 -1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-11.5l-3.5-3.5h-4.5z" opacity=".21" />
        <path d="m0-7h-6v14h12v-11l-3-3z" fill="#fff" />
        <path d="m0-6h-5v12h10v-10l-2-2h-2z" fill={"url(#" + uid + "_a)"} />
        <path d="m2-7h1l3 3v1h-4z" fill="#fff" />
        <path d="m3-7h.1l3 3h-3.1z" fill={"url(#" + uid + "_b)"} />
        <path d="m-4-4h6v1h-6m0 1h8v1h-8m0 1h8v1h-8m0 1h8v1h-8m0 1h8v1h-8" fill={"url(#" + uid + "_c)"} />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser text_padding_left.svg (Autoformat) */
export function CellWordWrapIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("tpl");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#767676" />
        <stop offset="1" stopColor="#070707" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#bcbcbc" />
        <stop offset="1" stopColor="#b3b3b3" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#f0f0f0" />
        <stop offset="1" stopColor="#e6e6e6" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-2-5h9v1h-9m0 1h7v1h-7m0 1h9v1h-9m0 1h7v1h-7m0 1h9v1h-9m0 1h7v1h-7" fill={"url(#" + uid + "_a)"} />
        <path d="m-6-5h3v11h-3z" fill={"url(#" + uid + "_b)"} />
        <path d="m-5-4h1v9h-1z" fill={"url(#" + uid + "_c)"} />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser folder_page.svg (Import) */
export function CellImportIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("fp");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#d9b434" />
        <stop offset="1" stopColor="#d8862c" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#fbf2ca" />
      </linearGradient>
      <linearGradient id={uid + "_c"}>
        <stop offset="0" stopColor="#f8e48e" />
        <stop offset="1" stopColor="#e9c173" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" href={"#" + uid + "_c"} y1="0%" y2="100%" />
      <linearGradient id={uid + "_e"} x1="100%" x2="0%" href={"#" + uid + "_c"} y1="0%" y2="0%" />
      <linearGradient id={uid + "_f"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fcf2c8" />
        <stop offset="1" stopColor="#f0cb26" />
      </linearGradient>
      <linearGradient id={uid + "_g"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#9dc3ea" />
        <stop offset="1" stopColor="#2e62b7" />
      </linearGradient>
      <linearGradient id={uid + "_h"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#eaf1f8" />
      </linearGradient>
      <linearGradient id={uid + "_i"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a0bedc" />
        <stop offset=".1" stopColor="#b3d2f1" />
        <stop offset=".5" stopColor="#d5e5fe" />
      </linearGradient>
      <linearGradient id={uid + "_j"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#999" />
      </linearGradient>
      <mask id={uid + "_k"}>
        <path d="m-6-1h12v6h-12z" fill={"url(#" + uid + "_j)"} />
      </mask>
      <g transform="translate(7 10)">
        <path d="m0-4h6a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1-1v-9.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5.5.5 0 0 0 .5.5z" fill={"url(#" + uid + "_a)"} />
        <path d="m0-3h6v8h-12v-9h6z" fill={"url(#" + uid + "_b)"} />
        <path d="m-2-2h7v1h-7z" fill={"url(#" + uid + "_e)"} />
        <path d="m-5-3h4v2l-1 1h-3z" fill={"url(#" + uid + "_d)"} />
        <path d="m0 0h5v5h-10v-4h4z" fill={"url(#" + uid + "_f)"} />
        <g transform="translate(2 -2)">
          <path d="m0-8h-2a1 1 0 0 0 -1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-8.5l-2.5-2.5z" fill={"url(#" + uid + "_g)"} />
          <path d="m0-7h-2v10h8v-8l-2-2h-3z" fill={"url(#" + uid + "_h)"} />
          <path d="m0-6h-1v8h6v-6.5l-1.5-1.5h-2z" fill={"url(#" + uid + "_i)"} />
          <path d="m3-7h1l2 2v1h-3z" fill="#fff" />
        </g>
        <path d="m-7-4v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6a1 1 0 0 0 -1-1h-7l-1 1h-4v1h4.5l1-1h6.5v6h-12v-9" fill={"url(#" + uid + "_a)"} />
        <g mask={"url(#" + uid + "_k)"}>
          <path d="m0-1h6v6h-12v-5h4.5l1-1z" fill={"url(#" + uid + "_b)"} />
          <path d="m0 0h5v5h-10v-4h4z" fill={"url(#" + uid + "_f)"} />
        </g>
        <path d="m-6 4h12v1h-12z" opacity=".05" />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser page_save.svg (Export) */
export function CellExportIcon({ size = 16, className }: IconProps) {
  return <SaveSqlIcon size={size} className={className} />;
}

/* Official sqlitebrowser application_go.svg */
export function CellExternalIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("app_go");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#85acdd" />
        <stop offset="1" stopColor="#5171a9" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#dee7f2" />
        <stop offset="1" stopColor="#fff" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#6fa53d" />
        <stop offset="1" stopColor="#1e7b03" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#b0ce96" />
        <stop offset="1" stopColor="#96c180" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m0-7h5a2 2 0 0 1 2 2v10a1 1 0 0 1 -1 1h-13a1 1 0 0 1 -1-1v-10a2 2 0 0 1 2-2z" fill={"url(#" + uid + "_a)"} />
        <path d="m-7-4h13v9h-13z" fill="#fff" />
        <path d="m-6-3h11v7h-11z" fill={"url(#" + uid + "_b)"} />
        <path d="m0-6h5a1 1 0 0 1 1 1h-13a1 1 0 0 1 1-1h4z" fill="#92b9e8" />
        <g transform="translate(3 3)">
          <path d="m-1-2v-2h1l4.5 4.5-4.5 4.5h-1v-2h-4v-5z" fill={"url(#" + uid + "_c)"} />
          <path d="m0-1v-1.5l3 3-3 3v-1.5h-4v-3z" fill={"url(#" + uid + "_d)"} />
          <path d="m.5 0v-.5l1 1-1 1v-.5h-3.5v-1z" fill="#8eba6f" />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser application_link.svg */
export function CellAppLinkIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("app_link");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#85acdd" />
        <stop offset="1" stopColor="#5171a9" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#dee7f2" />
        <stop offset="1" stopColor="#fff" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#858585" />
        <stop offset="1" stopColor="#4a4a4a" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#ddd" />
        <stop offset="1" stopColor="#aeaeae" />
      </linearGradient>
      <radialGradient id={uid + "_e"} cx="50%" cy="0%" r="70%">
        <stop offset="0" stopColor="#929292" />
        <stop offset="1" stopColor="#414141" />
      </radialGradient>
      <radialGradient id={uid + "_f"} cx="50%" cy="50%" r="70%">
        <stop offset="0" stopColor="#cecece" />
        <stop offset="1" stopColor="#bdbdbd" />
      </radialGradient>
      <g transform="translate(8 8)">
        <path d="m0-7h5a2 2 0 0 1 2 2v10a1 1 0 0 1 -1 1h-13a1 1 0 0 1 -1-1v-10a2 2 0 0 1 2-2z" fill={"url(#" + uid + "_a)"} />
        <path d="m-7-4h13v9h-13z" fill="#fff" />
        <path d="m-6-3h11v7h-11z" fill={"url(#" + uid + "_b)"} />
        <path d="m0-6h5a1 1 0 0 1 1 1h-13a1 1 0 0 1 1-1h4z" fill="#92b9e8" />
        <g transform="translate(1.5 4)">
          <g id={uid + "_g"}>
            <path d="m-1.5-3h-1.5a3.5 3.5 0 0 0 0 7h1.5a1.5 1.5 0 0 0 0-3h-2a.5.5 0 0 1 0-1h2a1.5 1.5 0 0 0 0-3z" fill={"url(#" + uid + "_c)"} />
            <path d="m-1.5-2h-1.5a2.5 2.5 0 0 0 0 5h1.5a.5.5 0 0 0 0-1h-1.5a1.5 1.5 0 0 1 0-3h1.5a.5.5 0 0 0 0-1z" fill={"url(#" + uid + "_d)"} />
          </g>
          <use transform="matrix(-1 0 0 -1 0 1)" href={"#" + uid + "_g"} />
          <path d="m-3.25-1h6v3h-6z" fill={"url(#" + uid + "_e)"} />
          <path d="m-2.25 0h4v1h-4z" fill={"url(#" + uid + "_f)"} />
        </g>
      </g>
    </svg>
  );
}

/* Official sqlitebrowser textfield_delete.svg (Set as NULL) */
export function CellNullIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("tf_del");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#c4581e" />
        <stop offset="1" stopColor="#b84503" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#fed6b8" />
        <stop offset="1" stopColor="#dd6401" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-8-4h16v8h-16z" fill="#c9c9c9" />
        <path d="m-7-3h15v7h-16v-1h1z" fill="#e8e8e8" />
        <path d="m-7-3h14v6h-14z" fill="#fff" />
        <path d="m-6-2h1v4h-1z" fill="#c9c9c9" />
        <g transform="translate(4.5 4.5)">
          <circle fill={"url(#" + uid + "_a)"} r="3.5" />
          <circle fill={"url(#" + uid + "_b)"} r="2.5" />
          <path d="m-1.5-.5h3v1h-3z" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

export function CellRevertIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10" fill="#FFFFFF" stroke="#5A7EA6" strokeWidth="1" />
      <path d="M11 8C11 6.3 9.7 5 8 5C6.8 5 5.8 5.7 5.3 6.7L3.8 5.8V9.2H7.2L6.1 8.1C6.4 7.3 7.1 6.7 8 6.7C9 6.7 9.8 7.3 9.8 8H11Z" fill="#5294E2" />
    </svg>
  );
}

/* Official sqlitebrowser table.svg (Tables group & table items) */
export function TablesGroupIcon({ size = 15, className }: IconProps) {
  const uid = useSvgUid("tbl_grp");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a3c2ef" />
        <stop offset="1" stopColor="#4277bb" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#f4f7fb" />
        <stop offset="1" stopColor="#d8e2f0" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a6c3e9" />
        <stop offset="1" stopColor="#b5cdea" />
      </linearGradient>
      <linearGradient id={uid + "_d"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#a5d59c" />
        <stop offset="1" stopColor="#7cbe76" />
      </linearGradient>
      <g transform="translate(8 8)">
        <rect fill={"url(#" + uid + "_a)"} height="14" rx="1" width="14" x="-7" y="-7" />
        <path d="m-6-6h12v12h-12z" fill={"url(#" + uid + "_b)"} />
        <path d="m-5-5h10v10h-10z" fill="#fff" />
        <path d="m-5-3h10v8h-10z" fill={"url(#" + uid + "_c)"} />
        <path d="m-4-2h1v1h-1m0 1h1v1h-1m0 1h1v1h-1m0 1h1v1h-1m2-7h3v1h-3m0 1h3v1h-3m0 1h3v1h-3m0 1h3v1h-3m4-7h3v1h-3m0 1h3v1h-3m0 1h3v1h-3m0 1h3v1h-3" fill="#fff" />
        <path d="m-5-5h10v1h-10z" fill={"url(#" + uid + "_d)"} />
      </g>
    </svg>
  );
}

export function TableItemIcon({ size = 14, className }: IconProps) {
  return <TablesGroupIcon size={size} className={className} />;
}

export function ColumnFieldIcon({ size = 14, isPrimaryKey, className }: IconProps & { isPrimaryKey?: boolean }) {
  if (isPrimaryKey) {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
        <circle cx="5" cy="6" r="2.7" fill="#F6C844" stroke="#9B7514" strokeWidth="1" />
        <circle cx="4.5" cy="5.5" r="0.8" fill="#FFF7D6" />
        <path d="M7.2 7.2L12.2 12.2M10.2 10.2L11.5 8.9M11.4 11.4L12.7 10.1" stroke="#9B7514" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="2" width="6" height="10" fill="#EDF3FA" stroke="#7197C0" strokeWidth="1" />
      <rect x="4" y="2" width="6" height="2.5" fill="#7CA8D6" />
      <path d="M4 7H10M4 9.5H10" stroke="#B7CCE2" strokeWidth="0.8" />
    </svg>
  );
}

/* Official sqlitebrowser tag_blue.svg (Indices) */
export function IndicesGroupIcon({ size = 15, className }: IconProps) {
  const uid = useSvgUid("tag_blue");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#d5d5d5" />
        <stop offset=".8" stopColor="#aaa" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#83ccff" />
        <stop offset="1" stopColor="#8dccf7" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#acddff" />
        <stop offset="1" stopColor="#9cd6ff" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-5-5h1v1h-1v-1l-3-3v7l9 9 7-7-9-9h-7z" fill={"url(#" + uid + "_a)"} />
        <path d="m-6-4.5a1.5 1.5 0 0 1 3 0 1.5 1.5 0 0 1 -3 0l-1-2.5v6l8 8 6-6-8-8h-6z" fill="#fff" />
        <path d="m-2.5-2.5 1.5-1.5 5.5 5.5-3 3-5.5-5.5" fill={"url(#" + uid + "_b)"} />
        <path d="m-2-2 1-1 4 4-2 2-4-4" fill={"url(#" + uid + "_c)"} />
      </g>
    </svg>
  );
}

export function IndexItemIcon({ size = 14, className }: IconProps) {
  return <IndicesGroupIcon size={size} className={className} />;
}

/* Official sqlitebrowser picture.svg (Views) */
export function ViewsGroupIcon({ size = 15, className }: IconProps) {
  const uid = useSvgUid("pic_view");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#9fb1cf" />
        <stop offset=".5" stopColor="#8ea6cd" />
        <stop offset="1" stopColor="#9cafce" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#799ed7" />
        <stop offset="1" stopColor="#a0bce7" />
      </linearGradient>
      <linearGradient id={uid + "_c"} x1="0%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#7aaa4e" />
        <stop offset="1" stopColor="#63963c" />
      </linearGradient>
      <radialGradient id={uid + "_d"} cx="60%" cy="60%" r="50%">
        <stop offset="0" stopColor="#7aba4f" />
        <stop offset=".2" stopColor="#7aba4f" />
        <stop offset=".5" stopColor="#87c158" />
        <stop offset="1" stopColor="#a1cb93" />
      </radialGradient>
      <linearGradient id={uid + "_e"} x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0" stopColor="#9a7b35" />
        <stop offset=".35" stopColor="#d39f54" />
        <stop offset=".65" stopColor="#d39f54" />
        <stop offset="1" stopColor="#af863f" />
      </linearGradient>
      <g transform="translate(8 8)">
        <rect fill={"url(#" + uid + "_a)"} height="14" rx="1" width="14" x="-7" y="-7" />
        <path d="m-6-6h12v12h-12z" fill="#fff" />
        <path d="m-5-5h10v10h-10z" fill={"url(#" + uid + "_b)"} />
        <path d="m-5 3h10v2h-10z" fill="#c2dcbf" />
        <path d="m-5 2h10v1h-10z" fill={"url(#" + uid + "_c)"} />
        <path d="m-2 0h4v3a3 3 0 0 1 -4 0" fill={"url(#" + uid + "_e)"} />
        <circle cy="-1.75" fill={"url(#" + uid + "_d)"} r="3.25" />
      </g>
    </svg>
  );
}

/* Official sqlitebrowser script.svg (Triggers) */
export function TriggersGroupIcon({ size = 15, className }: IconProps) {
  const uid = useSvgUid("scr_trig");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <linearGradient id={uid + "_a"} x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#5face2" />
        <stop offset=".5" stopColor="#598fd4" />
        <stop offset="1" stopColor="#335f94" />
      </linearGradient>
      <linearGradient id={uid + "_b"} x1="100%" x2="0%" y1="0%" y2="100%">
        <stop offset="0" stopColor="#dfedfd" />
        <stop offset="1" stopColor="#bddaf8" />
      </linearGradient>
      <g transform="translate(8 8)">
        <path d="m-3-8c9 0 11 0 11 3a2 2 0 0 1 -2 2c0 9-1 11-3 11-9 0-11 0-11-3a2 2 0 0 1 2-2c0-9 0-11 3-11" fill={"url(#" + uid + "_a)"} />
        <path d="m-4-7c9 0 11 0 11 2a1 1 0 0 1 -1 1c0-1.5 0-1.5-1-1.5 0 10.5-1 12.5-2 12.5-8 0-10 0-10-2h9.25v.25a.5.5 0 0 0 1 0v-1.25l-8-.25c0-9 0-11 2-11" fill="#fff" />
        <path d="m-3-6c7 0 7 0 7 2 0 8-1 8-1 8.25l-7-.25c0-10 0-10 2-10" fill={"url(#" + uid + "_b)"} />
      </g>
    </svg>
  );
}
