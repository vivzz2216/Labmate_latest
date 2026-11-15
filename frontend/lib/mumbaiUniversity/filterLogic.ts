/**
 * Mumbai University Engineering Laboratory Catalogue (NEP 2020)
 * Search, Deduplicated Filtering, and Active Pill Engine
 */

import type {
  ActiveFilters,
  DepartmentCode,
  UniversityLabEntry,
} from "./types.ts";
import { DEPARTMENTS } from "./types.ts";

export const DEFAULT_FILTERS: ActiveFilters = {
  department: "all",
  academicYear: "all",
  semester: "all",
  category: "all",
  scheme: "all",
  searchQuery: "",
};

/**
 * Pre-builds a lowercase, whitespace-normalized search corpus for sub-millisecond multi-token lookups.
 */
export function buildSearchIndex(lab: UniversityLabEntry): string {
  const branchCodes = Object.values(lab.branchCodes || {}).join(" ");
  const branchNames = Object.values(lab.branchNames || {}).join(" ");
  const deptCodes = lab.departments.join(" ");
  const deptNames = lab.departments
    .map((code) => {
      const match = DEPARTMENTS.find((d) => d.code === code);
      return match ? `${match.name} ${match.shortName}` : code;
    })
    .join(" ");

  const semAliases = `sem ${lab.semester} semester ${lab.semester} s${lab.semester} sem${lab.semester}`;
  const topics = lab.syllabusTopics.join(" ");
  const tags = lab.domainTags.join(" ");

  return [
    lab.id,
    lab.name,
    lab.courseName,
    lab.courseCode,
    branchCodes,
    branchNames,
    deptCodes,
    deptNames,
    semAliases,
    lab.year,
    lab.category,
    lab.scheme,
    tags,
    topics,
    lab.description,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Tokenizes a query string into lowercase non-empty terms.
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Pure filtering function executing conjunctive (AND) multi-dimensional filtering
 * and conjunctive multi-token free-text search.
 *
 * Employs the Canonical Course Entity pattern to guarantee ZERO duplicate laboratory
 * cards under any filter combination (e.g. "All Departments", multi-branch filters, etc.).
 */
export function filterLabs(
  labs: UniversityLabEntry[],
  filters: ActiveFilters
): UniversityLabEntry[] {
  // If Sem 7 or 8 (or Final Year) is active, NEP 2020 rollout is scheduled for AY 2027–28;
  // in accordance with integrity requirements, 0 fabricated or Rev-2019 labs are shown.
  if (
    filters.semester === 7 ||
    filters.semester === 8 ||
    filters.academicYear === "Final Year"
  ) {
    return [];
  }

  const tokens = tokenizeQuery(filters.searchQuery);

  const matched = labs.filter((lab) => {
    // 1. Department dimension: matches if 'all' or if the course is prescribed for the department
    if (
      filters.department !== "all" &&
      !lab.departments.includes(filters.department)
    ) {
      return false;
    }

    // 2. Academic Year dimension
    if (
      filters.academicYear !== "all" &&
      lab.year !== filters.academicYear
    ) {
      return false;
    }

    // 3. Semester dimension
    if (filters.semester !== "all" && lab.semester !== filters.semester) {
      return false;
    }

    // 4. Subject Category dimension
    if (filters.category !== "all" && lab.category !== filters.category) {
      return false;
    }

    // 5. Academic Scheme dimension
    if (filters.scheme !== "all" && lab.scheme !== filters.scheme) {
      return false;
    }

    // 6. Multi-token conjunctive search (AND)
    if (tokens.length > 0) {
      const corpus = lab.searchIndex ?? buildSearchIndex(lab);
      const matchesAllTokens = tokens.every((token) => corpus.includes(token));
      if (!matchesAllTokens) {
        return false;
      }
    }

    return true;
  });

  // Guarantee strict deduplication by canonical ID
  const seenIds = new Set<string>();
  const deduplicated: UniversityLabEntry[] = [];

  for (const item of matched) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

/**
 * Checks whether the active filters point to the Semester 7 / 8 rollout state.
 */
export function isSem78RolloutActive(filters: ActiveFilters): boolean {
  return (
    filters.semester === 7 ||
    filters.semester === 8 ||
    filters.academicYear === "Final Year"
  );
}

export interface FilterPill {
  key: keyof ActiveFilters;
  label: string;
  displayValue: string;
}

/**
 * Computes active filter pills for dismissible chips UI.
 */
export function getActiveFilterPills(filters: ActiveFilters): FilterPill[] {
  const pills: FilterPill[] = [];

  if (filters.department !== "all") {
    const dept = DEPARTMENTS.find((d) => d.code === filters.department);
    pills.push({
      key: "department",
      label: "Department",
      displayValue: dept ? dept.shortName : filters.department,
    });
  }

  if (filters.academicYear !== "all") {
    pills.push({
      key: "academicYear",
      label: "Year",
      displayValue: filters.academicYear,
    });
  }

  if (filters.semester !== "all") {
    pills.push({
      key: "semester",
      label: "Semester",
      displayValue: `Semester ${filters.semester}`,
    });
  }

  if (filters.category !== "all") {
    pills.push({
      key: "category",
      label: "Category",
      displayValue: filters.category,
    });
  }

  if (filters.scheme !== "all") {
    pills.push({
      key: "scheme",
      label: "Scheme",
      displayValue: filters.scheme,
    });
  }

  if (filters.searchQuery.trim().length > 0) {
    pills.push({
      key: "searchQuery",
      label: "Search",
      displayValue: `"${filters.searchQuery.trim()}"`,
    });
  }

  return pills;
}

/**
 * Calculates total count of active non-default filters.
 */
export function getActiveFilterCount(filters: ActiveFilters): number {
  return getActiveFilterPills(filters).length;
}

/**
 * Returns branch-specific course code when a specific department is filtered,
 * or standard course code when browsing 'all'.
 */
export function getDisplayCourseCode(
  lab: UniversityLabEntry,
  activeDepartment: DepartmentCode | "all"
): string {
  if (
    activeDepartment !== "all" &&
    lab.branchCodes &&
    lab.branchCodes[activeDepartment]
  ) {
    return lab.branchCodes[activeDepartment]!;
  }
  return lab.courseCode;
}

/**
 * Returns branch-specific laboratory title when a specific department is filtered
 * (e.g. IT Sem 4 Mini-Project: "Mini-Project – Programming Paradigm"),
 * or standard lab name when browsing 'all' or if no branch variation exists.
 */
export function getDisplayLabName(
  lab: UniversityLabEntry,
  activeDepartment?: DepartmentCode | "all"
): string {
  if (
    activeDepartment &&
    activeDepartment !== "all" &&
    lab.branchNames &&
    lab.branchNames[activeDepartment]
  ) {
    return lab.branchNames[activeDepartment]!;
  }
  return lab.name;
}
