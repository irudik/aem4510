# Check lecture typography, math, and reveals without an interactive browser.
source_lines = readLines("../08-slides-second-best.Rmd", warn = FALSE)
source_text = paste(source_lines, collapse = "\n")
source_text = gsub("(?s)<!--.*?-->", "", source_text, perl = TRUE)

# Math inside Remark color wrappers can remain literal text after rendering.
# Color the prose label and place the equation outside the wrapper.
color_wrappers = regmatches(source_text, gregexpr(
  "\\.(?:hi(?:-[[:alnum:]-]+)?|pc-[[:alnum:]-]+)\\[[^]]*\\]",
  source_text, perl = TRUE))[[1]]
stopifnot(!any(grepl("\\$|\\\\\\(|\\\\\\[", color_wrappers)))

# All lecture text inherits the shared 32px body font, including welfare slides.
lecture_styles = paste(readLines("../08-second-best.css"), collapse = "\n")
shared_styles = paste(readLines("../my-css.css"), collapse = "\n")
stopifnot(!grepl("font-size\\s*:", lecture_styles, perl = TRUE))
stopifnot(grepl("(?s)\\.remark-slide-content\\s*\\{[^}]*font-size:\\s*32px;",
  shared_styles, perl = TRUE))

market_start = which(source_lines == "class: intensity-market-walkthrough")[[1]]
market_end = which(source_lines == "# Why this is second-best")[[1]] - 3L
market_walkthrough = source_lines[market_start:market_end]
stopifnot(!any(market_walkthrough == "--"))
market_slides = split(market_walkthrough, cumsum(market_walkthrough == "---"))
stopifnot(length(market_slides) == 13L)
numbered_stages = c(1, 6, 10, 11, 13)
for (stage in seq_along(market_slides)) {
  content = market_slides[[stage]]
  stopifnot(sum(content == ".market-caption[") == 1L)
  stopifnot(sum(content == ".market-figure[") == 1L)
  stopifnot(sum(grepl("^# Intensity standards:", content)) == 1L)
  stopifnot(paste0("sb_intensity_market_step(", stage, ")") %in% content)
  stopifnot((!any(content == "count: false")) == (stage %in% numbered_stages))
}

walkthrough_start = which(source_lines == "class: intensity-walkthrough")[[1]]
excluded_sections = which(source_lines == "exclude: true")
walkthrough_end = excluded_sections[excluded_sections > walkthrough_start][[1]] - 2L
walkthrough = source_lines[walkthrough_start:walkthrough_end]

# Each click replaces a whole diagram and its explanation. An incremental
# separator would append the earlier columns and cause overlapping content.
stopifnot(!any(walkthrough == "--"))
stopifnot(!any(grepl("^template:", walkthrough)))
slide_groups = cumsum(walkthrough == "---")
slide_contents = split(walkthrough, slide_groups)
stopifnot(length(slide_contents) == 22L)
expected_counts = rep(c(TRUE, FALSE, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE,
  TRUE, FALSE, TRUE), 2)
expected_calls = paste0("sb_intensity_diagram(", c(1:6, 6:10), ")")
expected_calls[[6]] = "sb_intensity_diagram(6, show_feasible = FALSE)"
expected_calls = c(expected_calls,
  sub(")", ', emissions_case = "fall")', expected_calls, fixed = TRUE))
for (reveal in seq_along(slide_contents)) {
  content = slide_contents[[reveal]]
  stopifnot(sum(grepl("^# Intensity standards:", content)) == 1L)
  stopifnot(sum(content == ".pull-left[") == 1L)
  stopifnot(sum(content == ".pull-right[") == 1L)
  stopifnot(sum(grepl("^sb_intensity_diagram\\(", content)) == 1L)
  stopifnot(expected_calls[[reveal]] %in% content)
  stopifnot((!any(content == "count: false")) == expected_counts[[reveal]])
}

# Reference material is excluded, so the final visible slide ends at its figure.
stopifnot(tail(walkthrough[nzchar(trimws(walkthrough))], 1) == "]")
