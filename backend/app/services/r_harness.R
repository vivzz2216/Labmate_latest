# LabMate R harness. Runs a student script like the RStudio console would and writes one JSON receipt.
# Usage: Rscript --vanilla r_harness.R <script.R> <outdir> [<stdin.txt>]
# Everything runs inside local() so the harness never adds variables to the student's Global Environment.
local({
args <- commandArgs(trailingOnly = TRUE)
script <- args[1]
outdir <- args[2]
stdin_file <- if (length(args) >= 3) args[3] else ""
options(width = 80, warn = 0, stringsAsFactors = FALSE, useFancyQuotes = FALSE, repos = c(CRAN = "@CRAN@"))
started <- proc.time()[["elapsed"]]
workdir <- getwd()

# ---- JSON helpers (no external packages) ----
jstr <- function(x) {
  x <- enc2utf8(as.character(x))
  x <- gsub("\\", "\\\\", x, fixed = TRUE)
  x <- gsub("\"", "\\\"", x, fixed = TRUE)
  x <- gsub("\n", "\\n", x, fixed = TRUE)
  x <- gsub("\r", "\\r", x, fixed = TRUE)
  x <- gsub("\t", "\\t", x, fixed = TRUE)
  x <- gsub("[\001-\037]", "", x)
  paste0("\"", x, "\"")
}
jv <- function(x) {
  if (is.null(x)) return("null")
  if (is.list(x)) {
    if (length(x) == 0L) return("[]")
    if (!is.null(names(x))) {
      return(paste0("{", paste0(jstr(names(x)), ":", vapply(x, jv, ""), collapse = ","), "}"))
    }
    return(paste0("[", paste0(vapply(x, jv, ""), collapse = ","), "]"))
  }
  if (length(x) != 1L) return(jv(as.list(x)))
  if (is.logical(x)) return(if (is.na(x)) "null" else tolower(as.character(x)))
  if (is.numeric(x)) return(if (is.finite(x)) format(x, scientific = FALSE, trim = TRUE) else "null")
  jstr(x)
}

# ---- console transcript ----
lines <- list()
add_line <- function(k, text, prompt = NULL) {
  item <- list(k = k, text = text)
  if (!is.null(prompt)) item$prompt <- prompt
  lines[[length(lines) + 1L]] <<- item
}
add_text <- function(k, text) {
  for (chunk in text) for (one in strsplit(chunk, "\n", fixed = TRUE)[[1]]) add_line(k, one)
  if (any(!nzchar(text))) for (i in which(!nzchar(text))) add_line(k, "")
}

banner <- c(
  paste0(R.version.string, " -- \"", R.version$nickname, "\""),
  paste0("Copyright (C) ", R.version$year, " The R Foundation for Statistical Computing"),
  paste0("Platform: ", R.version$platform, " (", 8 * .Machine$sizeof.pointer, "-bit)"),
  "",
  "R is free software and comes with ABSOLUTELY NO WARRANTY.",
  "You are welcome to redistribute it under certain conditions.",
  "Type 'license()' or 'licence()' for distribution details.",
  "",
  "R is a collaborative project with many contributors.",
  "Type 'contributors()' for more information and",
  "'citation()' on how to cite R or R packages in publications.",
  "",
  "Type 'demo()' for some demos, 'help()' for on-line help, or",
  "'help.start()' for an HTML browser interface to help.",
  "Type 'q()' to quit R.",
  ""
)

# ---- plots: a PNG device so nothing opens a window or writes Rplots.pdf ----
device_count <- 0L
open_device <- function() {
  device_count <<- device_count + 1L
  file <- file.path(outdir, sprintf("plot_d%02d_%%03d.png", device_count))
  if (isTRUE(capabilities("cairo"))) {
    grDevices::png(filename = file, width = 640, height = 480, res = 96, type = "cairo")
  } else {
    grDevices::png(filename = file, width = 640, height = 480, res = 96)
  }
}
open_device()

# ---- shims for interactive functions (attached, so they never appear in the Global Environment) ----
stdin_lines <- if (nzchar(stdin_file) && file.exists(stdin_file)) readLines(stdin_file, warn = FALSE) else character()
views <- list()
shims <- new.env()
shims$readline <- function(prompt = "") {
  value <- if (length(stdin_lines)) stdin_lines[1] else ""
  if (length(stdin_lines)) stdin_lines <<- stdin_lines[-1]
  cat(prompt, value, "\n", sep = "")
  value
}
shims$View <- function(x, title) {
  name <- if (missing(title)) paste(deparse(substitute(x)), collapse = "") else title
  df <- tryCatch(as.data.frame(x), error = function(e) NULL)
  if (is.null(df) || ncol(df) == 0L) return(invisible(NULL))
  shown <- utils::head(df[, seq_len(min(ncol(df), 10L)), drop = FALSE], 20L)
  rows <- lapply(seq_len(nrow(shown)), function(i) unname(as.list(vapply(shown, function(col) format(col[i]), ""))))
  views[[length(views) + 1L]] <<- list(
    title = name, nrow = nrow(df), ncol = ncol(df), cols = as.list(names(shown)), rows = rows,
    rowNames = as.list(rownames(shown)), numeric = unname(as.list(vapply(shown, is.numeric, TRUE))))
  invisible(NULL)
}
attach(shims, name = "labmate_shims", warn.conflicts = FALSE)

# ---- formatting of conditions ----
is_top_call <- function(call) is.null(call) || startsWith(paste(deparse(call, nlines = 1L), collapse = ""), "eval(parsed")
format_error <- function(e) {
  call <- conditionCall(e)
  msg <- conditionMessage(e)
  if (is_top_call(call)) return(paste0("Error: ", msg))
  prefix <- paste0("Error in ", paste(deparse(call, nlines = 1L), collapse = ""), " : ")
  first <- strsplit(msg, "\n", fixed = TRUE)[[1]]
  first <- if (length(first)) first[1] else ""
  if (nchar(prefix) + nchar(first) > 77) paste0(prefix, "\n  ", msg) else paste0(prefix, msg)
}
format_warnings <- function(ws) {
  one <- function(w) {
    call <- conditionCall(w)
    if (is_top_call(call)) conditionMessage(w)
    else paste0("In ", paste(deparse(call, nlines = 1L), collapse = ""), " : ", conditionMessage(w))
  }
  items <- vapply(ws, one, "")
  if (length(items) == 1L) return(c("Warning message:", items))
  c("Warning messages:", paste0(seq_along(items), ": ", items))
}

# ---- run the script ----
script_lines <- readLines(script, encoding = "UTF-8", warn = FALSE)
history <- character()
error_text <- NULL
parsed <- tryCatch(parse(file = script, keep.source = TRUE, encoding = "UTF-8"), error = function(e) e)
echoed <- 0L
echo_range <- function(from, to, structured) {
  if (to < from) return(invisible())
  first <- TRUE
  for (i in from:to) {
    text <- script_lines[i]
    if (!nzchar(trimws(text))) next
    prompt <- if (structured && !first) "+ " else "> "
    add_line("cmd", text, prompt)
    history <<- c(history, text)
    first <- FALSE
  }
}
print_visible <- function(x) {
  if (isS4(x)) methods::show(x) else print(x)
}

if (inherits(parsed, "error")) {
  error_text <- paste0("Error: ", conditionMessage(parsed))
  echo_range(1L, length(script_lines), FALSE)
  add_text("err", error_text)
} else {
  srcs <- attr(parsed, "srcref")
  for (i in seq_along(parsed)) {
    first_line <- srcs[[i]][1]
    last_line <- srcs[[i]][3]
    if (first_line > echoed + 1L) echo_range(echoed + 1L, first_line - 1L, FALSE)
    if (last_line > echoed) echo_range(max(first_line, echoed + 1L), last_line, TRUE)
    echoed <- max(echoed, last_line)
    if (grDevices::dev.cur() == 1L) open_device()
    out <- character()
    con <- textConnection("out", "w", local = TRUE)
    consumed <- 0L
    flush_out <- function() {
      current <- textConnectionValue(con)
      if (length(current) > consumed) {
        add_text("out", current[(consumed + 1L):length(current)])
        consumed <<- length(current)
      }
    }
    base_sinks <- sink.number()
    sink(con)
    warns <- list()
    failure <- tryCatch(
      withCallingHandlers({
        shown <- withVisible(eval(parsed[[i]], envir = globalenv()))
        if (shown$visible) print_visible(shown$value)
        NULL
      },
      message = function(m) {
        flush_out()
        add_text("msg", sub("\n$", "", conditionMessage(m)))
        invokeRestart("muffleMessage")
      },
      warning = function(w) {
        warns[[length(warns) + 1L]] <<- w
        invokeRestart("muffleWarning")
      }),
      error = function(e) e)
    while (sink.number() > base_sinks) sink()
    close(con)
    if (length(out) > consumed) add_text("out", out[(consumed + 1L):length(out)])
    if (length(warns)) add_text("warn", format_warnings(warns))
    if (!is.null(failure)) {
      error_text <- format_error(failure)
      add_text("err", error_text)
      break
    }
  }
  if (is.null(error_text) && echoed < length(script_lines)) echo_range(echoed + 1L, length(script_lines), FALSE)
}
add_line("prompt", "")

# ---- finish plots, then snapshot the session ----
while (grDevices::dev.cur() > 1L) grDevices::dev.off()
plots <- sort(list.files(outdir, pattern = "^plot_d[0-9]+_[0-9]+\\.png$"))

describe_var <- function(name) {
  x <- get(name, envir = globalenv())
  if (is.function(x)) {
    sig <- tryCatch(paste(deparse(args(x)), collapse = ""), error = function(e) "function (...)")
    return(list(name = name, kind = "functions", value = trimws(sub("\\s*NULL\\s*$", "", sig))))
  }
  if (is.data.frame(x)) {
    return(list(name = name, kind = "data",
                value = sprintf("%d obs. of  %d variable%s", nrow(x), ncol(x), if (ncol(x) == 1L) "" else "s")))
  }
  struct <- tryCatch(utils::capture.output(utils::str(x, vec.len = 3, give.attr = FALSE))[1], error = function(e) "")
  struct <- trimws(struct)
  if ((is.matrix(x) || is.array(x))) return(list(name = name, kind = "data", value = substr(struct, 1, 200)))
  if (is.atomic(x) && length(x) == 1L && is.null(attributes(x))) {
    shown <- if (is.character(x)) paste0("\"", x, "\"") else format(x, digits = 15)
    return(list(name = name, kind = "values", value = shown))
  }
  list(name = name, kind = "values", value = substr(struct, 1, 200))
}
visible_names <- setdiff(ls(globalenv()), "")
env <- lapply(visible_names, function(n) tryCatch(describe_var(n), error = function(e) list(name = n, kind = "values", value = "<unavailable>")))

file_rows <- list()
for (f in sort(list.files(workdir))) {
  info <- file.info(file.path(workdir, f))
  if (!is.na(info$isdir) && !info$isdir) file_rows[[length(file_rows) + 1L]] <- list(name = f, size = info$size)
}

base_pkgs <- c("base", "compiler", "datasets", "graphics", "grDevices", "grid", "methods", "parallel", "splines", "stats", "stats4", "tcltk", "tools", "utils")
loaded_pkgs <- .packages()
extra <- setdiff(loaded_pkgs, base_pkgs)
pkg_names <- sort(unique(c(extra, intersect(c("datasets", "graphics", "grDevices", "methods", "stats", "utils"), base_pkgs))))
packages <- lapply(pkg_names, function(p) {
  list(name = p, version = tryCatch(as.character(utils::packageVersion(p)), error = function(e) ""),
       title = tryCatch(utils::packageDescription(p, fields = "Title"), error = function(e) ""),
       loaded = p %in% loaded_pkgs)
})

receipt <- list(
  rVersion = R.version.string, rShort = paste0("R ", R.version$major, ".", R.version$minor),
  banner = as.list(banner), lines = lines, history = as.list(history), env = env,
  files = file_rows, packages = packages, views = views, plots = as.list(plots),
  error = error_text, seconds = round(proc.time()[["elapsed"]] - started, 3)
)
con <- file(file.path(outdir, "result.json"), "wb")
writeBin(charToRaw(jv(receipt)), con)
close(con)
quit(save = "no", status = 0)
})
