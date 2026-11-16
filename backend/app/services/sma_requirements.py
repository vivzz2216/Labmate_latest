"""Social Media Analytics lab: notebook instructions and the function counts the university manuals ask for.

Experiment 3 asks for 7-8 preprocessing functions and Experiment 4 for ten exploratory functions and ten
visualization functions. A program that does fewer must not be reported as passing, so the counts are checked on
the generated code and a shortfall is handled like any other execution failure (the code is repaired).
"""
import ast

# part_title (set by the lab catalogue) -> (what is counted, minimum distinct operations)
COUNTED_PARTS = {
    "Cleaning social_posts_raw.csv": ("preprocessing", 7),
    "Part A: ten exploratory analysis functions": ("eda", 10),
    "Part B: ten visualization functions": ("plots", 10),
}

LABELS = {"preprocessing": "data preprocessing functions", "eda": "exploratory analysis functions",
          "plots": "visualization functions"}

# canonical operation -> call names that implement it
OPERATIONS = {
    "preprocessing": {
        "lower": {"lower", "casefold"}, "upper": {"upper"}, "title": {"title", "capitalize"}, "drop": {"drop"},
        "extract": {"extract", "extractall", "findall"}, "drop_duplicates": {"drop_duplicates", "duplicated"},
        "fillna": {"fillna", "interpolate"}, "dropna": {"dropna"}, "strip": {"strip", "lstrip", "rstrip"},
        "to_datetime": {"to_datetime"}, "replace": {"replace"}, "astype": {"astype", "to_numeric"}, "rename": {"rename"},
        "isnull": {"isnull", "isna"}, "sort_values": {"sort_values"}, "reset_index": {"reset_index"}, "split": {"split"},
        "contains": {"contains"},
    },
    "eda": {
        "mean": {"mean", "nanmean", "average"}, "median": {"median", "nanmedian"}, "mode": {"mode"},
        "variance": {"var", "variance", "pvariance"}, "std": {"std", "stdev", "pstdev"}, "min": {"min", "nanmin", "idxmin"},
        "max": {"max", "nanmax", "idxmax"}, "quantile": {"quantile", "percentile", "quantiles"}, "skew": {"skew", "skewness"},
        "kurtosis": {"kurt", "kurtosis"}, "correlation": {"corr", "corrcoef", "pearsonr", "spearmanr"}, "covariance": {"cov"},
        "describe": {"describe"}, "value_counts": {"value_counts"}, "count": {"count", "nunique"}, "sum": {"sum"},
        "range": {"ptp"}, "groupby": {"groupby"},
    },
    "plots": {
        "scatter": {"scatter", "scatterplot"}, "histogram": {"hist", "histplot", "displot"}, "pie": {"pie"},
        "heatmap": {"heatmap", "imshow", "matshow"}, "bar": {"bar", "barh", "barplot"}, "line": {"lineplot"},
        "box": {"boxplot", "box"}, "violin": {"violinplot", "violin"}, "kde": {"kdeplot", "kde"}, "count": {"countplot"},
        "pair": {"pairplot"}, "area": {"stackplot", "fill_between", "area"}, "hexbin": {"hexbin"}, "stem": {"stem"},
        "step": {"step"}, "errorbar": {"errorbar"}, "joint": {"jointplot"}, "strip": {"stripplot", "swarmplot"},
        "regression": {"regplot", "lmplot"},
    },
}
# DataFrame.plot(kind=...) names the chart in its keyword.
PLOT_KINDS = {"bar": "bar", "barh": "bar", "hist": "histogram", "box": "box", "pie": "pie", "kde": "kde", "density": "kde",
              "area": "area", "scatter": "scatter", "hexbin": "hexbin", "line": "line"}


def _called_names(tree):
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        name = node.func.attr if isinstance(node.func, ast.Attribute) else node.func.id if isinstance(node.func, ast.Name) else None
        if name:
            yield name, node


def distinct_operations(kind, code):
    """The canonical operations of one kind that the code actually calls."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return set()
    table = OPERATIONS[kind]
    found = set()
    for name, node in _called_names(tree):
        for canonical, aliases in table.items():
            if name in aliases:
                found.add(canonical)
        if kind == "plots" and name == "plot":
            kind_keyword = next((kw.value.value for kw in node.keywords
                                 if kw.arg == "kind" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str)), None)
            found.add(PLOT_KINDS.get(kind_keyword, "line"))
    return found


# The same counts as written in an uploaded manual: "Implement any 10 functions for Exploratory Analysis",
# "Implement 7-8 functions of data preprocessing" (the lower bound of a range is the requirement).
TEXT_COUNTS = [
    ("preprocessing", r"(\d+)\s*(?:-\s*\d+\s*)?functions?\s+(?:of|for)\s+(?:data\s+)?pre-?process"),
    ("eda", r"(\d+)\s*(?:-\s*\d+\s*)?functions?\s+(?:of|for)\s+exploratory"),
    ("plots", r"(\d+)\s*(?:-\s*\d+\s*)?functions?\s+(?:of|for)\s+visuali[sz]"),
]


def counted_requirements(question):
    """[(kind, minimum)] the manual asks this code part for: from the catalogue part title, else from the task text."""
    if question.get("track") != "sma":
        return []
    counted = COUNTED_PARTS.get(str(question.get("part_title") or ""))
    if counted:
        return [counted]
    import re
    found = []
    for kind, pattern in TEXT_COUNTS:
        match = re.search(pattern, str(question.get("text") or ""), re.I)
        if match and 1 <= int(match.group(1)) <= 20:
            found.append((kind, int(match.group(1))))
    return found


def sma_shortfall(question, code):
    """A message when a counted part has fewer distinct operations than the manual asks for, else None."""
    problems = []
    for kind, minimum in counted_requirements(question):
        found = distinct_operations(kind, code)
        if len(found) < minimum:
            problems.append("at least %d different %s but the program uses %d (%s)"
                            % (minimum, LABELS[kind], len(found), ", ".join(sorted(found)) or "none"))
    if not problems:
        return None
    return "This experiment needs " + "; and ".join(problems) + ". Add the missing ones, each in its own labelled step."


def sma_instructions(question):
    """Extra notebook rules for Social Media Analytics parts."""
    text = (
        "\nSOCIAL MEDIA ANALYTICS NOTEBOOK: the workspace already contains the practice file(s) named in the question; read them by "
        "exact relative name (pd.read_csv('name.csv'), open('name.html', encoding='utf-8')). The data is invented LabMate practice data, "
        "so describe it as practice data and never present it as real posts, real users or real opinions about real companies. "
        "Available libraries: pandas, numpy, scipy, matplotlib, seaborn, scikit-learn, nltk, networkx, bs4 (BeautifulSoup) and PIL. "
        "Scrape the supplied HTML file with BeautifulSoup(html_text, 'html.parser'); never request a URL or import requests/urllib. "
        "For sentiment use nltk.sentiment.vader.SentimentIntensityAnalyzer: its lexicon is pre-installed, so never call nltk.download, "
        "and use scikit-learn for stop words and tokenising. Save requested output files with relative names in the working directory "
        "and print their contents. Start each labelled step with a print() of its heading so the output reads as a lab record. "
    )
    for kind, minimum in counted_requirements(question):
        text += ("The manual requires at least %d DIFFERENT %s; a repeated call to the same function counts once, so implement %d "
                 "distinct ones, each clearly labelled. " % (minimum, LABELS[kind], minimum))
    return text
