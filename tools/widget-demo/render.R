# tools/widget-demo/render.R — knit demo.Rmd with the development qeviz and
# write a saveWidget() page next to it. Output: tools/widget-demo/out/.
#
#   RENA_SRC=/path/to/rENA Rscript tools/widget-demo/render.R
dir  <- normalizePath("tools/widget-demo")
out  <- file.path(dir, "out"); dir.create(out, showWarnings = FALSE)
suppressPackageStartupMessages({
  rena_src <- Sys.getenv("RENA_SRC", "")
  if (nzchar(rena_src)) pkgload::load_all(rena_src, quiet = TRUE, export_all = FALSE)
  else library(rENA)
  pkgload::load_all(file.path(dir, "..", "..", "R"), quiet = TRUE, export_all = FALSE)
})
rmarkdown::render(file.path(dir, "demo.Rmd"), output_dir = out, quiet = TRUE,
                  envir = new.env(), intermediates_dir = tempdir())

data(RS.data)
codes <- c("Data", "Technical.Constraints", "Performance.Parameters",
           "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration")
set <- ena.make.set(ena.accumulate.data(
  units = RS.data[, c("Condition", "UserName")],
  conversation = RS.data[, c("Condition", "GroupName")],
  codes = RS.data[, codes], window.size.back = 4))
w <- qe_plot(set, title = "Saved widget", group_col = "Condition") |>
  qe_edges("SecondGame") |> qe_group("SecondGame") |> qe_labels(nodes = "on") |> qe_widget()
htmlwidgets::saveWidget(w, file.path(out, "saved.html"), selfcontained = TRUE)
cat("Wrote", file.path(out, "demo.html"), "and saved.html\n")
