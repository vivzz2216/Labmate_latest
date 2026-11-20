"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { IconType } from "react-icons";
import { FaJava } from "react-icons/fa";
import { BarChart3, Network } from "lucide-react";
import {
  SiCplusplus,
  SiAndroidstudio,
  SiDocker,
  SiGooglecolab,
  SiHtml5,
  SiMysql,
  SiKubernetes,
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
  status: "available" | "studio" | "soon" | "planned";
  description: string;
  templates: Template[];
};

const L = "/images/labs/";
// Showcase images come from sample runs or from the LabMate workspaces.
// Paired images show the source and output of the same run.
const labs: Lab[] = [
  {
    id: "deep-learning", name: "Deep Learning", icon: SiPytorch, color: "#EE4C2C", href: "/labs/deep-learning", status: "available",
    description: "Neural networks with PyTorch, TensorFlow and Keras. Training output and plots appear in a Colab-style notebook.",
    templates: [
      { name: "Model results", image: "showcase-deep-learning-plots.webp", caption: "PyTorch digit classifier · training loss and the test confusion matrix" },
      { name: "Training log", image: "showcase-deep-learning-training.webp", caption: "CPU training and evaluation · 96.39% accuracy on 360 held-out digits" },
    ]
  },
  {
    id: "distributed", name: "Distributed Computing", icon: FaJava, color: "#E76F00", href: "/labs/distributed-computing", status: "available",
    description: "Multi-process Java: TCP and UDP sockets, Java RMI and consensus algorithms, captured in VS Code.",
    templates: [
      { name: "Server code", image: "showcase-distributed-source.webp", caption: "Java TCP server source · listens for and replies to local clients" },
      { name: "Client and server output", image: "showcase-distributed-run.webp", caption: "Actual TCP execution · client requests, server replies, and shutdown in the VS Code terminal" },
    ]
  },
  {
    id: "python", name: "Python", icon: SiPython, color: "#3776AB", href: "/labs/python", status: "available",
    description: "Functions, OOP and programming practicals. Choose the editor your college uses.",
    templates: [
      { name: "IDLE editor", image: "showcase-python-idle-editor.webp", caption: "Python IDLE editor · a function that squares its input" },
      { name: "IDLE shell", image: "showcase-python-idle-shell.webp", caption: "Python IDLE shell · result from the same function" },
      { name: "Jupyter · Light", image: "showcase-python-jupyter-light.webp", caption: "Jupyter notebook in light mode · a function and its executed output" },
      { name: "Jupyter · Dark", image: "showcase-python-jupyter-dark.webp", caption: "Jupyter notebook in dark mode · attendance statistics from an executed cell" },
    ]
  },
  {
    id: "java", name: "Java", icon: FaJava, color: "#E76F00", href: "/labs/java", status: "available",
    description: "Java source and output in the IDE your lab uses: Eclipse, IntelliJ IDEA, or Notepad with a command prompt.",
    templates: [
      { name: "Eclipse", image: "showcase-java-eclipse.webp", caption: "Eclipse workspace · student records sorted by marks and name" },
      { name: "IntelliJ IDEA", image: "showcase-java-intellij.webp", caption: "IntelliJ IDEA workspace · a frequency map and its console output" },
      { name: "Notepad + Command Prompt", image: "showcase-java-notepad.webp", caption: "Java source, compilation, and output · Notepad and Command Prompt from the same run" },
    ]
  },
  {
    id: "c-cpp", name: "C / C++", icon: SiCplusplus, color: "#00599C", href: "/labs/c-cpp", status: "available",
    description: "Programming and data-structure exercises, with Code::Blocks source and Windows-style output.",
    templates: [
      { name: "C · Code::Blocks", image: "showcase-c-marks.webp", caption: "C arrays in Code::Blocks · marks, average, and highest score" },
      { name: "C++ · Code::Blocks", image: "showcase-cpp-stack.webp", caption: "C++ stack in Code::Blocks · undo operation and remaining stack size" },
    ]
  },
  {
    id: "web", name: "Web Development", icon: SiHtml5, color: "#E34F26", href: "/labs/web-development", status: "available",
    description: "HTML, CSS, JavaScript, React and Node.js. Source in VS Code; web output in a browser frame.",
    templates: [
      { name: "React in browser", image: "showcase-react-browser.webp", caption: "Running React experiment tracker · filter narrowed the list to two practicals" },
      { name: "React in VS Code", image: "showcase-react-source.webp", caption: "React source in VS Code · state and filtering for the same tracker" },
      { name: "HTML portfolio", image: "showcase-web-portfolio.webp", caption: "HTML and CSS portfolio · rendered in a Microsoft Edge frame" },
    ]
  },
  {
    id: "sql", name: "SQL", icon: SiMysql, color: "#00618A", href: "/labs/sql", status: "available",
    description: "Compare a SQLite shell session, a MySQL Workbench report, and the DB Browser for SQLite workspace.",
    templates: [
      { name: "MySQL Workbench", image: "showcase-sql-workbench.webp", caption: "MySQL Workbench report · executing a GROUP BY query and inspecting its result grid" },
      { name: "SQLite", image: "showcase-sqlite-shell.webp", caption: "SQLite shell session · stock rows and the calculated inventory total" },
      { name: "DB Browser for SQLite", image: "showcase-sqlite-browser.webp", caption: "DB Browser for SQLite workspace · a join result alongside the database schema" },
    ]
  },
  {
    id: "colab", name: "Google Colab", icon: SiGooglecolab, color: "#F9AB00", href: "/labs/colab", status: "available",
    description: "Python data science practicals with executed notebook cells, calculated results, and plots.",
    templates: [
      { name: "Clean and summarise data", image: "showcase-colab-cleaning.webp", caption: "Colab notebook · Pandas cleaning code, grouped marks, and the resulting chart" },
      { name: "Evaluate a classifier", image: "showcase-colab-classifier.webp", caption: "Colab notebook · Iris classification results and a held-out confusion matrix" },
    ]
  },
  {
    id: "android-studio", name: "Android Studio", icon: SiAndroidstudio, color: "#3DDC84", href: "/android-studio", status: "available",
    description: "Interactive Android Studio workspace for Java/Kotlin apps, XML layouts, Logcat, and live activity preview.",
    templates: []
  },
  {
    id: "docker", name: "Docker", icon: SiDocker, color: "#2496ED", status: "soon",
    description: "A Docker learning workspace is in development.", templates: []
  },
  {
    id: "kubernetes", name: "Kubernetes", icon: SiKubernetes, color: "#326CE5", status: "soon",
    description: "A Kubernetes learning workspace is in development.", templates: []
  },
  {
    id: "power-bi", name: "Power BI", icon: BarChart3, color: "#E9BA13", href: "/power-bi", status: "available",
    description: "A Power BI Desktop workspace for CSV/Excel data import, interactive charts, DAX measures, and reports.",
    templates: []
  },
  {
    id: "packet-tracer", name: "Cisco Packet Tracer", icon: Network, color: "#049FD9", href: "/networks/packet-tracer", status: "available",
    description: "Network topology workspace: place routers, switches, and workstations, configure interfaces, and inspect packet transmissions in simulation mode.",
    templates: [
      { name: "Network topology", image: "showcase-packet-tracer.webp", caption: "Cisco Packet Tracer · three PCs connected in a star topology through a hub" },
      { name: "Device configuration", image: "showcase-packet-tracer-config.webp", caption: "Cisco Packet Tracer · inspecting a PC's network configuration" },
    ]
  },
  {
    id: "wireshark", name: "Wireshark", icon: SiWireshark, color: "#1679A7", href: "/networks/wireshark", status: "available",
    description: "Deep network packet analyzer: open capture files, apply display filters, inspect multi-layer packet headers, and follow TCP streams.",
    templates: [
      { name: "Packet list", image: "showcase-wireshark-packets.webp", caption: "Wireshark · ARP, DNS, TCP, HTTP, and ICMP traffic" },
      { name: "DNS inspection", image: "showcase-wireshark-dns.webp", caption: "Wireshark · DNS filter, packet headers, and captured bytes" },
    ]
  },
  {
    id: "ubuntu", name: "Ubuntu", icon: SiUbuntu, color: "#E95420", status: "planned",
    description: "A preview from LabMate’s local Ubuntu environment, with native terminal and text editor captures.",
    templates: [
      { name: "Terminal", image: "showcase-ubuntu-native-terminal.webp", caption: "Ubuntu terminal · running a Bash arithmetic practical with inputs 12 and 4" },
      { name: "Text editor", image: "showcase-ubuntu-native-editor.webp", caption: "GNOME Text Editor · Bash source for the same arithmetic practical" },
    ]
  },
];

const STATUS_LABEL = { available: "Available", studio: "Practice studio", soon: "In development", planned: "Developed · coming later" } as const;

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
          See sample lab runs, report screenshots, and standalone workspaces.{" "}
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
            {lab.href && lab.status !== "planned" && <Link href={lab.href} className={styles.openLab}>Open lab →</Link>}
          </div>
          <p className={styles.labDescription}>{lab.description}</p>
          {lab.status === "planned" && (
            <p className={styles.labDescription}>Available when LabMate reaches 100+ students and included in your pack.</p>
          )}

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
              <lab.icon size={28} color={lab.color} aria-hidden="true" />
              <p>{lab.status === "soon" ? "This workspace is in development." : "This workspace is coming later."}</p>
            </div>
          )}
        </div>
      </div>
      <p className={styles.galleryFootnote}>Screenshots from LabMate sample exercises. Open a preview at full size to read the code and results.</p>

      <p className={styles.roadmap}>
        <strong>Also available:</strong> R programming and Social Media Analytics. <strong>In development:</strong> Git and GitHub, DevOps (Jenkins, Terraform, Ansible), MLOps (MLflow, Airflow), PROLOG, GNS3 and Mininet.
      </p>
    </section>
  );
}
