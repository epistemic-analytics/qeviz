# ── qe_model_data ──────────────────────────────────────────────────────────────

test_that("qe_model_data returns required top-level fields", {
  m <- qe_model_data(nodes_df, edges_df, points_df,
                     id_col = "ENA_UNIT", group_col = "Condition")
  expect_named(m, c("directed", "updated", "id_col", "node_id_col",
                    "x_col", "y_col", "group_col", "nodes", "edges",
                    "points", "groups"),
               ignore.order = TRUE)
})

test_that("qe_model_data without points omits points and groups", {
  m <- qe_model_data(nodes_df, edges_df, id_col = "ENA_UNIT")
  expect_false("points" %in% names(m))
  expect_false("groups" %in% names(m))
})

test_that("qe_model_data with points includes groups when group_col is set", {
  m <- qe_model_data(nodes_df, edges_df, points_df,
                     id_col = "ENA_UNIT", group_col = "Condition")
  expect_true("points" %in% names(m))
  expect_true("groups" %in% names(m))
})

test_that("qe_model_data includes trajectories when supplied", {
  m <- qe_model_data(nodes_df, edges_df, points_df,
                     trajectories = trajectory_df,
                     id_col = "ENA_UNIT", group_col = "Condition")
  expect_true("trajectories" %in% names(m))
  expect_length(m$trajectories$data, nrow(trajectory_df))
})

test_that("qe_model_data directed flag is passed through", {
  expect_false(qe_model_data(nodes_df, edges_df, directed = FALSE)$directed)
  expect_true( qe_model_data(nodes_df, edges_df, directed = TRUE)$directed)
})

test_that("qe_model_data column name fields reflect arguments", {
  m <- qe_model_data(nodes_df, edges_df,
                     id_col = "ENA_UNIT", node_id_col = "code",
                     x_col = "x", y_col = "y", group_col = "Condition")
  expect_equal(m$id_col,      "ENA_UNIT")
  expect_equal(m$node_id_col, "code")
  expect_equal(m$x_col,       "x")
  expect_equal(m$y_col,       "y")
  expect_equal(m$group_col,   "Condition")
})

test_that("qe_model_data nodes QEFrame has correct row count", {
  m <- qe_model_data(nodes_df, edges_df)
  expect_length(m$nodes$data, nrow(nodes_df))
})

test_that("qe_model_data groups QEFrame has one row per group", {
  m <- qe_model_data(nodes_df, edges_df, points_df,
                     id_col = "ENA_UNIT", group_col = "Condition")
  n_groups <- length(unique(points_df$Condition))
  expect_length(m$groups$data, n_groups)
})

test_that("qe_model_data updated timestamp is recent", {
  before <- as.numeric(Sys.time()) * 1000
  m      <- qe_model_data(nodes_df, edges_df)
  after  <- as.numeric(Sys.time()) * 1000
  expect_gte(m$updated, before)
  expect_lte(m$updated, after)
})

# ── qe_extract ─────────────────────────────────────────────────────────────────

test_that("qe_extract returns required top-level fields from mock set", {
  m <- qe_extract(mock_set)
  expect_true(all(c("nodes", "edges", "points", "groups", "directed") %in% names(m)))
})

test_that("qe_extract directed flag is passed through", {
  expect_false(qe_extract(mock_set, directed = FALSE)$directed)
  expect_true( qe_extract(mock_set, directed = TRUE)$directed)
})

test_that("qe_extract normalises ' & ' to '.' in edge column names", {
  m    <- qe_extract(mock_set)
  cols <- names(m$edges$types)
  expect_false(any(grepl(" & ", cols, fixed = TRUE)))
  expect_true( any(grepl(".",   cols, fixed = TRUE)))
})

test_that("qe_extract nodes row count matches source", {
  m <- qe_extract(mock_set)
  expect_length(m$nodes$data, nrow(mock_set$rotation$nodes))
})

test_that("qe_extract keeps the set's dimension names (used as axis labels)", {
  m    <- qe_extract(mock_set)
  expect_equal(c(m$x_col, m$y_col), c("SVD1", "SVD2"))
  expect_true(all(c("SVD1", "SVD2") %in% names(m$points$types)))
  expect_true(all(c("SVD1", "SVD2") %in% names(m$nodes$types)))
  expect_true(all(c("SVD1.low", "SVD1.high", "SVD2.low", "SVD2.high")
                  %in% names(m$groups$types)))
  expect_false(any(c("x", "y") %in% names(m$points$types)))
})

test_that("qe_extract with real rENA data", {
  skip_if_not_installed("rENA")
  skip_if_not_installed("tma")

  library(tma)
  library(rENA)
  data(RS.data)

  codes     <- c("Data", "Technical.Constraints", "Performance.Parameters",
                 "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration")
  hoo_rules <- tma::conversation_rules(
    (Condition %in% UNIT$Condition) & (GroupName %in% UNIT$GroupName)
  )
  ctx <- tma::contexts(RS.data,
                       units_by  = c("Condition", "UserName"),
                       hoo_rules = hoo_rules)
  arr <- tma::context_tensor(RS.data,
                             sender_cols    = NULL, receiver_cols = NULL,
                             default_window = 8,    default_weight = 1)
  res <- tma::accumulate(arr, codes = codes, context_model = ctx, ordered = FALSE)
  set <- rENA::model(res)
  m   <- qe_extract(set, directed = FALSE)

  expect_false(m$directed)
  expect_length(m$nodes$data, length(codes))
  expect_true(all(c("nodes", "edges", "points", "groups") %in% names(m)))
})

test_that("qe_trajectory_units reads trajectories frame", {
  m <- qe_model_data(nodes_df, edges_df, points_df,
                     trajectories = trajectory_df,
                     id_col = "ENA_UNIT", group_col = "Condition")
  expect_equal(sort(qe_trajectory_units(m)), sort(unique(trajectory_df$ENA_UNIT)))
})

test_that("qe_trajectory_units falls back to points frame", {
  m <- qe_model_data(nodes_df, edges_df, points_df,
                     id_col = "ENA_UNIT", group_col = "Condition")
  expect_equal(sort(qe_trajectory_units(m)), sort(unique(points_df$ENA_UNIT)))
})
