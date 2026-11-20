"use client";

import React, { useId } from "react";

export interface StudioIconProps {
  size?: number;
  color?: string;
  className?: string;
}

/* =========================================================================
 * A. Brand / App Icons & Green Android Head (#3DDC84)
 * ========================================================================= */

/** Official `studio/icons/common/android-head_dark.svg` (16x16) */
export function AndroidHeadIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.38 4.433a.5.5 0 11.866.5l-1.122 1.943a5.999 5.999 0 012.855 4.624.47.47 0 01-.479.5.541.541 0 01-.525-.5 5 5 0 00-9.95 0 .541.541 0 01-.525.5.47.47 0 01-.48-.5 5.999 5.999 0 012.853-4.622L3.75 4.933a.5.5 0 01.866-.5l1.152 1.996A5.984 5.984 0 018 6c.787 0 1.54.152 2.229.427l1.151-1.994z"
        fill="#3DDC84"
      />
      <path d="M2.5 11.5h11" stroke="#3DDC84" />
      <rect x="5" y="9" width="1" height="1" rx=".5" fill="#3DDC84" />
      <rect x="10" y="9" width="1" height="1" rx=".5" fill="#3DDC84" />
    </svg>
  );
}

/** Official multi-color `androidstudio-original.svg` (128x128) */
export function AndroidStudioLogoIcon({ size = 20, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className} aria-hidden="true">
      <path fill="#073042" d="M51.3 17.7H23.2C17.6 17.7 13 22.3 13 28c-.2 5.5 4.2 10.1 9.7 10.3h28.9l-.3-20.6z" />
      <path fill="#4285F4" d="M115 109.3H23.2c-5.7 0-10.2-4.6-10.2-10.3V27.9c0 5.7 4.6 10.3 10.2 10.4h76.9s15-1.3 15 10v61z" />
      <path
        fill="#3870B2"
        d="M72.2 72.9C76.3 69.8 77.1 64 74 60c-1.7-2.2-4.3-3.6-7.1-3.7h.3c.5-.1 1.1-.1 1.6 0v-5.7c0-.7-.3-1.3-.9-1.6-.9-.5-2-.2-2.5.7-.2.3-.3.6-.2 1v5.8c-5 .8-8.5 5.5-7.7 10.6v.1c.4 2.4 1.7 4.6 3.7 6l-16.9 36.2h11l7.8-16.6c.9-2 3.3-2.9 5.4-1.9.8.4 1.5 1.1 1.9 1.9l8.1 16.6h11.2L72.2 72.9zm-5.7-1.6c-3.2 0-5.7-2.6-5.7-5.8 0-3.2 2.6-5.7 5.8-5.6 1.5 0 2.8.6 3.9 1.6 2.3 2.2 2.3 5.8.1 8.1-1 1-2.5 1.7-4.1 1.7z"
      />
      <path fill="#FFF" d="M45.2 22.7h39.4v7.2H45.2v-7.2z" />
      <path
        fill="#073042"
        d="M63.5 59.8c3.1 0 5.7 2.6 5.6 5.8 0 3.1-2.6 5.7-5.8 5.6-3.1 0-5.6-2.6-5.6-5.7 0-1.5.6-2.9 1.7-4s2.6-1.7 4.1-1.7zm2.2-3.3v-6c0-.7-.3-1.3-.9-1.6-.9-.5-2-.2-2.5.7-.2.3-.3.6-.2 1v5.8c-5 .8-8.5 5.5-7.7 10.6v.1c.4 2.4 1.7 4.6 3.7 6l-21.3 45.7c-.8 1.6-.7 3.6.4 5.1 1.6 2.3 4.7 2.9 7 1.3.8-.5 1.4-1.3 1.8-2.1l14.2-30.4c.9-2 3.3-2.9 5.4-1.9.8.4 1.5 1.1 1.9 1.9L82 122.8c1.2 2.5 4.2 3.5 6.7 2.3 2.5-1.2 3.5-4.2 2.3-6.7L69.1 72.9c4-3.2 4.7-9.1 1.5-13.1-1.2-1.6-2.9-2.7-4.9-3.3"
      />
      <path
        fill="#3DDC84"
        d="M78.8 29.1c-1.5 0-2.7-1.1-2.7-2.6 0-.7.3-1.5.8-2 1.1-1 2.7-1 3.8 0 .5.5.8 1.2.8 1.9-.1 1.5-1.2 2.6-2.7 2.7M49.2 29c-1.5 0-2.7-1.2-2.7-2.6 0-.7.3-1.4.8-1.9.9-1.1 2.6-1.3 3.7-.4h.1c1.1 1 1.2 2.7.2 3.8l-.3.4c-.5.5-1.2.8-1.9.8m30.5-16.2l5.3-9.2c.3-.5.1-1.1-.3-1.5-.5-.2-1-.1-1.3.3L77.8 12C69 8.1 59 8.1 50.3 12l-5.4-9.4c-.2-.3-.6-.6-1-.6s-.8.2-1 .6c-.2.3-.2.8 0 1.1l5.4 9.2C38.9 18 32.8 27.6 31.9 38.2h64.2c-.8-10.7-7-20.2-16.4-25.3"
      />
      <path fill="#073042" d="M105.6 58.1h-4.2c-.2.1-.4.3-.4.6v66.5c0 .3.2.5.5.5h4.4c5.1 0 9.2-4.2 9.2-9.2V48.8c0 5.1-4.1 9.2-9.2 9.2h-.3z" />
    </svg>
  );
}

/* =========================================================================
 * B. Project Tree & Filetype Icons (ExpUI Dark)
 * ========================================================================= */

/** Official `kotlin_dark.svg` (16x16) */
export function KotlinFileIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M13.3337 12.6314C13.6699 12.9396 13.4519 13.5 12.9958 13.5H3C2.72386 13.5 2.5 13.2761 2.5 13V3C2.5 2.72386 2.72386 2.5 3 2.5H12.9958C13.4519 2.5 13.6699 3.06044 13.3337 3.36858L8.68333 7.63142C8.46715 7.82959 8.46715 8.17041 8.68333 8.36858L13.3337 12.6314Z"
        fill="#2F2936"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 3C2 2.44772 2.44771 2 3 2H12.9958C13.9079 2 14.3439 3.12089 13.6716 3.73715L9.0212 8L13.6716 12.2628C14.3439 12.8791 13.9079 14 12.9958 14H3C2.44771 14 2 13.5523 2 13V3ZM12.9958 3L3 3V13H12.9958L8.34547 8.73715C7.91311 8.34082 7.9131 7.65918 8.34547 7.26285L12.9958 3Z"
        fill="#A571E6"
      />
    </svg>
  );
}

/** Official `classKotlin_dark.svg` (16x16) */
export function KotlinClassIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M10 10H14.6445L12.6748 11.9697C12.3819 12.2626 12.3819 12.7374 12.6748 13.0303L14.6445 15H10V10Z" fill="#2F2936" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 10C9 9.44771 9.44772 9 10 9H15.248C15.9162 9 16.2508 9.80786 15.7783 10.2803L13.5587 12.5L15.7783 14.7197C16.2508 15.1921 15.9162 16 15.248 16H10C9.44772 16 9 15.5523 9 15V10ZM14.6445 10L10 10V15H14.6445L12.6748 13.0303C12.3819 12.7374 12.3819 12.2626 12.6748 11.9697L14.6445 10Z"
        fill="#A571E6"
      />
      <path d="M15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15V10C8 8.89543 8.89543 8 10 8H15Z" fill="#25324D" />
      <path
        d="M8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8H14C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14V15Z"
        fill="#548AF7"
      />
      <path
        d="M8 10.5731C6.73005 10.5048 5.82647 9.45343 5.82647 8C5.82647 6.49655 6.79332 5.42334 8.13241 5.42334C9.1041 5.42334 9.88241 5.94544 10.1966 6.67541H11.2118C10.8976 5.39917 9.62136 4.5 8.13241 4.5C6.21321 4.5 4.78711 5.99378 4.78711 8C4.78711 9.9598 6.14798 11.4306 8 11.4976V10.5731Z"
        fill="#548AF7"
      />
    </svg>
  );
}

/** Official `kotlinGradleScript_dark.svg` (16x16) */
export function KotlinGradleScriptIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M10 10H14.6445L12.6748 11.9697C12.3819 12.2626 12.3819 12.7374 12.6748 13.0303L14.6445 15H10V10Z" fill="#2F2936" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 10C9 9.44771 9.44772 9 10 9H15.248C15.9162 9 16.2508 9.80786 15.7783 10.2803L13.5587 12.5L15.7783 14.7197C16.2508 15.1921 15.9162 16 15.248 16H10C9.44772 16 9 15.5523 9 15V10ZM14.6445 10L10 10V15H14.6445L12.6748 13.0303C12.3819 12.7374 12.3819 12.2626 12.6748 11.9697L14.6445 10Z"
        fill="#A571E6"
      />
      <path
        d="M15.3414 2.32081C15.1092 1.84187 14.6262 1.32836 13.9725 1.10846C13.2757 0.87402 12.4598 0.998327 11.6716 1.68712C11.4637 1.86882 11.4424 2.18469 11.6241 2.39262C11.8058 2.60056 12.1217 2.62183 12.3296 2.44012C12.8789 1.96014 13.3287 1.94694 13.6537 2.05626C14.0166 2.17834 14.309 2.48313 14.4417 2.75726L14.447 2.76976C14.4527 2.78335 14.4621 2.8067 14.4736 2.83911C14.4841 2.86846 14.4963 2.90511 14.5092 2.94857C14.5557 3.19132 14.501 3.53184 14.2837 3.86426C14.0245 4.26068 13.5754 4.56986 12.9631 4.56986C12.5694 4.56986 12.1339 4.405 11.5646 4.11946C11.4149 4.0444 11.2552 3.96049 11.0871 3.87212C10.6516 3.64329 10.1591 3.38451 9.63586 3.17177C8.12036 2.55559 6.23123 2.26654 3.70259 3.51324C3.04147 3.83919 2.76989 4.59964 2.98364 5.26297L2.98427 5.2649C2.01842 5.9524 1.32137 6.81828 0.892733 7.85733C0.420154 9.0029 0.286208 10.3284 0.439053 11.8084C0.470493 12.1129 0.727153 12.3466 1.03552 12.3466H2.22824C2.58589 12.3466 2.84203 12.089 2.91808 11.8099C3.03345 11.3866 3.42039 11.0837 3.87007 11.0837C4.3196 11.0837 4.70646 11.3864 4.82195 11.8096C4.89808 12.0885 5.15419 12.346 5.51172 12.346H6.58831C6.94583 12.346 7.20194 12.0885 7.27807 11.8096C7.37328 11.4607 7.65289 11.1938 8 11.1107V10.0969C7.26532 10.1819 6.6445 10.6691 6.37966 11.346H5.72037C5.4283 10.5995 4.70328 10.0837 3.87007 10.0837C3.0366 10.0837 2.3114 10.5998 2.01951 11.3466H1.40261C1.31833 10.1387 1.45899 9.10691 1.81716 8.23868C2.13015 7.47996 2.61709 6.82667 3.29932 6.2796L3.68085 7.53383L3.68344 7.54146C3.86226 8.06775 4.30675 8.34504 4.73802 8.44037C5.16003 8.53365 5.63407 8.47248 6.01126 8.26203C6.70052 7.88902 7.33875 7.44585 7.92628 6.91662C8.13145 6.73181 8.14796 6.41566 7.96314 6.21048C7.77832 6.0053 7.46217 5.9888 7.257 6.17361C6.73098 6.64743 6.15742 7.04609 5.53236 7.38409L5.5254 7.38799C5.37364 7.47321 5.15073 7.50746 4.95385 7.46394C4.7682 7.4229 4.67094 7.33239 4.63233 7.2256L4.05405 5.32433L3.93545 4.95627C3.86133 4.72625 3.96408 4.49925 4.14479 4.41016C6.38031 3.30797 7.96767 3.57301 9.25922 4.09813C9.73457 4.2914 10.1568 4.51334 10.5764 4.73396C10.7555 4.8281 10.9342 4.92201 11.1163 5.01334C11.693 5.3026 12.3136 5.56986 12.9631 5.56986C13.5118 5.56986 13.9864 5.41167 14.3723 5.16035C14.0751 5.91818 13.4649 6.80367 12.2645 7.70158C12.142 7.79335 12.0278 7.89321 11.9216 8H13.4829C14.9416 6.71327 15.4747 5.41124 15.6003 4.35421C15.6702 3.76563 15.6117 3.27088 15.5339 2.91956C15.5182 2.84864 15.5017 2.78344 15.4853 2.72433C15.4552 2.58488 15.4079 2.44938 15.3414 2.32081Z"
        fill="currentColor"
      />
      <path
        d="M9.14402 6.04034C9.1068 6.14729 9.16406 6.25882 9.25933 6.32003L10.1478 6.89091C10.2431 6.95212 10.3683 6.95785 10.4501 6.87955C10.6688 6.67024 10.7543 6.34903 10.6556 6.05159C10.5372 5.69461 10.1856 5.46872 9.8117 5.50936C9.50016 5.54321 9.24352 5.75444 9.14402 6.04034Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `expui/fileTypes/xml_dark.svg` (16x16) */
export function XmlFileIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.0775 2.44037C10.1656 2.12093 9.97809 1.79054 9.65866 1.70242C9.33922 1.6143 9.00882 1.80182 8.9207 2.12126L5.76529 13.5596C5.67717 13.8791 5.86469 14.2095 6.18412 14.2976C6.50356 14.3857 6.83396 14.1982 6.92208 13.8788L10.0775 2.44037ZM5.41281 4.66699C5.61982 4.92575 5.57786 5.30332 5.31911 5.51033L1.96049 8.19723L5.31911 10.8841C5.57786 11.0911 5.61982 11.4687 5.41281 11.7275C5.20581 11.9862 4.82823 12.0282 4.56947 11.8212L0.625202 8.66575L0.0395508 8.19723L0.625202 7.7287L4.56947 4.57329C4.82823 4.36628 5.20581 4.40823 5.41281 4.66699ZM10.5872 11.7275C10.3802 11.4687 10.4222 11.0911 10.6809 10.8841L14.0395 8.19725L10.6809 5.51035C10.4222 5.30334 10.3802 4.92577 10.5872 4.66701C10.7942 4.40825 11.1718 4.3663 11.4305 4.57331L15.3748 7.72872L15.9605 8.19725L15.3748 8.66577L11.4305 11.8212C11.1718 12.0282 10.7942 11.9862 10.5872 11.7275Z"
        fill="#C77D55"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/filetree/manifest-file_dark.svg` (16x16) */
export function ManifestFileIcon({ size = 16, className }: StudioIconProps) {
  const clipId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <g clipPath={`url(#${clipId})`}>
        <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="#25362D" stroke="#3DDC84" />
        <path
          d="M5.645 11H4.547V4.7h1.427l1.93 4.55.108.35.104-.35 1.89-4.55h1.444V11h-1.102V6.518l.013-.238L8.404 11H7.58L5.632 6.311l.013.207V11z"
          fill="#3DDC84"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <path fill="#fff" d="M0 0h16v16H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Official `studio/icons/shell/filetree/android-module_dark.svg` (16x16) */
export function AndroidModuleIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="9.5" y="9.5" width="6" height="6" rx="1.5" fill="#25362D" stroke="#3DDC84" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 3.867C1 2.836 1.784 2 2.75 2h3.288a1 1 0 01.698.283L8.5 4H13a2 2 0 012 2v2.17c-.313-.11-.65-.17-1-.17h-3a3 3 0 00-3 3v3H2.75C1.784 14 1 13.164 1 12.133V3.867z"
        fill="#43454A"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.803 4.717l.29.283H13a1 1 0 011 1v2c.35 0 .687.06 1 .17V6a2 2 0 00-2-2H8.5L6.736 2.283A1 1 0 006.038 2H2.75C1.784 2 1 2.836 1 3.867v8.266C1 13.164 1.784 14 2.75 14H8v-1H2.75c-.354 0-.75-.326-.75-.867V3.867c0-.54.396-.867.75-.867h3.288l1.765 1.717z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/filetree/gradle-file_dark.svg` (16x16) */
export function GradleFileIcon({ size = 16, className }: StudioIconProps) {
  const clipId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M14.894 3.545c-.362-.756-1.556-1.65-2.893-.481m2.893.48c.463.882-.33 2.526-1.93 2.526-2.087 0-4.276-3.457-9.04-1.108-.421.207-.608.7-.464 1.148l.116.36m11.318-2.925s1.336 2.815-2.33 5.557c-1.033.773-1.411 2.291-1.45 3.644a.1.1 0 01-.1.098h-1.14a.22.22 0 01-.208-.169 1.482 1.482 0 00-1.436-1.091c-.678 0-1.26.456-1.434 1.094a.22.22 0 01-.208.168H5.512a.22.22 0 01-.208-.168 1.487 1.487 0 00-2.868 0 .22.22 0 01-.208.169H1.036a.1.1 0 01-.1-.09c-.293-2.844.53-4.951 2.64-6.287m0 0l.58 1.91c.217.636 1.085.741 1.614.444a9.336 9.336 0 001.822-1.279"
          stroke="currentColor"
          strokeLinecap="round"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.26 7.32c-.096-.061-.153-.173-.116-.28a.798.798 0 111.306.84c-.082.078-.207.072-.302.01l-.889-.57z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <path fill="#fff" d="M0 0h16v16H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Official `expui/nodes/sourceRoot_dark.svg` (16x16) */
export function SourceRootFolderIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.15132 4.35836L8.29689 4.5H8.5H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.919 13.9104 13.5 13.25 13.5H2.75C2.08955 13.5 1.5 12.919 1.5 12.1333V3.86667C1.5 3.08099 2.08955 2.5 2.75 2.5H6.03823C6.16847 2.5 6.29357 2.55082 6.38691 2.64164L8.15132 4.35836Z"
        fill="#25324D"
        stroke="#548AF7"
      />
    </svg>
  );
}

/** Official `expui/nodes/resourcesRoot_dark.svg` (16x16) */
export function ResourcesRootFolderIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M1 3.86667C1 2.83574 1.7835 2 2.75 2H6.03823C6.29871 2 6.5489 2.10163 6.73559 2.28327L8.5 4L13 4C14.1046 4 15 4.89543 15 6V9H9C8.44772 9 8 9.44772 8 10V14H2.75C1.7835 14 1 13.1643 1 12.1333V3.86667Z"
        fill="#43454A"
      />
      <path
        d="M8.09379 5H13C13.5523 5 14 5.44772 14 6V9H15V6C15 4.89543 14.1046 4 13 4L8.5 4L6.73559 2.28327C6.5489 2.10163 6.29871 2 6.03823 2H2.75C1.7835 2 1 2.83574 1 3.86667V12.1333C1 13.1643 1.7835 14 2.75 14H8V13H2.75C2.3956 13 2 12.6738 2 12.1333V3.86667C2 3.32624 2.3956 3 2.75 3H6.03823L8.09379 5Z"
        fill="currentColor"
      />
      <rect x="9" y="10" width="7" height="1" rx="0.5" fill="#F2C55C" />
      <rect x="9" y="12" width="7" height="1" rx="0.5" fill="#F2C55C" />
      <rect x="9" y="14" width="7" height="1" rx="0.5" fill="#F2C55C" />
    </svg>
  );
}

/** Official `expui/nodes/folder_dark.svg` (16x16) */
export function FolderDarkIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
        fill="#43454A"
        stroke="currentColor"
      />
    </svg>
  );
}

/** Official `expui/nodes/package_dark.svg` (16x16) */
export function PackageFolderIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 3.86667C1 2.83574 1.73127 2 2.63333 2H6.1217C6.39413 2 6.65477 2.11115 6.84336 2.30775L8.46667 4H13C14.1046 4 15 4.89543 15 6V12.1333C15 13.1643 14.2687 14 13.3667 14H2.63333C1.73127 14 1 13.1643 1 12.1333V3.86667ZM6 10C6.55228 10 7 9.55228 7 9C7 8.44772 6.55228 8 6 8C5.44772 8 5 8.44772 5 9C5 9.55228 5.44772 10 6 10Z"
        fill="#43454A"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.04022 5L6.1217 3H2.63333C2.40481 3 2 3.25841 2 3.86667V12.1333C2 12.7416 2.40481 13 2.63333 13H13.3667C13.5952 13 14 12.7416 14 12.1333V6C14 5.44771 13.5523 5 13 5H8.04022ZM8.46667 4L6.84336 2.30775C6.65477 2.11115 6.39413 2 6.1217 2H2.63333C1.73127 2 1 2.83574 1 3.86667V12.1333C1 13.1643 1.73127 14 2.63333 14H13.3667C14.2687 14 15 13.1643 15 12.1333V6C15 4.89543 14.1046 4 13 4H8.46667ZM4 9C4 7.89543 4.89543 7 6 7C7.10457 7 8 7.89543 8 9C8 10.1046 7.10457 11 6 11C4.89543 11 4 10.1046 4 9ZM7 9C7 9.55228 6.55228 10 6 10C5.44772 10 5 9.55228 5 9C5 8.44772 5.44772 8 6 8C6.55228 8 7 8.44772 7 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `expui/fileTypes/properties_dark.svg` (16x16) */
export function PropertiesFileIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.22655 4.36961C2.89397 4.81844 2.65633 5.23403 2.47037 5.67626L3.30992 7.0943C3.6406 7.65283 3.6406 8.34718 3.30992 8.9057L2.47037 10.3237C2.69648 10.8419 2.93961 11.2535 3.22656 11.6304L4.87261 11.6124C5.52165 11.6053 6.12297 11.9524 6.44133 12.5181L7.24899 13.953C7.51399 13.9851 7.75709 14 8.00408 14C8.2602 14 8.51214 13.984 8.75904 13.9531L9.56671 12.5181C9.88507 11.9524 10.4864 11.6053 11.1354 11.6124L12.7816 11.6304C13.1142 11.1816 13.3518 10.766 13.5377 10.3239L12.6981 8.9057C12.3726 8.17571 12.4088 7.58301 12.6981 7.0943L13.5377 5.67613C13.3117 5.15806 13.0685 4.74652 12.7816 4.36961L11.1354 4.38764C10.4864 4.39475 9.88507 4.04758 9.56671 3.48194L8.75904 2.04693C8.4941 2.01487 8.25104 2 8.00408 2C7.74792 2 7.49594 2.016 7.24899 2.04695L6.44133 3.48194C6.12297 4.04758 5.52165 4.39475 4.87261 4.38764L3.22655 4.36961ZM8.004 9.65101C8.91582 9.65101 9.655 8.91183 9.655 8.00001C9.655 7.08819 8.91582 6.34902 8.004 6.34902C7.09218 6.34902 6.353 7.08819 6.353 8.00001C6.353 8.91183 7.09218 9.65101 8.004 9.65101ZM10.655 8.00001C10.655 9.46412 9.46811 10.651 8.004 10.651C6.5399 10.651 5.353 9.46412 5.353 8.00001C5.353 6.53591 6.5399 5.34902 8.004 5.34902C9.46811 5.34902 10.655 6.53591 10.655 8.00001Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** TOML Version Catalog `libs.versions.toml` icon (16x16 blue `[T]` badge) */
export function TomlFileIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="#25324D" stroke="#548AF7" />
      <path d="M5.2 5.2H10.8V6.3H8.6V11H7.4V6.3H5.2V5.2Z" fill="#548AF7" />
    </svg>
  );
}

/** Composable `@Composable` gutter icon (14x14) */
export function ComposableGutterIcon({ size = 14, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3" fill="#25362D" stroke="#3DDC84" strokeWidth="1.2" />
      <path d="M6.2 5.5L10.5 8L6.2 10.5V5.5Z" fill="#3DDC84" />
    </svg>
  );
}

/* =========================================================================
 * C. Top Main Toolbar Action SVGs (ExpUI Dark)
 * ========================================================================= */

/** Official `expui/general/windowsMenu@20x20_dark.svg` (20x20) */
export function HamburgerMenuIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2.5" width="16" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="2" y="7" width="16" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="2" y="11.5" width="16" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="2" y="16" width="16" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

/** Official `expui/vcs/vcs_dark.svg` (16x16) */
export function VcsBranchIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="4.5" cy="4" r="2" stroke="currentColor" />
      <path d="M4.5 11H8.5C9.60457 11 10.5 10.1046 10.5 9V9V7.5" stroke="currentColor" />
      <path d="M4.5 6.5L4.5 14.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="6" r="2" stroke="currentColor" />
    </svg>
  );
}

/** Official `expui/run/run_dark.svg` (16x16) */
export function RunPlayIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M13.5 7.13397C14.1667 7.51888 14.1667 8.48112 13.5 8.86602L4.5 14.0622C3.83333 14.4471 3 13.966 3 13.1962L3 2.80385C3 2.03405 3.83333 1.55292 4.5 1.93782L13.5 7.13397Z"
        fill="#253627"
        stroke="#57965C"
      />
    </svg>
  );
}

/** Official `expui/run/debug_dark.svg` (16x16) */
export function DebugBugIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6907 4.4347C10.6974 4.35728 10.7008 4.27899 10.7008 4.2C10.7008 2.70883 9.49195 1.5 8.00078 1.5C6.50961 1.5 5.30078 2.70883 5.30078 4.2C5.30078 4.27871 5.30416 4.35672 5.3108 4.43387C4.83909 4.6943 4.43389 5.06042 4.12714 5.5003L2.0178 4.36019C1.77487 4.22888 1.4715 4.31937 1.34019 4.5623C1.20889 4.80523 1.29938 5.1086 1.5423 5.2399L3.67822 6.39438C3.5626 6.74191 3.5 7.11364 3.5 7.5V8.50006H1C0.723858 8.50006 0.5 8.72392 0.5 9.00006C0.5 9.2762 0.723858 9.50006 1 9.50006H3.5V10C3.5 10.4892 3.57807 10.9602 3.72243 11.4012L1.52989 12.667C1.29075 12.8051 1.20881 13.1109 1.34688 13.3501C1.48495 13.5892 1.79075 13.6711 2.02989 13.5331L4.14017 12.3147C4.92703 13.624 6.36122 14.5 8 14.5C9.63821 14.5 11.072 13.6246 11.859 12.3161L13.967 13.5331C14.2061 13.6712 14.5119 13.5893 14.65 13.3501C14.7881 13.111 14.7061 12.8052 14.467 12.6671L12.2771 11.4028C12.4217 10.9613 12.5 10.4898 12.5 10V9.49982H15C15.2761 9.49982 15.5 9.27596 15.5 8.99982C15.5 8.72367 15.2761 8.49982 15 8.49982H12.5V7.5C12.5 7.11367 12.4374 6.74197 12.3218 6.39447L14.4551 5.23979C14.698 5.10835 14.7883 4.80492 14.6569 4.56207C14.5254 4.31922 14.222 4.2289 13.9791 4.36035L11.8729 5.50036C11.5665 5.06092 11.1618 4.69509 10.6907 4.4347ZM6.30577 4.06885C6.53015 4.02369 6.76231 4 7 4H9C9.23825 4 9.47094 4.02381 9.69582 4.06917C9.62902 3.19142 8.89564 2.5 8.00078 2.5C7.10603 2.5 6.37272 3.19125 6.30577 4.06885ZM4.5 7.5C4.5 6.11929 5.61929 5 7 5H9C10.3807 5 11.5 6.11929 11.5 7.5V10C11.5 11.933 9.933 13.5 8 13.5C6.067 13.5 4.5 11.933 4.5 10V7.5Z"
        fill="#57965C"
      />
      <path
        d="M7 4C6.76231 4 6.53015 4.02369 6.30577 4.06885C6.37272 3.19125 7.10603 2.5 8.00078 2.5C8.89564 2.5 9.62902 3.19142 9.69582 4.06917C9.47094 4.02381 9.23825 4 9 4H7Z"
        fill="#253627"
      />
      <path
        d="M7 5C5.61929 5 4.5 6.11929 4.5 7.5V10C4.5 11.933 6.067 13.5 8 13.5C9.933 13.5 11.5 11.933 11.5 10V7.5C11.5 6.11929 10.3807 5 9 5H7Z"
        fill="#253627"
      />
    </svg>
  );
}

/** Official `expui/run/stop_dark.svg` (16x16) */
export function StopSquareIcon({ size = 16, active = true, className }: StudioIconProps & { active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="1.5"
        fill={active ? "#5E3838" : "#393B40"}
        stroke={active ? "#DB5C5C" : "#5E6168"}
      />
    </svg>
  );
}

/** Official `expui/run/restart_dark.svg` (16x16) */
export function RestartIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5501 1.3999C13.5501 1.12376 13.3262 0.899902 13.0501 0.899902C12.774 0.899902 12.5501 1.12376 12.5501 1.3999V4.08871C11.4503 2.81049 9.81987 1.99991 8 1.99991C4.68629 1.99991 2 4.68621 2 7.99991C2 11.3136 4.68629 13.9999 8 13.9999C10.3918 13.9999 12.4558 12.6003 13.4194 10.5777C13.5382 10.3284 13.4324 10.03 13.1831 9.91126C12.9338 9.79248 12.6354 9.89829 12.5167 10.1476C11.7126 11.8353 9.99182 12.9999 8 12.9999C5.23858 12.9999 3 10.7613 3 7.99991C3 5.23849 5.23858 2.99991 8 2.99991C9.59 2.99991 11.0069 3.74169 11.9233 4.8999H9.05005C8.77391 4.8999 8.55005 5.12376 8.55005 5.3999C8.55005 5.67604 8.77391 5.8999 9.05005 5.8999H13.0501H13.5501V5.3999V1.3999ZM12.5206 4.8999H12.5501V4.87961L12.5206 4.8999Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/build-run-configuration@20x20_dark.svg` (20x20) */
export function BuildRunConfigurationIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.65 3.007C13.705 2.509 12.75 2.5 12 2.5H8.394l-1.115.446A.75.75 0 017 3H5.5a.75.75 0 01-.335-.08l-.842-.42H2.75V5h1.573l.842-.42A.75.75 0 015.5 4.5H7a.75.75 0 01.469.164l1.044.836h2.237l1.8-1.35A.75.75 0 0113 4h.032c.733 0 1.45 0 2.303.249.32.093.652.219 1.01.386-.54-.843-1.136-1.333-1.695-1.628zM6.737 6l.763.61v2.213l-.143.286a5.75 5.75 0 00-.607 2.571v6.57c0 .414.336.75.75.75h2.143a3.546 3.546 0 01-.143-1.005V17.5H8.25v-5.82c0-.66.154-1.31.449-1.9l.222-.445A.75.75 0 009 9V7h1.25v2a.75.75 0 00.08.335l.128.258c.362-.38.805-.675 1.292-.863V6.625l1.5-1.125c.627.003 1.103.025 1.665.189.64.186 1.439.574 2.655 1.425a.75.75 0 001.145-.84c-.796-2.522-2.03-3.89-3.365-4.594C14.06 1 12.78 1 12.027 1H8.25a.75.75 0 00-.279.054L6.856 1.5H5.677l-.842-.42A.75.75 0 004.5 1H2a.75.75 0 00-.75.75v4c0 .414.336.75.75.75h2.5a.75.75 0 00.335-.08L5.677 6h1.06z"
        fill="currentColor"
      />
      <path
        d="M13.61 10.928l5.031 2.995a1.258 1.258 0 010 2.155l-5.03 2.995c-.815.485-1.861-.101-1.861-1.078v-5.99c0-.977 1.046-1.563 1.86-1.077z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/apply-all-changes@20x20_dark.svg` (20x20) */
export function ApplyAllChangesIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 19l3.477-10h1.926L19 19h-1.642l-.86-2.543h-4.023L11.669 19H10zm5.986-4.042L14.588 10.9l-.156-.614-.155.614-1.323 4.058h3.032z" fill="currentColor" />
      <path d="M11.5 1.5l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8.5 13.75a.75.75 0 000-1.5v1.5zm0-1.5H6.75v1.5H8.5v-1.5zm-1.75-7h7.75v-1.5H6.75v1.5zm-3.5 3.5a3.5 3.5 0 013.5-3.5v-1.5a5 5 0 00-5 5h1.5zm3.5 3.5a3.5 3.5 0 01-3.5-3.5h-1.5a5 5 0 005 5v-1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/apply-code-swap@20x20_dark.svg` (20x20) */
export function ApplyCodeSwapIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M2.5 2h15M2.5 7h15M2.5 12h4M2.5 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M11 16.25a.75.75 0 000 1.5v-1.5zm0 1.5h4v-1.5h-4v1.5zm4-6.5h-4v1.5h4v-1.5zm3.25 3.25A3.25 3.25 0 0015 11.25v1.5c.966 0 1.75.784 1.75 1.75h1.5zM15 17.75a3.25 3.25 0 003.25-3.25h-1.5A1.75 1.75 0 0115 16.25v1.5z"
        fill="currentColor"
      />
      <path d="M12.5 9.5L10 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/attach-debugger@20x20_dark.svg` (20x20) */
export function AttachDebuggerIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 5.03V5a2 2 0 114 0v.03a4.04 4.04 0 00-.5-.03h-3c-.17 0-.336.01-.5.03zM13.5 5c0 .175-.013.346-.037.514a4.02 4.02 0 011.428 1.364l2.254-1.212a.75.75 0 01.71 1.322l-2.418 1.3c.041.231.063.469.063.712v1H14V9a2.5 2.5 0 00-2.5-2.5h-3A2.5 2.5 0 006 9v3.5a4 4 0 005 3.874v1.535a5.5 5.5 0 01-5.849-2.811l-2.298 1.236a.75.75 0 11-.71-1.322l2.483-1.335A5.522 5.522 0 014.5 12.5v-.75h-3a.75.75 0 010-1.5h3V9c0-.243.022-.48.063-.711l-2.42-1.301a.75.75 0 11.71-1.322L5.108 6.88a4.02 4.02 0 011.43-1.365A3.5 3.5 0 1113.5 5z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.25 12a.75.75 0 000 1.5h2.19l-4.22 4.22a.75.75 0 101.06 1.06l4.22-4.22v2.19a.75.75 0 001.5 0v-4a.747.747 0 00-.213-.524l-.013-.013A.748.748 0 0018.25 12h-4z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/gradle-sync@20x20_dark.svg` (20x20) */
export function GradleSyncIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.74 1.146c.876.295 1.521.98 1.832 1.621.09.175.154.358.195.546a5.676 5.676 0 01.15 2.145c-.174 1.467-.942 3.279-3.074 5.042h-2.22c.233-.298.502-.568.811-.8 1.392-1.041 2.162-2.066 2.576-2.964a3.434 3.434 0 01-1.61.388c-.876 0-1.708-.365-2.464-.745-.23-.116-.453-.234-.677-.351-.561-.295-1.12-.59-1.753-.842-1.672-.668-3.74-.988-6.684.527-.07.037-.127.137-.089.256l.223.693.004.011.748 2.46c.036.096.128.194.342.241.231.051.494.01.668-.088l.01-.005a11.342 11.342 0 002.214-1.554.75.75 0 111.004 1.114c-.767.691-1.6 1.27-2.5 1.757a2.501 2.501 0 01-1.72.24c-.583-.128-1.195-.506-1.44-1.23l-.005-.012-.003-.011-.447-1.468a6.145 6.145 0 00-1.775 2.408c-.444 1.082-.626 2.368-.532 3.875h.634a2.676 2.676 0 014.931 0h.716a2.676 2.676 0 012.695-1.626v1.513a1.176 1.176 0 00-1.371.873.965.965 0 01-.934.74H6.699a.965.965 0 01-.933-.74 1.176 1.176 0 00-2.284 0 .965.965 0 01-.934.74H.926a.85.85 0 01-.845-.761C-.122 13.204.05 11.463.67 9.955c.553-1.347 1.45-2.472 2.687-3.368l-.05-.158c-.25-.773.066-1.656.83-2.05 3.376-1.738 5.902-1.395 7.927-.586.71.284 1.376.634 1.958.94.208.11.405.213.59.306.748.377 1.3.585 1.79.585.754 0 1.305-.38 1.624-.868.27-.413.33-.825.278-1.107a2.754 2.754 0 00-.075-.215l-.006-.013a1.76 1.76 0 00-.96-.853c-.383-.13-.928-.123-1.615.477a.75.75 0 11-.987-1.13c1.046-.913 2.14-1.085 3.08-.769z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.557 7.963c-.095-.06-.152-.172-.12-.28a1.034 1.034 0 111.668 1.071c-.086.074-.21.069-.306.008l-1.242-.799zM16.75 19a.75.75 0 000-1.5h-2.19l4.22-4.22a.75.75 0 10-1.06-1.06l-4.22 4.22v-2.19a.75.75 0 00-1.5 0v4c0 .204.081.388.213.523l.013.014a.748.748 0 00.524.213h4z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/device-manager@20x20_dark.svg` (20x20) */
export function DeviceManagerIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M7.5 18.25h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.276 18.25a4.75 4.75 0 019.448 0h1.506a6.25 6.25 0 00-12.46 0h1.506z"
        fill="currentColor"
      />
      <path d="M10.5 13.75l-1-2M15.5 13.75l1-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.75 5a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm4.75 6V4a.5.5 0 00-.5-.5H4a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h2V18H4a2 2 0 01-2-2V4a2 2 0 012-2h7a2 2 0 012 2v7h-1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/toolbar/sdk-manager@20x20_dark.svg` (20x20) */
export function SdkManagerIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M2 5l7 3 7-3" stroke="currentColor" strokeWidth="1.5" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.49 2.049a1.25 1.25 0 011.02 0l5 2.232c.45.201.74.648.74 1.141V7.5h1.5V5.422a2.75 2.75 0 00-1.629-2.51l-5-2.233a2.75 2.75 0 00-2.242 0l-5 2.232A2.75 2.75 0 001.25 5.422v6.156a2.75 2.75 0 001.629 2.51l5 2.233a2.75 2.75 0 002.242 0l.879-.393v-1.642l-1.49.665a1.25 1.25 0 01-1.02 0l-5-2.232a1.25 1.25 0 01-.74-1.141V5.422c0-.493.29-.94.74-1.141l5-2.232z"
        fill="currentColor"
      />
      <path d="M9 8v8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 10v6.5M13 15l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Official `expui/general/search@20x20_dark.svg` (20x20) */
export function SearchEverywhereIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.5 9C14.5 12.0376 12.0376 14.5 9 14.5C5.96243 14.5 3.5 12.0376 3.5 9C3.5 5.96243 5.96243 3.5 9 3.5C12.0376 3.5 14.5 5.96243 14.5 9ZM13.3584 14.478C12.1625 15.4307 10.6478 16 9 16C5.13401 16 2 12.866 2 9C2 5.13401 5.13401 2 9 2C12.866 2 16 5.13401 16 9C16 10.6478 15.4307 12.1625 14.478 13.3584C14.5086 13.3812 14.5379 13.4065 14.5657 13.4343L18.5657 17.4343C18.8781 17.7467 18.8781 18.2533 18.5657 18.5657C18.2533 18.8781 17.7467 18.8781 17.4343 18.5657L13.4343 14.5657C13.4065 14.5379 13.3812 14.5086 13.3584 14.478Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `expui/general/settings@20x20_dark.svg` (20x20) */
export function SettingsGearIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.96446 5.54781C3.63344 5.99572 3.35137 6.48132 3.12584 6.99671L4.14987 8.72634C4.61489 9.51177 4.61489 10.4882 4.14987 11.2736L3.12584 13.0033C3.35137 13.5187 3.63344 14.0043 3.96446 14.4522L5.9723 14.4302C6.88501 14.4202 7.73062 14.9084 8.17831 15.7038L9.16331 17.4539C9.43778 17.4843 9.71717 17.5 10.0007 17.5C10.2843 17.5 10.5637 17.4843 10.8382 17.4539L11.8232 15.7038C12.2709 14.9084 13.1165 14.4202 14.0292 14.4302L16.037 14.4522C16.368 14.0043 16.6501 13.5186 16.8756 13.0033L15.8516 11.2736C15.3866 10.4882 15.3866 9.51177 15.8516 8.72634L16.8756 6.99671C16.6501 6.48132 16.368 5.99572 16.037 5.54781L14.0292 5.56981C13.1165 5.57981 12.2709 5.09159 11.8232 4.29617L10.8382 2.5461C10.5637 2.51567 10.2843 2.5 10.0007 2.5C9.71717 2.5 9.43779 2.51567 9.16332 2.54609L8.17831 4.29617C7.73062 5.09159 6.88501 5.57981 5.9723 5.56981L3.96446 5.54781ZM13.6234 10C13.6234 12.0008 12.0015 13.6227 10.0007 13.6227C7.99996 13.6227 6.37802 12.0008 6.37802 10C6.37802 7.99924 7.99996 6.37729 10.0007 6.37729C12.0015 6.37729 13.6234 7.99923 13.6234 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MoreVerticalIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="3" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14, color = "#B4B8BF", className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M11.5 6.25L8 9.75L4.5 6.25" stroke={color} strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 14, color = "#B4B8BF", className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M6.25 4.5L9.75 8L6.25 11.5" stroke={color} strokeLinecap="round" />
    </svg>
  );
}

/* =========================================================================
 * D. Tool Window Stripe SVGs (@20x20_dark.svg)
 * ========================================================================= */

/** Official `studio/icons/shell/tool-windows/logcat@20x20_dark.svg` (20x20) */
export function LogcatStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M14.625 7.563L17.4 4.836a.5.5 0 01.851.357v8.557a3 3 0 01-3 3h-5.5a3 3 0 01-3-3V5.193a.5.5 0 01.85-.357l2.775 2.727a1 1 0 00.7.287h2.85a1 1 0 00.7-.287z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <path d="M1.75 7.75H6M2.75 11.25H6M2.75 14.75H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M12.665 14.606a.25.25 0 01-.33 0l-1.334-1.168a.25.25 0 01.164-.438h2.67a.25.25 0 01.164.438l-1.334 1.168z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/tool-windows/emulator@20x20_dark.svg` (20x20) */
export function RunningDevicesStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.5 11.5v3h8v-3h-8zM8 10a1 1 0 00-1 1v4a1 1 0 001 1h9a1 1 0 001-1v-4a1 1 0 00-1-1H8z"
        fill="currentColor"
      />
      <path d="M7.75 18.25h9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.75 5a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zm4.75 3.5V4a.5.5 0 00-.5-.5H4a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h1.5V18H4a2 2 0 01-2-2V4a2 2 0 012-2h7a2 2 0 012 2v4.5h-1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/tool-windows/visual-assets@20x20_dark.svg` (20x20) */
export function ResourceManagerStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="5.5" r="3.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.5 12.5v4h4v-4h-4zM3 11a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1v-5a1 1 0 00-1-1H3z"
        fill="currentColor"
      />
      <path
        d="M17.13 15.25h-5.26a.5.5 0 01-.431-.752l2.63-4.508a.5.5 0 01.863 0l2.63 4.508a.5.5 0 01-.433.752z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/tool-windows/app-quality-insights@20x20_dark.svg` (20x20) */
export function AppQualityInsightsStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M14.094 2.75H5.906a1 1 0 00-.697.283l-3.54 3.441a1 1 0 00-.066 1.363l7.634 9.012a1 1 0 001.526 0l7.633-9.012a1 1 0 00-.066-1.363l-3.539-3.441a1 1 0 00-.697-.283zM2 7.75h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.667 2.75L6.225 7.41a1 1 0 00-.026.874L10 16.75M11.333 2.75l2.442 4.66a1 1 0 01.026.874L10 16.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Official `studio/icons/shell/tool-windows/android-profiler@20x20_dark.svg` (20x20) */
export function ProfilerStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 4a8 8 0 00-8 8c0 1.19.258 2.454.7 3.5h14.6c.442-1.046.7-2.31.7-3.5a8 8 0 00-8-8zM.5 12a9.5 9.5 0 1119 0c0 1.628-.41 3.382-1.131 4.748a.481.481 0 01-.428.252H2.059a.481.481 0 01-.428-.252C.91 15.382.5 13.628.5 12zM14.871 8.623a.85.85 0 10-1.086-1.308L11 9.628a2.3 2.3 0 101.15 1.254l2.722-2.26zM10.8 11.7a.8.8 0 11-1.6 0 .8.8 0 011.6 0z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `gemini-logo_dark.svg` (16x16 with unique useId gradient) */
export function GeminiSparkleIcon({ size = 18, className }: StudioIconProps) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M13.483 7.258a8.995 8.995 0 01-2.831-1.91A8.99 8.99 0 018.31 1.243a.32.32 0 00-.62 0 8.99 8.99 0 01-2.341 4.106 8.99 8.99 0 01-4.106 2.34.32.32 0 000 .621 8.996 8.996 0 014.106 2.341 8.985 8.985 0 012.34 4.106.32.32 0 00.621 0 8.995 8.995 0 012.341-4.106 8.99 8.99 0 014.106-2.34.32.32 0 000-.621 8.408 8.408 0 01-1.274-.432z"
        fill={`url(#${gradId})`}
      />
      <defs>
        <linearGradient id={gradId} x1="5.357" y1="10.049" x2="11.69" y2="4.71" gradientUnits="userSpaceOnUse">
          <stop stopColor="#346BF1" />
          <stop offset=".372" stopColor="#3186FF" />
          <stop offset=".777" stopColor="#4FA0FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Official `gradle@20x20_dark.svg` (20x20) */
export function GradleStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M18.9016 4.65326C18.4322 3.67376 16.8861 2.51625 15.1539 4.02994M18.9016 4.65326C19.5006 5.79453 18.4726 7.92337 16.4004 7.92337C13.6672 7.92337 10.7983 3.3425 4.47909 6.59615C4.06186 6.81098 3.87557 7.30249 4.01951 7.74917L4.24258 8.44141M18.9016 4.65326C18.9016 4.65326 20.6308 8.2992 15.8839 11.8501C14.5388 12.8574 14.0507 14.8399 14.0058 16.5987C14.0044 16.6533 13.9599 16.6969 13.9054 16.6969H12.3477C12.2486 16.6969 12.1656 16.6239 12.1423 16.5276C11.9362 15.6732 11.1678 15.0644 10.2705 15.0644C9.37546 15.0644 8.60879 15.6787 8.40024 16.5307C8.37674 16.6267 8.29385 16.6992 8.19504 16.6992H6.69933C6.60052 16.6992 6.51763 16.6267 6.49413 16.5307C6.28558 15.6787 5.51891 15.0644 4.62391 15.0644C3.72864 15.0644 2.96177 15.6791 2.75349 16.5315C2.73003 16.6275 2.64712 16.7 2.54828 16.7H0.926436C0.875473 16.7 0.832559 16.6611 0.827236 16.6104C0.43905 12.9139 1.50445 10.1758 4.24258 8.44141M4.24258 8.44141L4.99534 10.916C5.27503 11.7392 6.39897 11.8754 7.08481 11.4902C7.93671 11.0296 8.72209 10.484 9.44376 9.83399"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.5569 9.51317C11.4617 9.45196 11.4054 9.34109 11.4369 9.23233C11.5518 8.83589 11.8961 8.53859 12.3182 8.49271C12.8024 8.44009 13.2577 8.73263 13.4111 9.19497C13.5448 9.59798 13.4175 10.0347 13.1046 10.3039C13.0188 10.3778 12.8946 10.3726 12.7993 10.3114L11.5569 9.51317Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Standard ExpUI Stripe Icons (Project, Commit, Build, Run, Terminal, Problems, VCS, Notifications) */
export function ProjectStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10.5199 5.57617L10.7285 5.75H11H17C17.6904 5.75 18.25 6.30964 18.25 7V15.1667C18.25 16.0671 17.553 16.75 16.75 16.75H3.25C2.44705 16.75 1.75 16.0671 1.75 15.1667V4.83333C1.75 3.93294 2.44705 3.25 3.25 3.25H7.63795C7.69643 3.25 7.75307 3.2705 7.798 3.30794L10.5199 5.57617Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function CommitStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.25 9.25C19.6642 9.25 20 9.58579 20 10C20 10.4142 19.6642 10.75 19.25 10.75L13.9298 10.75C13.5787 12.6006 11.9528 14 10 14C8.04721 14 6.42125 12.6006 6.0702 10.75L0.75 10.75C0.335787 10.75 0 10.4142 0 10C0 9.58579 0.335787 9.25 0.75 9.25L6.0702 9.25C6.42125 7.39935 8.04721 6 10 6C11.9528 6 13.5787 7.39935 13.9298 9.25L19.25 9.25ZM10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BuildStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.25 1C4.44891 1 4.63962 1.07907 4.78027 1.21973L5.56055 2H6.43945L7.21973 1.21973L7.33398 1.12598C7.45628 1.04445 7.60085 1 7.75 1H13.125C14.9473 1 16.4277 1.87993 17.4346 3.08105C18.4322 4.27143 19 5.81492 19 7.25C19 7.51735 18.8572 7.76425 18.626 7.89844C18.3948 8.03247 18.11 8.0339 17.8779 7.90137L15.4258 6.5H14.0605L13 7.56055V18.25C13 18.6642 12.6642 19 12.25 19H7.75C7.33579 19 7 18.6642 7 18.25V7.56055L6.43945 7H5.56055L4.78027 7.78027C4.63962 7.92093 4.44891 8 4.25 8H1.75C1.33579 8 1 7.66421 1 7.25V1.75C1 1.33579 1.33579 1 1.75 1H4.25ZM8.5 17.5H11.5V8H8.5V17.5ZM2.5 6.5H3.93945L4.71973 5.71973L4.83398 5.62598C4.95628 5.54445 5.10085 5.5 5.25 5.5H6.75C6.94891 5.5 7.13962 5.57907 7.28027 5.71973L8.06055 6.5H11.9395L13.2197 5.21973L13.334 5.12598C13.4563 5.04445 13.6008 5 13.75 5H15.625C15.7555 5 15.8838 5.03392 15.9971 5.09863L17.2637 5.82227C17.0602 5.19249 16.7287 4.57423 16.2842 4.04395C15.5098 3.12029 14.4276 2.5 13.125 2.5H8.06055L7.28027 3.28027C7.13962 3.42093 6.94891 3.5 6.75 3.5H5.25C5.05109 3.5 4.86038 3.42093 4.71973 3.28027L3.93945 2.5H2.5V6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RunStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M16.125 11.0825L5.625 17.1447C4.79167 17.6258 3.75 17.0244 3.75 16.0622L3.75 3.93782C3.75 2.97557 4.79167 2.37417 5.625 2.85529L16.125 8.91747C16.9583 9.39859 16.9583 10.6014 16.125 11.0825Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function TerminalStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 13.2788C9 12.8646 9.33579 12.5288 9.75 12.5288L14.25 12.5C14.6642 12.5 15 12.8358 15 13.25C15 13.6642 14.6642 14 14.25 14L9.75 14.0288C9.33579 14.0288 9 13.693 9 13.2788Z"
        fill="currentColor"
      />
      <rect x="1.75" y="2.75" width="16.5" height="14.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.75 11.75L8.5 9L5.75 6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProblemsStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 18.25C14.5563 18.25 18.25 14.5563 18.25 10C18.25 5.44365 14.5563 1.75 10 1.75C5.44365 1.75 1.75 5.44365 1.75 10C1.75 14.5563 5.44365 18.25 10 18.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function VcsStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.5 4.5C7.5 5.60457 6.60457 6.5 5.5 6.5C4.39543 6.5 3.5 5.60457 3.5 4.5C3.5 3.39543 4.39543 2.5 5.5 2.5C6.60457 2.5 7.5 3.39543 7.5 4.5ZM9 4.5C9 6.17556 7.82259 7.57612 6.25 7.91946L6.25 13.25H9.5C10.2092 13.25 10.7035 13.2496 11.0904 13.2232C11.4706 13.1973 11.692 13.1487 11.861 13.0787C12.4124 12.8504 12.8504 12.4124 13.0787 11.861C13.1487 11.692 13.1973 11.4706 13.2232 11.0904C13.244 10.7848 13.2487 10.4121 13.2497 9.91939C11.6773 9.57594 10.5 8.17546 10.5 6.5C10.5 4.567 12.067 3 14 3C15.933 3 17.5 4.567 17.5 6.5C17.5 8.17565 16.3225 9.57626 14.7498 9.91951C14.7488 10.4185 14.7439 10.8379 14.7197 11.1925C14.6886 11.6491 14.6229 12.0528 14.4645 12.4351C14.0839 13.3539 13.3539 14.0839 12.4351 14.4645C12.0528 14.6229 11.6491 14.6886 11.1925 14.7197C10.7485 14.75 10.203 14.75 9.52664 14.75H9.5H6.25V18C6.25 18.4142 5.91421 18.75 5.5 18.75C5.08579 18.75 4.75 18.4142 4.75 18L4.75 7.91946C3.17741 7.57612 2 6.17556 2 4.5C2 2.567 3.567 1 5.5 1C7.433 1 9 2.567 9 4.5ZM16 6.5C16 7.60457 15.1046 8.5 14 8.5C12.8954 8.5 12 7.60457 12 6.5C12 5.39543 12.8954 4.5 14 4.5C15.1046 4.5 16 5.39543 16 6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function NotificationsStripeIcon({ size = 18, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.67717 17.5625H11.3229C11.2515 17.7305 11.148 17.8849 11.0165 18.0164C10.7469 18.286 10.3813 18.4375 10 18.4375C9.61878 18.4375 9.25315 18.286 8.98358 18.0164C8.85202 17.8849 8.74859 17.7305 8.67717 17.5625Z"
        stroke="currentColor"
        strokeWidth="1.12498"
      />
      <path
        d="M4.67081 10.3354C4.72288 10.2313 4.74999 10.1164 4.74999 10V7C4.74999 4.97056 5.52681 3.69096 6.52723 2.90116C7.55609 2.08891 8.8818 1.75 9.99999 1.75C11.1182 1.75 12.4439 2.08891 13.4728 2.90116C14.4732 3.69096 15.25 4.97056 15.25 7V10C15.25 10.1164 15.2771 10.2313 15.3292 10.3354L17.4648 14.6067C17.6126 14.9023 17.3977 15.25 17.0672 15.25H2.93274C2.6023 15.25 2.38739 14.9023 2.53516 14.6067L4.67081 10.3354Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================================
 * E. Editor Split (`Code | Split | Design`), Compose & Logcat Toolbar SVGs
 * ========================================================================= */

/** Official `expui/general/editorOnly_dark.svg` (16x16) */
export function EditorOnlyIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="10" height="1" rx="0.5" fill="currentColor" />
      <rect x="3" y="6" width="10" height="1" rx="0.5" fill="currentColor" />
      <rect x="3" y="9" width="10" height="1" rx="0.5" fill="currentColor" />
      <rect x="3" y="12" width="10" height="1" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Official `expui/general/editorPreview_dark.svg` (16x16) */
export function EditorPreviewSplitIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="3" width="5" height="1" rx="0.5" fill="currentColor" />
      <rect x="1" y="6" width="5" height="1" rx="0.5" fill="currentColor" />
      <rect x="1" y="9" width="5" height="1" rx="0.5" fill="currentColor" />
      <rect x="1" y="12" width="5" height="1" rx="0.5" fill="currentColor" />
      <path
        d="M8.5 4C8.5 3.17157 9.17157 2.5 10 2.5H13C13.8284 2.5 14.5 3.17157 14.5 4V12C14.5 12.8284 13.8284 13.5 13 13.5H10C9.17157 13.5 8.5 12.8284 8.5 12V4Z"
        stroke="currentColor"
      />
    </svg>
  );
}

/** Official `expui/general/previewOnly_dark.svg` (16x16) */
export function PreviewOnlyDesignIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" />
      <path
        d="M2.35742 9.5L4.18285 7.67457C4.56044 7.29699 5.16806 7.28268 5.563 7.64207L12.0003 13.5"
        stroke="currentColor"
      />
      <circle cx="10" cy="6" r="1.5" stroke="currentColor" />
    </svg>
  );
}

/** Official `studio/icons/compose/toolbar/run-on-device.svg` (16x16) */
export function RunPreviewOnDeviceIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 7V3H4v10h4v1H4a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v4h-1z"
        fill="currentColor"
      />
      <path
        d="M15.108 11.492a.6.6 0 01.011 1.036l-4.71 2.825a.6.6 0 01-.909-.515V9.332a.6.6 0 01.897-.522l4.71 2.682z"
        fill="#253627"
        stroke="#57965C"
        strokeLinecap="round"
      />
      <rect x="6" y="4" width="2" height="1" rx=".5" fill="currentColor" />
    </svg>
  );
}

/** Official `filter_dark.svg` (16x16) */
export function FilterFunnelIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M13.5 2.5H2.5L6.5 7.5V14L9.5 12V7.5L13.5 2.5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** Official `delete_dark.svg` (16x16) */
export function TrashDeleteIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2H9C9.55228 2 10 2.44772 10 3H6C6 2.44772 6.44772 2 7 2ZM5 3C5 1.89543 5.89543 1 7 1H9C10.1046 1 11 1.89543 11 3H13C13.5523 3 14 3.44772 14 4V5V6H13V13C13 14.1046 12.1046 15 11 15H5C3.89543 15 3 14.1046 3 13V6H2V5V4C2 3.44772 2.44772 3 3 3H5ZM11 4H10H6H5H3V5H4H12H13V4H11ZM4 6H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V6ZM6.5 7C6.22386 7 6 7.22386 6 7.5V11.5C6 11.7761 6.22386 12 6.5 12C6.77614 12 7 11.7761 7 11.5V7.5C7 7.22386 6.77614 7 6.5 7ZM9 7.5C9 7.22386 9.22386 7 9.5 7C9.77614 7 10 7.22386 10 7.5V11.5C10 11.7761 9.77614 12 9.5 12C9.22386 12 9 11.7761 9 11.5V7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official `pause_dark.svg` (16x16) */
export function PauseBarsIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="2.5" width="3" height="11" rx="0.5" stroke="currentColor" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="0.5" stroke="currentColor" />
    </svg>
  );
}

/** Official `studio/icons/logcat/toolbar/wrap-text.svg` (16x16) */
export function SoftWrapIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M1.5 3.5h13M1.5 8h10.75a2.25 2.25 0 012.25 2.25v0a2.25 2.25 0 01-2.25 2.25H8.5m0 0l2-2m-2 2l2 2m-9-2h4"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* =========================================================================
 * F. Running Devices Emulator Toolbar SVGs (`studio/icons/emulator/toolbar/`)
 * ========================================================================= */

export function EmulatorPowerIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 2.5V8M11.297 3.594C12.005 4.114 13.5 5.625 13.5 8c0 2.844-2.344 5.5-5.5 5.5A5.495 5.495 0 012.469 8c0-2.25 1.458-3.781 2.187-4.406"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmulatorVolumeUpIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.528 6.1h.211l.148-.151 2.641-2.717v9.536l-2.641-2.716-.148-.152H2.03a.5.5 0 01-.5-.5V6.6a.5.5 0 01.5-.5h2.5z"
        stroke="currentColor"
      />
      <path
        d="M11.525 2.809a6.362 6.362 0 012.172 4.828c0 2.312-1.14 3.914-2.172 4.851M9.504 4.918a3.483 3.483 0 011.297 2.719c0 1.5-.875 2.375-1.297 2.718"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmulatorVolumeDownIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.528 6.1h.211l.148-.151 2.641-2.717v9.536l-2.641-2.716-.148-.152H2.03a.5.5 0 01-.5-.5V6.6a.5.5 0 01.5-.5h2.5z"
        stroke="currentColor"
      />
      <path
        d="M9.504 4.918a3.483 3.483 0 011.297 2.719c0 1.5-.875 2.375-1.297 2.718"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmulatorRotateLeftIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M11.248 2.566a.5.5 0 00-.496.868l.496-.868zM13.5 2h-3v1h3V2zm-3.5.5v3h1v-3h-1zM11 3c1.6 1 3 2.5 3 5.5s-1.2 4-3.3 4.8"
        stroke="#548AF7"
        strokeLinecap="round"
      />
      <path d="M8.5 3v10a.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5h6a.5.5 0 01.5.5z" stroke="currentColor" strokeLinecap="round" />
      <rect x="4" y="4" width="2" height="1" rx=".5" fill="currentColor" />
    </svg>
  );
}

export function EmulatorRotateRightIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M2.5 2h3v1h-3V2zm3.5.5v3H5v-3h1zM5 3c-1.6 1-3 2.5-3 5.5s1.2 4 3.3 4.8"
        stroke="#548AF7"
        strokeLinecap="round"
      />
      <path d="M14.5 3v10a.5.5 0 01-.5.5H8a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5h6a.5.5 0 01.5.5z" stroke="currentColor" strokeLinecap="round" />
      <rect x="10" y="4" width="2" height="1" rx=".5" fill="currentColor" />
    </svg>
  );
}

export function EmulatorFoldIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.5 2.5h-9a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-9a1 1 0 00-1-1z"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <rect x="7.479" y="2.014" width="1.019" height="2.994" rx=".51" fill="currentColor" />
      <rect x="7.479" y="11.006" width="1.019" height="2.929" rx=".51" fill="currentColor" />
      <rect x="7.479" y="5.972" width="1.019" height="4.035" rx=".51" fill="currentColor" />
    </svg>
  );
}

export function EmulatorBackIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.816 7.563l5.941-3.3a.5.5 0 01.743.437v6.6a.5.5 0 01-.743.438l-5.94-3.3-.244.436.243-.437a.5.5 0 010-.874z"
        stroke="currentColor"
      />
    </svg>
  );
}

export function EmulatorHomeIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="4.5" stroke="currentColor" />
    </svg>
  );
}

export function EmulatorOverviewIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" rx=".5" stroke="currentColor" />
    </svg>
  );
}

export function EmulatorScreenshotIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="1.5" stroke="currentColor" />
      <rect x="1" y="1" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="1" y="1" width="1" height="4" rx=".5" fill="currentColor" />
      <rect x="11" y="1" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="1" y="14" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="11" y="14" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="14" y="11" width="1" height="4" rx=".5" fill="currentColor" />
      <rect x="1" y="11" width="1" height="4" rx=".5" fill="currentColor" />
      <rect x="14" y="1" width="1" height="4" rx=".5" fill="currentColor" />
      <path
        d="M10.309 4.5l.138.276.362.724h.691a1 1 0 011 1v4a1 1 0 01-1 1h-7a1 1 0 01-1-1v-4a1 1 0 011-1h.691l.362-.724.138-.276h4.618z"
        stroke="currentColor"
      />
    </svg>
  );
}

export function EmulatorRecordIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="1" y="1" width="1" height="4" rx=".5" fill="currentColor" />
      <rect x="11" y="1" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="1" y="14" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="11" y="14" width="4" height="1" rx=".5" fill="currentColor" />
      <rect x="14" y="11" width="1" height="4" rx=".5" fill="currentColor" />
      <rect x="1" y="11" width="1" height="4" rx=".5" fill="currentColor" />
      <rect x="14" y="1" width="1" height="4" rx=".5" fill="currentColor" />
      <circle cx="8" cy="8" r="3.5" fill="#402929" stroke="#DB5C5C" />
    </svg>
  );
}

export function EmulatorSnapshotsIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M8 10.5a.5.5 0 01-1 0V7h3.5a.5.5 0 010 1H8v2.5z" fill="currentColor" />
      <path
        d="M2.7 2a.5.5 0 011 0v1.816a6 6 0 11-1.119 6.761.5.5 0 11.902-.43A5 5 0 104.43 4.5H6.2a.5.5 0 110 1H2.7V2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function EmulatorHardwareInputIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path fill="currentColor" d="M5 8h4v1H5zM5 6h1v1H5zM4 4h1v1H4zM6 4h1v1H6zM7 6h1v1H7zM8 4h1v1H8zM10 4h1v1h-1zM9 6h1v1H9z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3H3a1 1 0 00-1 1v5a1 1 0 001 1h6v1H3a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v3h-1V4a1 1 0 00-1-1z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 13V9h1v2h1V9h1v4c0 .356-.452 1-1.5 1s-1.5-.644-1.5-1zm0-5a1 1 0 00-1 1v4c0 1.105 1.12 2 2.5 2s2.5-.895 2.5-2V9a1 1 0 00-1-1h-3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CheckGreenIcon({ size = 14, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3.2 8.4L6.4 11.6L12.8 4.6" stroke="#57965C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningTriangleIcon({ size = 14, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M7.35 3.1C7.65 2.58 8.35 2.58 8.65 3.1L13.75 12C14.04 12.5 13.68 13.12 13.1 13.12H2.9C2.32 13.12 1.96 12.5 2.25 12L7.35 3.1Z" fill="#E0A82E" />
      <path d="M8 6.2V9.3" stroke="#1E1F22" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.8" fill="#1E1F22" />
    </svg>
  );
}

export function ErrorCircleIcon({ size = 14, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="#DB5C5C" />
      <path d="M8 4.8V8.8" stroke="#1E1F22" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.85" fill="#1E1F22" />
    </svg>
  );
}

/** Official IntelliJ New UI Java Class file icon (blue circle C) */
export function JavaFileIcon({ size = 16, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="#25324D" stroke="#548AF7" strokeWidth="1.2" />
      <path
        d="M9.9 6.5A2.2 2.2 0 006.1 8a2.2 2.2 0 003.8 1.5"
        stroke="#548AF7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SunIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.8 10.2A5.2 5.2 0 015.8 3.2a5.5 5.5 0 107 7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FilePlusIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M4 2.5h5.2L12.5 5.8V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function FolderPlusIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M2.2 4a1 1 0 011-1H6.6l1.3 1.4h4.9a1 1 0 011 1V12a1 1 0 01-1 1H3.2a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v3.6M6.2 8.8h3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadApkIcon({ size = 15, className }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M8 2.5v7.2m0 0l-2.6-2.6M8 9.7l2.6-2.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11.5v1.6a.9.9 0 00.9.9h8.2a.9.9 0 00.9-.9v-1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
