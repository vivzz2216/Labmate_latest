"""Reference programs for the Social Media Analytics lab, used to verify the lab end to end without a language model.

Each case lists the parts of one experiment exactly as frontend/lib/smaCatalog.ts launches them. Code parts carry a
hand-written reference solution that is run for real in the notebook runtime on the bundled practice data; theory and
evidence parts carry a short sample answer. The evidence screenshots in the test reports are labelled stand-ins: LabMate
never draws a Canva, ParseHub, Google Trends or Similarweb screen, and neither do these cases.
"""

FEED = '''import pandas as pd
from bs4 import BeautifulSoup

print("=== Method B: scraping social_feed.html with BeautifulSoup ===")
with open("social_feed.html", encoding="utf-8") as handle:
    soup = BeautifulSoup(handle.read(), "html.parser")
rows = []
for post in soup.select("article.post"):
    rows.append({
        "author": post.select_one(".author").get_text(strip=True),
        "text": post.select_one(".content").get_text(strip=True),
        "date": post.select_one("time")["datetime"],
        "likes": int(post.select_one(".likes").get_text()),
        "comments": int(post.select_one(".comments").get_text()),
        "shares": int(post.select_one(".shares").get_text()),
    })
df = pd.DataFrame(rows)
print(df.to_string())
df.to_csv("scraped_posts.csv", index=False)
with open("scraped_posts.txt", "w", encoding="utf-8") as out:
    for row in rows:
        out.write("%s | %s | %s | likes=%d comments=%d shares=%d\\n" % (
            row["author"], row["date"], row["text"], row["likes"], row["comments"], row["shares"]))
print("\\n=== scraped_posts.csv ===")
print(open("scraped_posts.csv", encoding="utf-8").read())
print("=== scraped_posts.txt ===")
print(open("scraped_posts.txt", encoding="utf-8").read())

print("=== profile_page.html ===")
with open("profile_page.html", encoding="utf-8") as handle:
    profile = BeautifulSoup(handle.read(), "html.parser")
print("Username :", profile.select_one(".username").get_text(strip=True))
print("Followers:", profile.select_one(".followers").get_text(strip=True))
print("Following:", profile.select_one(".following").get_text(strip=True))
print("Posts    :", profile.select_one(".post-count").get_text(strip=True))
'''

CLEAN = '''import pandas as pd

df = pd.read_csv("social_posts_raw.csv")
print("=== Raw data ===")
print("Shape:", df.shape)
print(df.isna().sum())
print(df.head(5).to_string())

print("\\n=== 1. str.lower: lowercase post_text ===")
df["post_text"] = df["post_text"].str.lower()
print(df["post_text"].head(3).to_string())

print("\\n=== 2. drop: remove the unused column location ===")
df = df.drop(columns=["location"])
print(list(df.columns))

print("\\n=== 3. str.extract: first URL in each post ===")
df["url"] = df["post_text"].str.extract(r"(https?://\\S+)", expand=False)
print(df["url"].dropna().head(3).to_string())

print("\\n=== 4. str.extract: first hashtag ===")
df["first_tag"] = df["post_text"].str.extract(r"(#\\w+)", expand=False)
print(df["first_tag"].value_counts().head(5).to_string())

print("\\n=== 5. drop_duplicates ===")
before = len(df)
df = df.drop_duplicates()
print("Rows before:", before, "after:", len(df))

print("\\n=== 6. fillna: missing likes, shares, comments ===")
for column in ["likes", "shares", "comments"]:
    df[column] = df[column].fillna(df[column].median())
print(df[["likes", "shares", "comments"]].isna().sum().to_string())

print("\\n=== 7. str.strip + str.lower: standardise platform ===")
df["platform"] = df["platform"].str.strip().str.lower()
print(df["platform"].value_counts().to_string())

print("\\n=== 8. to_datetime: posted_at ===")
df["posted_at"] = pd.to_datetime(df["posted_at"])
print(df["posted_at"].dtype)

df.to_csv("cleaned_posts.csv", index=False)
print("\\n=== Cleaned data saved to cleaned_posts.csv ===")
print("Shape:", df.shape)
print(df.isna().sum().to_string())
print(pd.read_csv("cleaned_posts.csv").head(5).to_string())
'''

EDA_PREP = '''import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

df = pd.read_csv("social_posts_raw.csv").drop_duplicates()
for column in ["likes", "shares", "comments", "followers", "views"]:
    df[column] = df[column].fillna(df[column].median())
'''

EDA = EDA_PREP + '''
cols = ["likes", "shares", "comments", "followers", "views"]
print("=== 1. mean ===");            print(df[cols].mean().round(2).to_string())
print("=== 2. median ===");          print(df[cols].median().to_string())
print("=== 3. mode ===");            print(df[cols].mode().iloc[0].to_string())
print("=== 4. variance ===");        print(df[cols].var().round(2).to_string())
print("=== 5. standard deviation ==="); print(df[cols].std().round(2).to_string())
print("=== 6. minimum ===");         print(df[cols].min().to_string())
print("=== 7. maximum ===");         print(df[cols].max().to_string())
print("=== 8. quantiles ===");       print(df[cols].quantile([0.25, 0.5, 0.75]).to_string())
print("=== 9. skewness ===");        print(df[cols].skew().round(3).to_string())
print("=== 10. kurtosis ===");       print(df[cols].kurt().round(3).to_string())
print("=== 11. correlation matrix ==="); print(df[cols].corr().round(3).to_string())
print("=== value_counts of platform ===")
print(df["platform"].str.strip().str.title().value_counts().to_string())
'''

VIZ = EDA_PREP + '''
df["platform"] = df["platform"].str.strip().str.title()
df["posted_at"] = pd.to_datetime(df["posted_at"])
cols = ["likes", "shares", "comments", "followers", "views"]

print("=== 1. scatter plot: likes vs shares ===")
plt.figure(figsize=(6, 4)); plt.scatter(df["likes"], df["shares"], alpha=.6)
plt.title("Likes vs shares"); plt.xlabel("likes"); plt.ylabel("shares"); plt.show()
print("=== 2. histogram of likes ===")
plt.figure(figsize=(6, 4)); plt.hist(df["likes"], bins=20, color="teal")
plt.title("Distribution of likes"); plt.xlabel("likes"); plt.ylabel("posts"); plt.show()
print("=== 3. pie chart of posts per platform ===")
plt.figure(figsize=(5, 5)); plt.pie(df["platform"].value_counts(), labels=df["platform"].value_counts().index, autopct="%1.0f%%")
plt.title("Posts per platform"); plt.show()
print("=== 4. heatmap of the correlation matrix ===")
plt.figure(figsize=(6, 5)); sns.heatmap(df[cols].corr(), annot=True, fmt=".2f", cmap="viridis")
plt.title("Correlation heatmap"); plt.show()
print("=== 5. bar chart of mean likes per platform ===")
means = df.groupby("platform")["likes"].mean()
plt.figure(figsize=(6, 4)); plt.bar(means.index, means.values, color="orange")
plt.title("Mean likes per platform"); plt.xlabel("platform"); plt.ylabel("mean likes"); plt.show()
print("=== 6. line chart of posts per month ===")
monthly = df.set_index("posted_at").resample("MS").size()
plt.figure(figsize=(6, 4)); plt.plot(monthly.index, monthly.values, marker="o")
plt.title("Posts per month"); plt.xlabel("month"); plt.ylabel("posts"); plt.show()
print("=== 7. box plot of likes by platform ===")
plt.figure(figsize=(6, 4)); sns.boxplot(data=df, x="platform", y="likes")
plt.title("Likes by platform"); plt.show()
print("=== 8. violin plot of views ===")
plt.figure(figsize=(6, 4)); sns.violinplot(y=df["views"], color="salmon")
plt.title("Views"); plt.ylabel("views"); plt.show()
print("=== 9. KDE plot of followers ===")
plt.figure(figsize=(6, 4)); sns.kdeplot(df["followers"], fill=True)
plt.title("Followers density"); plt.xlabel("followers"); plt.show()
print("=== 10. count plot of platform ===")
plt.figure(figsize=(6, 4)); sns.countplot(data=df, x="platform")
plt.title("Posts per platform (count plot)"); plt.xlabel("platform"); plt.ylabel("posts"); plt.show()
'''

SENTIMENT = '''import pandas as pd
import matplotlib.pyplot as plt
from nltk.sentiment.vader import SentimentIntensityAnalyzer

print("PROBLEM STATEMENT: classify tweets about three fictitious brands as positive, negative or neutral and watch the trend.")
print("DATASET: tweets_sentiment.csv (LabMate practice data), 180 tweets over 60 days.  LIBRARIES: pandas, NLTK VADER, matplotlib.")
tweets = pd.read_csv("tweets_sentiment.csv")
analyzer = SentimentIntensityAnalyzer()
tweets["compound"] = tweets["text"].apply(lambda text: analyzer.polarity_scores(text)["compound"])
tweets["predicted"] = tweets["compound"].apply(lambda score: "positive" if score >= 0.05 else "negative" if score <= -0.05 else "neutral")
print(tweets[["text", "label", "predicted", "compound"]].head(8).to_string())
print("\\nAccuracy against the label column:", round((tweets["predicted"] == tweets["label"]).mean(), 3))
print(pd.crosstab(tweets["label"], tweets["predicted"]))

counts = tweets["predicted"].value_counts()
plt.figure(figsize=(6, 4)); plt.bar(counts.index, counts.values, color=["green", "red", "gray"][:len(counts)])
plt.title("Predicted sentiment of tweets"); plt.xlabel("sentiment"); plt.ylabel("tweets"); plt.show()

tweets["date"] = pd.to_datetime(tweets["date"])
daily = tweets.groupby("date")["compound"].mean()
plt.figure(figsize=(7, 4)); plt.plot(daily.index, daily.values)
plt.title("Daily average sentiment"); plt.xlabel("date"); plt.ylabel("mean compound score"); plt.show()

tags = tweets["text"].str.findall(r"#\\w+").explode().value_counts().head(5)
print("\\nTop five hashtags:"); print(tags.to_string())
print("\\nINFERENCE: the mix of predicted sentiment is shown above; VADER agrees with the labels for most tweets, and the trend chart shows how the mood moves day to day.")
'''

NETWORKS = '''import networkx as nx
import matplotlib.pyplot as plt

graphs = {
    "Erdos-Renyi": nx.erdos_renyi_graph(40, 0.1, seed=7),
    "Barabasi-Albert": nx.barabasi_albert_graph(40, 2, seed=7),
    "Watts-Strogatz": nx.watts_strogatz_graph(40, 4, 0.2, seed=7),
}
for name, graph in graphs.items():
    print("=== %s ===" % name)
    print("Nodes:", graph.number_of_nodes(), " Edges:", graph.number_of_edges())
    print("Density:", round(nx.density(graph), 4))
    print("Average degree:", round(sum(d for _, d in graph.degree()) / graph.number_of_nodes(), 2))
    print("Average clustering coefficient:", round(nx.average_clustering(graph), 4))
    biggest = graph.subgraph(max(nx.connected_components(graph), key=len))
    print("Average shortest path (largest component):", round(nx.average_shortest_path_length(biggest), 3))
    print("Diameter (largest component):", nx.diameter(biggest))
    plt.figure(figsize=(5, 4)); nx.draw(graph, node_size=60, node_color="skyblue", edge_color="gray")
    plt.title(name + " network"); plt.show()
    plt.figure(figsize=(5, 3)); plt.hist([d for _, d in graph.degree()], bins=10, color="slateblue")
    plt.title(name + " degree distribution"); plt.xlabel("degree"); plt.ylabel("nodes"); plt.show()
'''

COMMUNITIES = '''import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from networkx.algorithms import community

edges = pd.read_csv("social_network_edges.csv")
graph = nx.from_pandas_edgelist(edges, "source", "target")
print("Users:", graph.number_of_nodes(), " Friendships:", graph.number_of_edges(), " Density:", round(nx.density(graph), 4))

groups = community.greedy_modularity_communities(graph)
print("\\nCommunities detected:", len(groups))
for number, members in enumerate(groups, 1):
    print("  Community %d: %d users" % (number, len(members)))
print("Modularity:", round(community.modularity(graph, groups), 4))

degree = nx.degree_centrality(graph)
between = nx.betweenness_centrality(graph)
pagerank = nx.pagerank(graph)
for label, scores in [("degree centrality", degree), ("betweenness centrality", between), ("PageRank", pagerank)]:
    print("\\nTop 10 users by %s:" % label)
    for user, value in sorted(scores.items(), key=lambda item: -item[1])[:10]:
        print("  %-8s %.4f" % (user, value))

colour = {user: index for index, members in enumerate(groups) for user in members}
plt.figure(figsize=(8, 6))
layout = nx.spring_layout(graph, seed=3)
nx.draw(graph, layout, node_color=[colour[n] for n in graph], cmap=plt.cm.tab10,
        node_size=[3000 * pagerank[n] for n in graph], edge_color="lightgray", with_labels=False)
plt.title("Communities (colour) and influence (size = PageRank)"); plt.show()
top = max(pagerank, key=pagerank.get)
print("\\nINTERPRETATION: %s is the most influential account (PageRank %.3f); the colours show %d friendship communities." % (top, pagerank[top], len(groups)))
'''

COMPETITORS = '''import pandas as pd
import matplotlib.pyplot as plt
from bs4 import BeautifulSoup
from nltk.sentiment.vader import SentimentIntensityAnalyzer

with open("competitor_mentions.html", encoding="utf-8") as handle:
    soup = BeautifulSoup(handle.read(), "html.parser")
rows = [{"brand": c["data-brand"], "author": c.select_one(".author").get_text(strip=True),
         "comment": c.select_one(".text").get_text(strip=True), "likes": int(c.select_one(".likes").get_text())}
        for c in soup.select("div.comment")]
data = pd.DataFrame(rows)
print("Scraped", len(data), "comments for", data["brand"].nunique(), "brands")
print(data.head(6).to_string())

analyzer = SentimentIntensityAnalyzer()
data["compound"] = data["comment"].apply(lambda text: analyzer.polarity_scores(text)["compound"])
data["sentiment"] = data["compound"].apply(lambda s: "positive" if s >= 0.05 else "negative" if s <= -0.05 else "neutral")
table = data.groupby(["brand", "sentiment"]).size().unstack(fill_value=0)
print("\\nSentiment counts per brand:"); print(table.to_string())
mean = data.groupby("brand")["compound"].mean().sort_values()
print("\\nMean compound score per brand:"); print(mean.round(3).to_string())

table.plot(kind="bar", figsize=(7, 4), color={"negative": "red", "neutral": "gray", "positive": "green"})
plt.title("Comparative sentiment of competitors"); plt.xlabel("brand"); plt.ylabel("comments"); plt.xticks(rotation=0); plt.show()
plt.figure(figsize=(6, 4)); plt.bar(mean.index, mean.values, color="steelblue")
plt.title("Mean sentiment score per brand"); plt.ylabel("mean compound score"); plt.show()
print("\\nINFERENCE: %s is received best and %s worst in these practice comments." % (mean.index[-1], mean.index[0]))
'''

REVIEWS = '''import re
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import CountVectorizer

reviews = pd.read_csv("product_reviews.csv")
print("Product:", reviews["product"].iloc[0], "| reviews:", len(reviews))
print(reviews["rating"].value_counts().sort_index().to_string())
negative = reviews[reviews["rating"] <= 2].copy()
print("\\nNegative reviews:", len(negative), "(%.1f%%)" % (100 * len(negative) / len(reviews)))

negative["clean"] = negative["review_text"].str.lower().apply(lambda text: re.sub(r"[^a-z ]", " ", text))
words = CountVectorizer(stop_words="english")
matrix = words.fit_transform(negative["clean"])
freq = pd.Series(matrix.sum(axis=0).A1, index=words.get_feature_names_out()).sort_values(ascending=False)
print("\\nTop 20 terms in negative reviews:"); print(freq.head(20).to_string())
pairs = CountVectorizer(stop_words="english", ngram_range=(2, 2))
pair_matrix = pairs.fit_transform(negative["clean"])
pair_freq = pd.Series(pair_matrix.sum(axis=0).A1, index=pairs.get_feature_names_out()).sort_values(ascending=False)
print("\\nTop two-word phrases:"); print(pair_freq.head(10).to_string())

areas = {"battery": "battery", "connectivity": "bluetooth|pairing|disconnect", "sound quality": "sound|bass",
         "app": "app", "comfort": "ears|fit|loose", "price": "price|overpriced|worth",
         "customer support": "support", "charging case": "case|charging"}
counts = {area: int(negative["clean"].str.contains(pattern).sum()) for area, pattern in areas.items()}
counts = dict(sorted(counts.items(), key=lambda item: -item[1]))
print("\\nComplaints per feature area:"); [print("  %-17s %d" % item) for item in counts.items()]
plt.figure(figsize=(7, 4)); plt.barh(list(counts)[::-1], list(counts.values())[::-1], color="crimson")
plt.title("Negative review complaints per feature area"); plt.xlabel("reviews"); plt.show()

for area in list(counts)[:3]:
    top = negative[negative["clean"].str.contains(areas[area])].sort_values("helpful_votes", ascending=False).iloc[0]
    print("\\nMost helpful complaint about %s (%d votes):\\n  %s" % (area, top["helpful_votes"], top["review_text"]))

print("\\nRECOMMENDATIONS (ordered by complaints):")
for number, (area, count) in enumerate(list(counts.items())[:5], 1):
    print("  %d. Fix %s - raised in %d negative reviews." % (number, area, count))
'''

THEORY = {
    "short": ("This part is answered in the report from the lab manual's own theory. The notes below are the sample answer used by "
              "LabMate's verification run.\nDefinition: the concept is explained in plain words first.\nKey points: the main ideas "
              "are listed one per line so the answer is easy to revise."),
}


def theory(title, text=None):
    return {"kind": "theory", "title": title, "answer": text or THEORY["short"]}


def evidence(title, slots, text=None):
    return {"kind": "evidence", "title": title, "slots": slots,
            "answer": text or ("1. Opened the tool and signed in.\n2. Loaded the practice data and built the requested view.\n"
                               "3. Saved the result and took the screenshots shown below.\nThe practical shows how the tool "
                               "turns raw social media data into something readable.")}


def code(title, source, datasets, expect, plots=0):
    return {"kind": "code", "title": title, "code": source, "datasets": datasets, "expect": expect, "plots": plots}


CASES = [
    {"number": 1, "title": "Study of Various Social Media Platforms", "parts": [
        {**theory("Five platforms compared"), "table": {"headers": ["Platform", "What can be posted", "Purpose", "Privacy concern"],
            "rows": [["Facebook", "Text, photos, video", "Friends and communities", "Broad data collection"],
                     ["X / Twitter", "Short text, media", "News and conversation", "Public by default"],
                     ["Instagram", "Photos, reels", "Visual sharing", "Location and tagging"],
                     ["YouTube", "Long video", "Video publishing", "Watch history profiling"],
                     ["LinkedIn", "Posts, articles", "Professional networking", "Employment details"]]}},
        {**theory("Social media evaluation metrics"), "table": {"headers": ["Metric", "Definition"],
            "rows": [["Reach", "Unique accounts that saw the content"], ["Impressions", "Total times content was shown"],
                     ["Engagement rate", "Interactions divided by reach"], ["Click-through rate", "Clicks divided by impressions"]]}},
        theory("Five brands on social media"), theory("Lexalytics and Google Analytics")]},
    {"number": 2, "title": "Web Scraping of Social Media Websites", "parts": [
        theory("Web scraping concepts"),
        code("Method B: scraping with Python", FEED, ["social_feed.html", "profile_page.html"],
             [r"Method B", r"likes", r"scraped_posts\.csv", r"@brightbrew", r"Followers: 12840"]),
        evidence("Method A: scraping with ParseHub", [("parsehub_project", "ParseHub project with the selected elements"),
                                                      ("parsehub_result", "ParseHub run result or exported CSV")])]},
    {"number": 3, "title": "Data Cleaning and Storage", "parts": [
        theory("Data preprocessing"),
        code("Cleaning social_posts_raw.csv", CLEAN, ["social_posts_raw.csv"],
             [r"=== 8\. to_datetime", r"Rows before: 2\d\d after: 19\d", r"cleaned_posts\.csv"])]},
    {"number": 4, "title": "Exploratory Data Analysis and Visualization", "parts": [
        theory("Exploratory analysis and visualization"),
        code("Part A: ten exploratory analysis functions", EDA, ["social_posts_raw.csv"], [r"=== 10\. kurtosis", r"=== 11\. correlation"]),
        code("Part B: ten visualization functions", VIZ, ["social_posts_raw.csv"], [r"=== 10\. count plot"], plots=10)]},
    {"number": 5, "title": "Content-Based Social Media Analytics", "parts": [
        theory("Content analysis"),
        code("Sentiment analysis of tweets", SENTIMENT, ["tweets_sentiment.csv"],
             [r"PROBLEM STATEMENT", r"Accuracy against the label column", r"Top five hashtags", r"INFERENCE"], plots=2)]},
    {"number": 6, "title": "Structure-Based Social Media Analytics", "parts": [
        theory("Social networks and network features"),
        code("Random social networks with NetworkX", NETWORKS, [], [r"=== Watts-Strogatz", r"Average clustering coefficient"], plots=6),
        code("Community detection and influence analysis", COMMUNITIES, ["social_network_edges.csv"],
             [r"Communities detected: [3-9]", r"Top 10 users by PageRank", r"INTERPRETATION"], plots=1)]},
    {"number": 8, "title": "Creative Content Design Using Canva", "parts": [
        theory("Working of Canva"),
        evidence("Promotional poster in Canva", [("canva_poster", "Final promotional poster"), ("canva_editor", "Canva editor while designing")])]},
    {"number": 9, "title": "Competitor Activity Analysis", "parts": [
        theory("Competitive analysis and Similarweb"),
        evidence("Google Trends and Similarweb evidence", [("google_trends", "Google Trends comparison"),
                                                           ("similarweb_snapshot", "Similarweb snapshot")]),
        code("Scraping and sentiment comparison", COMPETITORS, ["competitor_mentions.html"],
             [r"Scraped 30 comments for 3 brands", r"Sentiment counts per brand", r"INFERENCE"], plots=2)]},
    {"number": 10, "title": "Social Media Text Analytics (Review Mining)", "parts": [
        theory("Review mining"),
        code("Negative review analysis", REVIEWS, ["product_reviews.csv"],
             [r"Negative reviews: \d+", r"Top 20 terms", r"Complaints per feature area", r"RECOMMENDATIONS"], plots=1)]},
]
