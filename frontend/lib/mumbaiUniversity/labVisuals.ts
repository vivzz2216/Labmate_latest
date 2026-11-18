import type { UniversityLabEntry } from "./types.ts";

export interface LabVisualMeta {
  imageSrc: string;
  altText: string;
  subjectLabel: string;
}

function matchDomainPhoto(lab: UniversityLabEntry, text: string): LabVisualMeta | null {
  if (text.includes("c programming")) {
    return {
      imageSrc: "/images/mu-labs/c-programming.jpg",
      altText: `${lab.name} C programming code on dark editor`,
      subjectLabel: "C Programming",
    };
  }
  if (text.includes("data structure") || text.includes("ads lab")) {
    return {
      imageSrc: "/images/mu-labs/data-structures.jpg",
      altText: `${lab.name} connected nodes and tree structure`,
      subjectLabel: "Data Structures",
    };
  }
  if (text.includes("algorithm")) {
    return {
      imageSrc: "/images/mu-labs/algorithms.jpg",
      altText: `${lab.name} algorithmic mathematics and analysis`,
      subjectLabel: "Algorithms",
    };
  }
  if (text.includes("java")) {
    return {
      imageSrc: "/images/mu-labs/java.jpg",
      altText: `${lab.name} full-stack Java workstation`,
      subjectLabel: "Java SE",
    };
  }
  if (text.includes("python")) {
    return {
      imageSrc: "/images/mu-labs/python.jpg",
      altText: `${lab.name} Python development environment`,
      subjectLabel: "Python 3",
    };
  }
  if (
    text.includes("sql") ||
    text.includes("dbms") ||
    text.includes("database") ||
    text.includes("datawarehouse") ||
    text.includes("mining")
  ) {
    return {
      imageSrc: "/images/mu-labs/database.jpg",
      altText: `${lab.name} database server racks`,
      subjectLabel: "SQL / DBMS",
    };
  }
  if (
    text.includes("security") ||
    text.includes("blockchain") ||
    text.includes("crypt")
  ) {
    return {
      imageSrc: "/images/mu-labs/security.jpg",
      altText: `${lab.name} cybersecurity and encryption`,
      subjectLabel: "Security",
    };
  }
  if (
    text.includes("graphics") ||
    text.includes("rendering") ||
    text.includes("opengl")
  ) {
    return {
      imageSrc: "/images/mu-labs/graphics.jpg",
      altText: `${lab.name} 3D wireframe graphics rendering`,
      subjectLabel: "Graphics",
    };
  }
  if (
    text.includes("compiler") ||
    text.includes("system programming") ||
    text.includes("spcc")
  ) {
    return {
      imageSrc: "/images/mu-labs/compilers.jpg",
      altText: `${lab.name} compiler syntax and systems code`,
      subjectLabel: "Compilers",
    };
  }
  if (
    text.includes("operating system") ||
    text.includes("unix") ||
    text.includes("shell")
  ) {
    return {
      imageSrc: "/images/mu-labs/operating-systems.jpg",
      altText: `${lab.name} Unix and Linux terminal shell`,
      subjectLabel: "OS / Unix",
    };
  }
  if (text.includes("cloud")) {
    return {
      imageSrc: "/images/mu-labs/cloud-computing.jpg",
      altText: `${lab.name} cloud infrastructure data center`,
      subjectLabel: "Cloud Computing",
    };
  }
  if (text.includes("network")) {
    return {
      imageSrc: "/images/mu-labs/networks.jpg",
      altText: `${lab.name} network switch and fiber optic cabling`,
      subjectLabel: "Networks",
    };
  }
  if (
    text.includes("organization") ||
    text.includes("architecture") ||
    text.includes("microprocessor")
  ) {
    return {
      imageSrc: "/images/mu-labs/architecture.jpg",
      altText: `${lab.name} CPU microchip hardware architecture`,
      subjectLabel: "Architecture",
    };
  }
  if (
    text.includes("devops") ||
    text.includes("software engineering") ||
    text.includes("agile")
  ) {
    return {
      imageSrc: "/images/mu-labs/devops-se.jpg",
      altText: `${lab.name} software engineering and DevOps pipeline`,
      subjectLabel: "SE & DevOps",
    };
  }
  if (
    text.includes("internet programming") ||
    text.includes("web lab") ||
    text.includes("web engineering")
  ) {
    return {
      imageSrc: "/images/mu-labs/web-dev.jpg",
      altText: `${lab.name} web engineering and frontend markup`,
      subjectLabel: "Web Engineering",
    };
  }
  if (
    text.includes("data science") ||
    text.includes("data analytics") ||
    text.includes("statistics") ||
    text.includes("visualization")
  ) {
    return {
      imageSrc: "/images/mu-labs/data-science.jpg",
      altText: `${lab.name} data analytics and metrics dashboard`,
      subjectLabel: "Data Science",
    };
  }
  if (
    text.includes("ai ") ||
    text.includes("ml") ||
    text.includes("machine learning") ||
    text.includes("soft computing") ||
    text.includes("swarm")
  ) {
    return {
      imageSrc: "/images/mu-labs/ai-ml.jpg",
      altText: `${lab.name} artificial intelligence neural network`,
      subjectLabel: "AI / ML",
    };
  }
  if (
    text.includes("mini project") ||
    text.includes("mini-project") ||
    text.includes("innovation")
  ) {
    return {
      imageSrc: "/images/mu-labs/mini-project.jpg",
      altText: `${lab.name} hardware and software project workbench`,
      subjectLabel: "Mini Project",
    };
  }

  return null;
}

/**
 * Deterministically maps each Mumbai University computing lab to a domain-matched
 * landscape photograph stored locally under /images/mu-labs/.
 * Prioritizes primary title/courseName before falling back to tags so broad tags
 * never override a lab's actual subject image.
 */
export function getLabVisualMeta(lab: UniversityLabEntry): LabVisualMeta {
  const titleText = `${lab.name} ${lab.courseName}`.toLowerCase();
  const titleMatch = matchDomainPhoto(lab, titleText);
  if (titleMatch) return titleMatch;

  const fullText = `${lab.id} ${titleText} ${lab.domainTags.join(" ")}`.toLowerCase();
  const fullMatch = matchDomainPhoto(lab, fullText);
  if (fullMatch) return fullMatch;

  if (lab.category === "Departmental Elective") {
    return {
      imageSrc: "/images/mu-labs/compilers.jpg",
      altText: `${lab.name} specialized computing elective`,
      subjectLabel: "Elective",
    };
  }

  return {
    imageSrc: "/images/mu-labs/mini-project.jpg",
    altText: `${lab.name} applied multidisciplinary engineering lab`,
    subjectLabel: "Applied Track",
  };
}
