/**
 * Automated Verification Suite for Mumbai University Laboratory Catalogue (NEP 2020)
 * Executable via Node 24 native test runner:
 *   cd frontend && node --test --experimental-strip-types tests/mumbaiUniversity.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  MUMBAI_UNIVERSITY_LABS,
  VERIFIED_EXPERIMENT_OUTLINES,
  SEMESTER_7_8_ROLLOUT_METADATA,
} from "../lib/mumbaiUniversity/catalogueData.ts";
import {
  filterLabs,
  isSem78RolloutActive,
  getActiveFilterPills,
  getActiveFilterCount,
  getDisplayCourseCode,
  getDisplayLabName,
  buildSearchIndex,
  DEFAULT_FILTERS,
} from "../lib/mumbaiUniversity/filterLogic.ts";
import type {
  DepartmentCode,
  ActiveFilters,
} from "../lib/mumbaiUniversity/types.ts";
import {
  DEPARTMENTS,
  SUBJECT_CATEGORIES,
} from "../lib/mumbaiUniversity/types.ts";

test("T1: Programme Coverage & Department Metadata Verification", () => {
  const expectedCodes: DepartmentCode[] = [
    "ce",
    "it",
    "csit",
    "cse_aiml",
    "cse_ds",
    "aids",
  ];

  // Verify all 6 computing programmes exist in metadata
  const registeredCodes = DEPARTMENTS.map((d) => d.code);
  for (const code of expectedCodes) {
    assert.ok(
      registeredCodes.includes(code),
      `Department code ${code} must be registered`
    );
  }

  // Verify Computer Engineering (CS) and Information Technology (IT) are marked first-class
  const ceDept = DEPARTMENTS.find((d) => d.code === "ce");
  const itDept = DEPARTMENTS.find((d) => d.code === "it");
  assert.ok(ceDept?.isFirstClass, "Computer Engineering must be marked isFirstClass");
  assert.ok(itDept?.isFirstClass, "Information Technology must be marked isFirstClass");

  // Verify every programme has labs assigned across Semesters I through VI
  for (const dept of expectedCodes) {
    const deptLabs = MUMBAI_UNIVERSITY_LABS.filter((lab) =>
      lab.departments.includes(dept)
    );
    assert.ok(
      deptLabs.length >= 15,
      `Department ${dept} must have at least 15 verified labs across Sem I–VI (found ${deptLabs.length})`
    );
  }
});

test("T2: Non-Electronics Compliance - Deliberate Exclusion of ESL102 and EXTC", () => {
  // ESL102 (Basic Electrical & Electronics Lab) must be completely absent
  const esl102Matches = MUMBAI_UNIVERSITY_LABS.filter(
    (lab) =>
      lab.courseCode.toUpperCase() === "ESL102" ||
      lab.id.includes("esl102") ||
      lab.name.toLowerCase().includes("electrical") ||
      lab.name.toLowerCase().includes("electronics engineering lab")
  );
  assert.strictEqual(
    esl102Matches.length,
    0,
    "ESL102 and Electrical/Electronics Lab must be strictly excluded from the catalogue"
  );

  // Search filter query for "ESL102" must yield zero results
  const searchResults = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "ESL102",
  });
  assert.strictEqual(
    searchResults.length,
    0,
    "Search for ESL102 must yield zero results"
  );
});

test("T3: Canonical Course Entity Pattern - Zero Duplicates Under Any Filter", () => {
  // Baseline: "All Departments" must have unique IDs for every single lab card
  const allIds = MUMBAI_UNIVERSITY_LABS.map((l) => l.id);
  const uniqueAllIds = new Set(allIds);
  assert.strictEqual(
    allIds.length,
    uniqueAllIds.size,
    "All laboratory entries must have strictly unique canonical IDs"
  );

  // Check each department filter individually for duplicates
  const departments: DepartmentCode[] = [
    "ce",
    "it",
    "csit",
    "cse_aiml",
    "cse_ds",
    "aids",
  ];
  for (const dept of departments) {
    const filtered = filterLabs(MUMBAI_UNIVERSITY_LABS, {
      ...DEFAULT_FILTERS,
      department: dept,
    });
    const ids = filtered.map((l) => l.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      `Department ${dept} must have zero duplicate cards`
    );
  }

  // Check each semester filter individually for duplicates
  for (let sem = 1; sem <= 6; sem++) {
    const filtered = filterLabs(MUMBAI_UNIVERSITY_LABS, {
      ...DEFAULT_FILTERS,
      semester: sem as any,
    });
    const ids = filtered.map((l) => l.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(
      ids.length,
      uniqueIds.size,
      `Semester ${sem} must have zero duplicate cards`
    );
  }
});

test("T4: Computing-Only First-Year Practicals (3 Labs Across Sem I & II) & Non-Computing Exclusion", () => {
  // Total canonical lab count must be strictly 43
  assert.strictEqual(
    MUMBAI_UNIVERSITY_LABS.length,
    43,
    "Authoritative catalogue must contain exactly 43 verified computing practicals"
  );

  const sem1Labs = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    semester: 1,
  });
  const sem2Labs = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    semester: 2,
  });

  // Verify strictly 1 computing lab in Sem I (VSEC102 C Programming Lab)
  assert.strictEqual(
    sem1Labs.length,
    1,
    "Semester I must have strictly 1 verified computing practical (VSEC102 C Programming Lab)"
  );
  assert.strictEqual(
    sem1Labs[0].courseCode,
    "VSEC102",
    "Semester I computing lab must be VSEC102"
  );
  assert.strictEqual(
    sem1Labs[0].id,
    "mu-nep-sem1-vsec102-c-programming",
    "Semester I computing lab ID must match canonical C programming entry"
  );

  // Verify strictly 2 computing labs in Sem II (PCL2011 Data Structure Lab & VSEC202 Python Programming Lab)
  assert.strictEqual(
    sem2Labs.length,
    2,
    "Semester II must have strictly 2 verified computing practicals (PCL2011 & VSEC202)"
  );
  const sem2Codes = sem2Labs.map((l) => l.courseCode).sort();
  assert.deepStrictEqual(
    sem2Codes,
    ["PCL2011", "VSEC202"].sort(),
    "Semester II course codes must be strictly PCL2011 and VSEC202"
  );

  // Explicitly assert all 9 removed non-computing foundation labs plus ESL102 are completely absent
  const removedCodes = [
    "BSL101",   // Applied Physics Lab
    "BSL102",   // Applied Chemistry Lab
    "ESL101",   // Engineering Mechanics Lab
    "AEL101",   // Professional & Communication Ethics Practical
    "VSEC101",  // Engineering Workshop-I
    "BSL201X",  // Elective Physics Lab
    "BSL202X",  // Elective Chemistry Lab
    "ESL201",   // Engineering Graphics Lab
    "VSEC201",  // Engineering Workshop-II
    "ESL102",   // Basic Electrical & Electronics Engineering Lab
  ];

  for (const code of removedCodes) {
    // 1. Must not exist in canonical dataset
    const directMatches = MUMBAI_UNIVERSITY_LABS.filter(
      (l) =>
        l.courseCode.toUpperCase() === code.toUpperCase() ||
        l.id.toLowerCase().includes(code.toLowerCase())
    );
    assert.strictEqual(
      directMatches.length,
      0,
      `Removed non-computing/electronics lab ${code} must be completely absent from canonical dataset`
    );

    // 2. Must not be returned by search queries
    const searchMatches = filterLabs(MUMBAI_UNIVERSITY_LABS, {
      ...DEFAULT_FILTERS,
      searchQuery: code,
    });
    assert.strictEqual(
      searchMatches.length,
      0,
      `Search query for removed code "${code}" must return 0 results`
    );
  }
});

test("T5: Verified Experiment Topic Outlines Presence for the 7 Labs", () => {
  const verifiedLabIds = [
    "mu-nep-sem1-vsec102-c-programming",
    "mu-nep-sem2-pcl2011-data-structures",
    "mu-nep-sem3-aoa-lab",
    "mu-nep-sem4-os-lab",
    "mu-nep-sem5-cn-lab",
    "mu-nep-sem5-ai-soft-computing-lab",
    "mu-nep-sem6-spcc-lab",
  ];

  for (const id of verifiedLabIds) {
    const lab = MUMBAI_UNIVERSITY_LABS.find((l) => l.id === id);
    assert.ok(lab, `Verified lab ${id} must exist in catalogue`);
    assert.ok(
      lab.syllabusTopics && lab.syllabusTopics.length > 0,
      `Lab ${id} must have syllabus topic outlines`
    );
    assert.ok(
      lab.detailedOutlines && lab.detailedOutlines.length > 0,
      `Lab ${id} must have detailed experiment outlines`
    );
  }

  // Check C Programming outlines
  const cLab = MUMBAI_UNIVERSITY_LABS.find(
    (l) => l.id === "mu-nep-sem1-vsec102-c-programming"
  );
  assert.strictEqual(cLab?.detailedOutlines?.length, 5, "C Programming must have 5 outline modules");

  // Check Data Structure outlines
  const dsLab = MUMBAI_UNIVERSITY_LABS.find(
    (l) => l.id === "mu-nep-sem2-pcl2011-data-structures"
  );
  assert.strictEqual(dsLab?.detailedOutlines?.length, 5, "Data Structure Lab must have 5 outline modules");

  // Check SPCC outlines
  const spccLab = MUMBAI_UNIVERSITY_LABS.find(
    (l) => l.id === "mu-nep-sem6-spcc-lab"
  );
  assert.strictEqual(spccLab?.detailedOutlines?.length, 3, "SPCC Lab must have 3 outline modules");
});

test("T6: Semester 7 & 8 Rollout State Integrity (Zero Fabricated Courses)", () => {
  // Querying semester 7 must return empty array from filterLabs
  const sem7Results = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    semester: 7,
  });
  assert.strictEqual(
    sem7Results.length,
    0,
    "Semester 7 must return 0 laboratory cards (no fabricated or Rev-2019 courses)"
  );

  // Querying semester 8 must return empty array from filterLabs
  const sem8Results = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    semester: 8,
  });
  assert.strictEqual(
    sem8Results.length,
    0,
    "Semester 8 must return 0 laboratory cards"
  );

  // Querying Final Year must return empty array
  const finalYearResults = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    academicYear: "Final Year",
  });
  assert.strictEqual(
    finalYearResults.length,
    0,
    "Final Year must return 0 laboratory cards"
  );

  // isSem78RolloutActive must correctly detect rollout condition
  assert.strictEqual(
    isSem78RolloutActive({ ...DEFAULT_FILTERS, semester: 7 }),
    true
  );
  assert.strictEqual(
    isSem78RolloutActive({ ...DEFAULT_FILTERS, semester: 8 }),
    true
  );
  assert.strictEqual(
    isSem78RolloutActive({ ...DEFAULT_FILTERS, academicYear: "Final Year" }),
    true
  );
  assert.strictEqual(
    isSem78RolloutActive({ ...DEFAULT_FILTERS, semester: 6 }),
    false
  );

  // Verify rollout metadata explanation mentions AY 2027-28
  assert.ok(
    SEMESTER_7_8_ROLLOUT_METADATA.headline.includes("AY 2027–28"),
    "Rollout metadata must state AY 2027–28"
  );
});

test("T7: Multi-Dimensional Filter Intersection", () => {
  // Combination 1: CE + Semester 3
  const ceSem3 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    department: "ce",
    semester: 3,
  });
  // CE Sem 3 has: AOA Lab (2113115), COA Lab (2113116), Full Stack Java (2113611)
  assert.strictEqual(ceSem3.length, 3, "CE Semester 3 must return exactly 3 labs");
  const ceSem3Codes = ceSem3.map((l) => l.courseCode);
  assert.ok(ceSem3Codes.includes("2113115"), "AOA Lab must be present");
  assert.ok(ceSem3Codes.includes("2113116"), "COA Lab must be present");
  assert.ok(ceSem3Codes.includes("2113611"), "Full Stack Java must be present");

  // Combination 2: IT + Semester 4
  const itSem4 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    department: "it",
    semester: 4,
  });
  // IT Sem 4 has: Unix Lab (2344114), Network Design Lab (2344115), MDL401, Mini Project (2114411 / 2344411)
  assert.strictEqual(itSem4.length, 4, "IT Semester 4 must return exactly 4 labs");

  // Combination 3: CE + Semester 3 + Core Laboratory
  const ceSem3Core = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    department: "ce",
    semester: 3,
    category: "Core Laboratory",
  });
  assert.strictEqual(
    ceSem3Core.length,
    2,
    "CE Semester 3 Core Labs should be AOA and COA (excluding Full Stack Java skill course)"
  );

  // Combination 4: Impossible intersection (First Year + Semester 5)
  const impossible = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    academicYear: "First Year",
    semester: 5,
  });
  assert.strictEqual(impossible.length, 0, "Conflicting year/semester must yield 0 results");
});

test("T8: Branch-Specific Course Code Resolution", () => {
  const aoaLab = MUMBAI_UNIVERSITY_LABS.find((l) => l.id === "mu-nep-sem3-aoa-lab")!;
  assert.ok(aoaLab, "AOA lab must exist");

  // In "all" view, default code 2113115 is displayed
  assert.strictEqual(getDisplayCourseCode(aoaLab, "all"), "2113115");

  // In CE view, displays 2113115
  assert.strictEqual(getDisplayCourseCode(aoaLab, "ce"), "2113115");

  // In CSIT view, displays 2453115
  assert.strictEqual(getDisplayCourseCode(aoaLab, "csit"), "2453115");

  // In CSE-AIML view, displays 2163115
  assert.strictEqual(getDisplayCourseCode(aoaLab, "cse_aiml"), "2163115");

  // In CSE-DS view, displays 2173115
  assert.strictEqual(getDisplayCourseCode(aoaLab, "cse_ds"), "2173115");

  // In AIDS view, displays 2483115
  assert.strictEqual(getDisplayCourseCode(aoaLab, "aids"), "2483115");
});

test("T9: Conjunctive Multi-Token Free-Text Search", () => {
  // Query 1: Numeric course code
  const q1 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "PCL2011",
  });
  assert.strictEqual(q1.length, 1, "PCL2011 should match exactly Data Structure Lab");
  assert.strictEqual(q1[0].id, "mu-nep-sem2-pcl2011-data-structures");

  // Query 2: Multi-token conjunction across title & semester
  const q2 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "sem 3 analysis of algorithm",
  });
  assert.strictEqual(q2.length, 1, "'sem 3 analysis of algorithm' must match Analysis of Algorithm Lab");
  assert.strictEqual(q2[0].id, "mu-nep-sem3-aoa-lab");

  // Query 3: Multi-token conjunction across branch & specific tool
  const q3 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "it unix",
  });
  assert.strictEqual(q3.length, 1, "'it unix' must match IT Unix Lab");
  assert.strictEqual(q3[0].id, "mu-nep-sem4-it-unix-lab");

  // Query 4: Search within detailed experiment outlines ("assembler two-pass")
  const q4 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "assembler two-pass",
  });
  assert.strictEqual(q4.length, 1, "'assembler two-pass' must match SPCC Lab");
  assert.strictEqual(q4[0].id, "mu-nep-sem6-spcc-lab");

  // Query 5: Case insensitivity and whitespace resilience
  const q5 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "   c   ProGrammIng   vsec102  ",
  });
  assert.strictEqual(q5.length, 1, "Messy query must still match C Programming Lab");
  assert.strictEqual(q5[0].id, "mu-nep-sem1-vsec102-c-programming");

  // Query 6: Zero-match query
  const q6 = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "non-existent-fabricated-lab-xyz",
  });
  assert.strictEqual(q6.length, 0, "Non-existent term must yield 0 results");
});

test("T10: Active Filter Pills & Reset Engine", () => {
  const activeFilters: ActiveFilters = {
    department: "ce",
    academicYear: "Second Year",
    semester: 3,
    category: "Core Laboratory",
    scheme: "Mumbai University NEP 2020",
    searchQuery: "algorithm",
  };

  const pills = getActiveFilterPills(activeFilters);
  assert.strictEqual(pills.length, 6, "All 6 active filters must produce pills");

  assert.strictEqual(getActiveFilterCount(activeFilters), 6);

  // Default filters must have 0 pills
  const defaultPills = getActiveFilterPills(DEFAULT_FILTERS);
  assert.strictEqual(defaultPills.length, 0, "Default filters must produce 0 pills");
  assert.strictEqual(getActiveFilterCount(DEFAULT_FILTERS), 0);
});

test("T11: Academic Scheme Distinctions", () => {
  // All verified entries belong to Mumbai University NEP 2020
  for (const lab of MUMBAI_UNIVERSITY_LABS) {
    assert.strictEqual(
      lab.scheme,
      "Mumbai University NEP 2020",
      "All active syllabus entries must belong to Mumbai University NEP 2020"
    );
  }

  // Autonomous colleges scheme filter test
  const autonomousResults = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    scheme: "Autonomous Colleges",
  });
  // Since no autonomous courses are fabricated, it returns 0 entries
  assert.strictEqual(
    autonomousResults.length,
    0,
    "Autonomous scheme filter returns 0 entries as autonomous syllabi are set by individual autonomous institutes"
  );
});

test("T12: Subject Categories Verification (Pruned Computing Categories Only)", () => {
  // Only verified categories remain in SUBJECT_CATEGORIES
  const expectedCategories = [
    "Core Laboratory",
    "Departmental Elective",
    "Skill Course",
    "Multidisciplinary Minor",
    "Mini Project",
  ];

  assert.deepStrictEqual(
    [...SUBJECT_CATEGORIES].sort(),
    expectedCategories.sort(),
    "SUBJECT_CATEGORIES must contain only the 5 verified computing categories"
  );

  // Every category in SUBJECT_CATEGORIES must have >= 1 matching lab in MUMBAI_UNIVERSITY_LABS
  for (const category of SUBJECT_CATEGORIES) {
    const matching = MUMBAI_UNIVERSITY_LABS.filter((l) => l.category === category);
    assert.ok(
      matching.length >= 1,
      `Category "${category}" must have at least 1 verified lab in the catalogue (found ${matching.length})`
    );
  }

  // Non-computing and unused categories must have 0 entries
  const prunedCategories = [
    "Basic Science Lab",
    "Engineering Science Lab",
    "Humanities & Ethics",
    "Open Elective",
  ];

  for (const cat of prunedCategories) {
    const found = MUMBAI_UNIVERSITY_LABS.filter((l) => (l.category as string) === cat);
    assert.strictEqual(
      found.length,
      0,
      `Pruned category "${cat}" must have 0 laboratory entries in the catalogue`
    );
  }
});

test("T13: IT Sem 4 Mini Project Department-Specific Title Resolution & Search", () => {
  const miniProjectLab = MUMBAI_UNIVERSITY_LABS.find(
    (l) => l.id === "mu-nep-sem4-mini-project"
  );
  assert.ok(miniProjectLab, "Sem 4 Mini Project lab must exist in catalogue");

  // When activeDepartment === "it", display name reflects official IT PDF title: "Mini-Project – Programming Paradigm"
  const itDisplayName = getDisplayLabName(miniProjectLab, "it");
  assert.strictEqual(
    itDisplayName,
    "Mini-Project – Programming Paradigm",
    "When activeDepartment is 'it', Sem 4 Mini Project title must be 'Mini-Project – Programming Paradigm'"
  );

  // When activeDepartment === "all", display canonical name
  const allDisplayName = getDisplayLabName(miniProjectLab, "all");
  assert.strictEqual(
    allDisplayName,
    "Mini Project (Sem 4)",
    "When activeDepartment is 'all', Sem 4 Mini Project title must be canonical name"
  );

  // When activeDepartment is another branch (e.g. CE), display canonical name
  const ceDisplayName = getDisplayLabName(miniProjectLab, "ce");
  assert.strictEqual(
    ceDisplayName,
    "Mini Project (Sem 4)",
    "When activeDepartment is 'ce', Sem 4 Mini Project title must be canonical name"
  );

  // Searching for "Programming Paradigm" matches the mini-project lab
  const paradigmSearch = filterLabs(MUMBAI_UNIVERSITY_LABS, {
    ...DEFAULT_FILTERS,
    searchQuery: "Programming Paradigm",
  });
  assert.strictEqual(
    paradigmSearch.length,
    1,
    "Search for 'Programming Paradigm' must match the Sem 4 Mini Project"
  );
  assert.strictEqual(
    paradigmSearch[0].id,
    "mu-nep-sem4-mini-project",
    "Search result must be mu-nep-sem4-mini-project"
  );
});
