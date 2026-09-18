# frames.R — low-level helpers for building QEFrame structures
#
# A QEFrame is the wire format qeviz expects for every data table:
#   { data: [ {col: val, ...}, ... ], types: { col: "character"|"numeric"|"integer"|"logical" } }

# ── Internal helpers ───────────────────────────────────────────────────────────

#' Convert a data.frame to a QEFrame list
#'
#' Serialises a data.frame into the `{ data, types }` structure expected by
#' qeviz's `ModelData` interface.  Factors are coerced to character.
#'
#' @param df A `data.frame` (or object coercible via `as.data.frame()`).
#' @return A named list with elements `data` (list of row lists) and `types`
#'   (named character vector of column types).
#' @keywords internal
qe_frame <- function(df) {
  df <- as.data.frame(df)
  types <- vapply(df, function(col) {
    if (is.character(col) || is.factor(col)) "character"
    else if (is.logical(col))               "logical"
    else if (is.integer(col))               "integer"
    else                                    "numeric"
  }, character(1L))
  rows <- lapply(seq_len(nrow(df)), function(i) {
    r <- as.list(df[i, , drop = FALSE])
    lapply(r, function(v) if (is.factor(v)) as.character(v) else v)
  })
  list(data = rows, types = as.list(types))
}

#' Return the names of the first two numeric columns
#'
#' Used to locate the rotated dimension axes (e.g. `SVD1`, `SVD2`) in a
#' nodes or points data.frame without hardcoding column names.
#'
#' @param df A `data.frame`.
#' @return Character vector of length 2.
#' @keywords internal
find_dims <- function(df) {
  nm <- names(df)[vapply(df, is.numeric, logical(1L))]
  if (length(nm) < 2L)
    stop("Expected at least two numeric dimension columns in data.frame.")
  nm[1:2]
}

#' Compute per-group means and 95% CI bounds
#'
#' For each group, computes the mean x/y position and a rectangular 95%
#' confidence interval using `t(df = n-1, 0.975) * SE` on each axis
#' independently.  This matches the CI convention used by rENA / Web ENA.
#'
#' @param pts   A `data.frame` with at least the columns named by `x_col`,
#'   `y_col`, and `group_col`.
#' @param x_col Name of the x-coordinate column.
#' @param y_col Name of the y-coordinate column.
#' @param group_col Name of the grouping column.
#' @return A `data.frame` with columns `group`, `x`, `y`, `x.low`, `x.high`,
#'   `y.low`, `y.high`.
#' @keywords internal
group_summary <- function(pts, x_col, y_col, group_col) {
  groups <- sort(unique(pts[[group_col]]))
  do.call(rbind, lapply(groups, function(g) {
    sub  <- pts[pts[[group_col]] == g, ]
    n    <- nrow(sub)
    t_v  <- stats::qt(0.975, df = max(1L, n - 1L))
    x    <- sub[[x_col]];  y <- sub[[y_col]]
    mx   <- mean(x, na.rm = TRUE);  my <- mean(y, na.rm = TRUE)
    se_x <- stats::sd(x,  na.rm = TRUE) / sqrt(n)
    se_y <- stats::sd(y,  na.rm = TRUE) / sqrt(n)
    row <- data.frame(
      x      = mx,            y      = my,
      x.low  = mx - t_v * se_x, x.high = mx + t_v * se_x,
      y.low  = my - t_v * se_y, y.high = my + t_v * se_y,
      stringsAsFactors = FALSE
    )
    row[[group_col]] <- g
    row[, c(group_col, "x", "y", "x.low", "x.high", "y.low", "y.high")]
  }))
}
