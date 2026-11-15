/**
 * Mumbai University Engineering Laboratory Catalogue (NEP 2020)
 * Domain Models and Type Definitions
 */

export type DepartmentCode =
  | "ce"       // B.E. Computer Engineering (CS)
  | "it"       // B.E. Information Technology (IT)
  | "csit"     // B.E. Computer Science & Information Technology
  | "cse_aiml" // B.E. CSE (Artificial Intelligence & Machine Learning)
  | "cse_ds"   // B.E. CSE (Data Science)
  | "aids";    // B.E. Artificial Intelligence & Data Science

export type AcademicYear =
  | "First Year"   // FE (Semesters I & II)
  | "Second Year"  // SE (Semesters III & IV)
  | "Third Year"   // TE (Semesters V & VI)
  | "Final Year";  // BE (Semesters VII & VIII - AY 2027-28 Rollout)

export type SemesterNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type SubjectCategory =
  | "Core Laboratory"
  | "Departmental Elective"
  | "Skill Course"
  | "Multidisciplinary Minor"
  | "Mini Project";

export type AcademicScheme =
  | "Mumbai University NEP 2020"
  | "Autonomous Colleges";

export type AvailabilityStatus =
  | "Verified NEP 2020"
  | "Rollout AY 2027–28";

export interface DepartmentMeta {
  code: DepartmentCode;
  name: string;
  shortName: string;
  isFirstClass: boolean; // Computer Engineering & Information Technology are first-class
  description: string;
}

export interface ExperimentTopicOutline {
  srNo?: number;
  title: string;
  details?: string[];
}

export interface UniversityLabEntry {
  /** Unique canonical identifier */
  id: string;
  /** Laboratory practical name, e.g. "Data Structure Lab" */
  name: string;
  /** Official subject/course name, e.g. "Data Structures" */
  courseName: string;
  /** Standard / primary course code, e.g. "PCL2011", "VSEC102", "2113115" */
  courseCode: string;
  /** Department-specific course code variations across branches */
  branchCodes?: Partial<Record<DepartmentCode, string>>;
  /** Department-specific laboratory title variations across branches */
  branchNames?: Partial<Record<DepartmentCode, string>>;
  /** Prescribing departments */
  departments: DepartmentCode[];
  /** Indicates if shared across multiple computing programmes */
  isCommon: boolean;
  /** Academic Year */
  year: AcademicYear;
  /** Semester (1 through 8) */
  semester: SemesterNumber;
  /** Subject Category */
  category: SubjectCategory;
  /** Academic Scheme designation */
  scheme: AcademicScheme;
  /** Practical credits */
  credits: number;
  /** Practical contact hours per week */
  hoursPerWeek: number;
  /** Short pedagogical description */
  description: string;
  /** Verified experiment topic outlines (available for verified labs) */
  syllabusTopics: string[];
  /** Detailed experiment topic breakdowns */
  detailedOutlines?: ExperimentTopicOutline[];
  /** Domain and keyword tags */
  domainTags: string[];
  /** Curriculum availability status */
  availabilityStatus: AvailabilityStatus;
  /** Optional prerequisites */
  prerequisites?: string[];
  /** Search corpus pre-indexed for fast token queries */
  searchIndex?: string;
}

export interface ActiveFilters {
  department: DepartmentCode | "all";
  academicYear: AcademicYear | "all";
  semester: SemesterNumber | "all";
  category: SubjectCategory | "all";
  scheme: AcademicScheme | "all";
  searchQuery: string;
}

export const DEPARTMENTS: DepartmentMeta[] = [
  {
    code: "ce",
    name: "B.E. Computer Engineering",
    shortName: "Computer Engg (CS)",
    isFirstClass: true,
    description: "Official Mumbai University NEP 2020 curriculum for Computer Engineering (Codes 211xxxx)",
  },
  {
    code: "it",
    name: "B.E. Information Technology",
    shortName: "Information Tech (IT)",
    isFirstClass: true,
    description: "Official Mumbai University NEP 2020 curriculum for Information Technology (Codes 234xxxx)",
  },
  {
    code: "csit",
    name: "B.E. Computer Science & Information Technology",
    shortName: "CSIT",
    isFirstClass: false,
    description: "Official Mumbai University NEP 2020 curriculum for CSIT (Codes 245xxxx)",
  },
  {
    code: "cse_aiml",
    name: "B.E. Computer Science & Engg (AI & ML)",
    shortName: "CSE (AI&ML)",
    isFirstClass: false,
    description: "Official Mumbai University NEP 2020 curriculum for CSE AI & ML (Codes 216xxxx)",
  },
  {
    code: "cse_ds",
    name: "B.E. Computer Science & Engg (Data Science)",
    shortName: "CSE (Data Science)",
    isFirstClass: false,
    description: "Official Mumbai University NEP 2020 curriculum for CSE Data Science (Codes 217xxxx)",
  },
  {
    code: "aids",
    name: "B.E. Artificial Intelligence & Data Science",
    shortName: "AI & Data Science",
    isFirstClass: false,
    description: "Official Mumbai University NEP 2020 curriculum for AI & Data Science (Codes 248xxxx / 201xxxx)",
  },
];

export const ACADEMIC_YEARS: AcademicYear[] = [
  "First Year",
  "Second Year",
  "Third Year",
  "Final Year",
];

export const SEMESTERS: SemesterNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const SUBJECT_CATEGORIES: SubjectCategory[] = [
  "Core Laboratory",
  "Departmental Elective",
  "Skill Course",
  "Multidisciplinary Minor",
  "Mini Project",
];

export const ACADEMIC_SCHEMES: AcademicScheme[] = [
  "Mumbai University NEP 2020",
  "Autonomous Colleges",
];
