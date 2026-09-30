# tools/rena-compare/harness.R
#
# Side-by-side accuracy harness: one ena.set, a reference renderer and qeviz.
#
#   truth     — computed directly from the set (nodes, mean networks, means, CIs)
#   reference — the package's own plot, read back into model-space numbers:
#               "rena": ena.plot.* → plotly traces (undirected ENA)
#               "ona":  ona::plot() |> edges() |> nodes() → plotly shapes (ONA)
#   adapter   — qe_extract() ModelData (what qeviz is handed)
#   qeviz     — rendered in the browser; numbers read back via the qe-graph
#               read APIs by qe_probe.js and checked live in report.html
#
# All comparisons happen in model space: qeviz's y-flip is undone, and qeviz is
# rendered with scale-points="false" so unit points / means are not rescaled
# to the node extent (rENA never rescales points; it only pads the axes).
#
# Requires rENA and qeviz to be loaded already (see run.R).

.QEC_DIR <- if (exists("QEC_DIR")) QEC_DIR else "tools/rena-compare"

# Same order as GROUP_PALETTE in src/elements/QEGraph.ts. qeviz assigns these
# by first appearance in the points frame; rENA gets the identical mapping.
QEC_PALETTE <- c("#4477AA", "#EE6677", "#228833", "#CCBB44",
                 "#66CCEE", "#AA3377", "#BBBBBB", "#000000")

`%||%` <- function(a, b) if (!is.null(a)) a else b

# ── View specs ────────────────────────────────────────────────────────────────
#
# A view describes *what* to draw; both renderers are built from the same spec.
#   network: NULL | list(group = "A") | list(group = "A", compare = "B")
#            | list(weights = "<R expr>", compare = "<R expr>", colors = c(pos, neg),
#                   threshold = min, name = "…")   — explicit data (qeviz 0.5):
#            the same expression is drawn by both renderers and used for truth.
#   means:   character vector of groups whose mean (+ CI) to show
#   ci:      CI around the means: TRUE / "box", "crosshairs", FALSE / "none"
#   outlier: also draw outlier intervals (Tukey fences)
#   points:  draw every unit point
#   point_set:  explicit points (qeviz 0.5): list(expr | units, color, shape, name)
#   mean_sets:  explicit means (qeviz 0.5): list of list(expr, label, color)
#   node_positions: R expr giving a nodes table (code + dims) to draw on (0.5)
#   node_labels:    named character, code -> display text (0.5)
#   dims:           two dimension names to plot, e.g. c("SVD1", "SVD3") (0.5)
#   range:          "network" | "points" | number (rENA scale.to) (0.5)
#   group_colors:   named colours overriding the palette (qe_colors) (0.5)
#   font:           list(size = px, family =) for labels + title (0.5)

qec_view <- function(name, title, network = NULL, means = character(0),
                     ci = TRUE, points = FALSE, outlier = FALSE,
                     point_set = NULL, mean_sets = NULL,
                     node_positions = NULL, node_labels = NULL,
                     dims = NULL, range = NULL, group_colors = NULL, font = NULL) {
  list(name = name, title = title, network = network,
       means = means, ci = ci, points = points, outlier = outlier,
       point_set = point_set, mean_sets = mean_sets,
       node_positions = node_positions, node_labels = node_labels,
       dims = dims, range = range, group_colors = group_colors, font = font)
}

.qec_ci <- function(view) {
  if (isTRUE(view$ci)) "box" else if (isFALSE(view$ci)) "none" else view$ci
}

# Rows of set$points selected by an expression (the subset both renderers draw).
QEC_POINTS_EXPR <- "set$points[as.data.frame(set$points)$SVD1 > 0]"

qec_default_views <- function(groups) {
  a <- groups[1]; b <- groups[2]
  list(
    qec_view("net_a", sprintf("%s mean network + CI", a),
             network = list(group = a), means = a),
    qec_view("net_b", sprintf("%s mean network + CI", b),
             network = list(group = b), means = b),
    qec_view("subtract", sprintf("Subtraction: %s − %s + both means", a, b),
             network = list(group = a, compare = b), means = c(a, b)),
    qec_view("means", "Both group means + CI, no network",
             means = c(a, b)),
    qec_view("means_noci", "Both group means, intervals off",
             means = c(a, b), ci = FALSE),
    qec_view("points", "All unit points + group means",
             means = c(a, b), points = TRUE),
    # ── Explicit data (qeviz 0.5 qe_edges(weights =)) ───────────────────────
    qec_view("w_group", sprintf("%s network from data (weights = matrix)", a),
             network = list(weights = .qec_rows("line.weights", a),
                            colors = QEC_PALETTE[1]), means = a),
    qec_view("w_sub", sprintf("Subtraction from data: weights = %s, compare = %s", a, b),
             network = list(weights = .qec_rows("line.weights", a),
                            compare = .qec_rows("line.weights", b),
                            colors = c("#386CB0", "#F0027F")), means = c(a, b)),
    qec_view("w_subset", "Non-group subset (units with SVD1 > 0), threshold 0.05",
             network = list(weights = QEC_SUBSET_EXPR, colors = "#228833",
                            threshold = 0.05, name = "SVD1 > 0")),
    # ── Explicit points / means (qeviz 0.5 qe_points / qe_group) ────────────
    qec_view("p_set", "Point set from data: units with SVD1 > 0, triangles",
             point_set = list(expr = QEC_POINTS_EXPR, color = "#228833",
                              shape = "triangle", name = "SVD1 > 0")),
    qec_view("p_units", sprintf("Point set by unit ID: %s units", a),
             point_set = list(units = sprintf("set$points[Condition == %s]$ENA_UNIT", deparse(a)),
                              color = QEC_PALETTE[1], name = a)),
    qec_view("m_subset", "Mean of a non-group subset (SVD1 > 0) + CI",
             mean_sets = list(list(expr = QEC_POINTS_EXPR, label = "SVD1 > 0", color = "#228833"))),
    qec_view("m_cross", "Group means with crosshair CIs", means = c(a, b), ci = "crosshairs"),
    qec_view("m_outlier", "Group means with CI + outlier intervals", means = c(a, b),
             outlier = TRUE),
    # ── Node overrides (qeviz 0.5 qe_nodes(positions =, labels =)) ──────────
    qec_view("n_moved", sprintf("%s network on moved nodes (move_nodes_to_unit_circle)", a),
             network = list(group = a), means = a,
             node_positions = "move_nodes_to_unit_circle(set)$rotation$nodes"),
    qec_view("n_labels", sprintf("%s network with custom node labels", a),
             network = list(group = a),
             node_labels = c(Technical.Constraints = "Tech. constraints",
                             Client.and.Consultant.Requests = "Client requests",
                             Design.Reasoning = "Design reasoning")),
    # ── Plot-level settings (qeviz 0.5 §6) ──────────────────────────────────
    qec_view("d_dims", sprintf("%s network + mean on SVD1 vs SVD3 (dims)", a),
             network = list(group = a), means = a, dims = c("SVD1", "SVD3")),
    qec_view("d_range", "Unit points + means, range from points (scale.to)",
             means = c(a, b), points = TRUE, range = "points"),
    qec_view("d_colors", sprintf("Custom group colours: %s − %s + means", a, b),
             network = list(group = a, compare = b), means = c(a, b),
             group_colors = stats::setNames(c("#E69F00", "#009E73"), c(a, b))),
    qec_view("d_title", sprintf("Title + 14 px Times New Roman labels: %s", a),
             network = list(group = a), means = a,
             font = list(size = 14, family = "Times New Roman"))
  )
}

# A subset that is not a group — only expressible with explicit data.
QEC_SUBSET_EXPR <- "as.matrix(set$line.weights)[as.data.frame(set$points)$SVD1 > 0, ]"

.qec_rows <- function(frame, g, group_col = "Condition")
  sprintf("as.matrix(set$%s[%s == %s])", frame, group_col, deparse(g))

# ONA: networks only. ona::units() cannot draw means or points for models from
# the current accumulate() (it filters on an ENA_DIRECTION column those models
# no longer carry), so there is nothing to compare them against.
qec_default_views_ona <- function(groups) {
  a <- groups[1]; b <- groups[2]
  list(
    qec_view("net_a", sprintf("%s mean network", a), network = list(group = a)),
    qec_view("net_b", sprintf("%s mean network", b), network = list(group = b)),
    qec_view("subtract", sprintf("Subtraction: %s − %s", a, b),
             network = list(group = a, compare = b)),
    qec_view("w_subset", "Non-group subset from data (units with SVD1 > 0)",
             network = list(weights = QEC_SUBSET_EXPR, colors = "#228833",
                            name = "SVD1 > 0"))
  )
}

# ── Model-space helpers ───────────────────────────────────────────────────────

.qec_dims <- function(set) {
  nodes <- as.data.frame(set$rotation$nodes)
  names(nodes)[vapply(nodes, is.numeric, logical(1))][1:2]
}

.qec_edge_matrix <- function(set) {
  lw <- as.data.frame(set$line.weights)
  cols <- grep(" & ", names(lw), fixed = TRUE, value = TRUE)
  m <- as.matrix(lw[, cols, drop = FALSE])
  storage.mode(m) <- "double"
  m
}

.qec_network <- function(set, spec, group_col) {
  if (is.null(spec)) return(NULL)
  if (!is.null(spec$weights)) {
    env <- list2env(list(set = set), parent = globalenv())
    ev  <- function(e) {
      x <- eval(parse(text = e), envir = env)
      if (is.matrix(x) || is.data.frame(x)) colMeans(as.matrix(x)) else x
    }
    net <- ev(spec$weights)
    if (!is.null(spec$compare)) net <- net - ev(spec$compare)
    return(net)
  }
  m <- .qec_edge_matrix(set)
  grp <- as.character(as.data.frame(set$meta.data)[[group_col]])
  net <- colMeans(m[grp == spec$group, , drop = FALSE])
  if (!is.null(spec$compare))
    net <- net - colMeans(m[grp == spec$compare, , drop = FALSE])
  net
}

.qec_split_pairs <- function(names) {
  parts <- strsplit(names, " & ", fixed = TRUE)
  data.frame(a = vapply(parts, `[`, "", 1), b = vapply(parts, `[`, "", 2),
             stringsAsFactors = FALSE)
}

# Positive / negative colours of a network spec: explicit `colors`, else the
# group palette (as both renderers default).
.qec_net_colors <- function(net, colors) {
  if (!is.null(net$colors)) return(net$colors)
  c(colors[[net$group]], if (!is.null(net$compare)) colors[[net$compare]])
}

qec_group_colors <- function(set, group_col) {
  g <- unique(as.character(as.data.frame(set$points)[[group_col]]))
  stats::setNames(QEC_PALETTE[(seq_along(g) - 1) %% length(QEC_PALETTE) + 1], g)
}

# ── Truth: computed straight from the ena.set ─────────────────────────────────

qec_truth <- function(set, view, group_col) {
  dims  <- view$dims %||% .qec_dims(set)
  nodes <- as.data.frame(set$rotation$nodes)
  pts   <- as.data.frame(set$points)

  # Code nodes are drawn only alongside a network (rENA draws them in
  # ena.plot.network(); qeviz's <qe-nodes show="auto"> does the same).
  if (!is.null(view$node_positions)) {
    env0 <- list2env(list(set = set), parent = globalenv())
    moved <- as.data.frame(eval(parse(text = view$node_positions), envir = env0))
    nodes[match(moved$code, nodes$code), dims] <- moved[, dims]
  }
  out <- list(nodes_drawn = !is.null(view$network),
              nodes = data.frame(code = as.character(nodes$code),
                                 x = nodes[[dims[1]]], y = nodes[[dims[2]]],
                                 stringsAsFactors = FALSE))
  if (!is.null(view$node_labels)) {
    lab <- view$node_labels[out$nodes$code]
    out$nodes$label <- ifelse(is.na(lab), out$nodes$code, lab)
  }

  # Directed (ONA): column "A & B" is the edge A → B, drawn with its wide end
  # on B. Self-connections ("A & A") are drawn inside the node, so they are
  # checked separately from the edges.
  out$directed <- inherits(set, "ena.ordered.set")
  net <- .qec_network(set, view$network, group_col)
  if (!is.null(net)) {
    e <- .qec_split_pairs(names(net))
    e$w <- unname(net)
    # Neither renderer draws a zero-weight edge (or one below the threshold).
    thr <- if (is.null(view$network$threshold)) 1e-6 else max(1e-6, view$network$threshold[1])
    e <- e[abs(e$w) >= thr, , drop = FALSE]
    self <- e$a == e$b
    if (out$directed && any(self))
      out$self <- data.frame(code = e$a[self], w = e$w[self], stringsAsFactors = FALSE)
    out$edges <- e[!self, , drop = FALSE]
  }

  env <- list2env(list(set = set), parent = globalenv())
  summarise <- function(g, sub) {
    cx <- stats::t.test(sub[[1]])$conf.int
    cy <- stats::t.test(sub[[2]])$conf.int
    fence <- function(v) { q <- stats::quantile(v, c(.25, .75), names = FALSE)
                           c(q[1] - 1.5 * diff(q), q[2] + 1.5 * diff(q)) }
    fx <- fence(sub[[1]]); fy <- fence(sub[[2]])
    data.frame(group = g, x = mean(sub[[1]]), y = mean(sub[[2]]),
               x_lo = cx[1], x_hi = cx[2], y_lo = cy[1], y_hi = cy[2],
               o_x_lo = fx[1], o_x_hi = fx[2], o_y_lo = fy[1], o_y_hi = fy[2],
               stringsAsFactors = FALSE)
  }
  out$means <- do.call(rbind, c(
    lapply(view$means, function(g) summarise(g, pts[pts[[group_col]] == g, dims, drop = FALSE])),
    lapply(view$mean_sets, function(ms) {
      sub <- as.data.frame(eval(parse(text = ms$expr), envir = env))
      summarise(ms$label, sub[, dims, drop = FALSE])
    })))

  out$ci <- .qec_ci(view) != "none"
  if (identical(view$range, "points")) out$range <- 1.2 * max(abs(as.matrix(pts[, dims])))
  if (identical(view$range, "network")) out$range <- 1.2 * max(abs(as.matrix(nodes[, dims])))
  if (!is.null(view$font)) out$font <- view$font
  if (!is.null(view$font)) out$title <- view$title
  if (!is.null(view$group_colors)) out$mean_colors <- as.list(view$group_colors[view$means])
  out$outlier <- isTRUE(view$outlier)

  if (!is.null(ps <- view$point_set)) {
    rows <- if (!is.null(ps$units)) {
      ids <- eval(parse(text = ps$units), envir = env)
      pts[match(ids, pts$ENA_UNIT), , drop = FALSE]
    } else as.data.frame(eval(parse(text = ps$expr), envir = env))
    out$points <- data.frame(id = as.character(rows$ENA_UNIT),
                             x = rows[[dims[1]]], y = rows[[dims[2]]], stringsAsFactors = FALSE)
  }

  if (isTRUE(view$points)) {
    out$points <- data.frame(id = as.character(pts$ENA_UNIT),
                             group = as.character(pts[[group_col]]),
                             x = pts[[dims[1]]], y = pts[[dims[2]]],
                             stringsAsFactors = FALSE)
  }
  out
}

# ── Plot code ─────────────────────────────────────────────────────────────────
#
# Each renderer's plot is built from R code *text* generated from the view spec.
# That exact text is eval()'d to make the plot and shown verbatim in the report,
# so the code on the page is guaranteed to be the code that ran.

.qec_q   <- function(x) deparse(x)
.qec_sym <- function(x) if (make.names(x) == x) x else paste0("`", x, "`")

# rENA: ena.plot.network / ena.plot.group / ena.plot.points directly. The pipe
# API (add_network, add_group, add_points) delegates to these same functions,
# but add_group() collapses to colMeans() first and so can never draw a CI.
qec_code_rena <- function(view, group_col, colors) {
  gc  <- .qec_sym(group_col)
  rows_of <- function(frame, g) sprintf("as.matrix(set$%s[%s == %s])%s", frame, gc, .qec_q(g),
                                       if (frame == "points") dsub else "")
  L   <- sprintf("p <- ena.plot(set, title = %s%s%s)", .qec_q(view$title),
                 if (!is.null(view$font)) sprintf(", font.size = %s, font.family = %s",
                                                   view$font$size, .qec_q(view$font$family)) else "",
                 if (!is.null(view$range)) sprintf(", scale.to = %s", .qec_q(view$range)) else "")
  dsub <- if (is.null(view$dims)) "" else sprintf("[, %s]", paste(deparse(view$dims), collapse = ""))

  if (!is.null(net <- view$network) && !is.null(net$weights)) {
    nc <- .qec_net_colors(net, colors)
    L <- c(L, "p <- ena.plot.network(p,",
           sprintf("  network = colMeans(%s)%s,", net$weights,
                   if (is.null(net$compare)) "" else sprintf(" -\n            colMeans(%s)", net$compare)),
           if (!is.null(net$threshold)) sprintf("  threshold = c(%s),", paste(net$threshold, collapse = ", ")),
           sprintf("  colors  = %s)", if (length(nc) == 1) .qec_q(nc)
                   else sprintf("c(%s)", paste(vapply(nc, .qec_q, ""), collapse = ", "))))
  } else if (!is.null(net <- view$network)) {
    a <- sprintf("colMeans(%s)", rows_of("line.weights", net$group))
    node_args <- c(
      if (!is.null(view$node_positions)) sprintf("  node.positions = %s,", view$node_positions),
      if (!is.null(view$dims)) sprintf("  node.positions = set$rotation$nodes[, %s],",
                                       paste(deparse(c("code", view$dims)), collapse = "")),
      if (!is.null(view$node_label_vec))
        sprintf("  labels = %s,", paste(deparse(unname(view$node_label_vec), width.cutoff = 500L), collapse = "")))
    if (is.null(net$compare)) {
      L <- c(L, "p <- ena.plot.network(p,",
             sprintf("  network = %s,", a), node_args,
             sprintf("  colors  = %s)", .qec_q(colors[[net$group]])))
    } else {
      L <- c(L, "p <- ena.plot.network(p,",
             sprintf("  network = %s -", a),
             sprintf("            colMeans(%s),", rows_of("line.weights", net$compare)), node_args,
             sprintf("  colors  = c(%s, %s))", .qec_q(colors[[net$group]]),
                     .qec_q(colors[[net$compare]])))
    }
  }

  if (isTRUE(view$points)) {
    for (g in names(colors))
      L <- c(L, sprintf("p <- ena.plot.points(p, points = %s, colors = %s)",
                        rows_of("points", g), .qec_q(colors[[g]])))
  }

  if (!is.null(ps <- view$point_set)) {
    src <- if (!is.null(ps$units)) sprintf("set$points[ENA_UNIT %%in%% %s]", ps$units) else ps$expr
    L <- c(L, sprintf("p <- ena.plot.points(p, points = as.matrix(%s),", src),
           sprintf("  colors = %s%s)", .qec_q(ps$color),
                   if (identical(ps$shape, "triangle")) ', shape = "triangle-up"'
                   else if (!is.null(ps$shape)) sprintf(", shape = %s", .qec_q(ps$shape)) else ""))
  }
  ci <- .qec_ci(view)
  oi <- if (isTRUE(view$outlier)) ', outlier.interval = "box"' else ""
  for (g in view$means) {
    L <- c(L, sprintf("p <- ena.plot.group(p, %s,", rows_of("points", g)),
           sprintf("  labels = %s, colors = %s, confidence.interval = %s%s)",
                   .qec_q(g), .qec_q(colors[[g]]), .qec_q(ci), oi))
  }
  for (ms in view$mean_sets) {
    L <- c(L, sprintf("p <- ena.plot.group(p, as.matrix(%s),", ms$expr),
           sprintf("  labels = %s, colors = %s, confidence.interval = %s%s)",
                   .qec_q(ms$label), .qec_q(ms$color), .qec_q(ci), oi))
  }
  paste(c(L, "p$plot"), collapse = "\n")
}

# ona: plot() |> edges() |> nodes(). Weights are passed explicitly because
# ona's defaults read x$line.weights$ENA_DIRECTION$response, which models from
# the current accumulate() no longer carry. scale_edges_from is the model-wide
# max — what ona's default intends — so plots of one model share a scale.
qec_code_ona <- function(view, group_col, colors) {
  gc  <- .qec_sym(group_col)
  net <- view$network
  mean_of <- function(g) sprintf("colMeans(as.matrix(set$line.weights[%s == %s]))", gc, .qec_q(g))
  nc   <- .qec_net_colors(net, colors)
  cols <- if (length(nc) == 1) .qec_q(nc)
          else sprintf("c(%s)", paste(vapply(nc, .qec_q, ""), collapse = ", "))
  L <- if (!is.null(net$weights))
         c(sprintf("w <- colMeans(%s)%s", net$weights,
                   if (is.null(net$compare)) "" else sprintf(" -\n     colMeans(%s)", net$compare)))
       else if (is.null(net$compare)) sprintf("w <- %s", mean_of(net$group))
       else c(sprintf("w <- %s -", mean_of(net$group)), sprintf("     %s", mean_of(net$compare)))
  L <- c(L,
    sprintf("p <- plot(set, title = %s) |>", .qec_q(view$title)),
    sprintf("  edges(weights = w, edge_color = %s,", cols),
    "        scale_edges_from = c(0, max(abs(as.matrix(set$line.weights))))) |>",
    sprintf("  nodes(weights = w, self_connection_color = %s)", cols),
    "p")
  paste(L, collapse = "\n")
}

QEC_REFERENCES <- list(
  rena = list(
    label = "rENA", tag = "plotly",
    code  = function(view, group_col, colors) qec_code_rena(view, group_col, colors),
    widget = function(p) p$plot,
    extract = function(p, view, colors, set) qec_extract_rena(p, view, colors)
  ),
  ona = list(
    label = "ona", tag = "plotly",
    code  = function(view, group_col, colors) qec_code_ona(view, group_col, colors),
    # What print.enaplot() does: ona keeps its drawing in attributes, and the
    # "enaplot" class must go or htmlwidgets looks for an "enaplot" JS binding.
    widget = function(p) {
      class(p) <- c("plotly", "htmlwidget")
      plotly::layout(p = p, shapes = attr(p, "shapes"), annotations = attr(p, "annotations"))
    },
    extract = function(p, view, colors, set) qec_extract_ona(p, view, colors, set)
  )
)

# rENA's ena.plot.network(labels =) takes one label per node, in node order.
.qec_node_labels <- function(set, map) {
  codes <- as.character(as.data.frame(set$rotation$nodes)$code)
  ifelse(codes %in% names(map), map[codes], codes)
}

qec_render_ref <- function(ref, set, view, group_col, colors) {
  # rENA takes node labels as a full vector in node order: spell it out.
  if (!is.null(view$node_labels)) view$node_label_vec <- .qec_node_labels(set, view$node_labels)
  code <- ref$code(view, group_col, colors)
  env  <- list2env(list(set = set), parent = globalenv())
  eval(parse(text = code), envir = env)
  list(plot = env$p, code = code)
}

.qec_hex_rgb <- function(col) as.numeric(grDevices::col2rgb(col))

.qec_hue <- function(col) {
  if (is.null(col) || !nzchar(col)) return(NA_real_)
  rgb <- if (grepl("^rgba?\\(", col)) {
    as.numeric(strsplit(gsub("rgba?\\(|\\)", "", col), ",")[[1]][1:3])
  } else .qec_hex_rgb(col)
  grDevices::rgb2hsv(rgb[1], rgb[2], rgb[3])[1, 1]
}

.qec_hue_dist <- function(h1, h2) { d <- abs(h1 - h2); min(d, 1 - d) }

qec_extract_rena <- function(p, view, colors) {
  bx    <- plotly::plotly_build(p$plot)$x
  tr    <- bx$data
  mult  <- p$get("multiplier")
  num   <- function(v) suppressWarnings(as.numeric(unlist(v)))
  txt   <- function(t) as.character(unlist(t$text %||% character(0)))
  out   <- list()

  # Nodes: the one trace whose text labels are the code names.
  node_tr <- Filter(function(t) length(t$x) > 1 && length(txt(t)) == length(t$x) &&
                      !identical(t$mode, "lines"), tr)
  if (length(node_tr)) {
    t <- node_tr[[1]]
    shown <- txt(t)
    inv <- if (is.null(view$node_labels)) NULL else stats::setNames(names(view$node_labels), view$node_labels)
    code <- ifelse(shown %in% names(inv), inv[shown], shown)
    out$nodes <- data.frame(code = unname(code), x = num(t$x), y = num(t$y),
                            d = num(t$marker$size), label = shown, stringsAsFactors = FALSE)
    out$font <- list(size = t$textfont$size %||% NA, family = t$textfont$family %||% NA)
  }
  xr <- unlist(bx$layout$xaxis$range)
  if (length(xr)) out$range <- max(abs(as.numeric(xr)))
  ttl <- bx$layout$title
  out$title <- if (is.list(ttl)) ttl$text %||% NA else ttl %||% NA

  # Edges: 2-point line traces whose endpoints sit on nodes.
  # Default ena.plot.network (scale.weights = FALSE): width = |w| * multiplier.
  if (!is.null(view$network) && !is.null(out$nodes)) {
    nc    <- .qec_net_colors(view$network, colors)
    hue_a <- .qec_hue(nc[1])
    hue_b <- if (length(nc) > 1) .qec_hue(nc[2])
    at_node <- function(x, y) {
      d <- abs(out$nodes$x - x) + abs(out$nodes$y - y)
      if (min(d) < 1e-9) out$nodes$code[which.min(d)] else NA_character_
    }
    rows <- lapply(tr, function(t) {
      if (!identical(t$mode, "lines") || length(t$x) != 2 || is.null(t$line$width) ||
          !(t$line$width > 0)) return(NULL)
      x <- num(t$x); y <- num(t$y)
      a <- at_node(x[1], y[1]); b <- at_node(x[2], y[2])
      if (is.na(a) || is.na(b)) return(NULL)
      sign <- 1
      if (!is.null(hue_b)) {
        h <- .qec_hue(t$line$color)
        sign <- if (.qec_hue_dist(h, hue_a) <= .qec_hue_dist(h, hue_b)) 1 else -1
      }
      data.frame(a = a, b = b, w = sign * t$line$width / mult,
                 width = t$line$width, stringsAsFactors = FALSE)
    })
    out$edges <- do.call(rbind, rows)
  }

  # Means: single-point trace named after the group; the CI box is the
  # 5-point "Conf. Int." line trace that immediately follows it.
  labels <- c(view$means, vapply(view$mean_sets, `[[`, "", "label"))
  means <- lapply(labels, function(g) {
    i <- which(vapply(tr, function(t) identical(t$name, g) && length(t$x) == 1, logical(1)))
    if (!length(i)) return(NULL)
    i <- i[length(i)]
    mx <- num(tr[[i]]$x); my <- num(tr[[i]]$y)
    row <- data.frame(group = g, x = mx, y = my,
                      color = as.character(unlist(tr[[i]]$marker$color)[1] %||% NA),
                      x_lo = NA_real_, x_hi = NA_real_, y_lo = NA_real_, y_hi = NA_real_,
                      o_x_lo = NA_real_, o_x_hi = NA_real_, o_y_lo = NA_real_, o_y_hi = NA_real_,
                      stringsAsFactors = FALSE)
    box <- function(t) { bx <- num(t$x); by <- num(t$y); c(min(bx), max(bx), min(by), max(by)) }
    for (k in (i + 1):min(i + 2, length(tr))) {
      if (k > length(tr)) break
      if (identical(tr[[k]]$name, "Conf. Int."))    row[c("x_lo", "x_hi", "y_lo", "y_hi")] <- box(tr[[k]])
      if (identical(tr[[k]]$name, "Outlier Int.")) row[c("o_x_lo", "o_x_hi", "o_y_lo", "o_y_hi")] <- box(tr[[k]])
    }
    # Crosshairs: plotly error bars on the mean trace (symmetric `array`).
    ex <- num(tr[[i]]$error_x$array); ey <- num(tr[[i]]$error_y$array)
    if (.qec_ci(view) == "crosshairs" && length(ex) && length(ey)) {
      row[c("x_lo", "x_hi", "y_lo", "y_hi")] <- c(mx - ex[1], mx + ex[1], my - ey[1], my + ey[1])
    }
    row
  })
  out$means <- do.call(rbind, means)

  # Unit points: unnamed single-marker traces (ena.plot.points draws one per unit).
  if (isTRUE(view$points) || !is.null(view$point_set)) {
    pt <- Filter(function(t) length(t$x) == 1 && !nzchar(t$name %||% "") &&
                   is.numeric(unlist(t$x)) && !identical(t$mode, "lines"), tr)
    out$points <- data.frame(x = vapply(pt, function(t) num(t$x), 0),
                             y = vapply(pt, function(t) num(t$y), 0))
  }
  out
}

# ona shapes are in model units: node circles (x0..x1), a white + coloured
# inner circle for the self-connection, and one tapered path per directed edge
# ("M apex L base1 C … base2 Z") whose wide end (base1–base2) sits on a node.
qec_extract_ona <- function(p, view, colors, set) {
  shapes <- plotly::plotly_build(QEC_REFERENCES$ona$widget(p))$x$layout$shapes
  dims  <- .qec_dims(set)
  rn    <- as.data.frame(set$rotation$nodes)
  nodes <- data.frame(code = as.character(rn$code), x = rn[[dims[1]]], y = rn[[dims[2]]],
                      stringsAsFactors = FALSE)
  nearest <- function(x, y) { d <- hypot(nodes$x - x, nodes$y - y); c(i = which.min(d), d = min(d)) }
  hypot <- function(a, b) sqrt(a^2 + b^2)
  type <- vapply(shapes, function(s) s$type %||% "", "")

  # Circles, grouped by centre: the largest is the node, a non-white smaller
  # one is the self-connection.
  circ <- do.call(rbind, lapply(shapes[type == "circle"], function(s) data.frame(
    x = (s$x0 + s$x1) / 2, y = (s$y0 + s$y1) / 2, d = s$x1 - s$x0,
    fill = toupper(s$fillcolor %||% ""), stringsAsFactors = FALSE)))
  out <- list()
  if (!is.null(circ)) {
    circ$code <- nodes$code[vapply(seq_len(nrow(circ)), function(i) nearest(circ$x[i], circ$y[i])[["i"]], 0)]
    node_rows <- do.call(rbind, lapply(split(circ, circ$code), function(g) g[which.max(g$d), ]))
    out$nodes <- data.frame(code = node_rows$code, x = node_rows$x, y = node_rows$y, d = node_rows$d,
                            stringsAsFactors = FALSE)
    self <- do.call(rbind, lapply(split(circ, circ$code), function(g) {
      g <- g[g$d < max(g$d) & !startsWith(g$fill, "#FFFFFF"), , drop = FALSE]
      if (nrow(g)) data.frame(code = g$code[1], d = g$d[1], stringsAsFactors = FALSE)
    }))
    if (!is.null(self)) out$self <- self
  }

  # Directed edges: wide end → the node it sits on (b); the apex points back
  # toward the other node (a). Width is ona's base width, weight × multiplier(1).
  nc    <- .qec_net_colors(view$network, colors)
  hue_a <- .qec_hue(nc[1])
  hue_b <- if (length(nc) > 1) .qec_hue(nc[2])
  rows <- lapply(shapes[type == "path"], function(s) {
    n <- as.numeric(regmatches(s$path, gregexpr("-?[0-9.]+(e[-+]?[0-9]+)?", s$path))[[1]])
    if (length(n) < 10) return(NULL)
    apex <- n[1:2]; b1 <- n[3:4]; b2 <- n[length(n) - 1:0]   # "... x2 y2 Z"
    width <- hypot(b1[1] - b2[1], b1[2] - b2[2])
    bi <- nearest((b1[1] + b2[1]) / 2, (b1[2] + b2[2]) / 2)[["i"]]
    dir <- apex - c(nodes$x[bi], nodes$y[bi])
    cosv <- vapply(seq_len(nrow(nodes)), function(j) {
      if (j == bi) return(-Inf)
      v <- c(nodes$x[j], nodes$y[j]) - c(nodes$x[bi], nodes$y[bi])
      sum(v * dir) / (hypot(v[1], v[2]) * hypot(dir[1], dir[2]))
    }, 0)
    sign <- 1; known <- TRUE
    if (!is.null(hue_b)) {
      rgb <- grDevices::col2rgb(s$fillcolor); hsv <- grDevices::rgb2hsv(rgb)
      known <- hsv[2, 1] > 0.004            # a colourless (white) edge has no hue
      h <- hsv[1, 1]
      sign <- if (.qec_hue_dist(h, hue_a) <= .qec_hue_dist(h, hue_b)) 1 else -1
    }
    data.frame(a = nodes$code[which.max(cosv)], b = nodes$code[bi],
               w = sign * width, width = width, sign_known = known, stringsAsFactors = FALSE)
  })
  out$edges <- do.call(rbind, rows)
  out
}

# ── Adapter: what qe_extract() hands to qeviz ─────────────────────────────────

qec_extract_adapter <- function(model, view) {
  rows <- function(f) do.call(rbind, lapply(f$data, as.data.frame, stringsAsFactors = FALSE))
  nodes <- rows(model$nodes)
  pts   <- rows(model$points)
  edges <- rows(model$edges)
  grps  <- rows(model$groups)
  gcol  <- model$group_col
  xc    <- model$x_col; yc <- model$y_col

  out <- list(nodes = data.frame(code = nodes$code, x = nodes[[xc]], y = nodes[[yc]],
                                 label = if (is.null(nodes$label)) nodes$code
                                         else ifelse(is.na(nodes$label), nodes$code, nodes$label),
                                 stringsAsFactors = FALSE))
  if (!is.null(view$network)) {
    ecols <- names(edges)[vapply(edges, is.numeric, logical(1))]
    if (!is.null(view$network$weights)) {
      # Explicit layer: the row qe_edges(weights =) wrote to the networks frame.
      nrow1 <- model$networks$data[[1]]
      net <- vapply(ecols, function(k) as.numeric(nrow1[[k]] %||% NA_real_), 0)
    } else {
      wmean <- function(g) colMeans(as.matrix(edges[edges[[gcol]] == g, ecols, drop = FALSE]))
      net <- wmean(view$network$group)
      if (!is.null(view$network$compare)) net <- net - wmean(view$network$compare)
    }
    out$edges <- data.frame(col = ecols, w = unname(net), stringsAsFactors = FALSE)
  }
  labels <- c(view$means, vapply(view$mean_sets, `[[`, "", "label"))
  g <- grps[grps[[gcol]] %in% labels, , drop = FALSE]
  b <- function(col, side) { v <- g[[paste0(col, ".", side)]]; if (is.null(v)) rep(NA_real_, nrow(g)) else v }
  out$means <- data.frame(group = g[[gcol]], x = g[[xc]], y = g[[yc]],
                          x_lo = b(xc, "low"), x_hi = b(xc, "high"),
                          y_lo = b(yc, "low"), y_hi = b(yc, "high"),
                          o_x_lo = b(xc, "olow"), o_x_hi = b(xc, "ohigh"),
                          o_y_lo = b(yc, "olow"), o_y_hi = b(yc, "ohigh"),
                          stringsAsFactors = FALSE)
  # The groups frame always carries bounds; whether to draw them is the
  # renderer's decision, so there is nothing to check here when intervals are off.
  if (.qec_ci(view) == "none") out$means[, c("x_lo", "x_hi", "y_lo", "y_hi")] <- NA_real_
  if (!is.null(view$point_set)) {
    ps <- rows(model$pointsets)
    out$points <- data.frame(id = ps$id, x = ps[[xc]], y = ps[[yc]], stringsAsFactors = FALSE)
  } else if (isTRUE(view$points))
    out$points <- data.frame(id = pts[[model$id_col]], x = pts[[xc]], y = pts[[yc]],
                             stringsAsFactors = FALSE)
  out
}

# ── Checks (mirrored in report.js for the in-browser qeviz side) ──────────────

.qec_row <- function(check, delta, tol, detail = "", level = "fail") {
  status <- if (is.na(delta)) "FAIL" else if (delta <= tol) "PASS"
            else if (level == "warn") "WARN" else "FAIL"
  data.frame(check = check, max_delta = delta, tol = tol, status = status,
             detail = detail, stringsAsFactors = FALSE)
}

.qec_pair_key <- function(a, b) ifelse(a <= b, paste(a, b, sep = "|"), paste(b, a, sep = "|"))

qec_check <- function(truth, got, tol = 1e-5, edge_key = c("pair", "col")) {
  edge_key <- match.arg(edge_key)
  res <- list()

  tn <- truth$nodes; gn <- got$nodes
  if (!isTRUE(truth$nodes_drawn) && edge_key == "pair") {
    n <- if (is.null(gn)) 0L else nrow(gn)
    res$nodes <- .qec_row("no code nodes without a network", n, 0, sprintf("%d drawn", n))
  } else if (is.null(gn)) {
    res$nodes <- .qec_row("node positions", NA, tol, "nodes not drawn")
  } else {
    m <- match(tn$code, gn$code)
    d <- if (anyNA(m)) NA else max(abs(tn$x - gn$x[m]), abs(tn$y - gn$y[m]))
    res$nodes <- .qec_row("node positions", d, tol,
                          if (anyNA(m)) paste("missing:", paste(tn$code[is.na(m)], collapse = ", ")) else "")
    if (!is.null(tn$label) && !anyNA(m)) {
      got_lab <- if (is.null(gn$label)) gn$code[m] else gn$label[m]
      wrong <- sum(tn$label != got_lab)
      res$labels <- .qec_row("node label text", wrong, 0,
                             sprintf("%d of %d labels differ", wrong, nrow(tn)))
    }
  }

  if (!is.null(truth$edges)) {
    te <- truth$edges
    if (is.null(got$edges) || !nrow(got$edges)) {
      res$edges <- .qec_row("edge weights (signed)", NA, tol, "no edges found")
    } else if (edge_key == "col") {
      # Adapter: columns are "A.B"; compare on the full vector incl. zeros.
      tk <- paste(te$a, te$b, sep = "."); m <- match(tk, got$edges$col)
      d <- if (anyNA(m)) NA else max(abs(te$w - got$edges$w[m]))
      res$edges <- .qec_row("edge weights (signed)", d, tol,
                            if (anyNA(m)) sprintf("%d edge columns missing", sum(is.na(m))) else "")
    } else {
      ge <- got$edges
      # Directed: match source → target (the wide end), not the unordered pair.
      key <- if (isTRUE(truth$directed)) function(a, b) paste(a, b, sep = " -> ") else .qec_pair_key
      tk <- key(te$a, te$b); gk <- key(ge$a, ge$b)
      m  <- match(tk, gk)
      extra <- setdiff(gk, tk)
      known <- if (is.null(ge$sign_known)) rep(TRUE, nrow(ge)) else ge$sign_known
      diffs <- if (anyNA(m)) NA else
        ifelse(known[m], te$w - ge$w[m], abs(te$w) - abs(ge$w[m]))
      d  <- if (anyNA(m)) NA else max(abs(diffs))
      det <- c(if (anyNA(m)) sprintf("%d missing", sum(is.na(m))),
               if (length(extra)) sprintf("%d unexpected", length(extra)),
               if (!anyNA(m) && !all(known[m])) sprintf("%d colourless (|w| only)", sum(!known[m])))
      res$edges <- .qec_row(if (isTRUE(truth$directed)) "directed edge weights (signed)"
                            else "edge weights (signed)", d, tol, paste(det, collapse = "; "))
      if (!anyNA(m) && any(te$w < 0)) {
        k <- known[m]
        flips <- sum(sign(te$w[k]) != sign(ge$w[m][k]))
        res$sign <- .qec_row("subtraction edge colour/sign", flips, 0,
                             sprintf("%d of %d edges on the wrong side", flips, sum(k)))
      }
      if (!anyNA(m) && !is.null(ge$width)) {
        # Visual encoding: width should be proportional to |w|.
        rel_t <- abs(te$w) / max(abs(te$w)); rel_g <- ge$width[m] / max(ge$width[m])
        res$width <- .qec_row("edge width ∝ |weight|", max(abs(rel_t - rel_g)), 0.02,
                              "relative widths (encoding, not data)", level = "warn")
      }
      if (!anyNA(m) && !is.null(ge$width) && !is.null(gn$d) && isTRUE(truth$directed)) {
        # Directed: diameter ∝ Σ |w| of edges directed AT the node + its
        # self-connection, at the plot's own width-per-weight (k).
        self_w <- function(cd) { i <- match(cd, truth$self$code); if (is.na(i)) 0 else abs(truth$self$w[i]) }
        win <- vapply(gn$code, function(cd) sum(abs(ge$w[ge$b == cd])) + self_w(cd), 0)
        k   <- stats::median(ge$width / abs(ge$w))
        conn <- win > 0
        ratio <- gn$d[conn] / (k * win[conn])
        res$node_size <- .qec_row("node diameter = Σ incoming edge widths + self",
                                  max(abs(ratio - 1)), 1e-3,
                                  sprintf("diameter ÷ (incoming + self) = %.3f – %.3f", min(ratio), max(ratio)),
                                  level = "warn")
      } else if (!anyNA(m) && !is.null(ge$width) && !is.null(gn$d)) {
        # Node diameter = Σ drawn widths of its edges. rENA instead rescales
        # Σ|w| per plot onto marker sizes 3–10, so this is a WARN there.
        sw <- vapply(gn$code, function(cd) sum(ge$width[ge$a == cd | ge$b == cd]), 0)
        conn <- sw > 0
        d <- max(abs(gn$d[conn] - sw[conn])) / max(sw)
        ratio <- range(gn$d[conn] / sw[conn])
        res$node_size <- .qec_row("node diameter = Σ edge widths", d, 1e-6,
                                  sprintf("diameter ÷ Σ widths = %.2f – %.2f", ratio[1], ratio[2]),
                                  level = "warn")
      }
    }
  }

  if (!is.null(truth$self) && !is.null(got$self) && nrow(got$self)) {
    # Self-connection glyph should grow with the self weight alone.
    m <- match(got$self$code, truth$self$code)
    r <- got$self$d / abs(truth$self$w[m])
    res$self <- .qec_row("self-connection size ∝ self weight",
                         max(abs(r / stats::median(r) - 1)), 0.02,
                         sprintf("size ÷ weight varies %.2f – %.2f × median",
                                 min(r) / stats::median(r), max(r) / stats::median(r)),
                         level = "warn")
  }

  if (!is.null(truth$means)) {
    tm <- truth$means; gm <- got$means
    m <- if (is.null(gm)) rep(NA, nrow(tm)) else match(tm$group, gm$group)
    d <- if (anyNA(m)) NA else max(abs(tm$x - gm$x[m]), abs(tm$y - gm$y[m]))
    res$means <- .qec_row("group mean positions", d, tol,
                          if (anyNA(m)) "group mean missing" else "")
    if (!anyNA(m)) {
      b <- c("x_lo", "x_hi", "y_lo", "y_hi")
      if (isFALSE(truth$ci)) {
        drawn <- sum(stats::complete.cases(gm[m, b, drop = FALSE]))
        res$ci <- .qec_row("no CI box when intervals off", drawn, 0,
                           sprintf("%d box(es) drawn", drawn))
      } else {
        d <- max(abs(as.matrix(tm[, b]) - as.matrix(gm[m, b])))
        res$ci <- .qec_row("95% CI bounds", d, tol,
                           if (is.na(d)) "CI not drawn" else "")
      }
      if (isTRUE(truth$outlier)) {
        ob <- c("o_x_lo", "o_x_hi", "o_y_lo", "o_y_hi")
        d <- if (is.null(gm$o_x_lo)) NA else max(abs(as.matrix(tm[, ob]) - as.matrix(gm[m, ob])))
        res$outlier <- .qec_row("outlier interval (Q1 − 1.5·IQR … Q3 + 1.5·IQR)", d, tol,
                                if (is.na(d)) "outlier interval not drawn" else "")
      }
    }
  }

  # Plot-level checks apply only to renderers (the adapter has no axes/title/fonts).
  if (!is.null(truth$range) && !is.null(got$range)) {
    d <- if (is.null(got$range)) NA else abs(got$range - truth$range) / truth$range
    res$range <- .qec_row("axis range (±)", d, 1e-6,
                          sprintf("expected ±%.4f, drawn ±%.4f", truth$range, got$range %||% NA),
                          level = "warn")
  }
  if (!is.null(truth$title) && !is.null(got$title)) {
    ok <- identical(as.character(got$title), as.character(truth$title))
    res$title <- .qec_row("title text", if (ok) 0 else 1, 0, as.character(got$title %||% "none"))
  }
  if (!is.null(truth$font) && !is.null(got$font)) {
    fs <- suppressWarnings(as.numeric(got$font$size)[1])
    res$font_size <- .qec_row("label font size (px)", abs(fs - truth$font$size), 0.5,
                              sprintf("expected %s px, drawn %s", truth$font$size, fs))
    res$font_family <- .qec_row("label font family",
                                if (identical(got$font$family, truth$font$family)) 0 else 1, 0,
                                as.character(got$font$family %||% "none"))
  }
  if (!is.null(truth$mean_colors) && !is.null(got$means$color)) {
    exp <- toupper(unlist(truth$mean_colors)); m <- match(names(truth$mean_colors), got$means$group)
    wrong <- sum(is.na(m) | toupper(got$means$color[m]) != exp)
    res$mean_colors <- .qec_row("group mean colours", wrong, 0,
                                sprintf("%d of %d differ", wrong, length(exp)))
  }

  if (!is.null(truth$points)) {
    tp <- truth$points; gp <- got$points
    if (is.null(gp) || !nrow(gp)) {
      res$points <- .qec_row("unit point positions", NA, tol, "no points found")
    } else {
      if (!is.null(gp$id)) {
        m <- match(tp$id, gp$id)
        d <- if (anyNA(m)) NA else max(abs(tp$x - gp$x[m]), abs(tp$y - gp$y[m]))
      } else {
        # rENA traces carry no unit id: nearest-neighbour match.
        d <- max(vapply(seq_len(nrow(tp)), function(i)
          min(pmax(abs(gp$x - tp$x[i]), abs(gp$y - tp$y[i]))), 0))
      }
      res$points <- .qec_row("unit point positions", d, tol,
                             sprintf("%d expected, %d drawn", nrow(tp), nrow(gp)))
      if (nrow(tp) != nrow(gp)) res$points$status <- "FAIL"
    }
  }
  do.call(rbind, res)
}

# ── qeviz: build the panel HTML for a view ────────────────────────────────────

qec_code_qe <- function(view, group_col) {
  L <- sprintf("qe_plot(set, title = %s, height = 460, group_col = %s,\n        scale_points = FALSE%s%s) |>",
               .qec_q(view$title), .qec_q(group_col),
               if (!is.null(view$dims)) sprintf(", dims = %s", paste(deparse(view$dims), collapse = "")) else "",
               if (!is.null(view$range)) sprintf(", range = %s", .qec_q(view$range)) else "")
  if (!is.null(view$group_colors))
    L <- c(L, sprintf("  qe_colors(%s) |>", paste(sprintf("%s = %s", names(view$group_colors),
                                                          vapply(view$group_colors, .qec_q, "")),
                                                  collapse = ", ")))
  ci <- .qec_ci(view)
  extra <- c(if (ci != "box") sprintf("intervals = %s", .qec_q(ci)),
             if (isTRUE(view$outlier)) "outlier = TRUE")
  if (length(view$means)) {
    L <- c(L, sprintf("  qe_group(%s) |>", paste(c(vapply(view$means, .qec_q, ""), extra), collapse = ", ")))
  }
  for (ms in view$mean_sets) {
    L <- c(L, sprintf("  qe_group(points = %s,\n           label = %s, color = %s%s) |>",
                      ms$expr, .qec_q(ms$label), .qec_q(ms$color),
                      if (length(extra)) paste0(", ", paste(extra, collapse = ", ")) else ""))
  }
  if (!is.null(ps <- view$point_set)) {
    L <- c(L, sprintf("  qe_points(%s,\n            color = %s%s, name = %s) |>",
                      if (!is.null(ps$units)) sprintf("units = %s", ps$units) else sprintf("points = %s", ps$expr),
                      .qec_q(ps$color), if (!is.null(ps$shape)) sprintf(", shape = %s", .qec_q(ps$shape)) else "",
                      .qec_q(ps$name)))
  }
  net <- view$network
  arg <- function(k, v) if (is.null(v)) NULL else sprintf("%s = %s", k, v)
  L <- c(L, if (is.null(net)) "  qe_edges(show = FALSE) |>"
            else if (!is.null(net$weights)) sprintf("  qe_edges(%s) |>", paste(c(
              arg("weights", net$weights), arg("compare", net$compare),
              arg("colors", if (is.null(net$colors)) NULL else if (length(net$colors) == 1) .qec_q(net$colors)
                            else sprintf("c(%s)", paste(vapply(net$colors, .qec_q, ""), collapse = ", "))),
              arg("threshold", net$threshold), arg("name", if (is.null(net$name)) NULL else .qec_q(net$name))),
              collapse = ",\n           "))
            else if (is.null(net$compare)) sprintf("  qe_edges(group = %s) |>", .qec_q(net$group))
            else sprintf("  qe_edges(group = %s, compare = %s) |>", .qec_q(net$group), .qec_q(net$compare)))
  if (isTRUE(view$points)) L <- c(L, "  qe_points() |>")
  if (!is.null(view$node_positions) || !is.null(view$node_labels)) {
    L <- c(L, sprintf("  qe_nodes(%s) |>", paste(c(
      if (!is.null(view$node_positions)) sprintf("positions = %s", view$node_positions),
      if (!is.null(view$node_labels)) sprintf("labels = %s", paste(deparse(view$node_labels), collapse = ""))),
      collapse = ",\n           ")))
  }
  lab <- if (is.null(view$font)) '  qe_labels(nodes = "on")'
         else sprintf('  qe_labels(nodes = "on", font_size = %s, font_family = %s)',
                      view$font$size, .qec_q(view$font$family))
  paste(c(L, "  qe_axes() |>", lab), collapse = "\n")
}

# qeviz is drawn with qe_plot(scale_points = FALSE) (in the code shown) so unit
# points and means are not rescaled to the node extent, matching the reference.
QEC_QE_NOTE <- NULL

qec_render_qe <- function(set, view, group_col, probe_js) {
  code <- qec_code_qe(view, group_col)
  env  <- list2env(list(set = set), parent = globalenv())
  p    <- eval(parse(text = code), envir = env)

  html <- qeviz::qe_html(p)
  # The R wrapper always emits <qe-means>; drop it when the view shows no
  # means, so both panels draw the same layers.
  if (!length(view$means) && !length(view$mean_sets)) {
    g0 <- regexpr("<qe-graph ", html, fixed = TRUE)
    rest <- substring(html, g0)
    m0 <- regexpr("<qe-means[^>]*></qe-means>\n?", rest)
    if (m0 > 0) html <- paste0(substr(html, 1, g0 + m0 - 2),
                               substring(rest, m0 + attr(m0, "match.length")))
  }
  probe <- sprintf("<script>window.__QEC_VIEW__ = %s;</script>\n<script>%s</script>\n</body>",
                   jsonlite::toJSON(view$name, auto_unbox = TRUE), probe_js)
  list(html = .qec_fill(html, "</body>", probe), model = p$model, code = code)
}

# Literal first-occurrence replacement. sub(fixed = TRUE) still interprets
# backslashes in the replacement, which would mangle JSON / JS escapes.
.qec_fill <- function(x, marker, value) {
  i <- regexpr(marker, x, fixed = TRUE)
  if (i < 0) stop("marker not found: ", marker)
  paste0(substr(x, 1, i - 1), value, substr(x, i + nchar(marker), nchar(x)))
}

# ── Driver ────────────────────────────────────────────────────────────────────

qec_compare <- function(set, views = NULL, out_dir = file.path(.QEC_DIR, "out"),
                        group_col = "Condition", tol = 1e-5,
                        label = "ENA model", setup_code = NULL,
                        reference = c("rena", "ona")) {
  reference <- match.arg(reference)
  ref <- QEC_REFERENCES[[reference]]
  dir.create(file.path(out_dir, "panels"), recursive = TRUE, showWarnings = FALSE)
  colors <- qec_group_colors(set, group_col)
  if (is.null(views)) views <- if (reference == "ona") qec_default_views_ona(names(colors))
                               else qec_default_views(names(colors))
  probe_js <- paste(readLines(file.path(.QEC_DIR, "qe_probe.js"), warn = FALSE), collapse = "\n")

  results <- lapply(views, function(v) {
    message("• ", v$name, ": ", v$title)
    truth <- qec_truth(set, v, group_col)

    vcol <- if (is.null(v$group_colors)) colors else utils::modifyList(as.list(colors), as.list(v$group_colors))
    vcol <- unlist(vcol)
    rp <- qec_render_ref(ref, set, v, group_col, vcol)
    htmlwidgets::saveWidget(ref$widget(rp$plot), normalizePath(file.path(out_dir, "panels",
                            paste0("ref_", v$name, ".html")), mustWork = FALSE),
                            selfcontained = FALSE, libdir = "lib", title = v$title)
    rena <- ref$extract(rp$plot, v, vcol, set)

    qe <- qec_render_qe(set, v, group_col, probe_js)
    writeLines(qe$html, file.path(out_dir, "panels", paste0("qe_", v$name, ".html")))
    adapter <- qec_extract_adapter(qe$model, v)

    # Thickness per unit weight; must match across views for plots of one
    # model to be comparable (checked across views in report.js).
    rena_k <- if (!is.null(rena$edges) && nrow(rena$edges))
      sum(rena$edges$width) / sum(abs(rena$edges$w)) else NULL

    list(view = v, truth = truth, colors = vcol, code = list(rena = rp$code, qe = qe$code), rena_k = rena_k,
         checks = list(rena = qec_check(truth, rena, tol),
                       adapter = qec_check(truth, adapter, tol, edge_key = "col")))
  })

  ref_pkg <- if (reference == "ona") "ona" else "rENA"
  payload <- list(
    label = label, tol = tol, colors = as.list(colors),
    reference = list(label = ref$label, tag = ref$tag),
    setup_code = setup_code, qe_note = QEC_QE_NOTE,
    generated = format(Sys.time(), "%Y-%m-%d %H:%M"),
    versions = list(ref = as.character(utils::packageVersion(ref_pkg)),
                    qeviz = as.character(utils::packageVersion("qeviz"))),
    views = lapply(results, function(r) list(
      name = r$view$name, title = r$view$title,
      network = if (is.null(r$view$network)) NULL
                else c(r$view$network, list(colors = as.list(.qec_net_colors(r$view$network, r$colors)))),
      code = r$code, truth = r$truth, rena_k = r$rena_k,
      rena = r$checks$rena, adapter = r$checks$adapter))
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, digits = NA,
                           dataframe = "rows", null = "null", na = "null")
  tpl  <- paste(readLines(file.path(.QEC_DIR, "report.html"), warn = FALSE), collapse = "\n")
  js   <- paste(readLines(file.path(.QEC_DIR, "report.js"), warn = FALSE), collapse = "\n")
  html <- .qec_fill(tpl, "/*__QEC_DATA__*/", paste0("window.QEC = ", json, ";"))
  html <- .qec_fill(html, "/*__QEC_JS__*/", js)
  out  <- file.path(out_dir, "index.html")
  writeLines(html, out)

  # Console summary (the qeviz-render column is only available in the browser).
  summary <- do.call(rbind, lapply(results, function(r) {
    rbind(cbind(view = r$view$name, renderer = ref$label, r$checks$rena),
          cbind(view = r$view$name, renderer = "adapter", r$checks$adapter))
  }))
  old <- options(width = max(getOption("width"), 160)); on.exit(options(old), add = TRUE)
  print(summary[, c("view", "renderer", "check", "status", "max_delta")], row.names = FALSE)
  message("\nReport: ", normalizePath(out),
          "\n(qeviz render checks run in the browser when the report loads.)")
  invisible(summary)
}
