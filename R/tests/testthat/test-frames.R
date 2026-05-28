test_that("qe_frame preserves all rows", {
  f <- qeviz:::qe_frame(nodes_df)
  expect_length(f$data, nrow(nodes_df))
})

test_that("qe_frame types: character, numeric", {
  f <- qeviz:::qe_frame(nodes_df)
  expect_equal(f$types$code, "character")
  expect_equal(f$types$x,    "numeric")
  expect_equal(f$types$y,    "numeric")
})

test_that("qe_frame coerces factors to character", {
  df <- data.frame(g = factor(c("A", "B")), v = 1:2)
  f  <- qeviz:::qe_frame(df)
  expect_equal(f$types$g, "character")
  expect_equal(f$data[[1]]$g, "A")
})

test_that("qe_frame handles integer and logical columns", {
  df <- data.frame(n = 1L, flag = TRUE, stringsAsFactors = FALSE)
  f  <- qeviz:::qe_frame(df)
  expect_equal(f$types$n,    "integer")
  expect_equal(f$types$flag, "logical")
})

test_that("qe_frame row values match source data", {
  f <- qeviz:::qe_frame(nodes_df)
  expect_equal(f$data[[1]]$code, nodes_df$code[1])
  expect_equal(f$data[[1]]$x,    nodes_df$x[1])
})

# ── find_dims ──────────────────────────────────────────────────────────────────

test_that("find_dims returns the first two numeric column names", {
  dims <- qeviz:::find_dims(nodes_df)
  expect_equal(dims, c("x", "y"))
})

test_that("find_dims ignores non-numeric columns", {
  df   <- data.frame(label = "a", p = 1.0, q = 2.0, stringsAsFactors = FALSE)
  dims <- qeviz:::find_dims(df)
  expect_equal(dims, c("p", "q"))
})

test_that("find_dims errors when fewer than two numeric columns", {
  df <- data.frame(label = "a", x = 1.0, stringsAsFactors = FALSE)
  expect_error(qeviz:::find_dims(df), "at least two numeric")
})

# ── group_summary ──────────────────────────────────────────────────────────────

test_that("group_summary returns one row per group", {
  gs <- qeviz:::group_summary(points_df, "x", "y", "Condition")
  expect_equal(nrow(gs), 2L)
  expect_setequal(gs$group, c("OA", "OB"))
})

test_that("group_summary mean is within CI bounds", {
  gs <- qeviz:::group_summary(points_df, "x", "y", "Condition")
  for (i in seq_len(nrow(gs))) {
    expect_lte(gs$x.low[i],  gs$x[i])
    expect_gte(gs$x.high[i], gs$x[i])
    expect_lte(gs$y.low[i],  gs$y[i])
    expect_gte(gs$y.high[i], gs$y[i])
  }
})

test_that("group_summary handles n = 1 without error", {
  single <- points_df[1, ]
  expect_no_error(qeviz:::group_summary(single, "x", "y", "Condition"))
})

test_that("group_summary groups are sorted", {
  gs <- qeviz:::group_summary(points_df, "x", "y", "Condition")
  expect_equal(gs$group, sort(unique(points_df$Condition)))
})
