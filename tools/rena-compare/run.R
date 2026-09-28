#!/usr/bin/env Rscript
# tools/rena-compare/run.R — rENA vs qeviz accuracy report on RS.data.
#
#   Rscript tools/rena-compare/run.R            # from the qeviz repo root
#
# Environment:
#   RENA_SRC   path to an rENA source tree to pkgload::load_all() (read-only;
#              nothing in that tree is modified). Unset → installed rENA.
#   QEC_OUT    output directory (default tools/rena-compare/out)
#
# qeviz is always loaded from this repo's R/ package so the report reflects
# the current bundle in R/inst/qeviz.umd.js (run `npm run build` first).
#
# To test your own model instead of RS.data, source harness.R and call
# qec_compare(set, group_col = "<your group column>").

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
  pkgload::load_all(file.path(repo, "R"), quiet = TRUE, export_all = FALSE)
})
source(file.path(QEC_DIR, "harness.R"))

# The model code is kept as text so the report can show exactly what ran.
setup_code <- '
data(RS.data)
codes <- c("Data", "Technical.Constraints", "Performance.Parameters",
           "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration")

accum <- ena.accumulate.data(
  units        = RS.data[, c("Condition", "UserName")],
  conversation = RS.data[, c("Condition", "GroupName")],
  codes        = RS.data[, codes],
  window.size.back = 4
)
set <- ena.make.set(accum)
'
eval(parse(text = setup_code))

qec_compare(
  set,
  out_dir    = Sys.getenv("QEC_OUT", file.path(QEC_DIR, "out")),
  group_col  = "Condition",
  label      = "RS.data · ena.accumulate.data(window 4) · ena.make.set (SVD)",
  setup_code = trimws(setup_code)
)
