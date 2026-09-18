# Shared synthetic ENA-shaped fixtures used across the test suite.
#
# Four codes arranged on the unit circle; eight units split evenly into two
# groups (OA / OB) with different edge-weight profiles.

CODES <- c("Data", "Design", "Tech", "Collab")

# ── Nodes ─────────────────────────────────────────────────────────────────────

.angles <- seq(0, 2 * pi, length.out = length(CODES) + 1L)[-(length(CODES) + 1L)]

nodes_df <- data.frame(
  code = CODES,
  x    = round(cos(.angles), 4),
  y    = round(sin(.angles), 4),
  stringsAsFactors = FALSE
)

# ── Edge-weight column names ───────────────────────────────────────────────────

.pairs <- do.call(rbind, lapply(seq_along(CODES), function(i) {
  lapply(seq_along(CODES), function(j) {
    if (i < j) data.frame(c1 = CODES[i], c2 = CODES[j], stringsAsFactors = FALSE)
  })
}))
.pairs <- do.call(rbind, Filter(Negate(is.null), .pairs))
EDGE_COLS <- paste(.pairs$c1, .pairs$c2, sep = ".")

# ── Helper: build one unit row ────────────────────────────────────────────────

.make_unit <- function(uid, group, seed) {
  set.seed(seed)
  row        <- list(ENA_UNIT = uid, Condition = group)
  high_group <- if (group == "OA") "OA" else "OB"
  for (col in EDGE_COLS) {
    parts  <- strsplit(col, ".", fixed = TRUE)[[1]]
    i1     <- match(parts[1], CODES)
    i2     <- match(parts[2], CODES)
    weight <- if ((i1 %% 2) == (i2 %% 2)) {
      runif(1, 0, if (group == "OA") 0.8 else 0.2)
    } else {
      runif(1, 0, if (group == "OA") 0.2 else 0.8)
    }
    row[[col]] <- round(weight, 4)
  }
  row
}

# ── Edges ─────────────────────────────────────────────────────────────────────

.unit_specs <- list(
  list("OA.alice",   "OA", 1L),
  list("OA.bob",     "OA", 7L),
  list("OA.carol",   "OA", 13L),
  list("OA.dan",     "OA", 19L),
  list("OB.eve",     "OB", 25L),
  list("OB.frank",   "OB", 31L),
  list("OB.grace",   "OB", 37L),
  list("OB.henry",   "OB", 43L)
)

edges_df <- do.call(rbind, lapply(.unit_specs, function(s) {
  as.data.frame(.make_unit(s[[1]], s[[2]], s[[3]]), stringsAsFactors = FALSE)
}))

# ── Points (trivial projection: weighted mean of node positions) ──────────────

.project <- function(unit_row) {
  wx <- 0; wy <- 0; total <- 0
  for (col in EDGE_COLS) {
    w  <- unit_row[[col]]
    parts <- strsplit(col, ".", fixed = TRUE)[[1]]
    i1 <- match(parts[1], CODES); i2 <- match(parts[2], CODES)
    wx <- wx + w * (cos(.angles[i1]) + cos(.angles[i2])) / 2
    wy <- wy + w * (sin(.angles[i1]) + sin(.angles[i2])) / 2
    total <- total + w
  }
  list(ENA_UNIT  = unit_row[["ENA_UNIT"]],
       Condition = unit_row[["Condition"]],
       x         = if (total > 0) round(wx / total, 4) else 0,
       y         = if (total > 0) round(wy / total, 4) else 0)
}

points_df <- do.call(rbind, lapply(seq_len(nrow(edges_df)), function(i) {
  as.data.frame(.project(as.list(edges_df[i, ])), stringsAsFactors = FALSE)
}))

trajectory_df <- do.call(rbind, lapply(seq_len(nrow(points_df)), function(i) {
  base <- points_df[i, , drop = FALSE]
  do.call(rbind, lapply(seq_len(3), function(t) {
    row <- base
    row$RowID <- t
    row$x <- row$x + (t - 2) * 0.03
    row$y <- row$y - (t - 2) * 0.02
    row
  }))
}))

# ── Mock rENA set (no rENA install needed) ────────────────────────────────────
# Mimics the structure read by qe_extract():
#   set$rotation$nodes  — nodes with SVD1/SVD2 column names
#   set$points          — unit positions
#   set$line.weights    — edge weights (rENA uses " & " separator)
#   set$meta.data       — unit metadata

.nodes_rena <- nodes_df
names(.nodes_rena)[names(.nodes_rena) == "x"] <- "SVD1"
names(.nodes_rena)[names(.nodes_rena) == "y"] <- "SVD2"

.points_rena <- points_df
names(.points_rena)[names(.points_rena) == "x"] <- "SVD1"
names(.points_rena)[names(.points_rena) == "y"] <- "SVD2"

# rENA uses " & " as the edge separator
.lw <- edges_df[, EDGE_COLS, drop = FALSE]
names(.lw) <- gsub(".", " & ", names(.lw), fixed = TRUE)

mock_set <- list(
  rotation   = list(nodes = .nodes_rena),
  points     = .points_rena,
  line.weights = .lw,
  meta.data  = edges_df[, c("ENA_UNIT", "Condition"), drop = FALSE]
)
