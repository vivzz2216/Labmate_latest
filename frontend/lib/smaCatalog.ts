import type { LabCategory, LabExperiment, LabPart } from "./labCatalog";

// Social Media Analytics lab: ten experiments, each launched as several parts (see LabPart).
// The coding parts run on invented LabMate practice data (backend/app/lab_data/sma) because the notebook
// sandbox has no network access. The rules for generated code (read files by name, never a URL, NLTK data is
// pre-installed) live in the backend (sma_requirements.sma_instructions), so this text reads as the student's task.

const SHOW_OUTPUT = "Print every result and show every chart with plt.show().";

const experiment = (
  number: number,
  title: string,
  aim: string,
  category: string,
  difficulty: LabExperiment["difficulty"],
  frameworks: string[],
  description: string,
  expectedOutputs: string[],
  parts: LabPart[],
  downloads?: string[],
): LabExperiment => ({
  id: `sma-${number}`,
  number,
  title,
  aim,
  category,
  difficulty,
  frameworks,
  runtime: "colab",
  track: "sma",
  description,
  expectedOutputs,
  starterPrompt: parts.map((part) => part.text).join("\n\n"),
  parts,
  downloads,
});

export const SMA_CATEGORY: LabCategory = {
  slug: "social-media-analytics",
  track: "sma",
  title: "Social Media Analytics Labs",
  shortTitle: "Social Media Analytics",
  tagline: "Platform research, scraping, data cleaning, EDA, sentiment, network analysis and review mining",
  description:
    "Ten Social Media Analytics practicals in one section. Coding parts run as real Python notebooks on LabMate practice data; research parts are written up; work done in outside tools (ParseHub, Power BI, Canva, Google Trends, Similarweb) is documented with your own screenshots.",
  defaultLanguage: "colab",
  badge: "New",
  accentColor: "#0d9488",
  features: [
    "Python notebooks with pandas, seaborn, NLTK (VADER), NetworkX and BeautifulSoup",
    "Bundled practice data and practice web pages; no network access during a run",
    "Theory answers, comparison tables and written analysis next to the code parts",
    "Upload your own Power BI, Canva, ParseHub and Similarweb screenshots into the report",
  ],
  environmentSpecs: [
    { label: "Engine", value: "Isolated Python notebook kernel (CPU)" },
    { label: "Libraries", value: "pandas, NumPy, SciPy, Matplotlib, Seaborn, scikit-learn, NLTK, NetworkX, BeautifulSoup" },
    { label: "Data", value: "Invented LabMate practice data and practice web pages" },
    { label: "Export Format", value: "Notebook captures, your screenshots + DOCX report" },
  ],
  experiments: [
    experiment(
      1,
      "Study of Various Social Media Platforms",
      "Study and compare social media platforms, define evaluation metrics, analyse brands and study two analytics tools.",
      "Research",
      "Beginner",
      ["Research write-up"],
      "A research practical: platform comparison, ten evaluation metrics, a five-brand analysis and a study of Lexalytics and Google Analytics.",
      ["Five-platform comparison table", "Ten defined metrics", "Five-brand strategy analysis", "Lexalytics and Google Analytics study"],
      [
        {
          kind: "theory",
          title: "Five platforms compared",
          text: "Study and compare five social media platforms (Facebook, X/Twitter, Instagram, YouTube and LinkedIn). For each platform explain: what information can be posted, what information can be shared, how the platform works, its purpose and its privacy concerns. Finish with a comparison table.",
        },
        {
          kind: "theory",
          title: "Social media evaluation metrics",
          text: "List and define at least ten social media evaluation metrics (for example reach, impressions, engagement rate, click-through rate, conversion rate, follower growth rate, share of voice, sentiment score, response time and average engagement per post). Give the formula where one exists.",
        },
        {
          kind: "theory",
          title: "Five brands on social media",
          text: "Choose five well-known companies or brands. For each one describe: the frequency of its interaction, the types of interaction it uses (broadcast, request for input, direct interaction or a combination), strengths of its social media strategy, areas for improvement, recommendations and how it leverages its social media platforms.",
        },
        {
          kind: "theory",
          title: "Lexalytics and Google Analytics",
          text: "Study two analytics tools, Lexalytics and Google Analytics. For each explain what it is, what data it analyses, its main features and how it supports social media analysis.",
        },
      ],
    ),
    experiment(
      2,
      "Web Scraping of Social Media Websites",
      "Scrape social media data with a visual scraping tool and with a Python program, and export the result.",
      "Data Collection",
      "Intermediate",
      ["BeautifulSoup", "pandas", "ParseHub"],
      "The same scraping task done twice: once with ParseHub (your screenshots) and once in Python on a bundled practice page, exported as CSV and TXT.",
      ["Scraped posts table", "scraped_posts.csv and scraped_posts.txt contents", "ParseHub project and result screenshots"],
      [
        {
          kind: "theory",
          title: "Web scraping concepts",
          text: "Explain web scraping: what it is, what kinds of data can be scraped from the web, how a web scraper functions, the steps involved in scraping and the different web scraping tools available (including ParseHub and Python libraries). Mention responsible scraping (terms of service, robots.txt, privacy).",
        },
        {
          kind: "code",
          title: "Method B: scraping with Python",
          text: `Write a Python program that scrapes the practice social media page social_feed.html using BeautifulSoup. Extract, for every post, the author, the post text, the date, and the numbers of likes, comments and shares. Build a pandas DataFrame, display it, then save it as scraped_posts.csv and as a readable text file scraped_posts.txt and print the contents of both files. Also read profile_page.html and print the username, followers, following and post count. ${SHOW_OUTPUT}`,
          builtinDatasets: ["social_feed.html", "profile_page.html"],
        },
        {
          kind: "evidence",
          title: "Method A: scraping with ParseHub",
          text: "Perform the same scraping task with ParseHub on a public page you are allowed to scrape. Describe the procedure step by step: creating the project, selecting the post elements, extracting author, text, likes and comments, running the project and exporting the data as CSV.",
          evidenceSlots: [
            { id: "parsehub_project", label: "ParseHub project with the selected elements" },
            { id: "parsehub_result", label: "ParseHub run result or exported CSV" },
          ],
        },
      ],
    ),
    experiment(
      3,
      "Data Cleaning and Storage",
      "Preprocess, filter and store social media data using eight preprocessing functions.",
      "Data Preparation",
      "Beginner",
      ["pandas"],
      "Clean a deliberately messy social media dataset with eight pandas functions and store the cleaned file.",
      ["Before and after views of the data", "Eight preprocessing steps with output", "cleaned_posts.csv"],
      [
        {
          kind: "theory",
          title: "Data preprocessing",
          text: "Explain what data preprocessing is and why it is needed for social media data. Explain eight Python (pandas) functions used for data preprocessing, each with its syntax and a one-line example: str.lower, drop, str.extract, drop_duplicates, fillna, str.strip, to_datetime and replace.",
        },
        {
          kind: "code",
          title: "Cleaning social_posts_raw.csv",
          text: `Load social_posts_raw.csv and clean it using exactly these eight functions, each in its own labelled step with the before and after shown: (1) str.lower to convert post_text to lowercase, (2) drop to remove the unused column location, (3) str.extract to pull the first URL out of post_text into a new column url, (4) str.extract to pull hashtags, (5) drop_duplicates to remove repeated posts, (6) fillna to fill missing likes, shares and comments, (7) str.strip and str.lower to standardise platform spelling, (8) to_datetime to convert posted_at. Print the shape and the number of missing values before and after, then save the result as cleaned_posts.csv and print its first rows. ${SHOW_OUTPUT}`,
          builtinDatasets: ["social_posts_raw.csv"],
        },
      ],
    ),
    experiment(
      4,
      "Exploratory Data Analysis and Visualization",
      "Perform ten exploratory analysis functions and ten visualization functions on social media data.",
      "Analysis",
      "Intermediate",
      ["pandas", "NumPy", "SciPy", "Matplotlib", "Seaborn"],
      "Ten statistical functions and ten different charts on the same social media dataset.",
      ["Ten statistical results", "Ten different charts"],
      [
        {
          kind: "theory",
          title: "Exploratory analysis and visualization",
          text: "Explain exploratory data analysis and its advantages. Explain any ten functions used for exploratory analysis. Explain why data visualization is needed and any ten visualization functions.",
        },
        {
          kind: "code",
          title: "Part A: ten exploratory analysis functions",
          text: `Using social_posts_raw.csv (clean it just enough to analyse it: drop duplicate rows and fill missing numbers with the median), implement ten DIFFERENT exploratory analysis functions, each in its own labelled step with printed output: mean, median, mode, variance, standard deviation, min and max, quantiles, skewness, kurtosis and the correlation matrix of likes, shares, comments, followers and views. Also finish with value_counts of platform. Print every result.`,
          builtinDatasets: ["social_posts_raw.csv"],
        },
        {
          kind: "code",
          title: "Part B: ten visualization functions",
          text: `Using social_posts_raw.csv (drop duplicate rows, fill missing numbers with the median, standardise platform with str.strip().str.title()), create ten DIFFERENT charts, each in its own labelled step with a title and axis labels: scatter plot (likes vs shares), histogram of likes, pie chart of posts per platform, heatmap of the correlation matrix, bar chart of mean likes per platform, line chart of posts per month, box plot of likes by platform, violin plot of views, KDE plot of followers and a count plot of platform. Show every chart with plt.show().`,
          builtinDatasets: ["social_posts_raw.csv"],
        },
      ],
    ),
    experiment(
      5,
      "Content-Based Social Media Analytics",
      "Develop a content-based analytics model (sentiment analysis) for social media posts.",
      "Content Analytics",
      "Intermediate",
      ["NLTK VADER", "pandas", "Matplotlib"],
      "Explain the six kinds of content analysis, then perform one of them: sentiment analysis of tweets with VADER.",
      ["Problem statement and dataset description", "Predicted sentiment per tweet", "Sentiment chart and inference"],
      [
        {
          kind: "theory",
          title: "Content analysis",
          text: "Explain content analysis and how it is useful in industry. Explain the types of content analysis: trend analysis, sentiment analysis, trending topic analysis, audio analysis, video analysis and image analysis. Mention the content types involved: text, emoticons, images, audio and video.",
        },
        {
          kind: "code",
          title: "Sentiment analysis of tweets",
          text: `Perform sentiment analysis on tweets_sentiment.csv. Print a short problem statement and a description of the dataset and libraries used. Score each tweet with NLTK's VADER SentimentIntensityAnalyzer, classify it as positive, negative or neutral from the compound score (>= 0.05, <= -0.05, otherwise neutral), compare the prediction with the label column (accuracy and a confusion table), plot the sentiment distribution as a bar chart, plot the daily average compound score as a line chart, and print the top five hashtags. End with a printed inference of what the results show. ${SHOW_OUTPUT}`,
          builtinDatasets: ["tweets_sentiment.csv"],
        },
      ],
    ),
    experiment(
      6,
      "Structure-Based Social Media Analytics",
      "Analyse social networks: network features, community detection and influence analysis with NetworkX.",
      "Network Analytics",
      "Advanced",
      ["NetworkX", "Matplotlib", "pandas"],
      "Random social networks and their features, then community detection and influence analysis on a bundled friendship network.",
      ["Network feature table", "Network drawings", "Communities and most influential users"],
      [
        {
          kind: "theory",
          title: "Social networks and network features",
          text: "Explain the different types of networks in social media (for example friendship, follower, interaction and information networks; directed, undirected, weighted). Explain the main network features: nodes and edges, degree, density, clustering coefficient, path length, diameter and centrality measures.",
        },
        {
          kind: "code",
          title: "Random social networks with NetworkX",
          text: `Using the Python NetworkX library, create three random social networks (Erdos-Renyi, Barabasi-Albert and Watts-Strogatz, 40 nodes each, fixed random seed). For each network print the number of nodes and edges, density, average degree, average clustering coefficient and the diameter or average shortest path length where defined, and draw the network. Plot the degree distribution of each. ${SHOW_OUTPUT}`,
        },
        {
          kind: "code",
          title: "Community detection and influence analysis",
          text: `Load the friendship network in social_network_edges.csv into a NetworkX graph. Print its size and density, detect communities with greedy modularity maximisation (print each community's size), compute degree, betweenness and PageRank scores, print the ten most influential users by each measure, and draw the network with nodes coloured by community and sized by PageRank. Conclude with a printed interpretation. ${SHOW_OUTPUT}`,
          builtinDatasets: ["social_network_edges.csv"],
        },
      ],
    ),
    experiment(
      7,
      "Dashboard and Reporting Tool (Power BI)",
      "Develop a social media dashboard and reporting tool in Microsoft Power BI.",
      "Dashboards",
      "Intermediate",
      ["Microsoft Power BI"],
      "Explain Power BI and social media reporting. Upload your dataset and LabMate builds the dashboard from it in its Power BI Desktop studio and captures it; the course certificate is your own upload.",
      ["Dashboard built from your dataset", "Course certificate", "KPI explanation"],
      [
        {
          kind: "theory",
          title: "Power BI and social media reporting",
          text: "Explain what Power BI is, its advantages and its limitations. Explain what a social media reporting tool is, the steps involved in creating a dashboard and the KPIs tracked in a social media dashboard (for example impressions, reach, engagement rate, likes, comments, shares, click-through rate and follower growth).",
        },
        {
          kind: "evidence",
          title: "Power BI dashboard and course certificate",
          text: "Create a dashboard for a social media platform in Microsoft Power BI from the dataset you upload (LabMate's practice file social_kpi_powerbi.csv has date, platform, impressions, reach, likes, comments, shares, clicks, followers and engagement_rate). Describe the procedure step by step: importing the data, building the visuals, choosing the KPI cards and exporting the dashboard. Attach the screenshot of the dashboard and your SimplyLearn Power BI Basics course certificate.",
          evidenceSlots: [
            { id: "powerbi_dataset", label: "Dataset for the dashboard (CSV)" },
            { id: "powerbi_dashboard", label: "Power BI dashboard screenshot" },
            { id: "powerbi_certificate", label: "Power BI Basics course certificate" },
          ],
        },
      ],
      ["social_kpi_powerbi.csv"],
    ),
    experiment(
      8,
      "Creative Content Design Using Canva",
      "Design a promotional poster for a business on a social media platform using Canva.",
      "Design",
      "Beginner",
      ["Canva"],
      "Explain how Canva works, then document the steps and features used to create your own promotional poster.",
      ["Explanation of Canva features", "Step-by-step procedure", "Your poster and editor screenshots"],
      [
        {
          kind: "theory",
          title: "Working of Canva",
          text: "Explain the working of Canva: its templates, drag-and-drop editor, elements and uploads library, text and font tools, brand kit, collaboration and export options.",
        },
        {
          kind: "evidence",
          title: "Promotional poster in Canva",
          text: "Design a promotional poster for a business on a social media platform using Canva. Explain each step involved (choosing the business and the goal, choosing a poster template, customising text, colours and images, using Canva features such as templates, elements, text effects and alignment guides, and exporting the poster) and the Canva features used. Attach your own poster and an editor screenshot.",
          evidenceSlots: [
            { id: "canva_poster", label: "Final promotional poster" },
            { id: "canva_editor", label: "Canva editor while designing" },
          ],
        },
      ],
    ),
    experiment(
      9,
      "Competitor Activity Analysis",
      "Analyse competitors using Google Trends, Similarweb, scraped data and a comparative sentiment graph.",
      "Competitive Analytics",
      "Advanced",
      ["BeautifulSoup", "NLTK VADER", "Matplotlib"],
      "Compare three competing assistants: tool evidence from Google Trends and Similarweb (your screenshots), scraped comments and a comparative sentiment bar graph.",
      ["Google Trends and Similarweb screenshots", "Scraped comments table", "Sentiment per competitor", "Comparative sentiment bar graph"],
      [
        {
          kind: "theory",
          title: "Competitive analysis and Similarweb",
          text: "Explain the advantages of competitive analysis. Explain the working of Similarweb (traffic estimates, audience, referral sources and engagement metrics) and of Google Trends.",
        },
        {
          kind: "evidence",
          title: "Google Trends and Similarweb evidence",
          text: "Analyse the activities of competing products (for example ChatGPT, Chatsonic and Gemini) using Google Trends and Similarweb. Describe the procedure step by step: choosing the competitors, comparing search interest over time in Google Trends, and looking up each competitor's website in Similarweb. Attach your own Google Trends comparison and Similarweb snapshot.",
          evidenceSlots: [
            { id: "google_trends", label: "Google Trends comparison" },
            { id: "similarweb_snapshot", label: "Similarweb snapshot" },
          ],
        },
        {
          kind: "code",
          title: "Scraping and sentiment comparison",
          text: `Scrape the viewer comments for three competing assistants from the practice page competitor_mentions.html with BeautifulSoup (brand, author, comment text, likes) into a pandas DataFrame and display it. Score every comment with NLTK's VADER SentimentIntensityAnalyzer, classify it as positive, negative or neutral from the compound score, and print the counts and mean compound score per brand. Create a comparative sentiment bar graph (grouped bars of positive, negative and neutral comment counts per brand) and a bar chart of mean compound score per brand. Print an inference naming the best and worst received competitor. ${SHOW_OUTPUT}`,
          builtinDatasets: ["competitor_mentions.html"],
        },
      ],
    ),
    experiment(
      10,
      "Social Media Text Analytics (Review Mining)",
      "Mine negative product reviews to find what users complain about and recommend improvements.",
      "Text Analytics",
      "Advanced",
      ["pandas", "scikit-learn", "Matplotlib"],
      "Review mining and negative review mining on an invented product review dataset, ending with improvement recommendations.",
      ["Negative review count", "Most frequent complaint terms and feature areas", "Improvement recommendations"],
      [
        {
          kind: "theory",
          title: "Review mining",
          text: "Explain review mining and negative review mining, and how they help improve existing products and services.",
        },
        {
          kind: "code",
          title: "Negative review analysis",
          text: `Analyse product_reviews.csv for the product it describes. Treat reviews rated 1 or 2 as negative. Print the number and share of negative reviews and the rating distribution. Preprocess the negative review text (lowercase, remove punctuation, remove English stop words using scikit-learn's CountVectorizer(stop_words='english')) and print the twenty most frequent terms and the most frequent two-word phrases. Group the negative reviews into feature areas (battery, connectivity, sound quality, app, comfort, price, customer support, charging case) by keyword matching, print the count per area and draw a bar chart of the complaints per area. Print the review most often marked helpful for each of the top three areas. End by printing specific improvement recommendations for the product, ordered by how many users complained. ${SHOW_OUTPUT}`,
          builtinDatasets: ["product_reviews.csv"],
        },
      ],
    ),
  ],
};
