"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { IconType } from "react-icons";
import { FaJava } from "react-icons/fa";
import { Network } from "lucide-react";
import {
  SiCplusplus,
  SiGooglecolab,
  SiHtml5,
  SiMysql,
  SiPython,
  SiPytorch,
  SiUbuntu,
  SiWireshark,
} from "react-icons/si";
import styles from "./HomepageSections.module.css";

type Template = { name: string; image: string; caption: string };
type Lab = {
  id: string;
  name: string;
  icon: IconType;
  color: string;
  href?: string;
  status: "available" | "studio" | "soon";
  description: string;
  templates: Template[];
};

const L = "/images/labs/";
// Every image is a real capture or a real report screenshot from LabMate itself. Frames are 16:10 and images are
// letterboxed (never stretched or cropped), so the showcase keeps one size while each tool keeps its own proportions.
const labs: Lab[] = [
  { id: "deep-learning", name: "Deep Learning", icon: SiPytorch, color: "#EE4C2C", href: "/labs/deep-learning", status: "available",
    description: "Neural networks with PyTorch, TensorFlow and Keras. Training output and plots appear in a Colab-style notebook.",
    templates: [
      { name: "Colab · Dark", image: "colab-dark-hd.webp", caption: "Notebook code and output · Colab-style dark theme (sample exercise)" },
      { name: "Colab · Light", image: "colab-light-hd.webp", caption: "Notebook code and output · Colab-style light theme (sample exercise)" },
    ] },
  { id: "distributed", name: "Distributed Computing", icon: FaJava, color: "#E76F00", href: "/labs/distributed-computing", status: "available",
    description: "Multi-process Java: TCP and UDP sockets, Java RMI and consensus algorithms, captured in VS Code.",
    templates: [
      { name: "VS Code", image: "web-code-hd.webp", caption: "VS Code Dark Modern capture style (sample file shown)" },
    ] },
  { id: "python", name: "Python", icon: SiPython, color: "#3776AB", href: "/labs/python", status: "available",
    description: "Functions, OOP and programming practicals. Choose the editor your college uses.",
    templates: [
      { name: "IDLE editor", image: "idle-hd.webp", caption: "Python IDLE editor · Windows" },
      { name: "IDLE shell", image: "idle-shell-hd.webp", caption: "Python IDLE shell · Windows" },
      { name: "Jupyter · Light", image: "jupyter-hd.webp", caption: "JupyterLab-style notebook · light theme" },
      { name: "Jupyter · Dark", image: "jupyter-dark-reference.webp", caption: "JupyterLab-style notebook · dark theme" },
    ] },
  { id: "java", name: "Java", icon: FaJava, color: "#E76F00", href: "/labs/java", status: "available",
    description: "Java source and output in the IDE your lab uses: Eclipse, IntelliJ IDEA, or Notepad with a command prompt.",
    templates: [
      { name: "Eclipse", image: "eclipse-hd.webp", caption: "Eclipse IDE · source with Console output" },
      { name: "IntelliJ IDEA", image: "intellij-hd.webp", caption: "IntelliJ IDEA · source with Run window" },
      { name: "Notepad", image: "java-hd.webp", caption: "Java source · Windows Notepad" },
      { name: "Command Prompt", image: "java-output-hd.webp", caption: "Java compile and run · Windows Command Prompt" },
    ] },
  { id: "c-cpp", name: "C / C++", icon: SiCplusplus, color: "#00599C", href: "/labs/c-cpp", status: "available",
    description: "Programming and data-structure exercises, with Code::Blocks source and Windows-style output.",
    templates: [
      { name: "Code::Blocks", image: "cpp-hd.webp", caption: "C++ source · Code::Blocks" },
      { name: "Command Prompt", image: "cpp-output-hd.webp", caption: "C++ output · Windows Command Prompt" },
    ] },
  { id: "web", name: "Web Development", icon: SiHtml5, color: "#E34F26", href: "/labs/web-development", status: "available",
    description: "HTML, CSS, JavaScript, React and Node.js. Source in VS Code; web output in a browser frame.",
    templates: [
      { name: "VS Code", image: "web-code-hd.webp", caption: "Web source · VS Code Dark Modern" },
      { name: "Microsoft Edge", image: "web-output-hd.webp", caption: "Example portfolio output · Microsoft Edge" },
    ] },
  { id: "sql", name: "SQL", icon: SiMysql, color: "#00618A", href: "/labs/sql", status: "available",
    description: "MySQL queries, tables and result grids shown together, in the order they ran.",
    templates: [
      { name: "MySQL Workbench", image: "mysql-hd.webp", caption: "GROUP BY query and its result · MySQL Workbench-style capture" },
      { name: "MySQL command line", image: "mysqlcli-hd.webp", caption: "MySQL command-line client" },
    ] },
  { id: "colab", name: "Google Colab", icon: SiGooglecolab, color: "#F9AB00", href: "/labs/colab", status: "available",
    description: "Python notebooks and data-science practicals with code cells and their output, in a light or dark theme.",
    templates: [
      { name: "Light", image: "colab-light-hd.webp", caption: "Notebook code and output · Colab-style light theme" },
      { name: "Dark", image: "colab-dark-hd.webp", caption: "Notebook code and output · Colab-style dark theme" },
    ] },
  { id: "packet-tracer", name: "Cisco Packet Tracer", icon: Network, color: "#049FD9", href: "/networks/packet-tracer", status: "studio",
    description: "A practice studio for network labs: place devices, cable them and follow guided steps. It is LabMate's own simulator, not Cisco's software.",
    templates: [
      { name: "Topology", image: "packettracer-hd.webp", caption: "LabMate Packet Tracer-style practice studio · star topology with a hub" },
    ] },
  { id: "wireshark", name: "Wireshark", icon: SiWireshark, color: "#1679A7", href: "/networks/wireshark", status: "studio",
    description: "A practice packet analyser: open a capture, apply display filters, read headers and follow streams. LabMate's own engine, not Wireshark.",
    templates: [
      { name: "Packet list", image: "wireshark-hd.webp", caption: "LabMate Wireshark-style practice studio · ARP, DNS, TCP, HTTP and ICMP capture" },
    ] },
  { id: "ubuntu", name: "Ubuntu", icon: SiUbuntu, color: "#E95420", status: "soon",
    description: "Linux command labs with real Ubuntu terminal and text-editor captures. This lab is in development; its screenshots will be added when it launches.",
    templates: [] },
];

const STATUS_LABEL = { available: "Available", studio: "Practice studio", soon: "In development" } as const;

export default function LabShowcase() {
  const [labIndex, setLabIndex] = useState(0);
  const [templateIndex, setTemplateIndex] = useState(0);
  const lab = labs[labIndex];
  const template = lab.templates[templateIndex] || lab.templates[0];
  const src = template ? L + template.image : "";

  return (
    <section id="labs" className={styles.section} aria-labelledby="labs-heading">
      <div className={styles.sectionHeader}>
        <h2 id="labs-heading">Your lab.<br /><span>Your familiar workspace.</span></h2>
        <p>
          See the labs available today and the screenshot styles that go into your Word report.{" "}
          <Link href="/labs" className={styles.inlineLink}>Explore full lab catalog →</Link>
        </p>
      </div>

      <div className={styles.gallery}>
        <div className={styles.labList} role="group" aria-label="Labs">
          {labs.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-pressed={labIndex === index} className={styles.labButton}
                onClick={() => { setLabIndex(index); setTemplateIndex(0); }}>
                <span className={styles.labIcon} aria-hidden="true"><Icon size={16} color={item.color} /></span>
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.galleryDetail} aria-live="polite" aria-atomic="true">
          <div className={styles.detailHeading}>
            <h3>{lab.name}</h3>
            <span className={`${styles.status} ${styles[`status_${lab.status}`]}`}>{STATUS_LABEL[lab.status]}</span>
            {lab.href && <Link href={lab.href} className={styles.openLab}>Open lab →</Link>}
          </div>
          <p className={styles.labDescription}>{lab.description}</p>

          {template ? (
            <>
              {lab.templates.length > 1 && (
                <div className={styles.templateChoices} role="group" aria-label={`${lab.name} screenshot styles`}>
                  {lab.templates.map((item, index) => (
                    <button key={item.name} type="button" aria-pressed={template === item} onClick={() => setTemplateIndex(index)}>{item.name}</button>
                  ))}
                </div>
              )}
              <figure className={styles.preview}>
                <div className={styles.frame}>
                  <Image key={src} src={src} alt={template.caption} fill sizes="(max-width: 900px) 100vw, 880px" className={styles.frameImage} unoptimized />
                </div>
                <figcaption>
                  <span>{template.caption}</span>
                  <a href={src} target="_blank" rel="noreferrer">View full size ↗</a>
                </figcaption>
              </figure>
            </>
          ) : (
            <div className={styles.soon}>
              <SiUbuntu size={28} color="#E95420" aria-hidden="true" />
              <p>Ubuntu desktop and terminal screenshots are captured from a native Ubuntu session, so none are shown until this lab ships.</p>
            </div>
          )}
        </div>
      </div>
      <p className={styles.galleryFootnote}>Previews use sample exercises. Choose your screenshot style before processing a manual.</p>

      <p className={styles.roadmap}>
        <strong>Also available:</strong> R programming and Social Media Analytics. <strong>In development:</strong> Git and GitHub, DevOps (Jenkins, Docker, Kubernetes, Terraform, Ansible), MLOps (MLflow, Airflow), PROLOG, GNS3 and Mininet.
      </p>
    </section>
  );
}
