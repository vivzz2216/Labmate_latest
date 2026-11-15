"""Social Media Analytics lab: practice data, notebook allowlists, requirement counts, evidence uploads and report blocks."""
import io
import os
from pathlib import Path
from types import SimpleNamespace

import pytest
from docx import Document
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import AssignmentWorkflow, Upload, User, WorkflowEvidence
from app.routers import lab_catalog, workflows
from app.security.generated_code import validate_generated_code
from app.services import evidence_files, sma_datasets, sma_requirements
from app.services.assignment_workflow import attach_evidence, clean_table
from app.services.docx_layout import embed_evidence_block, embed_theory_block


def png_bytes(size=(64, 40), colour=(200, 30, 30), mode="RGB"):
    out = io.BytesIO()
    Image.new(mode, size, colour).save(out, format="PNG")
    return out.getvalue()


# ----------------------------------------------------------------------------- practice data
def test_every_registered_dataset_exists_and_is_non_empty():
    for name in sma_datasets.DATASETS:
        assert sma_datasets.dataset_path(name).stat().st_size > 0, name
        assert name in sma_datasets.DESCRIPTIONS


def test_datasets_load_as_text_or_bytes_and_unknown_names_are_rejected():
    loaded = sma_datasets.load_datasets(["social_feed.html", "post_banner_1.png", "social_feed.html"])
    assert isinstance(loaded["social_feed.html"], str) and "article" in loaded["social_feed.html"]
    assert isinstance(loaded["post_banner_1.png"], bytes) and loaded["post_banner_1.png"].startswith(b"\x89PNG")
    assert len(loaded) == 2
    for bad in ("../../config.py", "..\\secrets.env", "social_posts_raw.csv/../x", "nope.csv", "", None):
        with pytest.raises(ValueError):
            sma_datasets.dataset_path(bad)
    with pytest.raises(ValueError):
        sma_datasets.load_datasets(list(sma_datasets.DATASETS)[:9])


def test_messy_posts_file_is_actually_messy():
    import csv
    rows = list(csv.DictReader(io.StringIO(sma_datasets.load_dataset("social_posts_raw.csv"))))
    assert len(rows) > 150
    assert len({row["platform"] for row in rows}) > 5            # inconsistent spelling
    assert any(row["likes"] == "" for row in rows)               # missing counts
    keys = [tuple(row.values()) for row in rows]
    assert len(keys) != len(set(keys))                           # exact duplicates


def test_practice_pages_expose_the_documented_selectors():
    feed = sma_datasets.load_dataset("social_feed.html")
    for selector in ('class="post"', 'class="author"', 'class="content"', 'class="likes"', "<time"):
        assert selector in feed
    comments = sma_datasets.load_dataset("competitor_mentions.html")
    assert comments.count('class="comment"') == 30 and comments.count('class="brand"') == 3


def test_dataset_download_route_serves_only_registered_files():
    app = FastAPI()
    app.include_router(lab_catalog.router, prefix="/api")
    client = TestClient(app)
    ok = client.get("/api/labs/datasets/social_posts_raw.csv")
    assert ok.status_code == 200 and ok.headers["content-disposition"].startswith("attachment")
    assert ok.headers["x-content-type-options"] == "nosniff"
    assert ok.text.startswith("post_id,username,platform,post_text")
    for bad in ("nope.csv", "..%2Fconfig.py", "%2e%2e%2fconfig.py"):
        assert client.get("/api/labs/datasets/" + bad).status_code in {404, 422}
    sma = client.get("/api/labs/social-media-analytics").json()
    assert sma["track"] == "sma" and sma["experiment_count"] == 9


# ----------------------------------------------------------------------------- notebook allowlists
@pytest.mark.parametrize("code", [
    "import networkx as nx\nG = nx.erdos_renyi_graph(10, .3)",
    "from bs4 import BeautifulSoup\nsoup = BeautifulSoup('<p>x</p>', 'html.parser')",
    "from PIL import Image\nImage.new('RGB', (4, 4))",
    "from nltk.sentiment.vader import SentimentIntensityAnalyzer",
])
def test_notebook_allows_the_sma_libraries(code):
    validate_generated_code(code, "python", capability="notebook")


@pytest.mark.parametrize("code", ["import requests", "import urllib.request", "import socket", "import subprocess"])
def test_notebook_still_blocks_network_and_process_modules(code):
    with pytest.raises(ValueError):
        validate_generated_code(code, "python", capability="notebook")


def test_runtime_cell_validator_matches_the_static_allowlist():
    from app.services.colab_worker import validate_cell
    validate_cell("import networkx\nfrom bs4 import BeautifulSoup\nfrom PIL import Image")
    with pytest.raises(PermissionError):
        validate_cell("import requests")


def test_required_library_check_knows_networkx_and_beautifulsoup():
    from app.services.colab_requirements import missing_required_libraries
    assert missing_required_libraries("Using the Python NetworkX library, build a graph.", "import pandas as pd\nprint(1)") == ["networkx"]
    assert missing_required_libraries("Using the Python NetworkX library, build a graph.",
                                      "import networkx as nx\nG = nx.Graph()") == []
    assert missing_required_libraries("Scrape it using BeautifulSoup.", "import re\nre.compile('x')") == ["bs4"]


# ----------------------------------------------------------------------------- function counts
EDA_TEN = "\n".join(["df.a.mean()", "df.a.median()", "df.a.mode()", "df.a.var()", "df.a.std()", "df.a.min()", "df.a.max()",
                     "df.a.quantile(.5)", "df.a.skew()", "df.a.kurt()", "df.corr()"])
PLOTS_TEN = ("plt.scatter(a,b)\nplt.hist(a)\nplt.pie(a)\nsns.heatmap(c)\ndf.plot(kind='bar')\nplt.plot(a)\nsns.boxplot(x=a)\n"
             "sns.violinplot(x=a)\nsns.kdeplot(a)\nsns.countplot(x=a)\n")


def question(title):
    return {"part_title": title, "track": "sma"}


def test_exploratory_and_visualization_counts_are_enforced():
    eda = question("Part A: ten exploratory analysis functions")
    assert sma_requirements.sma_shortfall(eda, EDA_TEN) is None
    short = sma_requirements.sma_shortfall(eda, "df.a.mean()\ndf.a.mean()\ndf.a.median()\ndf.a.mean()")
    assert short and "at least 10" in short and "uses 2" in short
    plots = question("Part B: ten visualization functions")
    assert sma_requirements.sma_shortfall(plots, PLOTS_TEN) is None
    assert sma_requirements.sma_shortfall(plots, PLOTS_TEN.replace("sns.countplot(x=a)\n", "plt.hist(a)\n"))


def test_repeating_one_chart_does_not_reach_ten():
    assert sma_requirements.sma_shortfall(question("Part B: ten visualization functions"), "plt.hist(a)\n" * 12)


def test_cleaning_part_needs_seven_distinct_operations():
    clean = question("Cleaning social_posts_raw.csv")
    seven = ("df.t.str.lower()\ndf.drop(columns=['x'])\ndf.t.str.extract('(a)')\ndf.drop_duplicates()\ndf.fillna(0)\n"
             "df.t.str.strip()\npd.to_datetime(df.d)\n")
    assert sma_requirements.sma_shortfall(clean, seven) is None
    assert sma_requirements.sma_shortfall(clean, "df.t.str.lower()\ndf.drop(columns=['x'])\n")


def test_other_parts_and_other_tracks_are_never_counted():
    assert sma_requirements.sma_shortfall(question("Sentiment analysis of tweets"), "print(1)") is None
    assert sma_requirements.sma_shortfall({"part_title": "Part A: ten exploratory analysis functions", "track": "deep_learning"}, "x=1") is None
    assert sma_requirements.sma_shortfall(question("Part A: ten exploratory analysis functions"), "def (:") is not None  # not parseable: no credit


def test_instructions_state_the_offline_rules():
    text = sma_requirements.sma_instructions(question("Part A: ten exploratory analysis functions"))
    assert "never request a URL" in text and "never call nltk.download" in text and "practice data" in text
    assert "at least 10 DIFFERENT exploratory analysis functions" in text


# ----------------------------------------------------------------------------- multi-part questions
def test_multi_part_fields_validate_track_datasets_and_slots():
    Q = workflows.QuestionInput
    data = SimpleNamespace(track=None)
    assert workflows.multi_part_fields(Q(id=1, text="x"), data) == {}
    good = Q(id=1, text="x", track="sma", kind="code", builtin_datasets=["social_feed.html", "social_feed.html"], part_title=" T ")
    assert workflows.multi_part_fields(good, data) == {"kind": "code", "part_title": "T", "builtin_datasets": ["social_feed.html"]}
    evidence = Q(id=2, text="x", track="sma", kind="evidence", evidence_slots=[{"id": "a_1", "label": "A"}])
    assert workflows.multi_part_fields(evidence, data)["evidence_slots"] == [{"id": "a_1", "label": "A"}]
    for bad in (Q(id=1, text="x", kind="code"),                                                     # not the SMA track
                Q(id=1, text="x", track="sma", kind="code", builtin_datasets=["../x"]),              # unknown dataset
                Q(id=1, text="x", track="sma", kind="code", evidence_slots=[{"id": "a", "label": "A"}]),
                Q(id=1, text="x", track="sma", kind="evidence",
                  evidence_slots=[{"id": "a", "label": "A"}, {"id": "a", "label": "B"}])):
        with pytest.raises(HTTPException):
            workflows.multi_part_fields(bad, data)
    with pytest.raises(ValueError):
        Q(id=1, text="x", track="sma", kind="evidence", evidence_slots=[{"id": "Bad Id!", "label": "A"}])


def test_experiment_number_survives_for_notebook_naming():
    Q = workflows.QuestionInput
    data = SimpleNamespace(track=None)
    fields = workflows.multi_part_fields(Q(id=2, text="x", track="sma", kind="code", experiment_no=7), data)
    assert fields["experiment_no"] == 7
    with pytest.raises(ValueError):
        Q(id=1, text="x", track="sma", kind="code", experiment_no=0)
    with pytest.raises(HTTPException):          # still only for the SMA track
        workflows.multi_part_fields(Q(id=1, text="x", experiment_no=3), data)


def test_question_datasets_resolve_names_at_run_time():
    from app.services.assignment_workflow import question_dataset_brief, question_datasets
    q = {"builtin_datasets": ["tweets_sentiment.csv", "post_banner_2.png"], "datasets": {"mine.csv": "a,b\n1,2\n"}}
    resolved = question_datasets(q)
    assert set(resolved) == {"mine.csv", "tweets_sentiment.csv", "post_banner_2.png"}
    assert isinstance(resolved["post_banner_2.png"], bytes)
    brief = question_dataset_brief(q)
    assert "tweets_sentiment.csv" in brief and "label (positive/negative/neutral)" in brief and "mine.csv" in brief
    assert question_datasets({}) == {}


# ----------------------------------------------------------------------------- evidence files
def test_png_and_jpeg_are_re_encoded_as_png_and_wide_images_are_shrunk():
    out = evidence_files.normalize_evidence(png_bytes())
    assert out.startswith(b"\x89PNG") and Image.open(io.BytesIO(out)).size == (64, 40)
    jpeg = io.BytesIO()
    Image.new("RGB", (30, 30), (1, 2, 3)).save(jpeg, format="JPEG")
    assert evidence_files.normalize_evidence(jpeg.getvalue()).startswith(b"\x89PNG")
    wide = evidence_files.normalize_evidence(png_bytes((5000, 100)))
    assert max(Image.open(io.BytesIO(wide)).size) == evidence_files.OUTPUT_SIDE


def test_transparency_is_flattened_and_metadata_is_dropped():
    out = Image.open(io.BytesIO(evidence_files.normalize_evidence(png_bytes((8, 8), (255, 0, 0, 0), "RGBA"))))
    assert out.mode == "RGB" and out.getpixel((0, 0)) == (255, 255, 255)
    tagged = io.BytesIO()
    meta = __import__("PIL.PngImagePlugin", fromlist=["PngInfo"]).PngInfo()
    meta.add_text("Comment", "secret-gps")
    Image.new("RGB", (8, 8)).save(tagged, format="PNG", pnginfo=meta)
    assert b"secret-gps" not in evidence_files.normalize_evidence(tagged.getvalue())


def test_pdf_certificate_first_page_becomes_a_png():
    pdf = io.BytesIO()
    Image.new("RGB", (300, 200), (10, 120, 10)).save(pdf, format="PDF")
    out = evidence_files.normalize_evidence(pdf.getvalue())
    assert out.startswith(b"\x89PNG")


@pytest.mark.parametrize("data,reason", [
    (b"", "empty"), (b"GIF89a....", "PNG, JPG or PDF"), (b"<svg onload=alert(1)/>", "PNG, JPG or PDF"),
    (b"\x89PNG\r\n\x1a\n" + b"garbage", "could not be read"), (b"%PDF-1.4 not really", "could not be read"),
    (b"x" * (evidence_files.MAX_BYTES + 1), "5 MB"),
], ids=['empty','gif','svg','broken-png','broken-pdf','oversized'])
def test_bad_evidence_is_refused_with_a_reason(data, reason):
    with pytest.raises(ValueError, match=reason):
        evidence_files.normalize_evidence(data)


def test_a_huge_declared_canvas_is_refused_before_decoding():
    bomb = io.BytesIO()
    Image.new("1", (9000, 9000)).save(bomb, format="PNG")
    assert len(bomb.getvalue()) < evidence_files.MAX_BYTES
    with pytest.raises(ValueError, match="too large"):
        evidence_files.normalize_evidence(bomb.getvalue())


# ----------------------------------------------------------------------------- evidence endpoints
SLOTS = [{"id": "dash", "label": "Dashboard screenshot"}, {"id": "cert", "label": "Course certificate"}]


@pytest.fixture
def env(tmp_path, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    engine = create_engine("sqlite:///" + str(tmp_path / "t.db").replace("\\", "/"), connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        owner, other = User(email="o@example.com", name="Owner"), User(email="x@example.com", name="Other")
        db.add_all([owner, other])
        db.flush()
        ids = []
        for user in (owner, other):
            upload = Upload(user_id=user.id, filename="a.docx", original_filename="a.docx", file_path="fixture", file_type="docx", file_size=1)
            db.add(upload)
            db.flush()
            questions = [{"id": 1, "text": "theory", "language": "theory", "kind": "theory", "track": "sma"},
                         {"id": 2, "text": "evidence", "language": "theory", "kind": "evidence", "track": "sma",
                          "evidence_slots": SLOTS}]
            db.add(AssignmentWorkflow(upload_id=upload.id, status="ready", stage="review", questions=questions, results=[], logs=[]))
            ids.append(upload.id)
        db.commit()
    app = FastAPI()
    app.include_router(workflows.router, prefix="/api")
    current = {"user": owner}

    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    app.dependency_overrides[require_csrf_token] = lambda: True
    client = TestClient(app)
    yield SimpleNamespace(client=client, factory=factory, ids=ids, owner=owner, other=other, current=current, tmp=tmp_path)
    client.close()
    engine.dispose()


def post(env, upload, question_id, slot, data, name="shot.png"):
    return env.client.post(f"/api/workflows/{upload}/evidence", data={"question_id": question_id, "slot": slot},
                           files={"file": (name, data, "application/octet-stream")})


def test_upload_list_preview_replace_and_delete(env):
    mine = env.ids[0]
    first = post(env, mine, 2, "dash", png_bytes())
    assert first.status_code == 200, first.text
    row = first.json()
    assert row["slot"] == "dash" and row["label"] == "Dashboard screenshot" and row["report_outdated"] is False
    listed = env.client.get(f"/api/workflows/{mine}/evidence").json()
    assert [item["slot"] for item in listed] == ["dash"]
    image = env.client.get(f"/api/workflows/{mine}/evidence/{row['id']}/image")
    assert image.status_code == 200 and image.headers["content-type"] == "image/png" and image.content.startswith(b"\x89PNG")
    # Replacing the same slot keeps one row and removes the old file.
    old_path = env.factory().query(WorkflowEvidence).one().file_path
    again = post(env, mine, 2, "dash", png_bytes((10, 10), (0, 0, 255)), name="new.png")
    assert again.status_code == 200 and not os.path.exists(old_path)
    assert len(env.client.get(f"/api/workflows/{mine}/evidence").json()) == 1
    deleted = env.client.delete(f"/api/workflows/{mine}/evidence/{again.json()['id']}")
    assert deleted.status_code == 200 and env.client.get(f"/api/workflows/{mine}/evidence").json() == []


def test_stored_file_is_a_private_png_with_a_safe_name(env):
    response = post(env, env.ids[0], 2, "cert", png_bytes(), name="../../evil name<script>.png")
    assert response.status_code == 200
    stored = env.factory().query(WorkflowEvidence).one()
    assert stored.file_path.startswith(str(env.tmp / "uploads" / "evidence")) and stored.file_path.endswith(".png")
    assert "/" not in stored.original_filename and "<" not in stored.original_filename


@pytest.mark.parametrize("question_id,slot", [(1, "dash"), (2, "nope"), (9, "dash"), (2, "../dash")])
def test_only_declared_slots_of_evidence_parts_accept_files(env, question_id, slot):
    assert post(env, env.ids[0], question_id, slot, png_bytes()).status_code == 400


def test_bad_files_are_rejected_without_a_database_row(env):
    for data in (b"<html>", b"GIF89a", b""):
        assert post(env, env.ids[0], 2, "dash", data).status_code == 400
    assert env.factory().query(WorkflowEvidence).count() == 0
    assert not (env.tmp / "uploads" / "evidence").exists() or not list((env.tmp / "uploads" / "evidence").iterdir())


def test_other_users_cannot_read_write_or_delete_evidence(env):
    row = post(env, env.ids[0], 2, "dash", png_bytes()).json()
    env.current["user"] = env.other
    assert post(env, env.ids[0], 2, "cert", png_bytes()).status_code == 404
    assert env.client.get(f"/api/workflows/{env.ids[0]}/evidence").status_code == 404
    assert env.client.get(f"/api/workflows/{env.ids[0]}/evidence/{row['id']}/image").status_code == 404
    assert env.client.delete(f"/api/workflows/{env.ids[0]}/evidence/{row['id']}").status_code == 404
    # Another user's workflow id cannot be used to reach this evidence row either.
    assert env.client.get(f"/api/workflows/{env.ids[1]}/evidence/{row['id']}/image").status_code == 404
    assert env.client.delete(f"/api/workflows/{env.ids[1]}/evidence/{row['id']}").status_code == 404


def test_changes_are_blocked_while_a_run_is_active_and_reset_a_finished_report(env):
    with env.factory() as db:
        workflow = db.query(AssignmentWorkflow).filter_by(upload_id=env.ids[0]).one()
        workflow.status = "processing"
        db.commit()
    assert post(env, env.ids[0], 2, "dash", png_bytes()).status_code == 409
    with env.factory() as db:
        workflow = db.query(AssignmentWorkflow).filter_by(upload_id=env.ids[0]).one()
        workflow.status = "completed"
        db.commit()
    response = post(env, env.ids[0], 2, "dash", png_bytes())
    assert response.status_code == 200 and response.json()["report_outdated"] is True
    with env.factory() as db:
        assert db.query(AssignmentWorkflow).filter_by(upload_id=env.ids[0]).one().status == "ready"


def test_per_assignment_screenshot_limit(env, monkeypatch):
    monkeypatch.setattr(workflows, "EVIDENCE_LIMIT_PER_WORKFLOW", 1)
    assert post(env, env.ids[0], 2, "dash", png_bytes()).status_code == 200
    assert post(env, env.ids[0], 2, "cert", png_bytes()).status_code == 400
    assert post(env, env.ids[0], 2, "dash", png_bytes()).status_code == 200   # replacing is still allowed


def test_from_prompt_keeps_the_multi_part_fields(env):
    payload = {"title": "Exp 7", "questions": [
        {"id": 1, "text": "Explain Canva", "language": "theory", "track": "sma", "kind": "theory", "part_title": "Canva"},
        {"id": 2, "text": "Scrape", "language": "colab", "track": "sma", "kind": "code", "builtin_datasets": ["social_feed.html"]},
        {"id": 3, "text": "Dashboard", "language": "theory", "track": "sma", "kind": "evidence", "evidence_slots": SLOTS}]}
    response = env.client.post("/api/workflows/from-prompt", json=payload)
    assert response.status_code == 200, response.text
    questions = response.json()["workflow"]["questions"]
    assert [q["kind"] for q in questions] == ["theory", "code", "evidence"]
    assert questions[1]["builtin_datasets"] == ["social_feed.html"] and questions[2]["evidence_slots"] == SLOTS
    bad = dict(payload, questions=[{"id": 1, "text": "x", "language": "colab", "track": "python", "kind": "code"}])
    assert env.client.post("/api/workflows/from-prompt", json=bad).status_code == 400


# ----------------------------------------------------------------------------- outside-tool tasks in uploaded manuals
def test_outside_tool_tasks_become_evidence_parts_with_the_right_slots():
    from app.services.lab_tools import tool_task_slots
    ids = lambda text, manual="": [s["id"] for s in tool_task_slots(text, manual)]
    # The certificate line lives elsewhere in the manual, not inside the dashboard task.
    assert ids("Create a promotional poster for a business using Canva.") == ["canva_poster", "canva_editor"]
    assert ids("Analyse competitors using Google Trends and Similarweb.") == ["google_trends", "similarweb_snapshot"]
    assert ids("Scrape the posts with ParseHub and export the CSV.") == []              # scraping is also a program task
    assert ids("Scrape a social media site with ParseHub.", "") == []
    assert ids("Use ParseHub to collect posts from a public page.") == ["parsehub_project", "parsehub_result"]


@pytest.mark.parametrize("text", [
    "Write a Python program that plots Google Trends data with matplotlib.",
    "Perform sentiment analysis on the scraped data and create a bar graph.",
    "Implement a classifier in Python.",
    "Write a SQL query to list customers.",
    "Explain how the Canva service works with Python scripts.",      # names a language: stays a code/theory task
    "Create a dashboard.",                                              # no tool named
])
def test_ordinary_tasks_are_not_mistaken_for_outside_tool_tasks(text):
    from app.services.lab_tools import tool_task_slots
    assert tool_task_slots(text, "Canva certificate") == []


@pytest.mark.parametrize("text,expected", [
    ("Implement 7-8 functions of data preprocessing using python/R.", [("preprocessing", 7)]),
    ("Implement any 10 functions for Exploratory Analysis. (for ex. Mean, Median, Mode, Variance..)", [("eda", 10)]),
    ("Implement any 10 functions for Visualization. (for ex. Scatter plot, Histogram)", [("plots", 10)]),
    ("Implement any 10 functions for Exploratory Analysis and any 10 functions for Visualization.", [("eda", 10), ("plots", 10)]),
    ("Choose any social media platform dataset and perform sentiment analysis.", []),
])
def test_counts_written_in_an_uploaded_manual_are_enforced(text, expected):
    q = {"track": "sma", "text": text}
    assert sma_requirements.counted_requirements(q) == expected
    if expected:
        assert sma_requirements.sma_shortfall(q, "df.a.mean()\nplt.hist(a)")
        assert "DIFFERENT" in sma_requirements.sma_instructions(q)
    assert sma_requirements.counted_requirements({"track": "python", "text": text}) == []


@pytest.mark.parametrize("text,first", [
    ("Write a program either in R or in python to perform the same task (web scraping).", "social_feed.html"),
    ("Scrape data of each platform, perform sentiment analysis and create comparative sentiment bar graph.", "competitor_mentions.html"),
    ("Compare chatgpt4 vs chatsonic vs Gemini", "competitor_mentions.html"),
    ("Create random social networks and analyze it using python NetworkX library", "social_network_edges.csv"),
    ("Analyse negative reviews/comments.", "product_reviews.csv"),
    ("Choose any social media platform dataset (eg. Facebook/twitter) and perform sentiment analysis.", "tweets_sentiment.csv"),
    ("Implement 7-8 functions of data preprocessing using python/R.", "social_posts_raw.csv"),
    ("Implement any 10 functions for Visualization.", "social_posts_raw.csv"),
])
def test_uploaded_sma_code_tasks_get_matching_practice_data(text, first):
    names = sma_datasets.suggest_datasets(text)
    assert names and names[0] == first and all(name in sma_datasets.DATASETS for name in names)
    assert sma_datasets.suggest_datasets("Print hello world") == []


def test_one_task_offered_in_two_languages_is_kept_once_in_the_runnable_language():
    from app.services.assignment_workflow import merge_language_alternatives
    text = "Write a program either in R or in Python to perform web scraping of the selected social media platform."
    questions = [{"id": 1, "text": "Explain web scraping.", "language": "theory", "is_theory": True},
                 {"id": 2, "text": text, "language": "r"},
                 {"id": 3, "text": text, "language": "python"},
                 {"id": 4, "text": "Use ParseHub.", "language": "theory", "is_theory": True, "kind": "evidence"},
                 {"id": 5, "text": "Write a program in Python to sort a list.", "language": "python"},
                 {"id": 6, "text": "Write a program in Java to sort a list.", "language": "java"}]
    merged = merge_language_alternatives(questions)
    # The R/Python alternative becomes one Python task; Java and Python sorting are two real assignments and both stay.
    assert [(q["id"], q["language"]) for q in merged] == [(1, "theory"), (2, "python"), (3, "theory"), (4, "python"), (5, "java")]
    assert merged[1]["text"] == text
    # Different tasks are never merged.
    distinct = [{"id": 1, "text": "Write a Python program for factorial.", "language": "python"},
                {"id": 2, "text": "Write a Python program for fibonacci.", "language": "python"}]
    assert merge_language_alternatives(distinct) == distinct


EXP4_MANUAL = ("Experiment No. 4\nAim: To perform Exploratory Data Analysis.\nTheory:\nExplain exploratory analysis and its advantages\n"
               "Explain any 10 functions for Exploratory Analysis.\nExplain why Visualization of data is needed.\n"
               "Explain any 10 functions for Visualization.\nImplementation:\nImplement any 10 functions for Exploratory Analysis.\n"
               "Code:\nScreenshots of Execution:\nConclusion:")


def test_theory_questions_dropped_by_extraction_are_restored_in_manual_order():
    from app.services.assignment_workflow import recover_theory_questions
    code = {"id": 1, "text": "Implement any 10 functions for Exploratory Analysis.", "language": "colab"}
    restored = recover_theory_questions(EXP4_MANUAL, [code])
    assert [q["text"] for q in restored] == [
        "Explain exploratory analysis and its advantages", "Explain any 10 functions for Exploratory Analysis.",
        "Explain why Visualization of data is needed.", "Explain any 10 functions for Visualization.", code["text"]]
    assert [q["id"] for q in restored] == [1, 2, 3, 4, 5] and all(q["is_theory"] for q in restored[:4])
    # Questions the model did extract are not duplicated, and implementation lines are never taken as theory.
    partial = [{"id": 1, "text": "Explain any 10 functions for Exploratory Analysis.", "language": "theory", "is_theory": True}, code]
    again = recover_theory_questions(EXP4_MANUAL, partial)
    assert sum("10 functions for Exploratory" in q["text"] for q in again) == 2       # theory + the code task
    # When the model kept some theory, only a clearly absent topic is restored; lines sharing half their words with a
    # kept question are treated as rewritten (that is how the real Exp 1 extraction merged and reworded its items).
    assert [q["text"] for q in again] == ["Explain any 10 functions for Exploratory Analysis.",
                                          "Explain why Visualization of data is needed.", code["text"]]
    assert recover_theory_questions("No theory heading here.\nExplain X.", [code]) == [code]


def test_exp1_reworded_and_split_by_the_model_gets_no_duplicates():
    from app.services.assignment_workflow import recover_theory_questions
    manual = ("Theory:\nStudy and compare five various social media platforms\n"
              "Consider any 5 social media platforms and compare their working w.r.t what info can be posted and can be shared.\n"
              "List and define various social media evaluation metrics (10 minimum)\n"
              "Come up with five companies or brands you interact with regularly. For example, the companies could be a beverage "
              "bottler.\nStudy of Lexalytics and Google Analytics tools\nConclusion:")
    model = [{"id": n, "text": t, "language": "theory", "is_theory": True} for n, t in enumerate([
        "Study and compare five social media platforms: explain the purpose of each chosen platform.",
        "List and define at least ten social media evaluation metrics.",
        "Come up with five companies or brands you interact with regularly (e.g., a beverage bottler).",
        "Study the Lexalytics tool.", "Study the Google Analytics tool."], 1)]
    assert recover_theory_questions(manual, model) == model
    # The model's other real answer: two manual lines merged into Q1, the brands line shortened. Still no duplicate.
    merged = [{"id": n, "text": t, "language": "theory", "is_theory": True} for n, t in enumerate([
        "Study and compare five various social media platforms: consider any 5 social media platforms and compare their working "
        "with respect to what information can be posted and shared.",
        "List and define various social media evaluation metrics (minimum 10).",
        "Come up with five companies or brands you interact with regularly (e.g., a beverage bottler, restaurant, clothing brand, "
        "or technology company) and find all the social media accounts you can.",
        "Study of Lexalytics and Google Analytics tools."], 1)]
    assert recover_theory_questions(manual, merged) == merged
    # And the third real answer: the brands line folded together with all of its sub-bullets (coverage 0.59).
    folded = merged[:2] + [{"id": 3, "language": "theory", "is_theory": True, "text":
        "Choose five companies or brands you interact with regularly (e.g., a beverage bottler, restaurant, clothing brand, or "
        "technology company). For each of the five, find all their social media accounts and cover frequency of interaction, "
        "types of interaction (broadcast, request for input, direct interaction or combination), social media strategy "
        "assessment, strengths, areas for improvement, recommendations and how they are leveraging the platforms."}] + merged[3:]
    assert recover_theory_questions(manual, folded) == folded


def test_a_shortened_theory_question_is_not_restored_a_second_time():
    from app.services.assignment_workflow import recover_theory_questions
    manual = ("Theory:\nStudy and compare five various social media platforms\n"
              "Come up with five companies or brands you interact with regularly. For example, the companies could be a beverage "
              "bottler, restaurant, clothing brand, or technology company. For each of the five, find all the social media accounts "
              "you can. These will usually include a Facebook page, often a Twitter or YouTube account.\n"
              "Study of Lexalytics and Google Analytics tools\nConclusion:")
    model = [{"id": 1, "text": "Study and compare any 5 social media platforms.", "language": "theory", "is_theory": True},
             {"id": 2, "text": "Come up with five companies or brands you interact with regularly. For each of the five, find all "
                               "their social media accounts.", "language": "theory", "is_theory": True},
             {"id": 3, "text": "Study of Lexalytics and Google Analytics tools.", "language": "theory", "is_theory": True}]
    assert recover_theory_questions(manual, model) == model
    # ...but a short question covers nothing else: Exp 3 keeps all three of its theory questions.
    exp3 = ("Theory:\nWhat is data preprocessing?\nWhy data preprocessing is needed?\n"
            "Explain 7-8 functions (Python/R) with syntax for data preprocessing.\nImplementation:\nImplement 7-8 functions.")
    restored = recover_theory_questions(exp3, [{"id": 1, "text": "Implement 7-8 functions of data preprocessing.", "language": "colab"}])
    assert [q["text"] for q in restored if q.get("is_theory")] == [
        "What is data preprocessing?", "Why data preprocessing is needed?",
        "Explain 7-8 functions (Python/R) with syntax for data preprocessing."]




@pytest.mark.parametrize("raw,clean", [
    ("Implementation: Create a dashboard.", "Create a dashboard."),
    ("Explain the working of the Canva tool. (Theory)", "Explain the working of the Canva tool."),
    ("Write a program [Code]", "Write a program"),
    ("Explain the advantages of competitive analysis (theory).", "Explain the advantages of competitive analysis."),
    ("Analyse Competitor Activities using Google Trends &amp; Similarweb", "Analyse Competitor Activities using Google Trends & Similarweb"),
    ("Explain theory of relativity (theory of everything)", "Explain theory of relativity (theory of everything)"),
])
def test_extraction_labels_are_stripped_from_question_text(raw, clean):
    from app.services.lab_tools import strip_section_label
    assert strip_section_label(raw) == clean


def test_theory_answers_are_told_which_sibling_questions_to_leave_alone():
    from app.services.assignment_workflow import sibling_note
    qs = [{"id": 1, "text": "Explain Web Scraping", "language": "theory", "is_theory": True},
          {"id": 2, "text": "Write down steps in scraping?", "language": "theory", "is_theory": True},
          {"id": 3, "text": "Write a program to scrape", "language": "colab"},
          {"id": 4, "text": "Use ParseHub", "language": "theory", "is_theory": True, "kind": "evidence"}]
    note = sibling_note(qs, qs[0])
    assert "Write down steps in scraping?" in note and "Explain Web Scraping" not in note
    assert "program" not in note and "ParseHub" not in note
    assert sibling_note(qs, qs[3]) == "" and sibling_note([qs[0]], qs[0]) == ""


def test_conclusion_is_written_only_when_the_manual_asks_and_is_grounded():
    import asyncio
    from app.services import assignment_workflow as aw
    assert aw.asks_for_conclusion("Code:\nScreenshots of Execution:\nConclusion:\n")
    assert aw.asks_for_conclusion("Conclusion")
    assert not aw.asks_for_conclusion("Write the conclusion of each program in a comment.")
    results = [{"id": 1, "question": "Explain web scraping.", "is_theory": True, "status": "completed"},
               {"id": 2, "question": "Scrape posts", "language": "colab", "status": "completed", "output": "Scraped 12 posts"},
               {"id": 3, "question": "Use ParseHub", "kind": "evidence", "is_theory": True, "status": "completed",
                "evidence_missing": ["ParseHub run result"]}]
    brief = aw.conclusion_brief(results)
    assert "Scraped 12 posts" in brief and "missing: ParseHub run result" in brief and "[theory, completed]" in brief
    seen = {}

    async def fake(instruction, content, schema, on_retry=None):
        seen["content"] = content
        return {"answer": "I scraped the practice feed and learned how a scraper works."}
    original = aw.generation_service.generate_json
    aw.generation_service.generate_json = fake
    try:
        text = asyncio.run(aw.write_conclusion("Experiment No. 2\nAim: To scrap data from social media websites.", results))
    finally:
        aw.generation_service.generate_json = original
    assert text.startswith("I scraped") and "Aim: To scrap data" in seen["content"] and "Scraped 12 posts" in seen["content"]

    async def failing(*args, **kwargs):
        raise aw.GenerationError("down")
    aw.generation_service.generate_json = failing
    try:
        assert asyncio.run(aw.write_conclusion("Aim: x", results)) == ""     # never fails the report
    finally:
        aw.generation_service.generate_json = original


@pytest.mark.parametrize("text,is_conclusion", [
    ("Write the conclusion of the experiment.", True), ("Conclusion", True), ("Conclusion:", True),
    ("Give your conclusion.", True), ("Write down the conclusion", True),
    ("Conclude your findings and suggest improvements in the product.", False),     # a real Exp 10 task
    ("Write the conclusion section of a report generator program", False),
])
def test_only_bare_conclusion_requests_are_dropped(text, is_conclusion):
    from app.services.assignment_workflow import CONCLUSION_TASK
    assert bool(CONCLUSION_TASK.match(text)) is is_conclusion


@pytest.mark.parametrize("answer,first_line", [
    ("Procedure:\n1. Opened Canva.", "1. Opened Canva."),
    ("Procedure: Web Scraping using ParseHub\n\n1. Opened ParseHub.", "Web Scraping using ParseHub"),
    ("**Procedure:**\n1. Step", "1. Step"),
    ("1. Opened Canva.\n2. Procedures were followed.", "1. Opened Canva."),
])
def test_evidence_procedure_label_is_printed_once(answer, first_line):
    from app.services.docx_layout import strip_procedure_heading
    assert strip_procedure_heading(answer).split("\n")[0] == first_line
    document = Document()
    embed_evidence_block(document, "Canva poster", answer, 2)
    assert sum(p.text.strip().lower().startswith("procedure") for p in document.paragraphs) == 1


def test_conclusion_block_is_rendered_after_the_parts():
    from app.services.docx_layout import embed_conclusion
    document = Document()
    embed_theory_block(document, "Q", "A", 1)
    embed_conclusion(document, "First line.\nSecond line.")
    texts = [p.text for p in document.paragraphs if p.text.strip()]
    assert texts[-3:] == ["Conclusion", "First line.", "Second line."]


def test_registry_ids_match_the_catalogue_slots():
    from app.services.lab_tools import SLOT_IDS
    import json
    catalogue = json.loads((Path(__file__).resolve().parents[2] / "frontend" / "lib" / "lab-catalog.json").read_text(encoding="utf-8"))
    category = next(c for c in catalogue if c['track']=='sma')
    used = {slot['id'] for e in category['experiments'] for part in e.get('parts',[]) for slot in part.get('evidenceSlots',[])}
    assert used and used <= SLOT_IDS, used - SLOT_IDS


def test_upload_flow_accepts_extracted_evidence_parts_on_any_track():
    Q = workflows.QuestionInput
    data = SimpleNamespace(track=None)
    slots = [{"id": "canva_poster", "label": "Canva dashboard screenshot"}]
    fields = workflows.multi_part_fields(Q(id=1, text="Create a dashboard in Canva", language="theory", kind="evidence", evidence_slots=slots), data)
    assert fields["kind"] == "evidence" and fields["evidence_slots"] == slots
    # Only slots LabMate itself defines, and never datasets or code parts, are allowed off the SMA track.
    for bad in (Q(id=1, text="x", kind="evidence", evidence_slots=[{"id": "my_slot", "label": "x"}]),
                Q(id=1, text="x", kind="evidence", evidence_slots=slots, builtin_datasets=["social_feed.html"]),
                Q(id=1, text="x", kind="code")):
        with pytest.raises(HTTPException):
            workflows.multi_part_fields(bad, data)


# ----------------------------------------------------------------------------- report pieces
def test_attach_evidence_reads_current_files_and_names_missing_ones(tmp_path):
    shot = tmp_path / "s.png"
    shot.write_bytes(png_bytes())
    results = [{"id": 1, "kind": "theory"}, {"id": 2, "kind": "evidence", "answer": "steps"}]
    questions = [{"id": 2, "evidence_slots": SLOTS}]
    out = attach_evidence(results, questions, [(2, "dash", str(shot)), (2, "cert", str(tmp_path / "gone.png"))])
    assert out[0] == results[0]
    assert out[1]["screenshot_paths"] == [str(shot)] and out[1]["screenshot_captions"] == ["Student-supplied: Dashboard screenshot"]
    assert out[1]["evidence_missing"] == ["Course certificate"]
    assert "screenshot_paths" not in results[1]          # the stored result is not modified


def test_clean_table_bounds_and_repairs_model_output():
    assert clean_table({}) is None and clean_table({"table_headers": ["a"], "table_rows": []}) is None
    table = clean_table({"table_headers": ["A", "B"], "table_rows": [{"cells": ["1"]}, {"cells": ["1", "2", "3"]}, {"cells": "x"}]})
    assert table == {"headers": ["A", "B"], "rows": [["1", ""], ["1", "2"]]}
    big = clean_table({"table_headers": [str(i) for i in range(12)], "table_rows": [{"cells": ["x" * 900]}] * 40})
    assert len(big["headers"]) == 7 and len(big["rows"]) == 16 and len(big["rows"][0][0]) == 400


def doc_text(document):
    return "\n".join(p.text for p in document.paragraphs)


def test_evidence_block_shows_procedure_images_and_placeholders(tmp_path):
    shot = tmp_path / "s.png"
    shot.write_bytes(png_bytes((300, 200)))
    document = Document()
    embed_evidence_block(document, "Canva dashboard", "1. Imported the file.\n2. Built KPI cards.", 7, [str(shot)],
                         ["Student-supplied: Dashboard screenshot"], ["Course certificate"])
    text = doc_text(document)
    assert "Part 7: Canva dashboard" in text and "Built KPI cards." in text
    assert "Student-supplied: Dashboard screenshot" in text
    assert "[Not attached: Course certificate." in text
    assert len(document.inline_shapes) == 1


def test_theory_and_evidence_blocks_render_a_bordered_table():
    table = {"headers": ["Platform", "Purpose"], "rows": [["X", "News"], ["LinkedIn", "Careers"]]}
    document = Document()
    embed_theory_block(document, "Five platforms", "Short explanation.", 1, table=table)
    embed_evidence_block(document, "Tool", "Steps.", 2, table=table)
    assert len(document.tables) == 2
    first = document.tables[0]
    assert [c.text for c in first.rows[0].cells] == ["Platform", "Purpose"] and first.rows[2].cells[0].text == "LinkedIn"
    assert "w:tblBorders" in first._tbl.xml and "E2E8F0" in first._tbl.xml
    # A document with no table keeps the old layout.
    plain = Document()
    embed_theory_block(plain, "Q", "A", 1)
    assert not plain.tables
