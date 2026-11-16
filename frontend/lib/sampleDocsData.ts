export interface SampleDoc {
  id: string;
  title: string;
  experimentNumber: string;
  subject: string;
  subjectCategory: "r-stats" | "python" | "sql" | "sma" | "web" | "systems";
  categoryLabel: string;
  syllabusCode: string;
  before: {
    title: string;
    description: string;
    fileSize: string;
    fileType: string;
    rawSnippet: string;
    painPoints: string[];
  };
  after: {
    title: string;
    description: string;
    fileSize: string;
    fileType: string;
    pages: number;
    screenshotsCount: number;
    ideTheme: string;
    highlights: string[];
    downloadUrl: string;
    previewImage: string;
    vivaQuestionsCount: number;
  };
  rawDownloadUrl?: string;
}

export const SAMPLE_CATEGORIES = [
  { id: "all", label: "All Samples" },
  { id: "r-stats", label: "R & Data Science" },
  { id: "python", label: "Python & OOP" },
  { id: "sql", label: "MySQL & Databases" },
  { id: "sma", label: "Social Media Analytics" },
  { id: "web", label: "Web Development" },
  { id: "systems", label: "Systems & Networks" },
] as const;

export const SAMPLE_DOCUMENTS: SampleDoc[] = [
  {
    id: "r-exp1-vectors",
    title: "Vectors, Operators & Built-in Functions in R",
    experimentNumber: "EXP 01",
    subject: "Statistical Computing Laboratory",
    subjectCategory: "r-stats",
    categoryLabel: "R & Data Science",
    syllabusCode: "CSL-404 · Mumbai Univ / VTU",
    before: {
      title: "Raw University Experiment Sheet (Before)",
      description: "Generic problem statement with unformatted procedure points, no verifiable R script, zero screenshot evidence, and empty output sections.",
      fileSize: "37 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Aim: To create numeric, character and logical vectors in R and to apply arithmetic, comparison, indexing and summary functions to them.\n\nProcedure:\n1. Create a named numeric vector of marks and print it.\n2. Apply arithmetic and comparison operators...\n3. [No code, no outputs provided]",
      painPoints: [
        "Empty code section requiring manual scripting",
        "Zero execution evidence or console captures",
        "No vector summary tables or data types breakdown",
        "Requires manual copy-pasting from ChatGPT into Word"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "Submission-ready document featuring genuine collegiate metadata, formal aim & theory, vectorized code, and 5 native 1080p RStudio Dark editor screenshots.",
      fileSize: "815 KB",
      fileType: "Completed Word (.docx)",
      pages: 6,
      screenshotsCount: 5,
      ideTheme: "RStudio Dark Modern",
      highlights: [
        "Formal academic cover metadata & course codes",
        "Complete vectorized R code with zero runtime errors",
        "5 native 1080p RStudio Dark execution screenshots",
        "Collegiate OxML bordered summary tables",
        "6 Viva-Voce oral exam questions with model answers"
      ],
      downloadUrl: "/samples/r-exp1-vectors-rstudio-dark.docx",
      previewImage: "/images/samples/rstudio-sample-1.png",
      vivaQuestionsCount: 6
    },
    rawDownloadUrl: "/samples/raw-manual-r-exp1-before.docx"
  },
  {
    id: "r-exp5-regression",
    title: "Simple & Multiple Linear Regression in R",
    experimentNumber: "EXP 05",
    subject: "Statistical Computing & Modeling",
    subjectCategory: "r-stats",
    categoryLabel: "R & Data Science",
    syllabusCode: "CSL-502 · Anna Univ / SPPU",
    before: {
      title: "Raw Syllabus Lab Assignment (Before)",
      description: "Bare prompt requesting regression analysis on mtcars dataset. Lacks formula notation, residual analysis, diagnostic charts, or interpretation.",
      fileSize: "37 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Aim: Fit a simple linear regression model between mpg and wt in mtcars. Next, fit a multiple regression model adding hp. Comment on R-squared.\n\n[End of prompt - No code or plots]",
      painPoints: [
        "Missing mathematical formulation of the regression equation",
        "No residual diagnostic plots or Q-Q plots",
        "ANOVA summary table missing from student prompt",
        "Hours needed to manually generate and paste graphics into Word"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "Comprehensive 1.39 MB statistical dossier including formula derivations, automated lm() model runs, ANOVA tables, and high-fidelity residual scatter plots.",
      fileSize: "1.39 MB",
      fileType: "Completed Word (.docx)",
      pages: 10,
      screenshotsCount: 6,
      ideTheme: "RStudio Dark Modern",
      highlights: [
        "Full mathematical equation (KaTeX style in Word)",
        "Formatted model summary coefficients & p-values",
        "6 high-res RStudio Dark graphs (Residuals vs Fitted, Normal Q-Q)",
        "Interpretation of Adjusted R-squared & F-statistic",
        "Viva questions on multicollinearity and homoscedasticity"
      ],
      downloadUrl: "/samples/r-exp5-linear-regression-dark.docx",
      previewImage: "/images/samples/regression-sample-1.png",
      vivaQuestionsCount: 8
    }
  },
  {
    id: "sma-exp4-eda",
    title: "Exploratory Data Analysis & Visualizations",
    experimentNumber: "EXP 04",
    subject: "Social Media Analytics Laboratory",
    subjectCategory: "sma",
    categoryLabel: "Social Media Analytics",
    syllabusCode: "ITL-601 · Mumbai Univ",
    before: {
      title: "Raw Manual Lab Guide (Before)",
      description: "Syllabus prompt specifying exploratory analysis over social metrics. Contains no data cleaning steps, distribution checks, or visualization scripts.",
      fileSize: "44 KB",
      fileType: "Raw PDF / Word",
      rawSnippet: "Perform EDA on Twitter/Instagram engagement metrics. Plot engagement rate distributions, identify outlier hashtags, and generate correlation heatmaps.",
      painPoints: [
        "No dataset provided or schema validation",
        "Missing matplotlib & seaborn styling configurations",
        "Zero chart captures or visual evidence",
        "Formatting 20+ charts in Word manually breaks page layouts"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "Flagship 1.47 MB report containing 21 beautifully rendered analytical charts, skewness interpretations, correlation matrices, and executive findings.",
      fileSize: "1.47 MB",
      fileType: "Completed Word (.docx)",
      pages: 14,
      screenshotsCount: 21,
      ideTheme: "Visual Analytics Light & Dark",
      highlights: [
        "21 embedded data visualizations & charts",
        "Step-by-step outlier identification via IQR method",
        "Correlation matrix tables with color-scaled headers",
        "Zero layout distortion: images pre-scaled to collegiate margins",
        "Comprehensive viva review on engagement metrics"
      ],
      downloadUrl: "/samples/sma-exp4-exploratory-analytics.docx",
      previewImage: "/images/samples/sma-chart-sample.png",
      vivaQuestionsCount: 10
    }
  },
  {
    id: "sma-exp10-text-mining",
    title: "Social Media Review Mining & Sentiment Analytics",
    experimentNumber: "EXP 10",
    subject: "Social Media Text Analytics",
    subjectCategory: "sma",
    categoryLabel: "Social Media Analytics",
    syllabusCode: "ITL-601 · Mumbai Univ",
    before: {
      title: "Raw Lab Problem Statement (Before)",
      description: "Brief assignment asking students to scrape reviews and classify sentiment into positive/negative. No preprocessing pipeline or confusion matrices.",
      fileSize: "38 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Aim: Perform sentiment analysis on social media product reviews using VADER or TextBlob. Display word clouds and classification metrics.",
      painPoints: [
        "No regex cleaning or stopword removal pipelines",
        "WordCloud rendering requires manual screenshotting",
        "Missing precision, recall, and F1-score evaluation tables"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "576 KB polished document with complete NLTK text processing, sentiment polarity distribution graphs, word cloud captures, and classification reports.",
      fileSize: "576 KB",
      fileType: "Completed Word (.docx)",
      pages: 8,
      screenshotsCount: 4,
      ideTheme: "Python / Jupyter Notebook",
      highlights: [
        "Automated text cleaning and lemmatization pipeline",
        "High-contrast polarity histogram and word cloud embeds",
        "OxML shaded table of positive vs negative sample sentences",
        "Viva Voce questions covering VADER compound thresholds"
      ],
      downloadUrl: "/samples/sma-exp10-text-mining.docx",
      previewImage: "/images/samples/sma-sample-2.png",
      vivaQuestionsCount: 6
    }
  },
  {
    id: "python-exp8-inheritance",
    title: "Menu-Driven OOP Inheritance & Polymorphism",
    experimentNumber: "EXP 08",
    subject: "Python Programming Laboratory",
    subjectCategory: "python",
    categoryLabel: "Python & OOP",
    syllabusCode: "SE-IT · Semester IV",
    before: {
      title: "Raw College Assignment (Before)",
      description: "Mumbai University SFIT college manual sheet with experiment aim and basic procedure outline, but completely blank program and output spaces.",
      fileSize: "35 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Department Of Information Technology\nExperiment – 8: Python program to implement Inheritance\nAim: Write a menu driven program to demonstrate OOP in python.\nProcedure: [Listed 4 points]\nProgram: [BLANK]\nOutput: [BLANK]",
      painPoints: [
        "Blank program section requiring student to write full OOP code",
        "Zero terminal evidence or menu execution screenshots",
        "No constructor super() chaining demonstration",
        "Risk of marks deduction for improper output formatting"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "383 KB complete submission with multiple inheritance, method overriding, super() calls, and real 1080p Python IDLE execution screenshots.",
      fileSize: "383 KB",
      fileType: "Completed Word (.docx)",
      pages: 6,
      screenshotsCount: 3,
      ideTheme: "Python IDLE Classic",
      highlights: [
        "Fully working menu-driven Python OOP implementation",
        "Single, multiple, and hierarchical inheritance hierarchies",
        "Real 1080p Python IDLE editor & shell interactive evidence",
        "Formatted output text block with valid test runs",
        "Viva questions on MRO (Method Resolution Order)"
      ],
      downloadUrl: "/samples/python-exp8-inheritance-oop.docx",
      previewImage: "/images/labs/idle-hd.webp",
      vivaQuestionsCount: 7
    }
  },
  {
    id: "python-exp11-file-handling",
    title: "File Handling, Pickle Serialization & Streams",
    experimentNumber: "EXP 11",
    subject: "Python Programming Laboratory",
    subjectCategory: "python",
    categoryLabel: "Python & OOP",
    syllabusCode: "SE-IT · Semester IV",
    before: {
      title: "Raw University Manual (Before)",
      description: "Classroom assignment sheet asking for binary file read/write using pickle module, with empty implementation and test run sections.",
      fileSize: "31 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Experiment – 11: Python program to implement different file handling operations using pickle\nAim: To implement a python program for file manipulation...\n[Blank execution sections]",
      painPoints: [
        "No error handling for FileNotFoundError / EOFError",
        "Missing proof of file creation on student filesystem",
        "No pickle serialization demonstration"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "172 KB verified manual with robust try-except-finally blocks, pickle dumping/loading, and IDLE shell verification screenshots.",
      fileSize: "172 KB",
      fileType: "Completed Word (.docx)",
      pages: 5,
      screenshotsCount: 2,
      ideTheme: "Python IDLE Shell",
      highlights: [
        "Clean binary file I/O with context managers (`with open`)",
        "Pickle object serialization and deserialization demo",
        "Real IDLE Shell screenshot showing interactive prompt output",
        "Viva Voce questions on binary vs text mode"
      ],
      downloadUrl: "/samples/python-exp11-file-handling.docx",
      previewImage: "/images/labs/idle-shell-hd.webp",
      vivaQuestionsCount: 5
    }
  },
  {
    id: "sql-exp5-nested-queries",
    title: "Complex GROUP BY & Nested Correlated Subqueries",
    experimentNumber: "EXP 05",
    subject: "Structured Query Language (RDBMS)",
    subjectCategory: "sql",
    categoryLabel: "MySQL & Databases",
    syllabusCode: "SE-COMPS · Semester III",
    before: {
      title: "Raw College Manual (Before)",
      description: "Department syllabus question sheet with sample table schema and 8 complex query questions without solutions or verified result tables.",
      fileSize: "13 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Department Of Computer Engineering\nExperiment – 5: Perform complex queries using group by and nested queries...\nQuestions:\n1. Find employees earning more than department average.\n2. Count projects per department having budget > 50000...\n[Empty queries & results]",
      painPoints: [
        "Empty queries leaving student to troubleshoot SQL syntax",
        "No sample DDL schema or INSERT statements provided",
        "Missing result grid tables",
        "Examiners require visual evidence of MySQL terminal / Workbench"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "184 KB submission record containing exact DDL schema, verified SQL queries with subqueries, and genuine MySQL Workbench result grid captures.",
      fileSize: "184 KB",
      fileType: "Completed Word (.docx)",
      pages: 6,
      screenshotsCount: 2,
      ideTheme: "MySQL Workbench / CLI",
      highlights: [
        "Complete DDL table creation and realistic sample records",
        "Correlated subqueries and HAVING clause solutions",
        "Pixel-perfect MySQL Workbench grid capture",
        "Bordered OxML output tables matching exact DB responses",
        "Viva questions on WHERE vs HAVING and subquery indexing"
      ],
      downloadUrl: "/samples/sql-exp5-nested-queries.docx",
      previewImage: "/images/labs/mysql-hd.webp",
      vivaQuestionsCount: 8
    },
    rawDownloadUrl: "/samples/raw-manual-sql-exp3-before.docx"
  },
  {
    id: "sql-exp7-joins-views",
    title: "Multi-Table Relational Joins & Database Views",
    experimentNumber: "EXP 07",
    subject: "Database Management Systems",
    subjectCategory: "sql",
    categoryLabel: "MySQL & Databases",
    syllabusCode: "SE-IT · Semester III",
    before: {
      title: "Raw DBMS Assignment Sheet (Before)",
      description: "Brief lab instructions on INNER, LEFT, RIGHT JOIN and VIEW creation on bank/student databases. No execution logs.",
      fileSize: "28 KB",
      fileType: "Raw Word (.docx)",
      rawSnippet: "Experiment – 7: Implement Inner, Outer Joins and Create Views.\nAim: Write SQL queries demonstrating various JOIN conditions.\n[No SQL queries or evidence]",
      painPoints: [
        "Missing multi-table relational schema",
        "No updatable view considerations or constraints explained",
        "Zero output screenshots"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "242 KB accredited report with foreign key integrity, cross/outer joins, view security considerations, and execution screenshots.",
      fileSize: "242 KB",
      fileType: "Completed Word (.docx)",
      pages: 7,
      screenshotsCount: 3,
      ideTheme: "MySQL Terminal & Workbench",
      highlights: [
        "Normalized 3NF relational schema with foreign key constraints",
        "INNER, LEFT, RIGHT, and FULL OUTER join syntax",
        "CREATE VIEW and materialization performance notes",
        "True MySQL console screenshots and formatted tables"
      ],
      downloadUrl: "/samples/sql-exp7-joins-views.docx",
      previewImage: "/images/labs/mysql-hd.webp",
      vivaQuestionsCount: 6
    }
  },
  {
    id: "webdev-exp2-dom",
    title: "Interactive DOM Manipulation & Responsive Layouts",
    experimentNumber: "EXP 02",
    subject: "Internet Programming Laboratory",
    subjectCategory: "web",
    categoryLabel: "Web Development",
    syllabusCode: "TE-IT · Semester V",
    before: {
      title: "Raw Internet Programming Guide (Before)",
      description: "University PDF asking for dynamic HTML5 form validation and event listeners. Lacks clean modular JS code and browser screenshots.",
      fileSize: "32 KB",
      fileType: "Raw PDF",
      rawSnippet: "Aim: Design a student registration form with client-side JavaScript validation (regex email, phone length, password match). Display real-time error messages.",
      painPoints: [
        "Missing CSS styling and responsive viewport meta tags",
        "No modern ES6+ event delegation patterns",
        "Must run local server and capture browser window manually"
      ]
    },
    after: {
      title: "LabMate Accredited Word Record (After)",
      description: "180 KB submission with semantic HTML5, modern CSS3 flexbox/grid, accessible JS validation, and desktop/mobile browser captures.",
      fileSize: "180 KB",
      fileType: "Completed Word (.docx)",
      pages: 6,
      screenshotsCount: 2,
      ideTheme: "VS Code & Browser Frame",
      highlights: [
        "Clean, commented HTML5, CSS3, and ES6 JavaScript code",
        "Real-time validation with accessibility ARIA attributes",
        "Dual screenshot: VS Code source + Microsoft Edge live render",
        "Viva questions on event bubbling, capturing, and DOM API"
      ],
      downloadUrl: "/samples/webdev-exp2-interactive-dom.docx",
      previewImage: "/images/labs/web-output-hd.webp",
      vivaQuestionsCount: 6
    }
  }
];
