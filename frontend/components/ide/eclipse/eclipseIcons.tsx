"use client";

import React, { useId } from "react";

interface IconProps {
  size?: number;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}

function useSvgUid(prefix: string): string {
  const raw = useId().replace(/[^a-zA-Z0-9_]/g, "");
  return `${prefix}_${raw}`;
}

export function EclipseGlobeIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_globe");
  return (
    <svg width={size} height={size} viewBox="0 0 1.3617021 1.3617021" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_SVGID_1_`} gradientUnits="userSpaceOnUse" x1="131.3853" y1="358.5762" x2="131.3853" y2="432.21109" gradientTransform="matrix(0.0110565,0,0,-0.01443215,-0.70160043,6.6977577)">
          <stop offset="0.3033" style={{ stopColor: "#473788" }} />
          <stop offset="0.872" style={{ stopColor: "#2C2255" }} />
        </linearGradient>
        <linearGradient id={`${uid}_SVGID_2_`} gradientUnits="userSpaceOnUse" x1="131.3853" y1="358.5752" x2="131.3853" y2="432.21011" gradientTransform="matrix(0.01105612,0,0,-0.01443458,-0.70156852,6.704854)">
          <stop offset="0.3033" style={{ stopColor: "#473788" }} />
          <stop offset="0.872" style={{ stopColor: "#2C2255" }} />
        </linearGradient>
        <linearGradient id={`${uid}_SVGID_3_`} gradientUnits="userSpaceOnUse" x1="131.3853" y1="358.57709" x2="131.3853" y2="432.2084" gradientTransform="matrix(0.01130076,0,0,-0.01068261,-0.7329326,5.1673425)">
          <stop offset="0.3033" style={{ stopColor: "#473788" }} />
          <stop offset="0.8631" style={{ stopColor: "#2C2255" }} />
        </linearGradient>
      </defs>
      <g>
        <path d="m 0.31439266,0.59574465 h -0.0967113 c -0.003538,0.0277386 -0.005949,0.0560544 -0.007043,0.085092 h 0.1149434 0.0576597 0.83227824 0.07597 c -0.00111,-0.0290374 -0.00351,-0.0573534 -0.00708,-0.085092" style={{ fill: "#2c2255", strokeWidth: "0.144573" }} />
        <path d="m 0.21063836,0.7659574 c 0.001095,0.0290569 0.003494,0.0573776 0.007043,0.0851063 h 0.10054431 0.0762098 0.81426083 0.07569 c 0.00356,-0.0277288 0.00599,-0.0560495 0.0071,-0.0851063" style={{ fill: "#2c2255", strokeWidth: "0.144583" }} />
        <path style={{ fill: "#2c2255", strokeWidth: "0.133163" }} d="M 0.41454626,0.89361769 H 0.22814691 c 0.0246807,0.0812411 0.0704785,0.15405391 0.13752861,0.21840611 0.1068924,0.1025848 0.23542602,0.153808 0.38573431,0.153808 0.0300462,0 0.0591574,-0.00215 0.0874334,-0.00624 C 0.95205875,1.2431968 1.0511805,1.1940768 1.136109,1.1120239 1.2035931,1.0476919 1.2497144,0.97485901 1.2745839,0.89361777 H 1.1989402 1.0883294 Z" />
        <path style={{ fill: "#2c2255", strokeWidth: "0.133163" }} d="M 1.2668657,0.54246809 C 1.2420234,0.46099363 1.1959007,0.38783112 1.1283973,0.32302332 1.0437092,0.24173051 0.94488598,0.19295901 0.83206131,0.17654876 c -0.0285368,-0.004154 -0.0579314,-0.006336 -0.0882827,-0.006336 -0.15027704,0 -0.2787951,0.0509506 -0.38565413,0.15281002 -0.0670578,0.0648077 -0.11286932,0.13797029 -0.13753331,0.21944478" />
        <path d="M 0.41865313,0.51063829 H 0.2361419 c -0.005999,0.0277109 -0.009869,0.0561367 -0.0135847,0.0851063 h 0.0940013 0.0800416 0.7131853 0.1010032 0.07219 c -0.00373,-0.0289542 -0.00853,-0.0573799 -0.014511,-0.0851063" style={{ fill: "#ffffff", strokeWidth: "0.148492" }} />
        <path d="m 1.1188859,0.68083664 c -0.00181,-0.0291673 -0.00558,-0.0576132 -0.011189,-0.085092 H 0.39444174 c -0.005617,0.0274644 -0.009387,0.0559101 -0.0112003,0.085092 z" style={{ fill: `url(#${uid}_SVGID_1_)`, strokeWidth: "0.144573" }} />
        <path d="M 1.118854,0.7659574 H 0.38324642 c 0.001813,0.0291723 0.005561,0.0576229 0.0111888,0.0851063 H 1.1076762 c 0.00562,-0.0274835 0.00936,-0.055934 0.011178,-0.0851063 z" style={{ fill: `url(#${uid}_SVGID_2_)`, strokeWidth: "0.144583" }} />
        <path d="m 0.75182905,1.0995883 c 0.15139629,0 0.28189755,-0.084318 0.34199495,-0.2059713 H 0.40983415 c 0.0600975,0.1216535 0.19059862,0.2059713 0.3419949,0.2059713 z" style={{ fill: `url(#${uid}_SVGID_3_)`, strokeWidth: "0.133164" }} />
        <path d="m 0.32109283,0.76595731 h 0.0539474 0.73681757 0.096794 0.073531 c 5.081e-4,-0.0135369 7.953e-4,-0.0271669 7.953e-4,-0.0408902 0,-0.0148423 -3.867e-4,-0.0295603 -9.867e-4,-0.044216 H 1.2086406 1.1118467 0.3750292 0.31727101 0.20311323 c -5.9648e-4,0.0146403 -9.8376e-4,0.0293739 -9.8376e-4,0.044216 0,0.0137233 2.8719e-4,0.0273534 7.9529e-4,0.0408902 z" style={{ fill: "#ffffff", strokeWidth: "0.149916" }} />
        <path d="m 1.2019969,0.85106376 h -0.098427 -0.69498572 -0.0742716 -0.098137 c 0.003524,0.0289542 0.007533,0.0573645 0.0132811,0.0851064 h 0.18059658 0.65204764 0.1070448 0.069715 c 0.00573,-0.0277263 0.010369,-0.0561367 0.013904,-0.0851064 z" style={{ fill: "#ffffff", strokeWidth: "0.146814" }} />
        <path d="m 0.1666079,0.71588183 c 0,-0.29724773 0.21917824,-0.54422903 0.50430771,-0.58766974 -0.007074,-2.6475e-4 -0.0141825,-5.5252e-4 -0.0213245,-5.5252e-4 -0.31996972,0 -0.57937867,0.26336078 -0.57937867,0.58822226 0,0.32487317 0.25939765,0.58822237 0.57937867,0.58822237 0.007165,0 0.0142729,-2.762e-4 0.0213697,-5.409e-4 C 0.38578614,1.2601224 0.1666079,1.0131411 0.1666079,0.71588183 Z" style={{ fill: "#f7941e", strokeWidth: "0.133164" }} />
        <ellipse style={{ fill: "none", fillRule: "evenodd", stroke: "#000000", strokeWidth: "0.0362633", strokeLinecap: "square", strokeMiterlimit: "3", strokeOpacity: 0.921569 }} cx="0.74907404" cy="0.71443456" rx="0.54395574" ry="0.54395568" />
      </g>
    </svg>
  );
}

export function NewWizardIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 2.5h7.5l2.5 2.5v8.5H2z" fill="#FFFFFF" stroke="#6E7A8A" strokeWidth="1" />
      <path d="M9.5 2.5v2.5H12" fill="#DCE5F0" stroke="#6E7A8A" strokeWidth="0.9" />
      <rect x="3.8" y="6.2" width="5" height="1" fill="#9BB0C9" />
      <rect x="3.8" y="8.5" width="6.2" height="1" fill="#9BB0C9" />
      <rect x="3.8" y="10.8" width="4.4" height="1" fill="#9BB0C9" />
      {/* Yellow star / plus */}
      <path d="M12.3 1.2l0.6 1.7 1.7 0.6-1.7 0.6-0.6 1.7-0.6-1.7-1.7-0.6 1.7-0.6z" fill="#F2B705" stroke="#B57B00" strokeWidth="0.4" />
    </svg>
  );
}

export function SaveFloppyIcon({ size = 16, active = false }: IconProps) {
  const body = active ? "#4A86C8" : "#B4B9C0";
  const border = active ? "#2B568B" : "#8A9098";
  const label = active ? "#FFFFFF" : "#EAECEF";
  const metal = active ? "#D8E4F2" : "#D4D7DC";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 2h10l2 2v10H2z" fill={body} stroke={border} strokeWidth="1" strokeLinejoin="round" />
      <rect x="4.5" y="2.2" width="6" height="4.2" fill={metal} stroke={border} strokeWidth="0.6" />
      <rect x="8.2" y="2.8" width="1.4" height="2.8" fill={border} />
      <rect x="4" y="8.2" width="8" height="5.2" fill={label} stroke={border} strokeWidth="0.6" />
      <line x1="5.2" y1="10" x2="10.8" y2="10" stroke={active ? "#7599C4" : "#B0B4BA"} strokeWidth="0.8" />
      <line x1="5.2" y1="11.7" x2="9.6" y2="11.7" stroke={active ? "#7599C4" : "#B0B4BA"} strokeWidth="0.8" />
    </svg>
  );
}

export function SaveAllFloppyIcon({ size = 16, active = false }: IconProps) {
  const body = active ? "#4A86C8" : "#B4B9C0";
  const border = active ? "#2B568B" : "#8A9098";
  const backBody = active ? "#6B9DD6" : "#C7CBD1";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 1.5h8l1.8 1.8v8.2H4.5z" fill={backBody} stroke={border} strokeWidth="0.9" />
      <path d="M1.8 4.5h8.5l1.7 1.7V14H1.8z" fill={body} stroke={border} strokeWidth="1" />
      <rect x="3.8" y="4.7" width="4.8" height="3.2" fill="#E3E9F2" />
      <rect x="3.5" y="9.2" width="6.6" height="4.2" fill="#FFFFFF" />
    </svg>
  );
}

export function UserProfileIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="#1F2328" />
      <circle cx="8" cy="6" r="2.2" fill="#FFFFFF" />
      <path d="M4 12.6c0.8-2 2.2-2.9 4-2.9s3.2 0.9 4 2.9" fill="#FFFFFF" />
    </svg>
  );
}

export function PrintViewIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2.2" width="12" height="9" rx="1" fill="#F2F6FC" stroke="#4D6B8E" strokeWidth="1" />
      <rect x="3" y="3.2" width="10" height="2" fill="#3B6DA6" />
      <rect x="4" y="6.5" width="8" height="1" fill="#7089A6" />
      <rect x="4" y="8.4" width="6" height="1" fill="#7089A6" />
      <path d="M5 13.8h6l-1.2-2.2H6.2z" fill="#6E85A0" />
    </svg>
  );
}

export function SkipBreakpointsIcon({ size = 16, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.6" fill={active ? "#2B78C5" : "#4E82B4"} opacity={active ? 1 : 0.78} />
      <line x1="2.5" y1="2.5" x2="13.5" y2="13.5" stroke="#1E4B7A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DebugBugIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_dbg");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient4515`}>
          <stop style={{ stopColor: "#ffffff", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#8ebc7b", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4490`}>
          <stop style={{ stopColor: "#3c624f", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#599a85", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4484`}>
          <stop style={{ stopColor: "#3c624f", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#599a85", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4478`}>
          <stop style={{ stopColor: "#3c624f", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#599a85", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4472`}>
          <stop style={{ stopColor: "#3c624f", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#599a85", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4258`}>
          <stop style={{ stopColor: "#387a31", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#397b3b", stopOpacity: 0 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4252`}>
          <stop style={{ stopColor: "#127091", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#34818f", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4246`}>
          <stop style={{ stopColor: "#3b5f4d", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#358391", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient12717-5-0-4-3`}>
          <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#8ebc7b", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient12862-1-8-7-96-9`} id={`${uid}_linearGradient3881-0`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,0.27903302,0.27903303,0,-96.392939,-104.7384)" x1="422.42462" y1="379.27396" x2="432.86548" y2="381.80399" />
        <linearGradient id={`${uid}_linearGradient12862-1-8-7-96-9`}>
          <stop offset="0" style={{ stopColor: "#3c624f", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#599a85", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient gradientTransform="matrix(0.27903303,0,0,0.27903304,-104.76098,-96.354723)" gradientUnits="userSpaceOnUse" y2="364.92181" x2="429.94864" y1="366.81937" x1="414.86481" id={`${uid}_linearGradient12878-2-7-1-2`} href={`#${uid}_linearGradient4478`} />
        <linearGradient href={`#${uid}_linearGradient12862-1-8-7-1-9`} id={`${uid}_linearGradient3847-1`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,0.27903302,0.27903303,0,-96.353305,-104.6999)" x1="415.70352" y1="367.07635" x2="429.94864" y2="364.92181" />
        <linearGradient id={`${uid}_linearGradient12862-1-8-7-1-9`}>
          <stop offset="0" style={{ stopColor: "#3c624f", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#599a85", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient12862-1-8-7-9-7`} id={`${uid}_linearGradient3813-8`} gradientUnits="userSpaceOnUse" x1="674.84711" y1="180.63965" x2="675.20258" y2="166.79221" gradientTransform="matrix(0,0.27903302,0.24756874,0,-39.521247,-178.59954)" />
        <linearGradient id={`${uid}_linearGradient12862-1-8-7-9-7`}>
          <stop offset="0" style={{ stopColor: "#3c624f", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#599a85", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" y2="166.79221" x2="675.20258" y1="179.88475" x1="675.9187" id={`${uid}_linearGradient12876-4-0-6-7`} href={`#${uid}_linearGradient4484`} gradientTransform="matrix(0.27903303,0,0,0.24756874,-178.60364,-39.53384)" />
        <linearGradient gradientTransform="matrix(0.27903303,0,0,0.27903304,-104.60473,-96.339099)" gradientUnits="userSpaceOnUse" y2="350.94641" x2="396.21149" y1="359.4902" x1="396.0101" id={`${uid}_linearGradient12868-4-7-0-8`} href={`#${uid}_linearGradient4490`} />
        <linearGradient href={`#${uid}_linearGradient12862-1-8-7-7-5`} id={`${uid}_linearGradient3915-6`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,-0.27903302,0.27903303,0,-96.327735,115.6161)" x1="396.0101" y1="359.4902" x2="396.21149" y2="350.94641" />
        <linearGradient id={`${uid}_linearGradient12862-1-8-7-7-5`}>
          <stop offset="0" style={{ stopColor: "#3c624f", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#599a85", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4472`} id={`${uid}_linearGradient3993`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.27903303,0,0,0.27903304,-104.76098,-96.354723)" x1="422.82431" y1="378.62045" x2="432.86548" y2="381.80399" />
        <linearGradient y2="183.92403" x2="666.19678" y1="204.12044" x1="684.11578" gradientTransform="matrix(0.27903303,0,0,0.24756874,-178.8909,996.82836)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4086`} href={`#${uid}_linearGradient4258`} />
        <linearGradient y2="417.26108" x2="440.35345" y1="447.02145" x1="427.92853" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4190`} href={`#${uid}_linearGradient4252`} />
        <radialGradient r="12.027534" fy="424.34106" fx="433.36789" cy="424.34106" cx="433.36789" gradientTransform="matrix(1.2231981,-0.08344257,0.10167677,1.4904962,-139.87254,-174.00694)" gradientUnits="userSpaceOnUse" id={`${uid}_radialGradient4192`} href={`#${uid}_linearGradient4515`} />
        <radialGradient r="12.952347" fy="420.74988" fx="433.5452" cy="420.74988" cx="433.5452" gradientTransform="matrix(1,0,0,1.2797889,0,-120.61151)" gradientUnits="userSpaceOnUse" id={`${uid}_radialGradient4194`} href={`#${uid}_linearGradient12717-5-0-4-3`} />
        <linearGradient y2="415.1088" x2="425.4519" y1="432.76639" x1="427.53012" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4196`} href={`#${uid}_linearGradient4246`} />
      </defs>
      <g style={{ display: "inline" }}>
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient3993)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 12.82579,9.4971188 1.661134,0 1.422561,1.4112212" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient12878-2-7-1-2)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 10,6.9999994 1.508233,-1.4917651 0.983535,-2.4e-6 0.977902,0.9889529 1.541382,0" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient12876-4-0-6-7)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 8.497184,5.9999999 0,-1.4696695 1.0021304,-1.0554648 0,-1.4697487" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient12868-4-7-0-8)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="M 5.516768,6.0186776 5.4903436,0.99696" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient3813-8)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 6.0125902,8.501281 -1.4696698,0 -1.0554648,1.0021285 -1.4697478,0" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient3847-1)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 7.0014107,10.06109 -1.4917664,1.508234 -2.8e-6,0.983533 0.9889544,0.977904 0,1.541381" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient3881-0)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 9.4588992,12.848383 0,1.661134 1.4112208,1.422562" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient3915-6)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="M 6.0300382,5.4946057 1.0083225,5.5210287" />
      </g>
      <g transform="translate(0,-1036.3622)" style={{ display: "inline" }}>
        <path transform="matrix(0.0982715,-0.0982715,0.0982715,0.0982715,-78.62319,1042.923)" d="m 444.77016,431.08047 a 11.313708,14.937631 0 1 1 -22.62742,0 11.313708,14.937631 0 1 1 22.62742,0 z" style={{ fill: `url(#${uid}_radialGradient4194)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4196)`, strokeWidth: "7.19544077", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
        <path transform="matrix(0.19686609,-0.19686609,0.1968661,0.1968661,-161.15278,1045.6329)" d="m 444.77016,431.08047 a 11.313708,14.937631 0 1 1 -22.62742,0 11.313708,14.937631 0 1 1 22.62742,0 z" style={{ fill: `url(#${uid}_radialGradient4192)`, fillOpacity: 1, stroke: "none", display: "inline" }} />
        <path d="m 5.88715,1042.2397 5.808198,5.8082" style={{ fill: "none", stroke: `url(#${uid}_linearGradient4086)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} />
        <path transform="matrix(0.18984474,-0.18571766,0.18984475,0.18571767,-155.10466,1045.8163)" d="m 444.77016,431.08047 a 11.313708,14.937631 0 1 1 -22.62742,0 11.313708,14.937631 0 1 1 22.62742,0 z" style={{ fill: "none", stroke: `url(#${uid}_linearGradient4190)`, strokeWidth: "3.76581596999999979", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
        <path transform="matrix(0.18984474,-0.18571766,0.18984475,0.18571767,-155.10466,1045.8163)" d="m 431.37184,416.3986 a 11.313708,14.937631 0 0 1 4.54485,0.1017" style={{ fill: "#2e6a22", fillOpacity: 1, stroke: "#2e6a22", strokeWidth: "3.76581597", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
      </g>
    </svg>
  );
}

export function RunPlayIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_run");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient href={`#${uid}_linearGradient10798-1-9-3-7-1-15-1-7-6-1`} id={`${uid}_linearGradient8163-2`} gradientUnits="userSpaceOnUse" x1="388.63736" y1="478.18777" x2="388.63736" y2="457.95499" gradientTransform="matrix(0.66159777,0,0,0.66159776,-240.06252,747.98229)" />
        <linearGradient id={`${uid}_linearGradient10798-1-9-3-7-1-15-1-7-6-1`}>
          <stop style={{ stopColor: "#4f9e55", stopOpacity: 1 }} offset="0" />
          <stop offset="0.5" style={{ stopColor: "#3c8d49", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#a4e173", stopOpacity: 1 }} offset="1" />
        </linearGradient>
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <g style={{ display: "inline" }} transform="translate(-8.2201163,-12.904699)">
          <circle style={{ display: "inline", fill: `url(#${uid}_linearGradient8163-2)`, fillOpacity: 1, stroke: "#14733c", strokeWidth: "0.941048", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeDasharray: "none", strokeDashoffset: "0", strokeOpacity: 1 }} cx="16.720118" cy="1057.767" r="7.0294762" />
          <path d="m 14.220116,1052.2669 6,5.567 -5.938144,5.433 z" style={{ display: "inline", fill: "#ffffff", fillOpacity: 1, stroke: "none", strokeWidth: "1.03057" }} />
        </g>
      </g>
    </svg>
  );
}

export function CoverageRunIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="6.8" cy="6.8" r="5" fill="#58B33C" stroke="#2D6E1B" strokeWidth="0.8" />
      <polygon points="5.3,4.2 9.8,6.8 5.3,9.4" fill="#FFFFFF" />
      <rect x="7.5" y="9.5" width="3.5" height="4.5" fill="#46A638" stroke="#264C20" strokeWidth="0.7" />
      <rect x="11" y="9.5" width="3.5" height="4.5" fill="#D9453D" stroke="#6B201C" strokeWidth="0.7" />
    </svg>
  );
}

export function ExternalToolsIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="6.8" cy="6.8" r="5" fill="#58B33C" stroke="#2D6E1B" strokeWidth="0.8" />
      <polygon points="5.3,4.2 9.8,6.8 5.3,9.4" fill="#FFFFFF" />
      {/* Red toolbox */}
      <path d="M9.5 10h2.5v-1h-2.5z" fill="none" stroke="#8C2318" strokeWidth="0.8" />
      <rect x="7.8" y="10" width="6.5" height="4.2" rx="0.6" fill="#D93D2E" stroke="#7A1D14" strokeWidth="0.7" />
    </svg>
  );
}

export function NewPackageIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.2" y="4.5" width="9.5" height="9" fill="#E3B16E" stroke="#8C622B" strokeWidth="0.9" />
      <line x1="7" y1="4.5" x2="7" y2="13.5" stroke="#8C622B" strokeWidth="0.8" />
      <line x1="2.2" y1="9" x2="11.7" y2="9" stroke="#8C622B" strokeWidth="0.8" />
      <path d="M12.3 1.4l0.5 1.5 1.5 0.5-1.5 0.5-0.5 1.5-0.5-1.5-1.5-0.5 1.5-0.5z" fill="#F2B705" stroke="#9C6B00" strokeWidth="0.4" />
    </svg>
  );
}

export function NewClassIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7.4" cy="8.4" r="5.6" fill="#4BA548" stroke="#286B26" strokeWidth="0.8" />
      <path d="M9.4 6.4a2.4 2.4 0 1 0 0 4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.5 1.2l0.5 1.4 1.4 0.5-1.4 0.5-0.5 1.4-0.5-1.4-1.4-0.5 1.4-0.5z" fill="#F2B705" stroke="#9C6B00" strokeWidth="0.4" />
    </svg>
  );
}

export function OpenTypeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 4h4l1.2 1.4H14v7.8H1.5z" fill="#F2C86B" stroke="#9F7828" strokeWidth="0.9" />
      <circle cx="10.5" cy="6.2" r="3" fill="#4D963C" stroke="#23571A" strokeWidth="0.8" />
      <circle cx="7.2" cy="8.8" r="2.6" fill="#4D7EC2" stroke="#1E4478" strokeWidth="0.8" />
    </svg>
  );
}

export function SearchFlashlightIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 12.2l5.8-5.8 2 2-5.8 5.8z" fill="#E3B152" stroke="#855E17" strokeWidth="0.8" />
      <path d="M7.8 6.4l3-3 2.2 2.2-3 3z" fill="#C4D3E3" stroke="#53687E" strokeWidth="0.8" />
      <path d="M11 2.2l3.4 0.8-0.8 3.4z" fill="#F7D65A" opacity="0.85" />
    </svg>
  );
}

export function MarkOccurrencesIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 12.5l1.5-3.2 6.5-6.5 2 2-6.5 6.5z" fill="#F7D85C" stroke="#8E7216" strokeWidth="0.9" />
      <line x1="2.5" y1="13.5" x2="7.5" y2="13.5" stroke="#C79210" strokeWidth="1.4" />
    </svg>
  );
}

export function BreadcrumbPageIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="2" width="10" height="12" fill="#FFFFFF" stroke="#6E7A8A" strokeWidth="0.9" />
      <rect x="4" y="3.5" width="7" height="2" fill="#7CA5D6" />
      <rect x="4" y="6.8" width="7" height="1" fill="#A0ACB8" />
      <rect x="4" y="8.8" width="5.5" height="1" fill="#A0ACB8" />
      <rect x="4" y="10.8" width="6.5" height="1" fill="#A0ACB8" />
    </svg>
  );
}

export function BlockSelectIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2.5" width="12" height="11" fill="#FFFFFF" stroke="#7A8696" strokeWidth="0.9" />
      <rect x="4.2" y="4.5" width="7.6" height="6.5" fill="#D5E4F7" stroke="#3F74B8" strokeWidth="0.8" strokeDasharray="1.5 1" />
    </svg>
  );
}

export function ShowWhitespaceIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <text x="4.5" y="12.5" fontSize="12" fontWeight="700" fill="#4679B8" fontFamily="serif">
        ¶
      </text>
    </svg>
  );
}

export function PrevAnnotationIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="6" y="3" width="7.5" height="10" fill="#FFFFFF" stroke="#7A8696" strokeWidth="0.8" />
      <path d="M4.5 2v7H2.5L5.2 12.2 7.9 9H5.9V2z" fill="#F2C13A" stroke="#9E730B" strokeWidth="0.7" />
    </svg>
  );
}

export function NextAnnotationIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="6" y="3" width="7.5" height="10" fill="#FFFFFF" stroke="#7A8696" strokeWidth="0.8" />
      <path d="M4.5 14V7H2.5L5.2 3.8 7.9 7H5.9v7z" fill="#F2C13A" stroke="#9E730B" strokeWidth="0.7" />
    </svg>
  );
}

export function LastEditIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M12.5 9.2H6.5V12L2.2 8 6.5 4v2.8h6z" fill="#F2C13A" stroke="#9E730B" strokeWidth="0.8" />
      <circle cx="12" cy="4" r="2" fill="#4F89CC" />
    </svg>
  );
}

export function NavBackIcon({ size = 16, disabled = false }: IconProps) {
  const fill = disabled ? "#D0D4DA" : "#F2C13A";
  const stroke = disabled ? "#9AA0A8" : "#9E730B";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13 9.2H7V12L2.5 8 7 4v2.8h6z" fill={fill} stroke={stroke} strokeWidth="0.8" />
    </svg>
  );
}

export function NavForwardIcon({ size = 16, disabled = false }: IconProps) {
  const fill = disabled ? "#E2E5EA" : "#F2C13A";
  const stroke = disabled ? "#A8AEB6" : "#9E730B";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 9.2h6V12l4.5-4L9 4v2.8H3z" fill={fill} stroke={stroke} strokeWidth="0.8" />
    </svg>
  );
}

export function OpenPerspectiveIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="3" width="11" height="10" fill="#FFFFFF" stroke="#6E7A8A" strokeWidth="0.9" />
      <rect x="2" y="3" width="11" height="2.4" fill="#6F9CD1" />
      <line x1="6" y1="5.4" x2="6" y2="13" stroke="#96A2B0" strokeWidth="0.8" />
      <path d="M12.5 1l0.5 1.4 1.4 0.5-1.4 0.5-0.5 1.4-0.5-1.4-1.4-0.5 1.4-0.5z" fill="#F2B705" stroke="#9C6B00" strokeWidth="0.4" />
    </svg>
  );
}

export function JavaBrowsingIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2.5" width="4.5" height="4" fill="#E39D46" stroke="#8C591C" strokeWidth="0.8" />
      <rect x="8.5" y="2.5" width="5" height="4" fill="#F2C86B" stroke="#8C591C" strokeWidth="0.8" />
      <rect x="8.5" y="8.5" width="5" height="4.5" fill="#F2C86B" stroke="#8C591C" strokeWidth="0.8" />
      <path d="M4.2 6.5v4.2h4.3" fill="none" stroke="#606870" strokeWidth="1" />
    </svg>
  );
}

export function JavaPerspectiveIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_jpersp");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <radialGradient href={`#${uid}_linearGradient11146-4-4`} id={`${uid}_radialGradient11268-5-5`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-239.76818,-165.74471)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <linearGradient id={`${uid}_linearGradient11146-4-4`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <radialGradient href={`#${uid}_linearGradient11146-8-3-2`} id={`${uid}_radialGradient11270-4-5`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-228.89318,-165.74471)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <linearGradient id={`${uid}_linearGradient11146-8-3-2`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <radialGradient href={`#${uid}_linearGradient11146-7-5-30`} id={`${uid}_radialGradient11272-3-8`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-239.76818,-154.86971)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <linearGradient id={`${uid}_linearGradient11146-7-5-30`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <radialGradient href={`#${uid}_linearGradient11146-8-7-5-7`} id={`${uid}_radialGradient11274-3-3`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-228.89318,-154.86971)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <linearGradient id={`${uid}_linearGradient11146-8-7-5-7`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient y2="460.35345" x2="388.63736" y1="476.00287" x1="388.63736" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient11298-3-4`} href={`#${uid}_linearGradient10856-6-3-0-0`} />
        <linearGradient id={`${uid}_linearGradient10856-6-3-0-0`}>
          <stop offset="0" style={{ stopColor: "#7d75ac", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#574a96", stopOpacity: 1 }} offset="0.38814881" />
          <stop offset="1" style={{ stopColor: "#b5b0d4", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient10798-1-9-3-7-7`}>
          <stop style={{ stopColor: "#4f9e55", stopOpacity: 1 }} offset="0" />
          <stop offset="0.50541079" style={{ stopColor: "#418a4d", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#b6d1a1", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient y2="462.88943" x2="388.63736" y1="473.86951" x1="388.63736" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient5160`} href={`#${uid}_linearGradient10798-1-9-3-7-7`} />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <g transform="matrix(0.27903303,0,0,0.27903303,-104.52871,915.34629)" style={{ display: "inline" }}>
          <path d="m 415.7658,462.33392 c -0.78811,-0.0635 -1.71385,-0.21503 -2.4572,-0.40219 -1.15352,-0.29043 -1.03859,0.0556 -1.03859,-3.1271 0,-1.66619 0.0328,-2.76503 0.0831,-2.78218 0.0456,-0.0156 0.13503,0.005 0.1987,0.0459 0.20645,0.13245 1.25464,0.59088 1.60168,0.70054 0.79425,0.25095 1.98598,0.37856 2.82546,0.30255 1.86095,-0.16848 3.12203,-1.07109 3.75632,-2.68853 0.5115,-1.30432 0.48576,-0.79854 0.53839,-10.58445 l 0.0485,-9.00201 3.53246,0 3.53248,0 0.0262,8.39212 c 0.0272,8.67486 -0.002,9.69018 -0.33092,11.27084 -0.66555,3.20509 -2.54905,5.61681 -5.34143,6.83944 -1.87712,0.82186 -4.60239,1.2263 -6.97504,1.03512 z" style={{ fill: "#366c9a", fillOpacity: 1, display: "inline" }} />
          <g transform="translate(20,0)">
            <rect y="438.95068" x="363.69003" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient11268-5-5)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <rect y="438.95068" x="374.56503" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient11270-4-5)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <rect y="449.82568" x="363.69003" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient11272-3-8)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <rect y="449.82568" x="374.56503" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient11274-3-3)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <path style={{ fill: "none", stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none" }} d="m 359.15637,449.81582 30.58237,0" />
            <path style={{ fill: "none", stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 374.44755,434.52463 0,30.58237" />
          </g>
          <path transform="matrix(1.0249809,0,0,1.0249809,7.3028442,-1.4899793)" d="m 398.75,468.23718 a 10.625,10.625 0 1 1 -21.25,0 10.625,10.625 0 1 1 21.25,0 z" style={{ fill: `url(#${uid}_linearGradient11298-3-4)`, fillOpacity: 1, stroke: "#4c4277", strokeWidth: "3.36212635000000004", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
          <path transform="matrix(1.0113298,0,0,1.0113298,-2.1207118,-4.2307157)" d="m 398.75,468.23718 a 10.625,10.625 0 1 1 -21.25,0 10.625,10.625 0 1 1 21.25,0 z" style={{ fill: "#ffffff", fillOpacity: 1, stroke: "#ffffff", strokeWidth: "3.36212635", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
          <path transform="matrix(1.0113298,0,0,1.0113298,-5.5043175,-5.7660141)" d="m 398.75,468.23718 a 10.625,10.625 0 1 1 -21.25,0 10.625,10.625 0 1 1 21.25,0 z" style={{ fill: `url(#${uid}_linearGradient5160)`, fillOpacity: 1, stroke: "#14733c", strokeWidth: "3.36212635000000004", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
        </g>
      </g>
    </svg>
  );
}

export function PackageExplorerTabIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="4.5" height="3.8" fill="#D4844A" stroke="#8A4B1D" strokeWidth="0.8" />
      <rect x="7.5" y="4.5" width="6" height="3.5" fill="#E6C27A" stroke="#8C6723" strokeWidth="0.8" />
      <rect x="7.5" y="10" width="6" height="3.5" fill="#E6C27A" stroke="#8C6723" strokeWidth="0.8" />
      <path d="M4.2 5.8v6h3.3M4.2 6.2h3.3" fill="none" stroke="#606870" strokeWidth="1" />
    </svg>
  );
}

export function LinkWithEditorIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 5.5h8V3.5l3 2.8-3 2.8V7H2.5z" fill="#F0B73A" stroke="#94680D" strokeWidth="0.7" />
      <path d="M13.5 10.5h-8v2l-3-2.8 3-2.8V9h8z" fill="#FFFFFF" stroke="#6B7888" strokeWidth="0.8" />
    </svg>
  );
}

export function CollapseAllIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.2" y="2.2" width="8.5" height="8.5" fill="#F5F7FA" stroke="#6C7A8A" strokeWidth="0.9" />
      <rect x="5.2" y="5.2" width="8.5" height="8.5" fill="#FFFFFF" stroke="#53687E" strokeWidth="0.9" />
      <line x1="7.2" y1="9.5" x2="11.8" y2="9.5" stroke="#425870" strokeWidth="1.3" />
    </svg>
  );
}

export function ViewFiltersIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5.2" cy="5.5" r="2.2" fill="#A0A8B2" />
      <circle cx="10.8" cy="6.5" r="2.2" fill="#B8BFC8" />
      <circle cx="7.8" cy="11" r="2.2" fill="#8C95A0" />
    </svg>
  );
}

export function JavaProjectFolderIcon({ size = 16, hasMaven = false, hasWarning = false }: IconProps & { hasMaven?: boolean; hasWarning?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 4h4.2l1.2 1.4H14v8.2H1.5z" fill="#C9DCF2" stroke="#4F709A" strokeWidth="0.9" />
      <path d="M1.5 5.4H14v8.2H1.5z" fill="#DCE9F8" stroke="#4F709A" strokeWidth="0.9" />
      {/* Blue J badge top-right */}
      <text x="10.6" y="6.8" fontSize="7.8" fontWeight="800" fill="#1C56A8" fontFamily="serif">
        J
      </text>
      {hasMaven && (
        <text x="1.2" y="6.2" fontSize="6.6" fontWeight="800" fill="#234F8C" fontFamily="sans-serif">
          M
        </text>
      )}
      {hasWarning && (
        <g>
          <polygon points="3.5,10 6.5,14.8 0.5,14.8" fill="#F2C029" stroke="#8C6700" strokeWidth="0.6" />
          <line x1="3.5" y1="11.6" x2="3.5" y2="13.2" stroke="#3D2D00" strokeWidth="0.9" />
          <circle cx="3.5" cy="14" r="0.45" fill="#3D2D00" />
        </g>
      )}
    </svg>
  );
}

export function JreBooksIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_jre");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient href={`#${uid}_linearGradient4918-5`} id={`${uid}_linearGradient4975-9`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.9790709,0,0,1.0606414,0.30288473,-67.582527)" x1="6.6639614" y1="1051.8521" x2="6.6639614" y2="1053.6217" />
        <linearGradient id={`${uid}_linearGradient4918-5`}>
          <stop style={{ stopColor: "#d48a4b", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#b1623a", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4907-9`} id={`${uid}_linearGradient4977-3`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.9790709,0,0,1.0606414,0.30288473,-67.582527)" x1="6.6639614" y1="1051.8521" x2="6.6639614" y2="1053.6217" />
        <linearGradient id={`${uid}_linearGradient4907-9`}>
          <stop style={{ stopColor: "#b86c44", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#8f4017", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4928-4`} id={`${uid}_linearGradient4979-8`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.93200086,0,0,1.0533679,0.56637029,-64.083352)" x1="5.9250002" y1="1051.6095" x2="5.9250002" y2="1054.2059" />
        <linearGradient id={`${uid}_linearGradient4928-4`}>
          <stop style={{ stopColor: "#4dac81", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#058048", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4938-8`}>
          <stop style={{ stopColor: "#8bc7d7", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#17477c", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4961-6`}>
          <stop style={{ stopColor: "#df9a39", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#b55829", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4938-8`} id={`${uid}_linearGradient9955`} x1="-0.81249988" y1="1040.3623" x2="-0.81249994" y2="1044.3622" gradientUnits="userSpaceOnUse" gradientTransform="translate(5.9999999,-1.0000877)" />
        <linearGradient y2="1049.2014" x2="18.744612" y1="1040.0764" x1="15.073242" gradientTransform="translate(-4.5804832,0.69509894)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient5020-3`} href={`#${uid}_linearGradient4961-6`} />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <g style={{ display: "inline" }} transform="translate(-0.18750003,0)">
          <rect y="1046.8622" x="1.6875" height="3" width="9" style={{ fill: `url(#${uid}_linearGradient4975-9)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4977-3)`, strokeWidth: "1", strokeMiterlimit: "4", strokeDasharray: "none", strokeOpacity: 1 }} />
          <rect y="1043.8622" x="2.6875" height="2" width="7" style={{ fill: "#78b87c", fillOpacity: 1, stroke: `url(#${uid}_linearGradient4979-8)`, strokeWidth: "1", strokeMiterlimit: "4", strokeDasharray: "none", strokeOpacity: 1 }} />
          <rect style={{ fill: `url(#${uid}_linearGradient9955)`, fillOpacity: 1, stroke: "none", strokeWidth: "0.83589131", strokeMiterlimit: "4", strokeDasharray: "none", strokeOpacity: 1 }} width="7" height="2" x="1.1875" y="1041.3622" />
          <rect y="1041.3622" x="2.1875" height="1" width="5" style={{ fill: "#0595d3", fillOpacity: 1, stroke: "none", strokeWidth: "0.83589131", strokeMiterlimit: "4", strokeDasharray: "none", strokeOpacity: 1 }} />
          <path d="m 9.6802586,1040.2852 c 0.08839,-0.044 1.5696584,-0.9063 1.5696584,-0.9063 l 3.976711,10.3859 -1.956435,0.5243 z" style={{ display: "inline", fill: "#f0c028", fillOpacity: 1, stroke: `url(#${uid}_linearGradient5020-3)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeDasharray: "none", strokeOpacity: 1 }} />
        </g>
      </g>
    </svg>
  );
}

export function SourceFolderIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_src");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient href={`#${uid}_linearGradient3967`} id={`${uid}_linearGradient3939`} gradientUnits="userSpaceOnUse" gradientTransform="translate(-61.366562,1.4453859)" x1="531.09253" y1="366.78851" x2="531.09253" y2="371.17883" />
        <linearGradient id={`${uid}_linearGradient3967`}>
          <stop offset="0" style={{ stopColor: "#c48a4e", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#ad6c24", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient3973`} id={`${uid}_linearGradient4933`} gradientUnits="userSpaceOnUse" gradientTransform="translate(-60.558598,0)" x1="538.00562" y1="396.2229" x2="538.00562" y2="374.21222" />
        <linearGradient id={`${uid}_linearGradient3973`}>
          <stop offset="0" style={{ stopColor: "#f8d078", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#f8f0c8", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient3949`} id={`${uid}_linearGradient4935-1`} gradientUnits="userSpaceOnUse" gradientTransform="translate(-60.558598,0)" x1="548.45923" y1="398.98798" x2="548.45923" y2="373.77069" />
        <linearGradient id={`${uid}_linearGradient3949`}>
          <stop style={{ stopColor: "#9e6627", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#c38536", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient3955`}>
          <stop offset="0" style={{ stopColor: "#c38536", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#f2dc91", stopOpacity: 1 }} offset="0.15381166" />
          <stop style={{ stopColor: "#fbdc8b", stopOpacity: 1 }} offset="0.5" />
          <stop offset="0.75" style={{ stopColor: "#e6bd7a", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#ba772f", stopOpacity: 1 }} />
        </linearGradient>
        <mask maskUnits="userSpaceOnUse" id={`${uid}_mask5153`}>
          <g style={{ display: "inline" }} transform="matrix(0.84489245,0,0,0.84489245,66.961974,62.982434)">
            <path transform="matrix(1.1835826,0,0,1.1835826,-79.255026,-74.544902)" d="m 462.77563,373.22885 29.11636,0 c 1.45425,0 2.625,1.17075 2.625,2.625 l 0,18.76896 c 0,1.45425 -1.17412,2.52598 -2.625,2.625 l -29.11636,1.98708 c -1.45088,0.099 -2.625,-1.17075 -2.625,-2.625 l 0,-20.75604 c 0,-1.45425 1.17075,-2.625 2.625,-2.625 z" style={{ fill: "#ffffff", fillOpacity: 1, stroke: "#ffffff", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDashoffset: "0", display: "inline" }} />
          </g>
        </mask>
        <linearGradient y2="381.57214" x2="538.83301" y1="397.56107" x1="537.94318" gradientTransform="matrix(0.33025864,0,0,0.46783406,884.33713,1300.6675)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient6107`} href={`#${uid}_linearGradient3973-7-8-2`} />
        <linearGradient id={`${uid}_linearGradient3973-7-8-2`}>
          <stop offset="0" style={{ stopColor: "#f8d078", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#f8f0c8", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient y2="381.19754" x2="548.01556" y1="398.98798" x1="548.45923" gradientTransform="matrix(0.33025864,0,0,0.46783406,884.33713,1300.6675)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient6109`} href={`#${uid}_linearGradient4807-2-8`} />
        <linearGradient id={`${uid}_linearGradient4807-2-8`}>
          <stop offset="0" style={{ stopColor: "#9e6627", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#bc8532", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient y2="373.2294" x2="543.91406" y1="373.2294" x1="523.00781" gradientTransform="translate(-60.558598,1.4188)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient5342`} href={`#${uid}_linearGradient3955`} />
        <linearGradient id={`${uid}_linearGradient11146-4-4-3-4`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-8-3-2-5-8`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-7-5-30-9-5`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-8-7-5-7-9-1`}>
          <stop style={{ stopColor: "#faefba", stopOpacity: 1 }} offset="0" />
          <stop offset="1" style={{ stopColor: "#9e6542", stopOpacity: 1 }} />
        </linearGradient>
        <radialGradient href={`#${uid}_linearGradient11146-4-4-3-4`} id={`${uid}_radialGradient3055`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-219.20821,-165.52072)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <radialGradient href={`#${uid}_linearGradient11146-8-3-2-5-8`} id={`${uid}_radialGradient3057`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-208.33321,-165.52072)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <radialGradient href={`#${uid}_linearGradient11146-7-5-30-9-5`} id={`${uid}_radialGradient3059`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-219.20821,-154.64572)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <radialGradient href={`#${uid}_linearGradient11146-8-7-5-7-9-1`} id={`${uid}_radialGradient3061`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.5657869,-2.9706834e-6,2.6069523e-6,1.3740716,-208.33321,-154.64572)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <g style={{ display: "inline" }} transform="matrix(0.33025864,0,0,0.33025864,-150.61632,918.18176)">
          <rect style={{ fill: "#fdf7eb", fillOpacity: 1, stroke: `url(#${uid}_linearGradient3939)`, strokeWidth: "3.02792978", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} width="15" height="16.625" x="463.74335" y="368.49503" rx="2.625" ry="2.625" />
          <path style={{ fill: `url(#${uid}_linearGradient4933)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4935-1)`, strokeWidth: "3.02792978", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0" }} d="m 463.24874,374.64819 28.07551,0 c 1.45425,0 2.625,1.17075 2.625,2.625 l 0,11.29376 c 0,1.45425 -1.22088,2.24642 -2.625,2.625 l -28.07551,7.56983 c -1.40411,0.37858 -2.625,-1.17075 -2.625,-2.625 l 0,-18.86359 c 0,-1.45425 1.17075,-2.625 2.625,-2.625 z" />
          <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient5342)`, strokeWidth: "3.02792978", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none" }} d="m 462.26171,374.64819 20.09375,0" />
        </g>
        <g transform="matrix(0.27903303,0,0,0.27903303,-93.454142,917.99265)" style={{ display: "inline" }}>
          <g transform="translate(-2.4638659,-2.5758595)" style={{ strokeWidth: "3.58380508", strokeMiterlimit: "4", strokeDasharray: "none" }}>
            <rect transform="translate(-20.000002,2.6171874e-6)" y="439.17468" x="384.25" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient3055)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <rect transform="translate(-20.000002,2.6171874e-6)" y="439.17468" x="395.125" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient3057)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <rect transform="translate(-20.000002,2.6171874e-6)" y="450.04968" x="384.25" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient3059)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <rect transform="translate(-20.000002,2.6171874e-6)" y="450.04968" x="395.125" height="10.875" width="10.875" style={{ fill: `url(#${uid}_radialGradient3061)`, fillOpacity: 1, stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
            <path style={{ fill: "none", stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none" }} d="m 359.71634,450.03981 30.58237,0" />
            <path style={{ fill: "none", stroke: "#694337", strokeWidth: "3.58380508", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} d="m 375.00752,434.74862 0,30.58237" />
          </g>
        </g>
        <g transform="matrix(0.33025864,0,0,0.33025864,-151.62636,919.14589)" style={{ display: "inline" }}>
          <g mask={`url(#${uid}_mask5153)`} transform="translate(3.058339,-2.9193236)">
            <rect style={{ opacity: 0.5, fill: "#000000", fillOpacity: 1, stroke: "#000000", strokeWidth: "2.38039374", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} width="29.135895" height="22.649353" x="860.68469" y="542.8974" rx="2.625" ry="3.7184925" transform="matrix(1,0,-0.70828043,0.70593118,4.9445873e-7,-4.9445987e-8)" />
          </g>
        </g>
        <rect transform="matrix(1,0,-0.70828042,0.7059312,0,0)" ry="1.2280643" rx="0.86692894" y="1480.1853" x="1054.8699" height="7.0601854" width="10.064708" style={{ fill: `url(#${uid}_linearGradient6107)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient6109)`, strokeWidth: "1.19019687", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
        <g transform="translate(18.738328,2)" />
      </g>
    </svg>
  );
}

export function PackageCubeIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_pkg");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient10573`}>
          <stop style={{ stopColor: "#c18965", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#975c45", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient10507`}>
          <stop style={{ stopColor: "#5f392d", stopOpacity: 1 }} offset="0" />
          <stop offset="0.18181793" style={{ stopColor: "#9e7058", stopOpacity: 1 }} />
          <stop offset="0.36363617" style={{ stopColor: "#794f40", stopOpacity: 1 }} />
          <stop offset="0.49999985" style={{ stopColor: "#794f40", stopOpacity: 1 }} />
          <stop offset="0.63636351" style={{ stopColor: "#794f40", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#9e7058", stopOpacity: 1 }} offset="0.81818175" />
          <stop style={{ stopColor: "#5f392d", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-4-4-4-6-2`}>
          <stop offset="0" style={{ stopColor: "#faefba", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#9e6542", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-8-3-2-6-1-7`}>
          <stop offset="0" style={{ stopColor: "#faefba", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#9e6542", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-7-5-30-1-1-4`}>
          <stop offset="0" style={{ stopColor: "#faefba", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#9e6542", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient11146-8-7-5-7-5-6-8`}>
          <stop offset="0" style={{ stopColor: "#faefba", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#9e6542", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient10507`} id={`${uid}_linearGradient4895`} gradientUnits="userSpaceOnUse" x1="355.2973" y1="449.88141" x2="394.71915" y2="449.88141" gradientTransform="matrix(0,1,-1,0,824.88775,74.875059)" />
        <radialGradient href={`#${uid}_linearGradient11146-7-5-30-1-1-4`} id={`${uid}_radialGradient10499`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(2.5866405,-4.9074941e-6,4.3066195e-6,2.2699317,-639.81718,-549.01598)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <radialGradient href={`#${uid}_linearGradient11146-8-7-5-7-5-6-8`} id={`${uid}_radialGradient10501`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(2.5866405,-4.9074941e-6,4.3066195e-6,2.2699317,-621.85195,-549.01598)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <radialGradient href={`#${uid}_linearGradient11146-8-3-2-6-1-7`} id={`${uid}_radialGradient10503`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(2.5866405,-4.9074941e-6,4.3066195e-6,2.2699317,-621.85195,-566.97066)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <radialGradient href={`#${uid}_linearGradient11146-4-4-4-6-2`} id={`${uid}_radialGradient10505`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(2.5866405,-4.9074941e-6,4.3066195e-6,2.2699317,-639.81718,-566.97066)" cx="387.59717" cy="442.57816" fx="387.59717" fy="442.57816" r="6.1875" />
        <linearGradient id={`${uid}_linearGradient10507-2`}>
          <stop style={{ stopColor: "#5f392d", stopOpacity: 1 }} offset="0" />
          <stop offset="0.18181793" style={{ stopColor: "#9e7058", stopOpacity: 1 }} />
          <stop offset="0.36363617" style={{ stopColor: "#794f40", stopOpacity: 1 }} />
          <stop offset="0.49999985" style={{ stopColor: "#794f40", stopOpacity: 1 }} />
          <stop offset="0.63636351" style={{ stopColor: "#794f40", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#9e7058", stopOpacity: 1 }} offset="0.81818175" />
          <stop style={{ stopColor: "#5f392d", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient y2="449.88141" x2="394.71915" y1="449.88141" x1="355.2973" gradientTransform="matrix(-1,0,0,-1,750.01459,899.76468)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient10544`} href={`#${uid}_linearGradient10507-2`} />
        <linearGradient href={`#${uid}_linearGradient10573`} id={`${uid}_linearGradient10579`} x1="366.04819" y1="430.17236" x2="366.04819" y2="466.01041" gradientUnits="userSpaceOnUse" />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <g transform="matrix(0.27903303,0,0,0.27903303,-129.51159,939.94639)" style={{ display: "inline" }}>
          <g transform="matrix(3.5838051,0,0,3.5838051,511.21484,-3419.8264)" style={{ fill: "#ffffff", fillOpacity: 1, stroke: "none", display: "inline" }}>
            <g transform="matrix(0.27903303,0,0,0.27903303,-109.29986,933.62804)" style={{ display: "inline" }}>
              <rect style={{ fill: `url(#${uid}_radialGradient10505)`, fillOpacity: 1, stroke: "#c37e3b", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} width="17.965227" height="17.965227" x="357.0806" y="431.97098" />
              <rect style={{ fill: `url(#${uid}_radialGradient10503)`, fillOpacity: 1, stroke: "#c37e3b", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} width="17.965227" height="17.965227" x="375.04584" y="431.97098" />
              <path d="m 357.08057,449.75837 17.96523,0 0,18.13262 -17.96523,0 z" style={{ fill: `url(#${uid}_radialGradient10499)`, fillOpacity: 1, stroke: "#a45d2b", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
              <path d="m 375.0458,449.75837 17.96522,0 0,18.13262 -17.96522,0 z" style={{ fill: `url(#${uid}_radialGradient10501)`, fillOpacity: 1, stroke: "#a45d2b", strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
              <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient10579)`, strokeWidth: "3.58380508", strokeLinecap: "round", strokeLinejoin: "round", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} d="m 357.27589,432.15148 0,17.71804 0,17.85756 17.71805,0 17.85755,0 0,-17.85756 0,-0.13951 0,-17.57853 -17.85755,0 -17.71805,0 z" />
              <path d="m 375.00635,426.58855 0,46.58947" style={{ fill: "#915323", fillOpacity: 1, stroke: `url(#${uid}_linearGradient4895)`, strokeWidth: "3.58380508", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} />
              <path d="m 398.30108,449.88328 -46.58947,0" style={{ fill: "#915323", fillOpacity: 1, stroke: `url(#${uid}_linearGradient10544)`, strokeWidth: "3.58380508", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} />
            </g>
            <g style={{ display: "inline" }} transform="matrix(0.27903303,0,0,0.27903303,-64.52871,915.34629)" />
          </g>
          <g transform="matrix(1.1835826,0,0,1.1835826,-68.597078,-81.712528)" style={{ fill: "#ffffff", stroke: "#ffffff", display: "inline" }} />
          <g transform="matrix(1.1835826,0,0,1.1835826,-68.597078,-81.712526)" style={{ display: "inline" }} />
        </g>
      </g>
    </svg>
  );
}

export function JavaFileIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_jcu");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient href={`#${uid}_linearGradient4902-3`} id={`${uid}_linearGradient4908-2`} x1="10.544736" y1="1038.5779" x2="10.544736" y2="1052.3228" gradientUnits="userSpaceOnUse" gradientTransform="translate(-1.977903,-1.044194)" />
        <linearGradient id={`${uid}_linearGradient4902-3`}>
          <stop style={{ stopColor: "#b28a30", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#7c703e", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4894-6`} id={`${uid}_linearGradient4900-1`} x1="7.9987183" y1="1042.2307" x2="9.9874563" y2="1040.3303" gradientUnits="userSpaceOnUse" gradientTransform="translate(2.022097,-1.044194)" />
        <linearGradient id={`${uid}_linearGradient4894-6`}>
          <stop style={{ stopColor: "#e0c88f", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#d5b269", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4994-6`}>
          <stop style={{ stopColor: "#f9fafc", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#dce7f7", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient y2="1051.8378" x2="9.8946028" y1="1039.153" x1="9.8946028" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4101`} href={`#${uid}_linearGradient4994-6`} gradientTransform="translate(-1.977903,-1.044194)" />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <path style={{ fill: `url(#${uid}_linearGradient4101)`, fillOpacity: 1, stroke: "none", display: "inline" }} d="m 3.5193795,1037.8597 7.0096695,0 3.062057,3.0066 0,9.9546 -10.0717265,0 z" />
        <path style={{ fill: `url(#${uid}_linearGradient4900-1)`, fillOpacity: 1, stroke: "none", display: "inline" }} d="m 9.998718,1037.397 0,3.9112 3.977478,0 z" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient4908-2)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDashoffset: "0", display: "inline" }} d="m 3.5193795,1037.8597 7.0096695,0 3.062057,3.0066 0,9.9546 -10.0717265,0 z" />
        <path d="m 6.6084618,1048.3431 c -0.2116277,-0.019 -0.4602115,-0.062 -0.6598209,-0.1162 -0.3097493,-0.083 -0.2788869,0.017 -0.2788869,-0.9031 0,-0.4813 0.0088,-0.7987 0.022313,-0.8035 0.012257,0 0.036259,0 0.053355,0.013 0.055439,0.038 0.3369032,0.1706 0.4300938,0.2023 0.2132743,0.072 0.5332849,0.1095 0.7587063,0.088 0.4997134,-0.048 0.838345,-0.3094 1.0086665,-0.7765 0.1373503,-0.3768 0.1304394,-0.2307 0.1445726,-3.0571 l 0.013011,-2.6 0.9485572,0 0.9485603,0 0.00704,2.4239 c 0.0073,2.5055 -6.28e-4,2.7987 -0.08886,3.2552 -0.1787185,0.9256 -0.684485,1.6223 -1.4343096,1.9754 -0.5040536,0.2374 -1.2358574,0.3542 -1.8729745,0.299 z" style={{ display: "inline", fill: "#366c9a", fillOpacity: 1 }} />
      </g>
    </svg>
  );
}

export function TodoClipboardIcon({ size = 14, className }: IconProps) {
  const uid = useSvgUid("ecl_tsk");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient4845`}>
          <stop style={{ stopColor: "#afb8cd", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#8192b5", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4837`}>
          <stop style={{ stopColor: "#acbfd5", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#627297", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4784`}>
          <stop style={{ stopColor: "#b68e69", stopOpacity: 1 }} offset="0" />
          <stop offset="0.94238818" style={{ stopColor: "#d5ae7d", stopOpacity: 1 }} />
          <stop style={{ stopColor: "#c69863", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4767`}>
          <stop style={{ stopColor: "#f1c373", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#f6e3c9", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4767`} id={`${uid}_linearGradient4774`} x1="-11.999999" y1="1050.9951" x2="-11.999999" y2="1038.8655" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.96875,0)" />
        <linearGradient href={`#${uid}_linearGradient4784`} id={`${uid}_linearGradient4790`} x1="-17.3125" y1="1050.9445" x2="-17.34375" y2="1039.0842" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.96875,0)" />
        <linearGradient href={`#${uid}_linearGradient4837`} id={`${uid}_linearGradient4843`} x1="-11.375669" y1="1036.296" x2="-11.375669" y2="1040.2782" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.96875,0)" />
        <linearGradient href={`#${uid}_linearGradient4845`} id={`${uid}_linearGradient4851`} x1="-12.921875" y1="1037.3231" x2="-12.921875" y2="1040.3914" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.96875,0)" />
        <linearGradient gradientTransform="translate(-4,-2)" gradientUnits="userSpaceOnUse" y2="1051.8378" x2="9.8946028" y1="1039.153" x1="9.8946028" id={`${uid}_linearGradient5000-6`} href={`#${uid}_linearGradient4994-7`} />
        <linearGradient gradientTransform="translate(-4,-2)" gradientUnits="userSpaceOnUse" y2="1052.3228" x2="10.544736" y1="1038.5779" x1="10.544736" id={`${uid}_linearGradient4908`} href={`#${uid}_linearGradient4902`} />
        <linearGradient gradientTransform="matrix(0.72293526,0,0,1,-14.128143,-4.875)" gradientUnits="userSpaceOnUse" y2="1047.857" x2="14" y1="1047.857" x1="7.0070496" id={`${uid}_linearGradient4871`} href={`#${uid}_linearGradient5147`} />
        <linearGradient gradientTransform="matrix(0.57546531,0,0,1,-13.094814,-4.875)" gradientUnits="userSpaceOnUse" y2="1045.857" x2="14" y1="1045.857" x1="7.0070496" id={`${uid}_linearGradient4869`} href={`#${uid}_linearGradient4861`} />
        <linearGradient gradientTransform="matrix(0.82571734,0,0,1,-14.848342,-4.875)" gradientUnits="userSpaceOnUse" y2="1043.857" x2="11" y1="1043.857" x1="7.0070496" id={`${uid}_linearGradient4867`} href={`#${uid}_linearGradient4877`} />
        <linearGradient id={`${uid}_linearGradient4861`}>
          <stop offset="0" style={{ stopColor: "#91a5c7", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#637aa7", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4877`}>
          <stop style={{ stopColor: "#91a5c7", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#5e76a3", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4902`}>
          <stop offset="0" style={{ stopColor: "#c7b571", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#9a9a8f", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4994-7`}>
          <stop offset="0" style={{ stopColor: "#f9fafc", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#dce7f7", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient5147`}>
          <stop style={{ stopColor: "#91a5c7", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#637aa7", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <filter id={`${uid}_filter11154`} x="-0.18204814" width="1.3631471" y="-0.26778204" height="1.6519907">
          <feGaussianBlur stdDeviation="0.34001774" />
        </filter>
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <rect style={{ fill: `url(#${uid}_linearGradient4774)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4790)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0" }} width="11.054" height="11.993433" x="3.4460011" y="1038.8688" rx="1.21875" ry="1.21875" />
        <path style={{ fill: `url(#${uid}_linearGradient4851)`, fillOpacity: 1, stroke: "none" }} d="m 4.9843751,1040.3466 1.53125,-1.3672 0.9375,-2.1172 1.5,0 1.4999999,0 0.953125,2.1172 1.546875,1.3672" />
        <path style={{ color: "#000000", fill: `url(#${uid}_linearGradient4843)`, fillOpacity: 1, fillRule: "nonzero", stroke: "none", strokeWidth: "1px", marker: "none", visibility: "visible", display: "inline", overflow: "visible" }} d="m 7.3125001,1036.375 c -0.138213,0.043 -0.255616,0.1482 -0.3125,0.2812 l -0.875,2 -0.966084,0.8634 c -0.219449,0.2194 -0.161431,0.3252 -0.190934,0.8384 0.205415,0 0.484943,0 0.746694,-3e-4 l 1.129074,-1.0139 c 0.0516,-0.043 0.0944,-0.097 0.125,-0.1563 l 0.8125,-1.8125 1.1875,0 1.1562499,0 0.8125,1.8125 c 0.0306,0.06 0.0734,0.1133 0.125,0.1563 l 1.173251,1.0325 c 0.113518,0 0.471938,-0.02 0.715999,-0.031 0,-0.2129 0.08262,-0.5753 -0.123815,-0.7817 l -1.015435,-0.9075 -0.90625,-2 c -0.07974,-0.164 -0.255243,-0.2768 -0.4375,-0.2812 l -1.4999999,0 -1.5,0 c -0.05166,-0.01 -0.104595,-0.01 -0.15625,0 z" />
        <g style={{ display: "inline" }} transform="translate(2.9714147,3.9176048)">
          <path d="m 1.4972825,1036.9037 8.8125525,0 0.102923,3.0066 0,6.5483 -8.9154755,0 z" style={{ fill: `url(#${uid}_linearGradient5000-6)`, fillOpacity: 1, stroke: "none", display: "inline" }} />
          <path d="m 1.4972825,1036.9037 9.0221325,0 0.04042,3.0066 0,6.0483 -9.0625531,0 z" style={{ fill: "none", stroke: `url(#${uid}_linearGradient4908)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDashoffset: "0" }} />
          <rect y="1038.4768" x="-9.0625" height="1.0103934" width="3.2970483" style={{ fill: `url(#${uid}_linearGradient4867)`, fillOpacity: 1, stroke: "none", display: "inline" }} transform="scale(-1,1)" />
          <rect y="1040.4768" x="-9.0625" height="1.0103934" width="4.0242004" style={{ fill: `url(#${uid}_linearGradient4869)`, fillOpacity: 1, stroke: "none", display: "inline" }} transform="scale(-1,1)" />
          <rect y="1042.4768" x="-9.0625" height="1.0103934" width="5.0554504" style={{ fill: `url(#${uid}_linearGradient4871)`, fillOpacity: 1, stroke: "none", display: "inline" }} transform="scale(-1,1)" />
        </g>
        <path d="m 1.7812498,1045.1747 2.4999999,2.5313 5.5000013,-5.4375" style={{ fill: "none", stroke: "#ffffff", strokeWidth: "1.79999995", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline", filter: `url(#${uid}_filter11154)` }} />
        <path d="m 0.49999987,1045.4246 2.49999993,2.5313 5.500001,-5.4375" style={{ fill: "none", stroke: "#00b4ff", strokeWidth: "1.79999994999999990", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", display: "inline" }} />
        <path style={{ color: "#000000", fill: "#1a549a", fillOpacity: 1, stroke: "none", strokeWidth: "1.79999995", marker: "none", visibility: "visible", display: "inline", overflow: "visible" }} d="m 7.90625,1043.0938 -4.875,4.8125 -1.875,-1.9062 -1.28125,0.1249 2.5,2.5312 0.625,0.625 0.625,-0.625 5.5,-5.4374 z" />
      </g>
    </svg>
  );
}

export function ErrorMarkerIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" fill="#D93232" stroke="#8C1A1A" strokeWidth="0.8" />
      <path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ProblemsTabIcon({ size = 16, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" opacity={active ? 1 : 0.65} aria-hidden="true">
      <rect x="2.5" y="2" width="9.5" height="11.5" fill="#FFFFFF" stroke="#7A8490" strokeWidth="0.9" />
      <line x1="4.5" y1="4.5" x2="10" y2="4.5" stroke="#9AA4B0" strokeWidth="1" />
      <line x1="4.5" y1="7" x2="10" y2="7" stroke="#9AA4B0" strokeWidth="1" />
      <circle cx="11.5" cy="11.5" r="3.2" fill="#D9453D" />
      <path d="M10.3 10.3l2.4 2.4M12.7 10.3l-2.4 2.4" stroke="#FFFFFF" strokeWidth="1" />
    </svg>
  );
}

export function JavadocTabIcon({ size = 16, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" opacity={active ? 1 : 0.65} aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="#E3EDF8" stroke="#5B86BA" strokeWidth="0.9" />
      <text x="4.5" y="11" fontSize="8.8" fontWeight="700" fill="#3B6DA8" fontFamily="sans-serif">
        @
      </text>
    </svg>
  );
}

export function DeclarationTabIcon({ size = 16, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" opacity={active ? 1 : 0.65} aria-hidden="true">
      <rect x="4" y="2" width="9.5" height="11.5" fill="#FFFFFF" stroke="#7A8490" strokeWidth="0.9" />
      <rect x="6" y="4.5" width="5.5" height="1" fill="#8C97A4" />
      <rect x="6" y="7" width="4.5" height="1" fill="#8C97A4" />
      <path d="M1.5 10.5h5V8.8l2.5 2.4-2.5 2.4v-1.7h-5z" fill="#E69A3A" stroke="#8C5917" strokeWidth="0.6" />
    </svg>
  );
}

export function ConsoleTabIcon({ size = 16, className }: IconProps) {
  const uid = useSvgUid("ecl_cons");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient4008`}>
          <stop style={{ stopColor: "#3a4e81", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#7688b7", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient3906`}>
          <stop style={{ stopColor: "#546483", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#818b9f", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient3892`}>
          <stop style={{ stopColor: "#2b5c9c", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#3673c4", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient3892`} id={`${uid}_linearGradient3898`} x1="22.420315" y1="1044.6581" x2="22.420315" y2="1037.9327" gradientUnits="userSpaceOnUse" />
        <linearGradient href={`#${uid}_linearGradient3906`} id={`${uid}_linearGradient3912`} x1="22.994839" y1="1040.1731" x2="22.994839" y2="1048.3184" gradientUnits="userSpaceOnUse" />
        <linearGradient href={`#${uid}_linearGradient4008`} id={`${uid}_linearGradient4014`} x1="25.096403" y1="1041.8778" x2="19.998154" y2="1041.8778" gradientUnits="userSpaceOnUse" gradientTransform="translate(-1.0281848,0)" />
        <linearGradient id={`${uid}_linearGradient4008-8`}>
          <stop style={{ stopColor: "#3a4e81", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#7688b7", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient y2="1041.8778" x2="19.998154" y1="1041.8778" x1="25.096403" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4048`} href={`#${uid}_linearGradient4008-8`} gradientTransform="matrix(1.20625,0,0,1,-5.1479113,2.03125)" />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <g transform="translate(-14,0)">
          <rect ry="0.79549515" rx="0.79549515" y="1037.8665" x="16.572817" height="10.010139" width="11.932429" style={{ fill: `url(#${uid}_linearGradient3912)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient3898)`, strokeOpacity: 1 }} />
          <rect ry="0" rx="0" y="1039.3717" x="18.002655" height="7.0085478" width="9.0156116" style={{ fill: "#ffffff", fillOpacity: 1, stroke: "none" }} />
          <g transform="matrix(1.2279408,0,0,1,-5.1169737,0)" style={{ fill: "#4673ad", fillOpacity: 1, display: "inline" }}>
            <rect style={{ fill: "#4673ad", fillOpacity: 1, stroke: "none" }} width="4.0751266" height="1.0385482" x="20.448273" y="1048.3518" rx="0" ry="0" />
            <rect style={{ fill: "#4673ad", fillOpacity: 1, stroke: "none" }} width="9.015625" height="0.984375" x="17.989351" y="1049.3667" />
          </g>
          <g>
            <rect style={{ fill: "#2a5893", fillOpacity: 1, stroke: "none" }} width="3.0493984" height="1.0385482" x="20.970135" y="1048.3518" rx="0" ry="0" />
            <rect style={{ fill: "#2a5893", fillOpacity: 1, stroke: "none" }} width="9.015625" height="0.984375" x="17.989351" y="1049.3667" />
          </g>
          <g transform="translate(0.02209709,0)">
            <rect style={{ fill: "#cfedfb", fillOpacity: 1, stroke: "none" }} width="8.9990387" height="0.98884457" x="17.987028" y="3.0069129" transform="translate(0,1036.3622)" />
            <rect style={{ fill: "#cfedfb", fillOpacity: 1, stroke: "none", display: "inline" }} width="7.0047607" height="1.0054171" x="1039.3691" y="-18.981396" transform="matrix(0,1,-1,0,0,0)" />
          </g>
          <rect y="1041.3622" x="19.003065" height="1" width="5" style={{ fill: `url(#${uid}_linearGradient4014)`, fillOpacity: 1, stroke: "none" }} />
          <rect y="1043.3661" x="19.006971" height="1" width="6.9918041" style={{ fill: `url(#${uid}_linearGradient4048)`, fillOpacity: 1, stroke: "none", display: "inline" }} />
        </g>
      </g>
    </svg>
  );
}

export function TerminateSquareIcon({ size = 14, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="0.6"
        fill={active ? "#D93232" : "#B2B6BC"}
        stroke={active ? "#8C1A1A" : "#8E939A"}
        strokeWidth="0.9"
      />
    </svg>
  );
}

export function RemoveLaunchIcon({ size = 14, active = true, className }: IconProps) {
  const uid = useSvgUid("ecl_rem");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" opacity={active ? 1 : 0.4} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient4852-7`}>
          <stop style={{ stopColor: "#707070", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#a0a0a0", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4844-4`}>
          <stop style={{ stopColor: "#414141", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#535353", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient y2="1038.5814" x2="4.7528968" y1="1051.0466" x1="4.7528968" gradientTransform="matrix(0.99104673,0,0,1.0377289,-0.03213967,-39.635801)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4047`} href={`#${uid}_linearGradient4852-7`} />
        <linearGradient y2="1037.7" x2="8.6566515" y1="1050.7386" x1="8.6566515" gradientTransform="matrix(0.99104673,0,0,1.0377289,-0.03213967,-39.635801)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4049`} href={`#${uid}_linearGradient4844-4`} />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <path style={{ fill: `url(#${uid}_linearGradient4047)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4049)`, strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} d="m 13.267004,1038.2068 c -0.463993,-0.4858 -1.211033,-0.4858 -1.675002,-10e-5 l -3.0849275,3.2304 -3.0849031,-3.2303 c -0.4639226,-0.4858 -1.2110333,-0.4858 -1.6750018,0 l -0.8523552,0.8927 c -0.4639479,0.4856 -0.463936,1.2678 3.62e-5,1.7537 l 3.0848535,3.2303 -3.084858,3.2302 c -0.4640179,0.4858 -0.4640062,1.268 -1.34e-5,1.7538 l 0.852401,0.8927 c 0.4639431,0.4858 1.2109842,0.4858 1.6750016,0 l 3.084908,-3.2302 3.1063417,3.2526 c 0.463945,0.4859 1.210985,0.4859 1.675003,0 l 0.852355,-0.8925 c 0.463969,-0.4859 0.459308,-1.2632 -3.6e-5,-1.7539 l -3.106344,-3.2527 3.084908,-3.2302 c 0.46399,-0.4859 0.463978,-1.2681 3.4e-5,-1.7538 z" />
      </g>
    </svg>
  );
}

export function RemoveAllLaunchesIcon({ size = 14, active = true, className }: IconProps) {
  const uid = useSvgUid("ecl_remall");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" opacity={active ? 1 : 0.4} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient4119`}>
          <stop offset="0" style={{ stopColor: "#2b2b2b", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#686861", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4113`}>
          <stop offset="0" style={{ stopColor: "#d8d8d8", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#d8d8d8", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4852-7`}>
          <stop style={{ stopColor: "#707070", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#a0a0a0", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4844-4`}>
          <stop style={{ stopColor: "#313131", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#696969", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient y2="1038.5814" x2="4.7528968" y1="1051.0466" x1="4.7528968" gradientTransform="matrix(0.85131056,0,0,0.85131056,3.1105797,157.79848)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4047`} href={`#${uid}_linearGradient4852-7`} />
        <linearGradient y2="1037.7" x2="8.6566515" y1="1050.7386" x1="8.6566515" gradientTransform="matrix(0.85131056,0,0,0.85131056,3.1105797,157.79848)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient4049`} href={`#${uid}_linearGradient4844-4`} />
        <linearGradient href={`#${uid}_linearGradient4113`} id={`${uid}_linearGradient4109`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.85131056,0,0,0.85131056,-0.812566,152.8602)" x1="4.7528968" y1="1051.0466" x2="4.7528968" y2="1038.5814" />
        <linearGradient href={`#${uid}_linearGradient4119`} id={`${uid}_linearGradient4111`} gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.85131056,0,0,0.85131056,-0.812566,152.8602)" x1="8.6566515" y1="1050.7386" x2="8.6566515" y2="1037.7" />
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <path style={{ fill: `url(#${uid}_linearGradient4109)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4111)`, strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} d="m 10.611417,1037.0786 c -0.39857,-0.3986 -1.040279,-0.3986 -1.438829,-10e-5 l -2.649957,2.65 -2.6499362,-2.6499 c -0.3985102,-0.3986 -1.0402794,-0.3986 -1.4388289,0 l -0.7321744,0.7322 c -0.3985317,0.3984 -0.3985216,1.0401 3.12e-5,1.4388 l 2.6498934,2.65 -2.6498973,2.6498 c -0.398592,0.3986 -0.3985819,1.0403 -1.14e-5,1.4389 l 0.7322136,0.7322 c 0.3985277,0.3985 1.0402371,0.3985 1.4388286,0 l 2.6499404,-2.6499 2.668352,2.6683 c 0.398529,0.3986 1.040238,0.3986 1.43883,0 l 0.732174,-0.7321 c 0.39855,-0.3986 0.394547,-1.0363 -3.2e-5,-1.4389 l -2.668352,-2.6683 2.649939,-2.6499 c 0.398568,-0.3987 0.398558,-1.0404 2.9e-5,-1.4389 z" />
        <path style={{ fill: `url(#${uid}_linearGradient4047)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient4049)`, strokeWidth: "1", strokeLinecap: "round", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} d="m 14.534563,1042.0169 c -0.39857,-0.3986 -1.040279,-0.3986 -1.438829,-10e-5 l -2.649957,2.65 -2.6499365,-2.6499 c -0.3985102,-0.3986 -1.0402794,-0.3986 -1.4388289,0 l -0.7321744,0.7322 c -0.3985317,0.3984 -0.3985216,1.0401 3.12e-5,1.4388 l 2.6498934,2.65 -2.6498973,2.6498 c -0.398592,0.3986 -0.3985819,1.0403 -1.14e-5,1.4389 l 0.7322136,0.7322 c 0.3985277,0.3985 1.0402371,0.3985 1.4388286,0 l 2.6499407,-2.6499 2.668352,2.6683 c 0.398529,0.3986 1.040238,0.3986 1.43883,0 l 0.732174,-0.7321 c 0.39855,-0.3986 0.394547,-1.0363 -3.2e-5,-1.4389 l -2.668352,-2.6683 2.649939,-2.6499 c 0.398568,-0.3987 0.398558,-1.0404 2.9e-5,-1.4389 z" />
      </g>
    </svg>
  );
}

export function ClearConsoleIcon({ size = 14, className }: IconProps) {
  const uid = useSvgUid("ecl_clr");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}_linearGradient5147`}>
          <stop offset="0" style={{ stopColor: "#91a5c7", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#637aa7", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient5141`}>
          <stop offset="0" style={{ stopColor: "#91a5c7", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#637aa7", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient5135`}>
          <stop offset="0" style={{ stopColor: "#91a5c7", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#637aa7", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4994`}>
          <stop style={{ stopColor: "#f9fafc", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#dce7f7", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4902`}>
          <stop style={{ stopColor: "#c7b571", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#9a9a8f", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4894`}>
          <stop style={{ stopColor: "#e0c88f", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#d5b269", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4877`}>
          <stop offset="0" style={{ stopColor: "#91a5c7", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#5e76a3", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4861`}>
          <stop style={{ stopColor: "#91a5c7", stopOpacity: 1 }} offset="0" />
          <stop style={{ stopColor: "#637aa7", stopOpacity: 1 }} offset="1" />
        </linearGradient>
        <linearGradient href={`#${uid}_linearGradient4877`} id={`${uid}_linearGradient4867`} x1="7.0070496" y1="1043.857" x2="11" y2="1043.857" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-4)" />
        <linearGradient href={`#${uid}_linearGradient4861`} id={`${uid}_linearGradient4869`} x1="7.0070496" y1="1045.857" x2="14" y2="1045.857" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-4)" />
        <linearGradient href={`#${uid}_linearGradient5147`} id={`${uid}_linearGradient4871`} x1="7.0070496" y1="1047.857" x2="14" y2="1047.857" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-4)" />
        <linearGradient href={`#${uid}_linearGradient5135`} id={`${uid}_linearGradient4873`} x1="7.0070496" y1="1051.857" x2="12.016466" y2="1051.857" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-4)" />
        <linearGradient href={`#${uid}_linearGradient5141`} id={`${uid}_linearGradient4875`} x1="7.0070496" y1="1049.857" x2="14" y2="1049.857" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-4)" />
        <linearGradient href={`#${uid}_linearGradient4894`} id={`${uid}_linearGradient4900`} x1="7.9987183" y1="1042.2307" x2="9.9874563" y2="1040.3303" gradientUnits="userSpaceOnUse" gradientTransform="translate(0,-2)" />
        <linearGradient href={`#${uid}_linearGradient4902`} id={`${uid}_linearGradient4908`} x1="10.544736" y1="1038.5779" x2="10.544736" y2="1052.3228" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-2)" />
        <linearGradient href={`#${uid}_linearGradient4994`} id={`${uid}_linearGradient5000`} x1="9.8946028" y1="1039.153" x2="9.8946028" y2="1051.8378" gradientUnits="userSpaceOnUse" gradientTransform="translate(-4,-2)" />
        <linearGradient id={`${uid}_linearGradient4852-7-8`}>
          <stop offset="0" style={{ stopColor: "#707070", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#a0a0a0", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={`${uid}_linearGradient4844-4-1`}>
          <stop offset="0" style={{ stopColor: "#3f3f3f", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "#303030", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient y2="1038.5814" x2="4.7528968" y1="1051.0466" x1="4.7528968" gradientTransform="translate(1.9961442e-6,-9.9830355e-5)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient6120`} href={`#${uid}_linearGradient4852-7-8`} />
        <linearGradient y2="1037.7" x2="8.6566515" y1="1050.7386" x1="8.6566515" gradientTransform="translate(1.9961442e-6,-9.9830355e-5)" gradientUnits="userSpaceOnUse" id={`${uid}_linearGradient6122`} href={`#${uid}_linearGradient4844-4-1`} />
        <mask maskUnits="userSpaceOnUse" id={`${uid}_mask6204`}>
          <path style={{ color: "#000000", fill: "#ffffff", fillOpacity: 1, stroke: "none", strokeWidth: "1", marker: "none", visibility: "visible", display: "inline", overflow: "visible" }} d="m 1,1036.3935 0,0.5 0,12.9687 0,0.5 0.5,0 10.0625,0 0.5,0 0,-0.5 0,-9.9687 0,-0.2188 -0.15625,-0.125 -3.0625,-3 -0.125,-0.1562 -0.21875,0 -7,0 -0.5,0 z" />
        </mask>
      </defs>
      <g style={{ display: "inline" }} transform="translate(0,-1036.3622)">
        <path style={{ fill: `url(#${uid}_linearGradient5000)`, fillOpacity: 1, stroke: "none", display: "inline" }} d="m 1.4972825,1036.9037 7.0096685,0 3.062057,3.0066 0,9.9546 -10.0717255,0 z" />
        <path style={{ fill: `url(#${uid}_linearGradient4900)`, fillOpacity: 1, stroke: "none" }} d="m 7.976621,1036.441 0,3.9112 3.977476,0 z" />
        <path style={{ fill: "none", stroke: `url(#${uid}_linearGradient4908)`, strokeWidth: "1", strokeLinecap: "butt", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDashoffset: "0" }} d="m 1.4972825,1036.9037 7.0096685,0 3.062057,3.0066 0,9.9546 -10.0717255,0 z" />
        <rect style={{ fill: `url(#${uid}_linearGradient4867)`, fillOpacity: 1, stroke: "none", display: "inline" }} width="3.9929504" height="1.0103934" x="3.0070496" y="1039.3518" />
        <rect style={{ fill: `url(#${uid}_linearGradient4869)`, fillOpacity: 1, stroke: "none", display: "inline" }} width="6.9929504" height="1.0103934" x="3.0070496" y="1041.3518" />
        <rect style={{ fill: `url(#${uid}_linearGradient4871)`, fillOpacity: 1, stroke: "none", display: "inline" }} width="6.9929504" height="1.0103934" x="3.0070496" y="1043.3518" />
        <rect style={{ fill: `url(#${uid}_linearGradient4875)`, fillOpacity: 1, stroke: "none", display: "inline" }} width="6.9929504" height="1.0103934" x="3.0070496" y="1045.3518" />
        <rect style={{ fill: `url(#${uid}_linearGradient4873)`, fillOpacity: 1, stroke: "none", display: "inline" }} width="5.0094166" height="1.0103934" x="3.0070496" y="1047.3518" />
        <g mask={`url(#${uid}_mask6204)`} transform="matrix(1.4660179,0,0,1.2212682,-5.6373987,-232.07964)">
          <g transform="matrix(0.53947849,0,0,0.53947849,7.846281,484.46953)" style={{ opacity: 0.75, fill: "#ffffff", stroke: "#ffffff", strokeWidth: "3.70728397", strokeMiterlimit: "4", strokeDasharray: "none", display: "inline" }}>
            <path style={{ fill: "#ffffff", fillOpacity: 1, stroke: "#ffffff", strokeWidth: "3.70728397", strokeLinecap: "round", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} d="m 13.419292,1038.6553 c -0.468185,-0.4682 -1.221974,-0.4682 -1.690135,-10e-5 l -3.1127968,3.1129 -3.1127723,-3.1128 c -0.4681138,-0.4682 -1.221974,-0.4682 -1.690134,0 l -0.8600555,0.8601 c -0.4681391,0.468 -0.4681272,1.2218 3.66e-5,1.6901 l 3.1127223,3.1128 -3.1127269,3.1127 c -0.4682099,0.4682 -0.468198,1.222 -1.34e-5,1.6902 l 0.8601016,0.8601 c 0.4681344,0.4681 1.2219244,0.4681 1.6901337,0 l 3.1127774,-3.1128 3.1344053,3.1344 c 0.468135,0.4682 1.221925,0.4682 1.690135,0 l 0.860055,-0.86 c 0.46816,-0.4682 0.463458,-1.2173 -3.7e-5,-1.6902 l -3.134406,-3.1344 3.112777,-3.1127 c 0.468181,-0.4683 0.468169,-1.2221 3.4e-5,-1.6902 z" />
          </g>
        </g>
        <g style={{ display: "inline" }} transform="matrix(0.50767387,0,0,0.5061245,8.120638,519.33645)">
          <path style={{ fill: "#ffffff", fillOpacity: 1, stroke: "#ffffff", strokeWidth: "0.50689858", strokeOpacity: 1 }} d="m 10.09375,7.0489054 c -0.3172668,0.031974 -0.6221509,0.15383 -0.78125,0.3125 l -0.59375,0.5625 C 8.400566,8.241043 8.3380492,9.7451599 8.65625,10.0625 L 10.25,11.59375 8.59375,13.1875 C 8.4346339,13.346119 8.405526,13.69178 8.4375,14.03125 l 3.59375,0 0,-5.7010946 -1.125,-1.09375 c -0.159083,-0.15867 -0.495233,-0.2194744 -0.8125,-0.1875 z" transform="matrix(1.9697685,0,0,1.9757984,-15.995777,1021.5387)" />
          <path d="m 13.419292,1038.6553 c -0.468185,-0.4682 -1.221974,-0.4682 -1.690135,-10e-5 l -3.1127968,3.1129 -3.1127723,-3.1128 c -0.4681138,-0.4682 -1.221974,-0.4682 -1.690134,0 l -0.8600555,0.8601 c -0.4681391,0.468 -0.4681272,1.2218 3.66e-5,1.6901 l 3.1127223,3.1128 -3.1127269,3.1127 c -0.4682099,0.4682 -0.468198,1.222 -1.34e-5,1.6902 l 0.8601016,0.8601 c 0.4681344,0.4681 1.2219244,0.4681 1.6901337,0 l 3.1127774,-3.1128 3.1344053,3.1344 c 0.468135,0.4682 1.221925,0.4682 1.690135,0 l 0.860055,-0.86 c 0.46816,-0.4682 0.463458,-1.2173 -3.7e-5,-1.6902 l -3.134406,-3.1344 3.112777,-3.1127 c 0.468181,-0.4683 0.468169,-1.2221 3.4e-5,-1.6902 z" style={{ fill: `url(#${uid}_linearGradient6120)`, fillOpacity: 1, stroke: `url(#${uid}_linearGradient6122)`, strokeWidth: "1.97278117", strokeLinecap: "round", strokeLinejoin: "miter", strokeMiterlimit: "4", strokeOpacity: 1, strokeDasharray: "none", strokeDashoffset: "0", display: "inline" }} />
        </g>
      </g>
    </svg>
  );
}

export function ScrollLockIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="3" y="1.8" width="8" height="10.4" fill="#FFFFFF" stroke="#6E7A8A" strokeWidth="0.9" />
      <rect x="5" y="6.8" width="5.5" height="4.4" rx="0.6" fill="#E8BA46" stroke="#8C6715" strokeWidth="0.8" />
      <path d="M6.2 6.8V5.4a1.6 1.6 0 0 1 3.1 0v1.4" fill="none" stroke="#6B5416" strokeWidth="1" />
    </svg>
  );
}

export function WordWrapIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2.2" y="2" width="8.5" height="10" fill="#FFFFFF" stroke="#6E7A8A" strokeWidth="0.9" />
      <path d="M4.5 6.5h4.5a1.5 1.5 0 0 1 0 3H7.5" fill="none" stroke="#C9832B" strokeWidth="1.2" />
      <polygon points="7.8,8 6,9.5 7.8,11" fill="#C9832B" />
    </svg>
  );
}

export function ConsoleStdoutToggleIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.8" y="2.2" width="10.4" height="7.6" fill="#465C78" stroke="#283A52" strokeWidth="0.8" />
      <rect x="2.8" y="3.2" width="8.4" height="5.6" fill="#FFFFFF" />
      <line x1="3.8" y1="4.8" x2="9.5" y2="4.8" stroke="#4D688A" strokeWidth="0.9" />
      <line x1="3.8" y1="6.6" x2="8" y2="6.6" stroke="#4D688A" strokeWidth="0.9" />
      <rect x="4.8" y="10.2" width="4.4" height="1.8" fill="#5D7491" />
    </svg>
  );
}

export function ConsoleStderrToggleIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.8" y="2.2" width="10.4" height="7.6" fill="#465C78" stroke="#283A52" strokeWidth="0.8" />
      <rect x="2.8" y="3.2" width="8.4" height="5.6" fill="#FFFFFF" />
      <rect x="6.3" y="3.7" width="1.5" height="3" fill="#D93232" />
      <rect x="6.3" y="7.2" width="1.5" height="1.2" fill="#D93232" />
      <rect x="4.8" y="10.2" width="4.4" height="1.8" fill="#5D7491" />
    </svg>
  );
}

export function PinConsoleIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M5.5 2.5h4.2l-0.8 3.2 1.6 1.5H4.2l1.6-1.5z" fill="#50A842" stroke="#265E1E" strokeWidth="0.8" />
      <line x1="7.2" y1="7.2" x2="7.2" y2="12.2" stroke="#4D5B6B" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function DisplayConsoleIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.8" y="2.2" width="10.4" height="7.6" fill="#5A6F8A" stroke="#314359" strokeWidth="0.8" />
      <rect x="2.8" y="3.2" width="8.4" height="5.6" fill="#E3EAF2" />
      <rect x="4.8" y="10.2" width="4.4" height="1.8" fill="#5A6F8A" />
    </svg>
  );
}

export function OpenConsoleIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.8" y="3" width="10" height="7.4" fill="#5A6F8A" stroke="#314359" strokeWidth="0.8" />
      <rect x="2.8" y="4" width="8" height="5.4" fill="#E3EAF2" />
      <path d="M11 1l0.4 1.2 1.2 0.4-1.2 0.4-0.4 1.2-0.4-1.2-1.2-0.4 1.2-0.4z" fill="#F2B705" stroke="#9C6B00" strokeWidth="0.4" />
    </svg>
  );
}
