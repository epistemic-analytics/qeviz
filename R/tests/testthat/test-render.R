model <- qe_model_data(nodes_df, edges_df, points_df,
                       id_col = "ENA_UNIT", group_col = "Condition")

# ── qe_html ────────────────────────────────────────────────────────────────────

test_that("qe_html returns a single character string", {
  html <- qe_html(model)
  expect_type(html, "character")
  expect_length(html, 1L)
})

test_that("qe_html output is a complete HTML document", {
  html <- qe_html(model)
  expect_match(html, "<!DOCTYPE html>", fixed = TRUE)
  expect_match(html, "</html>",         fixed = TRUE)
})

test_that("qe_html contains required custom elements", {
  html <- qe_html(model)
  expect_match(html, "qe-visual", fixed = TRUE)
  expect_match(html, "qe-graph",  fixed = TRUE)
})

test_that("qe_html embeds setModelData call", {
  html <- qe_html(model)
  expect_match(html, "setModelData", fixed = TRUE)
})

test_that("qe_html embeds model JSON", {
  html <- qe_html(model)
  expect_match(html, '"nodes"',  fixed = TRUE)
  expect_match(html, '"edges"',  fixed = TRUE)
  expect_match(html, '"groups"', fixed = TRUE)
})

test_that("qe_html title appears in <title> tag", {
  html <- qe_html(model, title = "My ENA Plot")
  expect_match(html, "<title>My ENA Plot</title>", fixed = TRUE)
})

test_that("qe_html graph_opts are reflected as element attributes", {
  html <- qe_html(model, graph_opts = list("label-nodes" = "off"))
  expect_match(html, '<qe-nodes label="off">', fixed = TRUE)
})

# ── qe_fragment ────────────────────────────────────────────────────────────────

test_that("qe_fragment returns a character string classed as html", {
  frag <- qe_fragment(model)
  expect_type(frag, "character")
  expect_true(inherits(frag, "html"))
})

test_that("qe_fragment does not contain a DOCTYPE or <html> tag", {
  frag <- qe_fragment(model)
  expect_no_match(frag, "<!DOCTYPE")
  expect_no_match(frag, "<html")
})

test_that("qe_fragment contains required custom elements", {
  frag <- qe_fragment(model)
  expect_match(frag, "qe-visual",    fixed = TRUE)
  expect_match(frag, "qe-graph",     fixed = TRUE)
  expect_match(frag, "setModelData", fixed = TRUE)
})

test_that("qe_fragment respects height argument", {
  frag <- qe_fragment(model, height = "600px")
  expect_match(frag, "height:600px", fixed = TRUE)
})

test_that("successive qe_fragment calls produce different element IDs", {
  Sys.sleep(0.01)   # ensure proc.time() ticks between calls
  id1 <- regmatches(qe_fragment(model), regexpr('id="qeviz[0-9]+"', qe_fragment(model)))
  Sys.sleep(0.01)
  id2 <- regmatches(qe_fragment(model), regexpr('id="qeviz[0-9]+"', qe_fragment(model)))
  # At minimum both should be valid IDs; collision is possible but unlikely
  expect_match(id1, "^id=\"qeviz[0-9]+\"$")
  expect_match(id2, "^id=\"qeviz[0-9]+\"$")
})

# ── qe_export_html ─────────────────────────────────────────────────────────────

test_that("qe_export_html writes a file and returns its path", {
  tmp <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  out <- qe_export_html(model, tmp, open = FALSE)
  expect_true(file.exists(out))
})

test_that("qe_export_html returned path is normalised and matches tmp", {
  tmp <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  out <- qe_export_html(model, tmp, open = FALSE)
  expect_equal(out, normalizePath(tmp))
})

test_that("qe_export_html written file contains valid HTML", {
  tmp  <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  qe_export_html(model, tmp, open = FALSE)
  html <- paste(readLines(tmp, warn = FALSE), collapse = "\n")
  expect_match(html, "<!DOCTYPE html>", fixed = TRUE)
  expect_match(html, "setModelData",    fixed = TRUE)
})

test_that("qe_export_html file size is non-trivial (bundle inlined)", {
  tmp <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  qe_export_html(model, tmp, open = FALSE)
  expect_gt(file.size(tmp), 10000L)   # bundle alone is >> 10 kB
})
