"use client";

import React from "react";

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function RunConfigAppIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="2" stroke={color} strokeWidth="1.25" />
      <path d="M2.5 5.8H13.5" stroke={color} strokeWidth="1.15" />
      <path d="M5 8.5L6.6 9.8L5 11.1" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.8 11.1H10.3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Official JetBrains ExpUI `run/run_dark.svg` (16x16) */
export function PlayOutlineIcon({ size = 16, color = "#57965C", className }: IconProps) {
  const fillColor = color === "#FFFFFF" ? "rgba(255,255,255,0.16)" : "#253627";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M13.5 7.13397C14.1667 7.51888 14.1667 8.48112 13.5 8.86602L4.5 14.0622C3.83333 14.4471 3 13.966 3 13.1962L3 2.80385C3 2.03405 3.83333 1.55292 4.5 1.93782L13.5 7.13397Z"
        fill={fillColor}
        stroke={color}
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function PlayFilledIcon({ size = 14, color = "#57965C", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M13.5 7.13397C14.1667 7.51888 14.1667 8.48112 13.5 8.86602L4.5 14.0622C3.83333 14.4471 3 13.966 3 13.1962L3 2.80385C3 2.03405 3.83333 1.55292 4.5 1.93782L13.5 7.13397Z"
        fill={color}
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `run/debug_dark.svg` (16x16) */
export function DebugBugIcon({ size = 16, color = "#57965C", className }: IconProps) {
  const innerFill = color === "#FFFFFF" ? "rgba(255,255,255,0.16)" : "#253627";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6907 4.4347C10.6974 4.35728 10.7008 4.27899 10.7008 4.2C10.7008 2.70883 9.49195 1.5 8.00078 1.5C6.50961 1.5 5.30078 2.70883 5.30078 4.2C5.30078 4.27871 5.30416 4.35672 5.3108 4.43387C4.83909 4.6943 4.43389 5.06042 4.12714 5.5003L2.0178 4.36019C1.77487 4.22888 1.4715 4.31937 1.34019 4.5623C1.20889 4.80523 1.29938 5.1086 1.5423 5.2399L3.67822 6.39438C3.5626 6.74191 3.5 7.11364 3.5 7.5V8.50006H1C0.723858 8.50006 0.5 8.72392 0.5 9.00006C0.5 9.2762 0.723858 9.50006 1 9.50006H3.5V10C3.5 10.4892 3.57807 10.9602 3.72243 11.4012L1.52989 12.667C1.29075 12.8051 1.20881 13.1109 1.34688 13.3501C1.48495 13.5892 1.79075 13.6711 2.02989 13.5331L4.14017 12.3147C4.92703 13.624 6.36122 14.5 8 14.5C9.63821 14.5 11.072 13.6246 11.859 12.3161L13.967 13.5331C14.2061 13.6712 14.5119 13.5893 14.65 13.3501C14.7881 13.111 14.7061 12.8052 14.467 12.6671L12.2771 11.4028C12.4217 10.9613 12.5 10.4898 12.5 10V9.49982H15C15.2761 9.49982 15.5 9.27596 15.5 8.99982C15.5 8.72367 15.2761 8.49982 15 8.49982H12.5V7.5C12.5 7.11367 12.4374 6.74197 12.3218 6.39447L14.4551 5.23979C14.698 5.10835 14.7883 4.80492 14.6569 4.56207C14.5254 4.31922 14.222 4.2289 13.9791 4.36035L11.8729 5.50036C11.5665 5.06092 11.1618 4.69509 10.6907 4.4347ZM6.30577 4.06885C6.53015 4.02369 6.76231 4 7 4H9C9.23825 4 9.47094 4.02381 9.69582 4.06917C9.62902 3.19142 8.89564 2.5 8.00078 2.5C7.10603 2.5 6.37272 3.19125 6.30577 4.06885ZM4.5 7.5C4.5 6.11929 5.61929 5 7 5H9C10.3807 5 11.5 6.11929 11.5 7.5V10C11.5 11.933 9.933 13.5 8 13.5C6.067 13.5 4.5 11.933 4.5 10V7.5Z"
        fill={color}
      />
      <path
        d="M7 4C6.76231 4 6.53015 4.02369 6.30577 4.06885C6.37272 3.19125 7.10603 2.5 8.00078 2.5C8.89564 2.5 9.62902 3.19142 9.69582 4.06917C9.47094 4.02381 9.23825 4 9 4H7Z"
        fill={innerFill}
      />
      <path
        d="M7 5C5.61929 5 4.5 6.11929 4.5 7.5V10C4.5 11.933 6.067 13.5 8 13.5C9.933 13.5 11.5 11.933 11.5 10V7.5C11.5 6.11929 10.3807 5 9 5H7Z"
        fill={innerFill}
      />
    </svg>
  );
}

export function MoreVerticalIcon({ size = 16, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="3.6" r="1.1" fill={color} />
      <circle cx="8" cy="8" r="1.1" fill={color} />
      <circle cx="8" cy="12.4" r="1.1" fill={color} />
    </svg>
  );
}

export function MoreHorizontalIcon({ size = 16, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="3.6" cy="8" r="1.1" fill={color} />
      <circle cx="8" cy="8" r="1.1" fill={color} />
      <circle cx="12.4" cy="8" r="1.1" fill={color} />
    </svg>
  );
}

export function CodeWithMeIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="6.8" cy="5.1" r="2.3" stroke={color} strokeWidth="1.25" />
      <path d="M2.6 13C2.8 10.6 4.5 9.3 6.8 9.3C7.9 9.3 8.9 9.6 9.6 10.2" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
      <path d="M12.2 9.8V13.8M10.2 11.8H14.2" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

/** Official JetBrains ExpUI `general/search@20x20_dark.svg` (20x20) */
export function SearchEverywhereIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.5 9C14.5 12.0376 12.0376 14.5 9 14.5C5.96243 14.5 3.5 12.0376 3.5 9C3.5 5.96243 5.96243 3.5 9 3.5C12.0376 3.5 14.5 5.96243 14.5 9ZM13.3584 14.478C12.1625 15.4307 10.6478 16 9 16C5.13401 16 2 12.866 2 9C2 5.13401 5.13401 2 9 2C12.866 2 16 5.13401 16 9C16 10.6478 15.4307 12.1625 14.478 13.3584C14.5086 13.3812 14.5379 13.4065 14.5657 13.4343L18.5657 17.4343C18.8781 17.7467 18.8781 18.2533 18.5657 18.5657C18.2533 18.8781 17.7467 18.8781 17.4343 18.5657L13.4343 14.5657C13.4065 14.5379 13.3812 14.5086 13.3584 14.478Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `general/settings@20x20_dark.svg` (20x20) */
export function SettingsGearIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.96446 5.54781C3.63344 5.99572 3.35137 6.48132 3.12584 6.99671L4.14987 8.72634C4.61489 9.51177 4.61489 10.4882 4.14987 11.2736L3.12584 13.0033C3.35137 13.5187 3.63344 14.0043 3.96446 14.4522L5.9723 14.4302C6.88501 14.4202 7.73062 14.9084 8.17831 15.7038L9.16331 17.4539C9.43778 17.4843 9.71717 17.5 10.0007 17.5C10.2843 17.5 10.5637 17.4843 10.8382 17.4539L11.8232 15.7038C12.2709 14.9084 13.1165 14.4202 14.0292 14.4302L16.037 14.4522C16.368 14.0043 16.6501 13.5186 16.8756 13.0033L15.8516 11.2736C15.3866 10.4882 15.3866 9.51177 15.8516 8.72634L16.8756 6.99671C16.6501 6.48132 16.368 5.99572 16.037 5.54781L14.0292 5.56981C13.1165 5.57981 12.2709 5.09159 11.8232 4.29617L10.8382 2.5461C10.5637 2.51567 10.2843 2.5 10.0007 2.5C9.71717 2.5 9.43779 2.51567 9.16332 2.54609L8.17831 4.29617C7.73062 5.09159 6.88501 5.57981 5.9723 5.56981L3.96446 5.54781ZM13.6234 10C13.6234 12.0008 12.0015 13.6227 10.0007 13.6227C7.99996 13.6227 6.37802 12.0008 6.37802 10C6.37802 7.99924 7.99996 6.37729 10.0007 6.37729C12.0015 6.37729 13.6234 7.99923 13.6234 10ZM5.98873 4.0699C6.35382 4.0739 6.69206 3.87861 6.87114 3.56044L7.98752 1.57695C8.13019 1.32346 8.37572 1.14153 8.66343 1.09868C9.09976 1.03368 9.54632 1 10.0007 1C10.4552 1 10.9017 1.03368 11.3381 1.09868C11.6258 1.14154 11.8713 1.32346 12.014 1.57695L13.1303 3.56044C13.3094 3.87861 13.6477 4.0739 14.0127 4.0699L16.2875 4.04498C16.5778 4.0418 16.8576 4.16301 17.0387 4.38992C17.594 5.08559 18.0482 5.8654 18.3793 6.70716C18.4856 6.9775 18.4507 7.28065 18.3027 7.53062L17.1424 9.49053C16.9563 9.8047 16.9563 10.1953 17.1424 10.5094L18.3027 12.4694C18.4507 12.7193 18.4856 13.0225 18.3793 13.2928C18.0482 14.1346 17.594 14.9144 17.0387 15.6101C16.8576 15.837 16.5778 15.9582 16.2875 15.955L14.0128 15.9301C13.6477 15.9261 13.3094 16.1214 13.1303 16.4395L12.014 18.423C11.8713 18.6765 11.6258 18.8584 11.3381 18.9013C10.9017 18.9663 10.4552 19 10.0007 19C9.54631 19 9.09976 18.9663 8.66343 18.9013C8.37571 18.8584 8.13018 18.6765 7.98751 18.423L6.87114 16.4395C6.69206 16.1214 6.35382 15.9261 5.98873 15.9301L3.71401 15.955C3.4237 15.9582 3.14389 15.837 2.96277 15.6101C2.40752 14.9144 1.95325 14.1346 1.62217 13.2928C1.51585 13.0225 1.55076 12.7193 1.69876 12.4694L2.85913 10.5094C3.04514 10.1953 3.04514 9.8047 2.85913 9.49053L1.69876 7.53061C1.55076 7.28064 1.51584 6.97749 1.62217 6.70715C1.95325 5.86539 2.40751 5.08558 2.96276 4.38992C3.14388 4.16301 3.42369 4.0418 3.71401 4.04498L5.98873 4.0699ZM12.1234 10C12.1234 11.1723 11.1731 12.1227 10.0007 12.1227C8.82839 12.1227 7.87802 11.1723 7.87802 10C7.87802 8.82766 8.82839 7.87729 10.0007 7.87729C11.1731 7.87729 12.1234 8.82766 12.1234 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `toolwindows/vcs@20x20_dark.svg` (20x20) */
export function GitBranchIcon({ size = 17, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.5 4.5C7.5 5.60457 6.60457 6.5 5.5 6.5C4.39543 6.5 3.5 5.60457 3.5 4.5C3.5 3.39543 4.39543 2.5 5.5 2.5C6.60457 2.5 7.5 3.39543 7.5 4.5ZM9 4.5C9 6.17556 7.82259 7.57612 6.25 7.91946L6.25 13.25H9.5C10.2092 13.25 10.7035 13.2496 11.0904 13.2232C11.4706 13.1973 11.692 13.1487 11.861 13.0787C12.4124 12.8504 12.8504 12.4124 13.0787 11.861C13.1487 11.692 13.1973 11.4706 13.2232 11.0904C13.244 10.7848 13.2487 10.4121 13.2497 9.91939C11.6773 9.57594 10.5 8.17546 10.5 6.5C10.5 4.567 12.067 3 14 3C15.933 3 17.5 4.567 17.5 6.5C17.5 8.17565 16.3225 9.57626 14.7498 9.91951C14.7488 10.4185 14.7439 10.8379 14.7197 11.1925C14.6886 11.6491 14.6229 12.0528 14.4645 12.4351C14.0839 13.3539 13.3539 14.0839 12.4351 14.4645C12.0528 14.6229 11.6491 14.6886 11.1925 14.7197C10.7485 14.75 10.203 14.75 9.52664 14.75H9.5H6.25V18C6.25 18.4142 5.91421 18.75 5.5 18.75C5.08579 18.75 4.75 18.4142 4.75 18L4.75 7.91946C3.17741 7.57612 2 6.17556 2 4.5C2 2.567 3.567 1 5.5 1C7.433 1 9 2.567 9 4.5ZM16 6.5C16 7.60457 15.1046 8.5 14 8.5C12.8954 8.5 12 7.60457 12 6.5C12 5.39543 12.8954 4.5 14 4.5C15.1046 4.5 16 5.39543 16 6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className} aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 12, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 3L7.5 6L4.5 9" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Official JetBrains ExpUI `toolwindows/project@20x20_dark.svg` (20x20) */
export function ProjectFolderStripeIcon({ size = 18, color = "#FFFFFF", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        d="M10.5199 5.57617L10.7285 5.75H11H17C17.6904 5.75 18.25 6.30964 18.25 7V15.1667C18.25 16.0671 17.553 16.75 16.75 16.75H3.25C2.44705 16.75 1.75 16.0671 1.75 15.1667V4.83333C1.75 3.93294 2.44705 3.25 3.25 3.25H7.63795C7.69643 3.25 7.75307 3.2705 7.798 3.30794L10.5199 5.57617Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `toolwindows/run@20x20_dark.svg` (20x20) */
export function RunStripeIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        d="M16.125 11.0825L5.625 17.1447C4.79167 17.6258 3.75 17.0244 3.75 16.0622L3.75 3.93782C3.75 2.97557 4.79167 2.37417 5.625 2.85529L16.125 8.91747C16.9583 9.39859 16.9583 10.6014 16.125 11.0825Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function CommitStripeIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path d="M2.2 10H6.6M13.4 10H17.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function StructureStripeIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <rect x="3" y="3" width="5.5" height="5.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.75" cy="14.25" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Official JetBrains ExpUI `toolwindows/build@20x20_dark.svg` (20x20) */
export function BuildHammerIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.25 1C4.44891 1 4.63962 1.07907 4.78027 1.21973L5.56055 2H6.43945L7.21973 1.21973L7.33398 1.12598C7.45628 1.04445 7.60085 1 7.75 1H13.125C14.9473 1 16.4277 1.87993 17.4346 3.08105C18.4322 4.27143 19 5.81492 19 7.25C19 7.51735 18.8572 7.76425 18.626 7.89844C18.3948 8.03247 18.11 8.0339 17.8779 7.90137L15.4258 6.5H14.0605L13 7.56055V18.25C13 18.6642 12.6642 19 12.25 19H7.75C7.33579 19 7 18.6642 7 18.25V7.56055L6.43945 7H5.56055L4.78027 7.78027C4.63962 7.92093 4.44891 8 4.25 8H1.75C1.33579 8 1 7.66421 1 7.25V1.75C1 1.33579 1.33579 1 1.75 1H4.25ZM8.5 17.5H11.5V8H8.5V17.5ZM2.5 6.5H3.93945L4.71973 5.71973L4.83398 5.62598C4.95628 5.54445 5.10085 5.5 5.25 5.5H6.75C6.94891 5.5 7.13962 5.57907 7.28027 5.71973L8.06055 6.5H11.9395L13.2197 5.21973L13.334 5.12598C13.4563 5.04445 13.6008 5 13.75 5H15.625C15.7555 5 15.8838 5.03392 15.9971 5.09863L17.2637 5.82227C17.0602 5.19249 16.7287 4.57423 16.2842 4.04395C15.5098 3.12029 14.4276 2.5 13.125 2.5H8.06055L7.28027 3.28027C7.13962 3.42093 6.94891 3.5 6.75 3.5H5.25C5.05109 3.5 4.86038 3.42093 4.71973 3.28027L3.93945 2.5H2.5V6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `terminal@20x20_dark.svg` (20x20) */
export function TerminalStripeIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
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

/** Official JetBrains ExpUI `toolwindows/problems@20x20_dark.svg` (20x20) */
export function ProblemsStripeIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        d="M10 18.25C14.5563 18.25 18.25 14.5563 18.25 10C18.25 5.44365 14.5563 1.75 10 1.75C5.44365 1.75 1.75 5.44365 1.75 10C1.75 14.5563 5.44365 18.25 10 18.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9.99999 15.2C10.6627 15.2 11.2 14.6627 11.2 14C11.2 13.3372 10.6627 12.8 9.99999 12.8C9.33725 12.8 8.79999 13.3372 8.79999 14C8.79999 14.6627 9.33725 15.2 9.99999 15.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `toolwindows/notifications@20x20_dark.svg` (20x20) */
export function NotificationsBellIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
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

export function DatabaseCylinderIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <ellipse cx="10" cy="5.2" rx="6" ry="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5.2V14.8C4 16 6.7 17 10 17C13.3 17 16 16 16 14.8V5.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10C4 11.2 6.7 12.2 10 12.2C13.3 12.2 16 11.2 16 10" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function MavenMIcon({ size = 18, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={{ color }} aria-hidden="true">
      <path
        d="M3.2 14.5L5.4 6.5H7.2L6.6 8.5C7.6 7.1 8.8 6.4 10.1 6.4C11.3 6.4 12.1 7.1 12.2 8.4C13.2 7.1 14.4 6.4 15.7 6.4C17.2 6.4 17.9 7.5 17.4 9.5L16.1 14.5H14.3L15.6 9.7C15.8 8.6 15.4 8 14.5 8C13.5 8 12.4 9 11.9 10.7L10.9 14.5H9.1L10.4 9.7C10.6 8.6 10.2 8 9.3 8C8.3 8 7.2 9 6.7 10.7L5.6 14.5H3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ProjectLocateIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="4.5" stroke={color} strokeWidth="1.2" />
      <path d="M8 1.8V4.2M8 11.8V14.2M1.8 8H4.2M11.8 8H14.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.2" fill={color} />
    </svg>
  );
}

export function ExpandAllIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M5.2 6.2L8 3.4L10.8 6.2" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.2 9.8L8 12.6L10.8 9.8" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CollapseAllIcon({ size = 16, color = "#CED0D6", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M5.2 3.6L8 6.4L10.8 3.6" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.2 12.4L8 9.6L10.8 12.4" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HideMinimizeIcon({ size = 16, color = "#9DA0A8", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 8H12.5" stroke={color} strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

/** Official JetBrains ExpUI `nodes/folder_dark.svg` & `nodes/sourceRoot_dark.svg` (16x16) */
export function TreeFolderIcon({
  variant = "default",
  size = 16,
}: {
  variant?: "default" | "sourceRoot" | "excluded" | "package";
  size?: number;
}) {
  if (variant === "sourceRoot") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8.15132 4.35836L8.29689 4.5H8.5H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.919 13.9104 13.5 13.25 13.5H2.75C2.08955 13.5 1.5 12.919 1.5 12.1333V3.86667C1.5 3.08099 2.08955 2.5 2.75 2.5H6.03823C6.16847 2.5 6.29357 2.55082 6.38691 2.64164L8.15132 4.35836Z"
          fill="#25324D"
          stroke="#548AF7"
        />
      </svg>
    );
  }
  if (variant === "excluded") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
          fill="#3D3428"
          stroke="#C78A4A"
        />
      </svg>
    );
  }
  if (variant === "package") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
          fill="#43454A"
          stroke="#CED0D6"
        />
        <circle cx="8" cy="9" r="1.4" stroke="#CED0D6" strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8.10584 4.34613L8.25344 4.5H8.46667H13C13.8284 4.5 14.5 5.17157 14.5 6V12.1333C14.5 12.9529 13.932 13.5 13.3667 13.5H2.63333C2.06804 13.5 1.5 12.9529 1.5 12.1333V3.86667C1.5 3.04707 2.06804 2.5 2.63333 2.5H6.1217C6.25792 2.5 6.38824 2.55557 6.48253 2.65387L8.10584 4.34613Z"
        fill="#43454A"
        stroke="#CED0D6"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `nodes/class_dark.svg` (16x16) */
export function JavaClassIcon({ size = 16, showRunBadge = false }: { size?: number; showRunBadge?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="#25324D" stroke="#548AF7" />
      <path
        d="M8.13295 11.5C9.61223 11.5 10.8836 10.6105 11.2075 9.33909H10.2213C9.90229 10.0739 9.11914 10.6057 8.13295 10.6057C6.77936 10.6057 5.80284 9.51796 5.80284 8C5.80284 6.48204 6.77936 5.39434 8.13295 5.39434C9.11914 5.39434 9.90229 5.92611 10.2213 6.66091H11.2075C10.8836 5.3895 9.61223 4.5 8.13295 4.5C6.21859 4.5 4.79248 5.99378 4.79248 8C4.79248 10.0062 6.21859 11.5 8.13295 11.5Z"
        fill="#548AF7"
      />
      {showRunBadge && (
        <path d="M10.5 10.1L14.8 12.6L10.5 15.1V10.1Z" fill="#57965C" stroke="#1E1F22" strokeWidth="0.6" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function MethodBreadcrumbIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="#DB5860" fillOpacity="0.2" stroke="#DB5860" strokeWidth="1.15" />
      <path
        d="M5 10.3V6.5C5 6.5 5.6 5.9 6.3 5.9C7 5.9 7.6 6.4 7.7 7.1C8 6.3 8.6 5.9 9.3 5.9C10.2 5.9 10.8 6.5 10.8 7.5V10.3"
        stroke="#DB5860"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GitIgnoreIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="#9DA0A8" strokeWidth="1.2" />
      <path d="M4.2 11.8L11.8 4.2" stroke="#9DA0A8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ModuleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1.8" stroke="#CED0D6" strokeWidth="1.2" />
      <rect x="6.5" y="6.5" width="4.4" height="4.4" rx="0.8" stroke="#CED0D6" strokeWidth="1.1" />
    </svg>
  );
}

export function ExternalLibrariesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.6" y="3" width="2.8" height="10" rx="0.7" stroke="#CED0D6" strokeWidth="1.15" />
      <rect x="6.6" y="2.5" width="2.8" height="10.5" rx="0.7" stroke="#CED0D6" strokeWidth="1.15" />
      <path d="M10.7 4.2L13.1 3.7L14.3 12.6L11.9 13.1L10.7 4.2Z" stroke="#CED0D6" strokeWidth="1.15" strokeLinejoin="round" />
    </svg>
  );
}

export function ScratchesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5H12.5M3 8H8.2M3 11.5H7.2" stroke="#CED0D6" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="11.4" cy="10.6" r="2.9" stroke="#548AF7" strokeWidth="1.15" />
      <path d="M11.4 9.2V10.7L12.4 11.3" stroke="#548AF7" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Official JetBrains ExpUI `run/rerun_dark.svg` (16x16) */
export function RerunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 9.50215C9 8.32441 10.2951 7.60608 11.2942 8.22967L15.2962 10.7275C16.2372 11.3149 16.2372 12.6851 15.2962 13.2725L11.2942 15.7703C10.2951 16.3939 9 15.6756 9 14.4978V9.50215ZM10.7647 9.07799C10.4317 8.87013 10 9.10957 10 9.50215V14.4978C10 14.8904 10.4317 15.1298 10.7647 14.922L14.7667 12.4241C15.0804 12.2284 15.0804 11.7716 14.7667 11.5758L10.7647 9.07799Z"
        fill="#57965C"
      />
      <path
        d="M10 9.50217C10 9.10959 10.4317 8.87015 10.7647 9.07801L14.7667 11.5758C15.0804 11.7716 15.0804 12.2284 14.7667 12.4242L10.7647 14.922C10.4317 15.1299 10 14.8904 10 14.4978V9.50217Z"
        fill="#253627"
      />
      <path
        d="M14 1.5C14 1.22386 13.7761 1 13.5 1C13.2239 1 13 1.22386 13 1.5V4.68235C11.9256 3.06631 10.0877 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14V13C5.23858 13 3 10.7614 3 8C3 5.23858 5.23858 3 8 3C9.63527 3 11.0878 3.78495 12.0005 5H9.5C9.22386 5 9 5.22386 9 5.5C9 5.77614 9.22386 6 9.5 6H14V1.5Z"
        fill="#CED0D6"
      />
    </svg>
  );
}

/** Official JetBrains ExpUI `run/stop_dark.svg` (16x16) */
export function StopSquareIcon({ size = 16, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

export function ThreadDumpCameraIcon({ size = 16, color = "#CED0D6" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 5.4C2.5 4.85 2.95 4.4 3.5 4.4H5.2L6.1 3.2H9.9L10.8 4.4H12.5C13.05 4.4 13.5 4.85 13.5 5.4V11.8C13.5 12.35 13.05 12.8 12.5 12.8H3.5C2.95 12.8 2.5 12.35 2.5 11.8V5.4Z"
        stroke={color}
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8.5" r="2.2" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function SoftWrapIcon({ size = 16, color = "#CED0D6" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.2H13.2M2.5 11.8H6.5" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
      <path
        d="M2.5 8H11.3C12.6 8 13.5 8.85 13.5 10C13.5 11.15 12.6 11.8 11.3 11.8H9.3"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path d="M10.4 10.4L8.8 11.8L10.4 13.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckGreenIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.2 8.4L6.4 11.6L12.8 4.6" stroke="#57965C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningTriangleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M7.35 3.1C7.65 2.58 8.35 2.58 8.65 3.1L13.75 12C14.04 12.5 13.68 13.12 13.1 13.12H2.9C2.32 13.12 1.96 12.5 2.25 12L7.35 3.1Z"
        fill="#E0A82E"
      />
      <path d="M8 6.2V9.3" stroke="#1E1F22" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.8" fill="#1E1F22" />
    </svg>
  );
}

export function ErrorCircleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="#DB5C5C" />
      <path d="M8 4.8V8.8" stroke="#1E1F22" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.85" fill="#1E1F22" />
    </svg>
  );
}

export function LockPadlockIcon({ size = 14, locked = false, color = "#9DA0A8" }: { size?: number; locked?: boolean; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="7.2" width="9" height="6.2" rx="1.3" stroke={color} strokeWidth="1.2" />
      {locked ? (
        <path d="M5.5 7.2V5.3C5.5 3.9 6.6 2.8 8 2.8C9.4 2.8 10.5 3.9 10.5 5.3V7.2" stroke={color} strokeWidth="1.2" />
      ) : (
        <path d="M5.5 7.2V5.1C5.5 3.7 6.6 2.6 8 2.6C9.2 2.6 10.2 3.4 10.4 4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function ReaderOffIcon({ size = 14, color = "#9DA0A8" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8C3.9 5.5 5.8 4.3 8 4.3C10.2 4.3 12.1 5.5 13.5 8C12.1 10.5 10.2 11.7 8 11.7C5.8 11.7 3.9 10.5 2.5 8Z" stroke={color} strokeWidth="1.15" />
      <circle cx="8" cy="8" r="1.6" stroke={color} strokeWidth="1.15" />
      <path d="M3 13L13 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpSmallIcon({ size = 12, color = "#868A91" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 9.5V2.8M3.3 5.3L6 2.6L8.7 5.3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownSmallIcon({ size = 12, color = "#868A91" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 2.5V9.2M3.3 6.7L6 9.4L8.7 6.7" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
