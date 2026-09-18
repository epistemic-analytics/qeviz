#!/usr/bin/env Rscript
# Parity reference generator for the qeviz trajectory port.
#
# Reproduces the fit-relevant behaviour of ena.plot.trajectory() (ETM Explorer
# RS kit) using only base R (lm / poly / hatvalues / predict) on a fixed,
# self-contained fixture of trajectory points that includes near-origin
# cumulative-start states. Writes both the input fixture and the reference
# outputs (selected degree, LOOCV criterion vector, sampled curve) so the JS
# checker fits the *same* points. No rENA/ona/plotly required.

suppressWarnings(suppressMessages(library(jsonlite)))

ZERO_EPS  <- 1e-8
MAX_DEG   <- 3L
N_SAMPLES <- 101L   # matches sampleCurve(fit, steps = 100) -> 101 points

# ── Fixture: units whose true shape spans degree 1..3, each starting at the ──
# cumulative origin (which the near-origin filter must drop before fitting).
make_unit <- function(seed, n, fx, fy) {
  set.seed(seed)
  s <- seq(0, 1, length.out = n)
  x <- fx(s) + rnorm(n, 0, 0.01)
  y <- fy(s) + rnorm(n, 0, 0.01)
  # Prepend an exact origin state (RowID 0) as ENA cumulative windows do.
  list(x = c(0, x), y = c(0, y))
}

fixture <- list(
  linear    = make_unit(1, 10, function(s)  0.6 * s - 0.3, function(s)  0.4 * s - 0.2),
  quadratic = make_unit(2, 12, function(s)  1.2 * (s - 0.5)^2 - 0.2, function(s) 0.5 * s),
  cubic     = make_unit(3, 14, function(s)  0.8 * sin(3 * s),        function(s) 0.7 * s - 0.35)
)

# ── Source-faithful loocv_2d fit (base R) ─────────────────────────────────────
fit_trajectory <- function(x, y, max_degree = MAX_DEG) {
  keep <- abs(x) > ZERO_EPS | abs(y) > ZERO_EPS
  x <- x[keep]; y <- y[keep]
  n <- length(x)
  stopifnot(n >= 3)

  t <- seq(0, 1, length.out = n)
  deg_cap <- min(as.integer(max_degree), max(1L, n - 1L))

  criterion <- vapply(seq_len(deg_cap), function(deg) {
    fx <- lm(x ~ poly(t, deg))
    fy <- lm(y ~ poly(t, deg))
    h  <- hatvalues(fx)               # identical design => identical for fy
    sum((residuals(fx) / (1 - h))^2) + sum((residuals(fy) / (1 - h))^2)
  }, numeric(1))

  best <- which.min(criterion)

  fx <- lm(x ~ poly(t, best))
  fy <- lm(y ~ poly(t, best))
  t_out <- seq(0, 1, length.out = N_SAMPLES)
  x_out <- as.numeric(predict(fx, newdata = data.frame(t = t_out)))
  y_out <- as.numeric(predict(fy, newdata = data.frame(t = t_out)))

  list(
    degree    = best,
    criterion = criterion,
    curve_x   = x_out,
    curve_y   = y_out
  )
}

records <- lapply(names(fixture), function(name) {
  u <- fixture[[name]]
  ref <- fit_trajectory(u$x, u$y)
  list(
    unit       = name,
    max_degree = MAX_DEG,
    points     = lapply(seq_along(u$x), function(i) list(x = u$x[i], y = u$y[i])),
    degree     = ref$degree,
    criterion  = ref$criterion,
    curve_x    = ref$curve_x,
    curve_y    = ref$curve_y
  )
})

out_path <- file.path(dirname(sub("--file=", "",
  grep("--file=", commandArgs(FALSE), value = TRUE)[1])), "reference.json")
if (is.na(out_path) || out_path == "reference.json")
  out_path <- "tools/parity/reference.json"

writeLines(toJSON(list(zero_eps = ZERO_EPS, samples = N_SAMPLES, units = records),
                  auto_unbox = TRUE, digits = 15, pretty = TRUE), out_path)
cat("wrote", out_path, "with", length(records), "units\n")
