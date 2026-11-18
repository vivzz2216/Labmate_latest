import Link from "next/link";
import type { IconType } from "react-icons";
import { FaJava } from "react-icons/fa";
import { BsFileEarmarkWordFill } from "react-icons/bs";
import {
  SiC,
  SiCplusplus,
  SiGooglecolab,
  SiHtml5,
  SiJavascript,
  SiMysql,
  SiPython,
  SiPytorch,
  SiR,
  SiReact,
  SiTensorflow,
  SiWireshark,
} from "react-icons/si";
import styles from "./RuntimeLogos.module.css";

type Mark = { icon: IconType; color: string; label: string };
type Runtime = { name: string; detail: string; href: string; marks: Mark[] };

// Official brand marks (Simple Icons / Font Awesome) in their brand colours, each on a light tile so dark brand
// colours (C++, MySQL, Word) stay legible on the black page.
const RUNTIMES: Runtime[] = [
  { name: "Deep Learning", detail: "PyTorch · TensorFlow", href: "/labs/deep-learning", marks: [
    { icon: SiPytorch, color: "#EE4C2C", label: "PyTorch" },
    { icon: SiTensorflow, color: "#FF6F00", label: "TensorFlow" },
  ] },
  { name: "Distributed Computing", detail: "Java RMI · sockets", href: "/labs/distributed-computing", marks: [
    { icon: FaJava, color: "#E76F00", label: "Java" },
  ] },
  { name: "Python", detail: "IDLE · Jupyter", href: "/labs/python", marks: [
    { icon: SiPython, color: "#3776AB", label: "Python" },
  ] },
  { name: "Java", detail: "OpenJDK", href: "/labs/java", marks: [
    { icon: FaJava, color: "#E76F00", label: "Java" },
  ] },
  { name: "C / C++", detail: "GCC · Code::Blocks", href: "/labs/c-cpp", marks: [
    { icon: SiC, color: "#3949AB", label: "C" },
    { icon: SiCplusplus, color: "#00599C", label: "C++" },
  ] },
  { name: "Web development", detail: "HTML · JS · React", href: "/labs/web-development", marks: [
    { icon: SiHtml5, color: "#E34F26", label: "HTML5" },
    { icon: SiJavascript, color: "#E8C400", label: "JavaScript" },
    { icon: SiReact, color: "#149ECA", label: "React" },
  ] },
  { name: "SQL", detail: "MySQL", href: "/labs/sql", marks: [
    { icon: SiMysql, color: "#00618A", label: "MySQL" },
  ] },
  { name: "Google Colab", detail: "Notebooks", href: "/labs/colab", marks: [
    { icon: SiGooglecolab, color: "#F9AB00", label: "Google Colab" },
  ] },
  { name: "R programming", detail: "RStudio", href: "/labs/r", marks: [
    { icon: SiR, color: "#276DC3", label: "R" },
  ] },
  { name: "Networks", detail: "Wireshark studio", href: "/networks/wireshark", marks: [
    { icon: SiWireshark, color: "#1679A7", label: "Wireshark" },
  ] },
  { name: "Word report", detail: ".docx output", href: "/samples", marks: [
    { icon: BsFileEarmarkWordFill, color: "#2B579A", label: "Microsoft Word" },
  ] },
];

export default function RuntimeLogos() {
  return (
    <section id="runtimes" className={styles.section} aria-labelledby="runtimes-heading">
      <p id="runtimes-heading" className={styles.title}>Labs, runtimes &amp; outputs LabMate supports</p>
      <ul className={styles.grid}>
        {RUNTIMES.map((runtime) => (
          <li key={runtime.name}>
            <Link href={runtime.href} className={styles.chip} title={`${runtime.name} (${runtime.detail})`}>
              <span className={styles.marks} aria-hidden="true">
                {runtime.marks.map(({ icon: Icon, color, label }) => (
                  <span key={label} className={styles.tile}>
                    <Icon size={17} color={color} />
                  </span>
                ))}
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{runtime.name}</span>
                <span className={styles.detail}>{runtime.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
