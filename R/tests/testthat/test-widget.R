# ── qe_widget / knitr / Shiny (spec §7) ──────────────────────────────────────

model <- qe_model_data(nodes_df, edges_df, points_df,
                       id_col = "ENA_UNIT", group_col = "Condition")

test_that("qe_widget builds a qeviz htmlwidget with the graph markup and model", {
  p <- qe_plot(model, title = "T", height = 500) |> qe_edges("OA")
  w <- qe_widget(p)
  expect_s3_class(w, "htmlwidget")
  expect_s3_class(w, "qeviz")
  expect_identical(w$x$graph, .build_graph_element(p$graph_opts))
  expect_match(w$x$graph, 'plot-title="T"', fixed = TRUE)
  m <- jsonlite::fromJSON(w$x$model, simplifyVector = FALSE)
  expect_true(all(c("nodes", "edges", "points") %in% names(m)))
  expect_identical(w$height, 500)
  expect_identical(w$width, "100%")
})

test_that("qe_widget sizes override qe_plot's and accept a raw set", {
  w <- qe_widget(mock_set, width = 300, height = "20em")
  expect_identical(w$width, 300)
  expect_identical(w$height, "20em")
})

test_that("qe_widget attaches the bundled qeviz script as a dependency", {
  dep <- qe_widget(qe_plot(mock_set))$dependencies[[1]]
  expect_identical(dep$name, "qeviz")
  expect_identical(dep$version, as.character(utils::packageVersion("qeviz")))
  expect_true(file.exists(file.path(dep$src$file, dep$script)))
})

test_that("saveWidget writes a page with the binding, bundle and graph", {
  skip_if_not(rmarkdown::pandoc_available(), "pandoc not available")
  f <- tempfile(fileext = ".html")
  htmlwidgets::saveWidget(qe_widget(qe_plot(model) |> qe_edges("OA")), f)
  html <- paste(readLines(f, warn = FALSE), collapse = "\n")
  expect_match(html, "customElements", fixed = TRUE)          # bundle inlined
  expect_match(html, 'HTMLWidgets.widget', fixed = TRUE)     # binding
  expect_match(html, "qe-edges", fixed = TRUE)
})

test_that("a qe_plot chunk knits to an inline widget", {
  skip_if_not(rmarkdown::pandoc_available(), "pandoc not available")
  dir <- tempfile(); dir.create(dir)
  rmd <- file.path(dir, "doc.Rmd")
  saveRDS(model, file.path(dir, "model.rds"))
  writeLines(c("---", "output: html_document", "---", "", "```{r}",
               "qeviz::qe_plot(readRDS('model.rds'), title = 'Knitted') |> qeviz::qe_edges('OA')",
               "```"), rmd)
  out  <- rmarkdown::render(rmd, quiet = TRUE)
  html <- paste(readLines(out, warn = FALSE), collapse = "\n")
  expect_match(html, 'class="qeviz html-widget', fixed = TRUE)
  expect_match(html, "plot-title=\\\"Knitted\\\"", fixed = TRUE)
})

test_that("qeOutput and renderQe produce Shiny bindings for the qeviz widget", {
  skip_if_not_installed("shiny")
  ui <- as.character(qeOutput("plt", height = "300px"))
  expect_match(ui, 'id="plt"', fixed = TRUE)
  expect_match(ui, "qeviz html-widget", fixed = TRUE)
  expect_match(ui, "height:300px", fixed = TRUE)
  expect_true(is.function(renderQe(qe_plot(model))))
})
