import type { UniversityLabEntry } from "./types.ts";

export interface LabVisualMeta {
  imageSrc: string;
  altText: string;
  subjectLabel: string;
}

/**
 * Deterministically maps each Mumbai University computing lab to a uniform,
 * domain-appropriate monochrome cover plate under /images/mu-labs/.
 */
export function getLabVisualMeta(lab: UniversityLabEntry): LabVisualMeta {
  const haystack = `${lab.id} ${lab.name} ${lab.courseName} ${lab.domainTags.join(" ")}`.toLowerCase();

  if (haystack.includes("java")) {
    return {
      imageSrc: "/images/mu-labs/java.svg",
      altText: `${lab.name} Java programming runtime emblem`,
      subjectLabel: "Java SE",
    };
  }
  if (haystack.includes("python")) {
    return {
      imageSrc: "/images/mu-labs/python.svg",
      altText: `${lab.name} Python runtime emblem`,
      subjectLabel: "Python 3",
    };
  }
  if (
    haystack.includes("sql") ||
    haystack.includes("dbms") ||
    haystack.includes("database") ||
    haystack.includes("datawarehouse") ||
    haystack.includes("mining")
  ) {
    return {
      imageSrc: "/images/mu-labs/database.svg",
      altText: `${lab.name} relational database schema emblem`,
      subjectLabel: "SQL / DBMS",
    };
  }
  if (
    haystack.includes("security") ||
    haystack.includes("blockchain") ||
    haystack.includes("crypt")
  ) {
    return {
      imageSrc: "/images/mu-labs/security.svg",
      altText: `${lab.name} security and blockchain emblem`,
      subjectLabel: "Security",
    };
  }
  if (
    haystack.includes("graphics") ||
    haystack.includes("rendering") ||
    haystack.includes("opengl")
  ) {
    return {
      imageSrc: "/images/mu-labs/graphics.svg",
      altText: `${lab.name} computer graphics wireframe emblem`,
      subjectLabel: "Graphics",
    };
  }
  if (
    haystack.includes("compiler") ||
    haystack.includes("system programming") ||
    haystack.includes("spcc")
  ) {
    return {
      imageSrc: "/images/mu-labs/systems-compiler.svg",
      altText: `${lab.name} compiler and AST pipeline emblem`,
      subjectLabel: "Compilers",
    };
  }
  if (
    haystack.includes("operating system") ||
    haystack.includes("unix") ||
    haystack.includes("shell")
  ) {
    return {
      imageSrc: "/images/mu-labs/linux-os.svg",
      altText: `${lab.name} Unix and OS kernel shell emblem`,
      subjectLabel: "OS / Unix",
    };
  }
  if (
    haystack.includes("network") ||
    haystack.includes("cloud")
  ) {
    return {
      imageSrc: "/images/mu-labs/network-cloud.svg",
      altText: `${lab.name} networks and cloud topology emblem`,
      subjectLabel: "Networks & Cloud",
    };
  }
  if (
    haystack.includes("organization") ||
    haystack.includes("architecture") ||
    haystack.includes("microprocessor")
  ) {
    return {
      imageSrc: "/images/mu-labs/architecture.svg",
      altText: `${lab.name} computer architecture CPU emblem`,
      subjectLabel: "Architecture",
    };
  }
  if (
    haystack.includes("devops") ||
    haystack.includes("software engineering") ||
    haystack.includes("agile")
  ) {
    return {
      imageSrc: "/images/mu-labs/devops-se.svg",
      altText: `${lab.name} software engineering pipeline emblem`,
      subjectLabel: "SE & DevOps",
    };
  }
  if (
    haystack.includes("internet programming") ||
    haystack.includes("web lab") ||
    haystack.includes("web engineering")
  ) {
    return {
      imageSrc: "/images/mu-labs/web-dev.svg",
      altText: `${lab.name} web engineering browser code emblem`,
      subjectLabel: "Web Engineering",
    };
  }
  if (
    haystack.includes("ai ") ||
    haystack.includes("ml") ||
    haystack.includes("machine learning") ||
    haystack.includes("soft computing") ||
    haystack.includes("data science") ||
    haystack.includes("data analytics") ||
    haystack.includes("swarm") ||
    haystack.includes("statistics")
  ) {
    return {
      imageSrc: "/images/mu-labs/ai-ml.svg",
      altText: `${lab.name} AI and machine learning graph emblem`,
      subjectLabel: "AI / ML / DS",
    };
  }
  if (
    haystack.includes("c programming") ||
    haystack.includes("data structure") ||
    haystack.includes("algorithm") ||
    haystack.includes("ads lab")
  ) {
    return {
      imageSrc: "/images/mu-labs/c-cpp.svg",
      altText: `${lab.name} C and algorithms emblem`,
      subjectLabel: "C & Algorithms",
    };
  }
  if (
    haystack.includes("mini project") ||
    haystack.includes("mini-project") ||
    haystack.includes("innovation")
  ) {
    return {
      imageSrc: "/images/mu-labs/project.svg",
      altText: `${lab.name} capstone project architecture emblem`,
      subjectLabel: "Mini Project",
    };
  }

  // Uniform technical plate fallback for electives & multidisciplinary minors
  return {
    imageSrc: "/images/mu-labs/project.svg",
    altText: `${lab.name} curriculum track emblem`,
    subjectLabel: lab.category === "Departmental Elective" ? "Elective" : "Applied Track",
  };
}
