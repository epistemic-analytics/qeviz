# tools/rena-pyena/rena.R — the rENA half of the rENA vs pyENA side by side.
#
# Fits RS.data with rENA, writes the model's numbers to out/rena.json (for
# compare.py) and draws the three views with qeviz into out/panels/.
#
#   RENA_SRC=~/Workspaces/RStudio/rENA Rscript tools/rena-pyena/rena.R
here <- normalizePath("tools/rena-pyena")
out  <- file.path(here, "out"); dir.create(file.path(out, "panels"), recursive = TRUE, showWarnings = FALSE)
suppressPackageStartupMessages({
  rena_src <- Sys.getenv("RENA_SRC", "")
  if (nzchar(rena_src)) pkgload::load_all(rena_src, quiet = TRUE, export_all = FALSE) else library(rENA)
  pkgload::load_all(file.path(here, "..", "..", "R"), quiet = TRUE, export_all = FALSE)
})

# The analysis, as shown on the page.
code <- '
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
eval(parse(text = code))
write.csv(RS.data, file.path(out, "RS.data.csv"), row.names = FALSE)   # pyENA reads the same rows

views <- list(
  FirstGame  = function(p) p |> qe_edges("FirstGame") |> qe_group("FirstGame"),
  SecondGame = function(p) p |> qe_edges("SecondGame") |> qe_group("SecondGame"),
  subtract   = function(p) p |> qe_edges("FirstGame", compare = "SecondGame") |> qe_group()
)
for (v in names(views)) {
  p <- views[[v]](qe_plot(set, title = paste("rENA:", v), height = 420, group_col = "Condition"))
  qe_export_html(p, file.path(out, "panels", paste0("rena_", v, ".html")), open = FALSE)
}

dims <- names(as.data.frame(set$rotation$nodes))[vapply(as.data.frame(set$rotation$nodes), is.numeric, TRUE)][1:2]
pts  <- as.data.frame(set$points)
lw   <- as.data.frame(set$line.weights)
ecol <- grep(" & ", names(lw), fixed = TRUE, value = TRUE)
res <- list(
  version = as.character(utils::packageVersion("rENA")),
  libqe   = as.character(utils::packageVersion("libqe")),
  code    = trimws(code),
  dims    = dims,
  units   = as.character(pts$ENA_UNIT),
  groups  = as.character(pts$Condition),
  points  = unname(as.matrix(pts[, dims])),
  nodes   = list(code = as.character(set$rotation$nodes$code),
                 xy = unname(as.matrix(as.data.frame(set$rotation$nodes)[, dims]))),
  connections  = ecol,
  line_weights = unname(as.matrix(lw[, ecol])),
  variance     = unname(as.numeric(set$model$variance[dims]))
)
jsonlite::write_json(res, file.path(out, "rena.json"), digits = NA, auto_unbox = TRUE)
message("rENA ", res$version, " (libqe ", res$libqe, "): ", length(res$units), " units -> ", out)
