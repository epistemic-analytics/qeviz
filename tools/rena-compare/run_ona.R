#!/usr/bin/env Rscript
# tools/rena-compare/run_ona.R — ona vs qeviz accuracy report on RS.data (ONA).
#
#   Rscript tools/rena-compare/run_ona.R        # from the qeviz repo root
#
# Environment:
#   RENA_SRC   rENA source tree to pkgload::load_all() (read-only). Unset →
#              installed rENA. rENA provides accumulate() for the ONA model.
#   ONA_SRC    ona source tree to pkgload::load_all() (read-only). Unset →
#              installed ona.
#   QEC_OUT    output directory (default tools/rena-compare/out-ona)

QEC_DIR <- local({
  args <- commandArgs(trailingOnly = FALSE)
  f <- sub("^--file=", "", grep("^--file=", args, value = TRUE))
  if (length(f)) dirname(normalizePath(f)) else normalizePath("tools/rena-compare")
})
repo <- normalizePath(file.path(QEC_DIR, "..", ".."))

suppressPackageStartupMessages({
  rena_src <- Sys.getenv("RENA_SRC", "")
  if (nzchar(rena_src)) pkgload::load_all(rena_src, quiet = TRUE, export_all = FALSE)
  else library(rENA)
  ona_src <- Sys.getenv("ONA_SRC", "")
  if (nzchar(ona_src)) pkgload::load_all(ona_src, quiet = TRUE, export_all = FALSE)
  else library(ona)
  pkgload::load_all(file.path(repo, "R"), quiet = TRUE, export_all = FALSE)
})
source(file.path(QEC_DIR, "harness.R"))

# The model code is kept as text so the report can show exactly what ran.
# This is the ona README's quick-start pipeline.
setup_code <- '
data(RS.data)
codes <- c("Data", "Technical.Constraints", "Performance.Parameters",
           "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration")

set <- RS.data |>
  accumulate(c("UserName", "Condition", "GroupName"), codes,
             c("Condition", "GroupName"), default_window = 4, ordered = TRUE) |>
  model()
'
eval(parse(text = setup_code))

qec_compare(
  set,
  reference  = "ona",
  out_dir    = Sys.getenv("QEC_OUT", file.path(QEC_DIR, "out-ona")),
  group_col  = "Condition",
  label      = "RS.data · ONA · accumulate(ordered, window 4) · ona::model (SVD)",
  setup_code = trimws(setup_code)
)
