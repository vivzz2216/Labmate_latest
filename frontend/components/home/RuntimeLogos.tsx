import type { IconType } from "react-icons";
import LogoLoop from "./LogoLoop";
import { FaChartBar, FaJava, FaTerminal } from "react-icons/fa";
import { BsFileEarmarkWordFill } from "react-icons/bs";
import {
  SiC,
  SiCplusplus,
  SiAndroidstudio,
  SiCisco,
  SiEclipseide,
  SiGooglecolab,
  SiHtml5,
  SiJavascript,
  SiIntellijidea,
  SiJupyter,
  SiMysql,
  SiPython,
  SiPytorch,
  SiR,
  SiReact,
  SiSqlite,
  SiTensorflow,
  SiUbuntu,
  SiWireshark,
} from "react-icons/si";
import styles from "./RuntimeLogos.module.css";

type Mark = { icon: IconType; color: string; label: string };
type Runtime = { name: string; detail: string; href: string; marks: Mark[] };

// Official brand marks (Simple Icons / Font Awesome) in their brand colours, each on a light tile so dark brand
// colours (C++, MySQL, Word) stay legible on the black page.
const RUNTIMES: Runtime[] = [
  { name: "Deep Learning", detail: "PyTorch · TensorFlow", href: "/code-execution?lab=deep-learning&track=deep_learning", marks: [
    { icon: SiPytorch, color: "#EE4C2C", label: "PyTorch" },
    { icon: SiTensorflow, color: "#FF6F00", label: "TensorFlow" },
  ] },
  { name: "Distributed Computing", detail: "Java RMI · sockets", href: "/code-execution?lab=distributed-computing&track=distributed", marks: [
    { icon: FaJava, color: "#E76F00", label: "Java" },
  ] },
  { name: "Python", detail: "IDLE · Jupyter · VS Code", href: "/code-execution?lab=python&track=python", marks: [
    { icon: SiPython, color: "#3776AB", label: "Python" },
    { icon: SiJupyter, color: "#F37626", label: "Jupyter" },
  ] },
  { name: "Java", detail: "Notepad · Eclipse · IntelliJ · VS Code", href: "/code-execution?lab=java&track=java", marks: [
    { icon: FaJava, color: "#E76F00", label: "Java" },
    { icon: SiEclipseide, color: "#2C2255", label: "Eclipse" },
    { icon: SiIntellijidea, color: "#111111", label: "IntelliJ IDEA" },
  ] },
  { name: "C / C++", detail: "GCC · Code::Blocks", href: "/code-execution?lab=c-cpp&track=cpp", marks: [
    { icon: SiC, color: "#3949AB", label: "C" },
    { icon: SiCplusplus, color: "#00599C", label: "C++" },
  ] },
  { name: "Web development", detail: "HTML · JS · React", href: "/code-execution?lab=web-development&track=web", marks: [
    { icon: SiHtml5, color: "#E34F26", label: "HTML5" },
    { icon: SiJavascript, color: "#E8C400", label: "JavaScript" },
    { icon: SiReact, color: "#149ECA", label: "React" },
  ] },
  { name: "SQL", detail: "Workbench · DB Browser · MySQL CLI", href: "/code-execution?lab=sql&track=sql", marks: [
    { icon: SiMysql, color: "#00618A", label: "MySQL" },
    { icon: SiSqlite, color: "#003B57", label: "SQLite" },
    { icon: FaTerminal, color: "#41414a", label: "SQL command line" },
  ] },
  { name: "Google Colab", detail: "Notebooks", href: "/code-execution?lab=colab&track=colab", marks: [
    { icon: SiGooglecolab, color: "#F9AB00", label: "Google Colab" },
  ] },
  { name: "R programming", detail: "RStudio", href: "/code-execution?lab=r&track=r", marks: [
    { icon: SiR, color: "#276DC3", label: "R" },
  ] },
  { name: "Networks", detail: "Wireshark · Packet Tracer", href: "/networks/wireshark", marks: [
    { icon: SiWireshark, color: "#1679A7", label: "Wireshark" },
    { icon: SiCisco, color: "#049FD9", label: "Cisco" },
  ] },
  { name: "Ubuntu", detail: "Terminal · Text Editor", href: "/labs", marks: [
    { icon: SiUbuntu, color: "#E95420", label: "Ubuntu" },
  ] },
  { name: "Power BI", detail: "Analytics workspace", href: "/power-bi", marks: [
    { icon: FaChartBar, color: "#D6A900", label: "Power BI" },
  ] },
  { name: "Android development", detail: "Android Studio", href: "/android-studio", marks: [
    { icon: SiAndroidstudio, color: "#3DDC84", label: "Android Studio" },
  ] },
  { name: "Word report", detail: ".docx output", href: "/reports", marks: [
    { icon: BsFileEarmarkWordFill, color: "#2B579A", label: "Microsoft Word" },
  ] },
];

export default function RuntimeLogos() {
  const logos = RUNTIMES.map((runtime) => ({
    title: runtime.name,
    ariaLabel: `${runtime.name}: ${runtime.detail}`,
    href: runtime.href,
    node: <span className={styles.marks}>{runtime.marks.map(({ icon: Icon, color, label }) => <Icon key={label} color={color} aria-hidden="true" />)}</span>,
  }));
  return (
    <section id="runtimes" className={styles.section} aria-labelledby="runtimes-heading">
      <p id="runtimes-heading" className={styles.title}>Labs, runtimes &amp; outputs LabMate supports</p>
      <LogoLoop logos={logos} speed={55} direction="left" logoHeight={32} gap={56} hoverSpeed={0} scaleOnHover labels="below" ariaLabel="Supported labs and tools" />
    </section>
  );
}
