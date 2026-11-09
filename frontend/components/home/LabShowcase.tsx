"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, Code2, Database, FileCode2, BookOpen, Terminal, ZoomIn, ZoomOut, MoveHorizontal } from "lucide-react";
import styles from "./HomepageSections.module.css";
import previewImages from "@/public/images/labs/preview-images.json";

const previews: Record<string, {src: string; width: number; height: number; displayWidth: number}> = previewImages;

const labs = [
  { id: "python", name: "Python", icon: Terminal, description: "Functions, OOP and programming practicals. Choose the editor you use in class.", templates: [
    { name: "IDLE editor", image: "idle", caption: "Python IDLE editor · Windows" },
    { name: "IDLE shell", image: "idle-shell", caption: "Python IDLE shell · Windows" },
    { name: "Jupyter · Light", image: "jupyter-light", caption: "JupyterLab-style notebook · light theme" },
    { name: "Jupyter · Dark", image: "jupyter-dark", caption: "JupyterLab-style notebook · dark theme" },
  ] },
  { id: "java", name: "Java", icon: FileCode2, description: "Java source in Notepad, with execution output in a Windows command-prompt style.", templates: [
    { name: "Notepad", image: "java", caption: "Java source screenshot · Windows Notepad" },
    { name: "Command Prompt", image: "java-output", caption: "Java compilation and execution · Windows Command Prompt" },
  ] },
  { id: "cpp", name: "C / C++", icon: Code2, description: "Programming and data-structure exercises, with Code::Blocks source screenshots and Windows-style output.", templates: [
    { name: "Code::Blocks", image: "cpp", caption: "C++ source screenshot · Code::Blocks" },
    { name: "Command Prompt", image: "cpp-output", caption: "C++ execution output · Windows Command Prompt" },
  ] },
  { id: "web", name: "Web development", icon: Code2, description: "HTML, CSS, JavaScript, React and Node.js. Source code in VS Code; web output in a browser frame.", templates: [
    { name: "VS Code", image: "web-code", caption: "Web source screenshot · VS Code Dark Modern" },
    { name: "Microsoft Edge", image: "web-output", caption: "Example portfolio output · Microsoft Edge, Windows" },
  ] },
  { id: "sql", name: "SQL", icon: Database, description: "MySQL queries, tables and result grids shown together, in the order of execution.", templates: [
    { name: "MySQL Workbench", image: "mysql", caption: "GROUP BY query and its result · MySQL Workbench-style capture" },
  ] },
  { id: "colab", name: "Google Colab", icon: BookOpen, description: "Python notebooks and data-science practicals, with code cells and their output. Pick a light or dark theme.", templates: [
    { name: "Light", image: "colab-light", caption: "Notebook code and output · Colab-style light theme" },
    { name: "Dark", image: "colab-dark", caption: "Notebook code and output · Colab-style dark theme" },
  ] },
];

export default function LabShowcase() {
  const [labIndex, setLabIndex] = useState(0);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const lab = labs[labIndex];
  const template = lab.templates[templateIndex] || lab.templates[0];
  const image = previews[template.image];
  const src = image.src;

  return (
    <section id="labs" className={styles.section} aria-labelledby="labs-heading">
      <div className={styles.sectionHeader}>
        <h2 id="labs-heading">Your lab.<br /><span>Your familiar workspace.</span></h2>
        <p>See the labs available today and the screenshot styles that go into your Word report.</p>
      </div>
      <div className={styles.gallery}>
        <div className={styles.labList} role="group" aria-label="Available labs">
          {labs.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" aria-pressed={labIndex === index}
              className={styles.labButton} onClick={() => { setLabIndex(index); setTemplateIndex(0); setZoomed(false); }}>
              <Icon size={19} aria-hidden="true" /><span>{item.name}</span>
              <ArrowUpRight size={16} className={styles.labArrow} aria-hidden="true" />
            </button>;
          })}
        </div>
        <div className={styles.galleryDetail} aria-live="polite" aria-atomic="true">
          <div className={styles.detailHeading}><h3>{lab.name}</h3><span className={styles.available}><Check size={13} aria-hidden="true" /> Available</span></div>
          <p className={styles.labDescription}>{lab.description}</p>
          <div className={styles.templateChoices} role="group" aria-label={`${lab.name} screenshot templates`}>
            {lab.templates.map((item, index) => <button key={item.name} type="button"
              aria-pressed={template === item} onClick={() => {setTemplateIndex(index); setZoomed(false);}}>{item.name}</button>)}
          </div>
          <figure className={styles.preview}>
            <div className={styles.previewControls}>
              <span>Screenshot preview</span>
              <button type="button" aria-pressed={zoomed} aria-controls="lab-preview-viewport"
                onClick={() => setZoomed(value => !value)}>
                {zoomed ? <ZoomOut size={15} aria-hidden="true" /> : <ZoomIn size={15} aria-hidden="true" />}
                {zoomed ? "Fit to width" : "Zoom in"}
              </button>
            </div>
            <div key={src} id="lab-preview-viewport" className={`${styles.previewViewport} ${zoomed ? styles.previewZoomed : ""}`}
              role="region" aria-label="Lab screenshot preview" tabIndex={zoomed ? 0 : undefined}
              style={{"--native-width": `${image.displayWidth}px`} as CSSProperties}>
              <Image className={styles.previewRaster} src={src} alt={template.caption}
                width={image.width} height={image.height} unoptimized />
            </div>
            {zoomed && <p className={styles.previewHint}><MoveHorizontal size={14} aria-hidden="true" /> Scroll or swipe across the screenshot to inspect it.</p>}
            <figcaption><span>{template.caption}</span><a href={src} target="_blank" rel="noreferrer">View full size <ArrowUpRight size={14} aria-hidden="true" /></a></figcaption>
          </figure>
        </div>
      </div>
      <p className={styles.galleryFootnote}>Template previews use sample exercises. Select your screenshot style before processing a manual.</p>
      <div className={styles.upcomingRoadmap}>
        <Terminal size={18} aria-hidden="true" />
        <div>
          <p><strong>Coming next:</strong> Ubuntu lab is expected within a few weeks.</p>
          <p>Git, GitHub, Jenkins, Docker, Kubernetes, Terraform, Ansible, MLflow, Airflow, PROLOG, Packet Tracer, GNS3, Wireshark and Mininet are planned or in progress.</p>
        </div>
      </div>
    </section>
  );
}
