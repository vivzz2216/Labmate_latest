"""Registry of the Social Media Analytics practice data (built by backend/scripts/build_sma_datasets.py).

The client names a dataset; the server looks the name up here and loads the file itself. A name that is not
in the registry is rejected, so no request can reach any other file through this path.
"""
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "lab_data" / "sma"

# name -> media type. Text files are handed to the notebook as text, images as bytes.
DATASETS = {
    "social_posts_raw.csv": "text/csv",
    "tweets_sentiment.csv": "text/csv",
    "product_reviews.csv": "text/csv",
    "social_network_edges.csv": "text/csv",
    "social_kpi_powerbi.csv": "text/csv",
    "social_feed.html": "text/html",
    "profile_page.html": "text/html",
    "competitor_mentions.html": "text/html",
    "post_banner_1.png": "image/png",
    "post_banner_2.png": "image/png",
    "post_banner_3.png": "image/png",
}
MAX_DATASETS_PER_QUESTION = 8

# What each file contains, so generated code reads the real columns and selectors instead of guessing them.
DESCRIPTIONS = {
    "social_posts_raw.csv": "Raw, deliberately messy posts. Columns: post_id, username, platform (inconsistent case/spacing), post_text "
                            "(mixed case, URLs, hashtags), hashtag, posted_at (text timestamp), likes, shares, comments, followers, views, "
                            "location ('N/A' or blank). Has missing counts and exact duplicate rows.",
    "tweets_sentiment.csv": "Invented tweets about three fictitious brands. Columns: tweet_id, date (YYYY-MM-DD, 60 days), user, text "
                            "(contains hashtags), label (positive/negative/neutral), likes, retweets.",
    "product_reviews.csv": "Invented reviews of one fictitious product. Columns: review_id, product, rating (1-5), review_text, "
                           "review_date, helpful_votes. Reviews rated 1-2 are negative and name features such as battery, connectivity, "
                           "sound quality, app, comfort, price, customer support and charging case.",
    "social_network_edges.csv": "Undirected friendship edges of an invented network of 66 users. Columns: source, target "
                                "(names like user_01). Contains several communities, a few bridges and a few hub accounts.",
    "social_kpi_powerbi.csv": "Daily KPIs for four platforms over 90 days. Columns: date, platform, impressions, reach, likes, comments, "
                              "shares, clicks, followers, engagement_rate (percent).",
    "social_feed.html": "Practice web page (no network). Each post is article.post[data-user] containing h3.author, p.content, "
                        "time[datetime], span.likes, span.comments, span.shares.",
    "profile_page.html": "Practice profile page. h1.username, p.bio, span.followers, span.following, span.post-count and "
                         "li.post items with span.content and span.likes.",
    "competitor_mentions.html": "Practice page of viewer comments on three fictitious assistants (Aurora AI, Bolt Assistant, Cirrus Chat). "
                                "Each section.brand has h2 and div.comment[data-brand] with span.author, p.text, span.likes.",
    "post_banner_1.png": "Invented 240x240 post image (orange sunset gradient).",
    "post_banner_2.png": "Invented 240x240 post image (blue ocean gradient).",
    "post_banner_3.png": "Invented 240x240 post image (green forest gradient).",
}


# What an uploaded Social Media Analytics task is about -> the practice files that fit it. The catalogue names its files
# per part; a manual uploaded by a student does not, so its code tasks get the matching practice data here instead of
# the model inventing data of its own. First match wins.
TOPIC_DATASETS = [
    (r"competitor|chatgpt|chatsonic|gemini|each\s+platform", ["competitor_mentions.html"]),
    (r"\bscrap", ["social_feed.html", "profile_page.html"]),
    (r"networkx|network|communit|influence|graph\s+analys", ["social_network_edges.csv"]),
    (r"review|complain|negative\s+comment", ["product_reviews.csv"]),
    (r"sentiment|trend|content\s+analys|emoticon|tweet|image\s+analys", ["tweets_sentiment.csv", "post_banner_1.png",
                                                                        "post_banner_2.png", "post_banner_3.png"]),
    (r"preprocess|clean|exploratory|eda\b|visuali[sz]|mean|median|histogram|scatter", ["social_posts_raw.csv"]),
]


def suggest_datasets(text):
    """Practice files for a Social Media Analytics code task named only by its text (an uploaded manual), or []."""
    import re
    for pattern, names in TOPIC_DATASETS:
        if re.search(pattern, str(text or ""), re.I):
            return list(names)
    return []


def builtin_brief(names):
    """Describe the practice files a question may open, for the code-generation prompt."""
    if not names:
        return ""
    return ("Practice files already in the notebook workspace (read them by exact name, never by URL): "
            + " | ".join("%s - %s" % (name, DESCRIPTIONS.get(name, "")) for name in names))


def dataset_path(name):
    if not isinstance(name, str) or name not in DATASETS:
        raise ValueError("Unknown practice dataset.")
    path = DATA_DIR / name
    if not path.is_file():
        raise FileNotFoundError("The practice dataset %s is not installed." % name)
    return path


def load_dataset(name):
    """Return the file as text (csv/html) or bytes (images), ready for the notebook workspace."""
    path = dataset_path(name)
    return path.read_bytes() if DATASETS[name].startswith("image/") else path.read_text(encoding="utf-8")


def load_datasets(names):
    """Load several practice datasets by name; duplicates collapse and the count is capped."""
    names = list(dict.fromkeys(names or []))
    if len(names) > MAX_DATASETS_PER_QUESTION:
        raise ValueError("A question can use at most %d practice datasets." % MAX_DATASETS_PER_QUESTION)
    return {name: load_dataset(name) for name in names}
