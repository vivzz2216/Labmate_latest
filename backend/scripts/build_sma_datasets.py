"""Build the Social Media Analytics practice data shipped in backend/app/lab_data/sma/.

Everything here is invented by LabMate: fictitious brands, users and posts, produced from a fixed seed so a
re-run reproduces the committed files byte for byte. The reports label it "LabMate practice data"; it never
stands in for real posts, real reviews or real opinions about real companies.

    python backend/scripts/build_sma_datasets.py
"""
import csv
import html
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "app" / "lab_data" / "sma"
SEED = 2026


def write_csv(name, header, rows):
    with open(OUT / name, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def write_text(name, text):
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------- social_posts_raw.csv (Exp 3, 4)
def social_posts_raw():
    rng = random.Random(SEED)
    platforms = ["Twitter", "Instagram", "Facebook", "YouTube", "LinkedIn"]
    spellings = {"Twitter": ["Twitter", "twitter", "TWITTER", " Twitter "], "Instagram": ["Instagram", "instagram", "INSTAGRAM"],
                 "Facebook": ["Facebook", "facebook ", "FACEBOOK"], "YouTube": ["YouTube", "youtube", "Youtube"],
                 "LinkedIn": ["LinkedIn", "linkedin", "LINKEDIN"]}
    topics = [("launch", "#NewLaunch"), ("sale", "#FlashSale"), ("travel", "#Wanderlust"), ("fitness", "#FitLife"),
              ("food", "#Foodie"), ("music", "#LiveMusic"), ("tech", "#TechTalk"), ("career", "#Hiring")]
    phrases = ["Loving the new {t} vibes today", "Just tried the {t} offer and WOW", "Big {t} announcement coming soon",
               "Can't believe how good the {t} event was", "Thoughts on the latest {t} trend?", "Our {t} story starts here",
               "Great {t} turnout this weekend", "Behind the scenes of our {t} shoot"]
    users = ["Aarav_M", "SaraKhan", "devika.r", "Noah_Lee", "mira_s", "ZaynAli", "priya_90", "OmarF", "lena.k", "TheRealJo",
             "kabir_x", "AnanyaP", "ben_carter", "SofiaG", "RohanDev"]
    start = datetime(2026, 1, 5, 8, 0)
    rows = []
    for number in range(1, 191):
        platform = rng.choice(platforms)
        topic, tag = rng.choice(topics)
        text = rng.choice(phrases).format(t=topic)
        if rng.random() < 0.4:
            text += " https://example.test/p/%d" % rng.randint(100, 999)
        text += " " + tag
        if rng.random() < 0.3:
            text += " " + rng.choice(topics)[1]
        if rng.random() < 0.35:
            text = text.upper() if rng.random() < 0.3 else text.lower()
        followers = rng.randint(120, 90000)
        views = int(followers * rng.uniform(0.2, 3.5))
        likes = int(views * rng.uniform(0.01, 0.12))
        comments = int(likes * rng.uniform(0.03, 0.25))
        shares = int(likes * rng.uniform(0.02, 0.3))
        posted = start + timedelta(hours=rng.randint(0, 24 * 120), minutes=rng.randint(0, 59))
        row = [1000 + number, rng.choice(users), rng.choice(spellings[platform]), text, tag,
               posted.strftime("%Y-%m-%d %H:%M:%S"), likes, shares, comments, followers, views,
               rng.choice(["Mumbai", "Delhi", "Pune", "Bengaluru", "London", "Toronto", "N/A", "", "Dubai"])]
        for column in (6, 7, 8):  # missing counts
            if rng.random() < 0.05:
                row[column] = ""
        if rng.random() < 0.03:
            row[10] = ""
        rows.append(row)
    for _ in range(12):  # exact duplicate posts
        rows.append(list(rng.choice(rows)))
    rng.shuffle(rows)
    write_csv("social_posts_raw.csv",
              ["post_id", "username", "platform", "post_text", "hashtag", "posted_at", "likes", "shares", "comments",
               "followers", "views", "location"], rows)


# ---------------------------------------------------------------- tweets_sentiment.csv (Exp 5)
def tweets_sentiment():
    rng = random.Random(SEED + 1)
    brands = ["NimbusPhone", "VerdantBank", "QuantaCab"]
    positive = ["Absolutely love {b}, the experience is fantastic", "{b} just made my day, brilliant service",
                "Super happy with {b}, would recommend to everyone", "{b} keeps getting better, great update this week",
                "Amazing support from {b}, solved my issue in minutes", "Five stars for {b}, smooth and reliable"]
    negative = ["Really disappointed with {b}, the app keeps crashing", "{b} support ignored me for three days, terrible",
                "Worst update ever from {b}, nothing works now", "Paid for {b} and got a poor experience, very frustrating",
                "{b} is overpriced and slow, not worth it", "Another outage at {b}, this is unacceptable"]
    neutral = ["Just saw the new {b} announcement today", "Trying out {b} this week to compare options",
               "{b} released a statement about the upcoming changes", "Reading reviews of {b} before deciding",
               "Anyone using {b} at work? Curious how it fits", "{b} will host a webinar on Friday"]
    tags = ["#Update", "#CustomerCare", "#TechNews", "#Pricing", "#Service", "#Feedback", "#Trending"]
    users = ["user_%02d" % n for n in range(1, 41)]
    start = date(2026, 3, 1)
    rows = []
    for number in range(1, 181):
        label = rng.choices(["positive", "negative", "neutral"], weights=[0.4, 0.33, 0.27])[0]
        bank = {"positive": positive, "negative": negative, "neutral": neutral}[label]
        text = rng.choice(bank).format(b=rng.choice(brands)) + " " + rng.choice(tags)
        when = start + timedelta(days=rng.randint(0, 59))
        if when.day in (10, 11, 12) and rng.random() < 0.6:  # a visible spike for trend analysis
            text += " #Trending"
        rows.append([5000 + number, when.isoformat(), rng.choice(users), text, label,
                     rng.randint(0, 220), rng.randint(0, 80)])
    rows.sort(key=lambda row: (row[1], row[0]))
    write_csv("tweets_sentiment.csv", ["tweet_id", "date", "user", "text", "label", "likes", "retweets"], rows)


# ---------------------------------------------------------------- practice pages (Exp 2, 9)
PAGE_STYLE = ("body{font-family:Arial,sans-serif;max-width:720px;margin:24px auto;color:#1f2937}"
              ".post,.comment{border:1px solid #d1d5db;border-radius:8px;padding:12px;margin:12px 0}"
              ".author{font-weight:bold}.meta{color:#6b7280;font-size:13px}")


def social_feed():
    rng = random.Random(SEED + 2)
    authors = ["Aarav M", "Sara Khan", "Devika R", "Noah Lee", "Mira S", "Zayn Ali", "Priya N", "Omar F", "Lena K", "Jo T",
               "Kabir X", "Ananya P"]
    texts = ["Sunrise run done, 5 km before work #fitness", "New cafe opened near campus, the cold brew is great #food",
             "Anyone up for a weekend hike? #travel", "Finished my first open source pull request #coding",
             "Concert tonight, cannot wait #music", "Study group at the library at 6 pm #exams",
             "Trying a new recipe for dinner #cooking", "Photo walk around the old town #photography",
             "Team hackathon starts tomorrow #tech", "Book club picked a mystery novel this month #reading",
             "Rainy day, perfect for movies #relax", "Volunteering at the food drive today #community"]
    posts = []
    for index, (author, text) in enumerate(zip(authors, texts), 1):
        likes, comments, shares = rng.randint(5, 480), rng.randint(0, 60), rng.randint(0, 40)
        day = date(2026, 4, index)
        posts.append(
            '    <article class="post" id="post-%d" data-user="%s">\n      <h3 class="author">%s</h3>\n'
            '      <p class="content">%s</p>\n      <div class="meta"><time datetime="%s">%s</time> | '
            '<span class="likes">%d</span> likes | <span class="comments">%d</span> comments | '
            '<span class="shares">%d</span> shares</div>\n    </article>'
            % (index, author.replace(" ", "_").lower(), html.escape(author), html.escape(text), day, day.strftime("%d %b %Y"),
               likes, comments, shares))
    write_text("social_feed.html",
               '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>ConnectSphere - Public Feed (practice page)</title>\n'
               "  <style>%s</style>\n</head>\n<body>\n  <h1>ConnectSphere public feed</h1>\n  <p class=\"meta\">LabMate practice page with invented posts.</p>\n"
               '  <section id="feed">\n%s\n  </section>\n</body>\n</html>\n' % (PAGE_STYLE, "\n".join(posts)))


def profile_page():
    rng = random.Random(SEED + 3)
    items = ["Launched our spring collection", "Thank you for 10k followers", "Live Q&A this Friday", "New blog post is up",
             "Giveaway winners announced", "Behind the scenes at the studio"]
    posts = "\n".join(
        '      <li class="post"><span class="content">%s</span> - <span class="likes">%d</span> likes</li>'
        % (html.escape(item), rng.randint(40, 900)) for item in items)
    write_text("profile_page.html",
               '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>ConnectSphere - @brightbrew (practice page)</title>\n'
               "  <style>%s</style>\n</head>\n<body>\n  <header id=\"profile\">\n    <h1 class=\"username\">@brightbrew</h1>\n"
               '    <p class="bio">Small-batch coffee roasters. Invented profile for LabMate practice.</p>\n'
               '    <ul class="stats">\n      <li>Followers: <span class="followers">12840</span></li>\n'
               '      <li>Following: <span class="following">312</span></li>\n      <li>Posts: <span class="post-count">%d</span></li>\n    </ul>\n  </header>\n'
               '  <section id="posts">\n    <ul>\n%s\n    </ul>\n  </section>\n</body>\n</html>\n' % (PAGE_STYLE, len(items), posts))


def competitor_mentions():
    rng = random.Random(SEED + 4)
    brands = {
        "Aurora AI": ["Answers are clear and quick, really impressed", "Helped me draft my report in minutes, love it",
                      "Sometimes slow at peak hours, otherwise good", "Great for studying, explanations are easy to follow",
                      "Gave a wrong answer twice today, disappointing", "Interface is clean and simple to use",
                      "Excellent for brainstorming ideas", "Keeps asking me to upgrade, annoying", "Reliable and accurate most days",
                      "Best assistant I have used this year"],
        "Bolt Assistant": ["Very fast responses, saves me time", "Struggles with long questions, frustrating",
                           "Voice mode is fantastic", "Too many errors in code suggestions, poor", "Pricing is fair for what you get",
                           "Crashed during my deadline, terrible timing", "Friendly tone and helpful tips",
                           "Average results, nothing special", "Love the mobile app experience", "Support replied quickly, thank you"],
        "Cirrus Chat": ["Creative writing help is excellent", "Free plan is too limited, disappointing",
                        "Understands context really well", "Laggy on my phone, needs work", "Great value and solid accuracy",
                        "Hallucinated facts in my essay, bad", "Smooth experience across devices", "Good but not the best",
                        "Helpful for quick summaries", "Nice update, noticeably better now"]}
    sections = []
    number = 0
    for brand, comments in brands.items():
        blocks = []
        for text in comments:
            number += 1
            blocks.append('      <div class="comment" data-brand="%s">\n        <span class="author">viewer_%03d</span>\n'
                          '        <p class="text">%s</p>\n        <span class="meta"><span class="likes">%d</span> likes</span>\n      </div>'
                          % (brand, number, html.escape(text), rng.randint(0, 150)))
        sections.append('    <section class="brand" id="%s">\n      <h2>%s</h2>\n%s\n    </section>'
                        % (brand.lower().replace(" ", "-"), brand, "\n".join(blocks)))
    write_text("competitor_mentions.html",
               '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>Assistant comparison - viewer comments (practice page)</title>\n'
               "  <style>%s</style>\n</head>\n<body>\n  <h1>Viewer comments on three fictitious AI assistants</h1>\n"
               '  <p class="meta">LabMate practice page; the brands and comments are invented.</p>\n%s\n</body>\n</html>\n'
               % (PAGE_STYLE, "\n".join(sections)))


# ---------------------------------------------------------------- product_reviews.csv (Exp 10)
def product_reviews():
    rng = random.Random(SEED + 5)
    product = "AuraBuds X2 Wireless Earbuds"
    complaints = {"battery": ["battery dies after two hours", "battery life is far below the advertised hours"],
                  "connectivity": ["bluetooth keeps disconnecting", "pairing fails every other time"],
                  "sound quality": ["bass is muddy and the sound is flat", "sound quality is poor at high volume"],
                  "app": ["the companion app crashes on launch", "the app never recognises my earbuds"],
                  "comfort": ["they hurt my ears after an hour", "the fit is loose and they fall out"],
                  "price": ["not worth the price", "overpriced compared with similar earbuds"],
                  "customer support": ["customer support never replied", "support took three weeks to answer"],
                  "charging case": ["the charging case stopped working", "the case lid broke within a month"]}
    weights = {"battery": 5, "connectivity": 5, "sound quality": 3, "app": 2, "comfort": 3, "price": 2, "customer support": 2,
               "charging case": 2}
    praise = ["great sound for the price", "comfortable for long listening", "battery lasts all day", "pairs instantly",
              "the case is compact and sturdy", "noise isolation works well", "the app is easy to use"]
    rows = []
    start = date(2026, 1, 1)
    for number in range(1, 161):
        negative = rng.random() < 0.4
        if negative:
            keys = rng.choices(list(weights), weights=list(weights.values()), k=rng.choice([1, 1, 2]))
            text = "Disappointed: " + " and ".join(rng.choice(complaints[key]) for key in dict.fromkeys(keys)) + "."
            rating = rng.choice([1, 1, 2, 2, 2])
        else:
            text = "Happy with these: " + " and ".join(rng.sample(praise, 2)) + "."
            rating = rng.choice([4, 4, 5, 5, 5, 3])
        rows.append([20000 + number, product, rating, text, (start + timedelta(days=rng.randint(0, 150))).isoformat(),
                     rng.randint(0, 40)])
    write_csv("product_reviews.csv", ["review_id", "product", "rating", "review_text", "review_date", "helpful_votes"], rows)


# ---------------------------------------------------------------- social_network_edges.csv (Exp 6)
def network_edges():
    rng = random.Random(SEED + 6)
    groups = [list(range(0, 18)), list(range(18, 38)), list(range(38, 54)), list(range(54, 66))]
    name = lambda number: "user_%02d" % (number + 1)
    edges = set()
    for group in groups:
        for index, left in enumerate(group):
            for right in group[index + 1:]:
                if rng.random() < 0.28:
                    edges.add((left, right))
    for _ in range(14):  # a few bridges between communities
        first, second = rng.sample(groups, 2)
        edges.add(tuple(sorted((rng.choice(first), rng.choice(second)))))
    for hub in (3, 25, 44):  # a few influential accounts
        for target in rng.sample(range(66), 10):
            if target != hub:
                edges.add(tuple(sorted((hub, target))))
    write_csv("social_network_edges.csv", ["source", "target"], [[name(a), name(b)] for a, b in sorted(edges)])


# ---------------------------------------------------------------- social_kpi_powerbi.csv (Exp 7)
def kpi_data():
    rng = random.Random(SEED + 7)
    rows = []
    start = date(2026, 1, 1)
    base = {"Instagram": 9000, "Facebook": 7000, "Twitter": 5000, "LinkedIn": 3000}
    followers = {platform: value * 3 for platform, value in base.items()}
    for offset in range(90):
        day = start + timedelta(days=offset)
        for platform, level in base.items():
            impressions = int(level * rng.uniform(0.7, 1.4) * (1 + offset / 300))
            reach = int(impressions * rng.uniform(0.55, 0.85))
            likes = int(reach * rng.uniform(0.03, 0.09))
            comments = int(likes * rng.uniform(0.05, 0.2))
            shares = int(likes * rng.uniform(0.04, 0.25))
            clicks = int(reach * rng.uniform(0.01, 0.04))
            followers[platform] += rng.randint(-5, 60)
            engagement = round((likes + comments + shares) / reach * 100, 2)
            rows.append([day.isoformat(), platform, impressions, reach, likes, comments, shares, clicks, followers[platform],
                         engagement])
    write_csv("social_kpi_powerbi.csv",
              ["date", "platform", "impressions", "reach", "likes", "comments", "shares", "clicks", "followers",
               "engagement_rate"], rows)


# ---------------------------------------------------------------- post images (Exp 5 image analysis)
def post_images():
    from PIL import Image, ImageDraw
    palettes = [((235, 96, 64), (250, 200, 80), "sunset"), ((40, 120, 200), (170, 220, 245), "ocean"),
                ((40, 150, 80), (200, 235, 120), "forest")]
    for number, (top, bottom, _) in enumerate(palettes, 1):
        image = Image.new("RGB", (240, 240))
        draw = ImageDraw.Draw(image)
        for row in range(240):
            mix = row / 239
            draw.line([(0, row), (239, row)], fill=tuple(int(top[i] * (1 - mix) + bottom[i] * mix) for i in range(3)))
        draw.ellipse((80, 70, 160, 150), fill=(255, 255, 255))
        draw.rectangle((20, 190, 220, 215), fill=(30, 30, 30))
        image.save(OUT / ("post_banner_%d.png" % number), optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for build in (social_posts_raw, tweets_sentiment, social_feed, profile_page, competitor_mentions, product_reviews,
                  network_edges, kpi_data, post_images):
        build()
    print("wrote", ", ".join(sorted(path.name for path in OUT.iterdir())))


if __name__ == "__main__":
    main()
