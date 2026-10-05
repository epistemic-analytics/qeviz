"""
QEViz — Julia adapter for the qeviz visualization library.

Converts DataFrames to the qeviz ModelData format and provides
a chainable plot object for Jupyter / Pluto display and standalone
HTML export.

# Quick start

```julia
using QEViz

# From a pre-built ModelData dict
p = qe_plot(model_dict)
p                                            # auto-display in Jupyter/Pluto
p |> (x -> qe_group(x, "FirstGame")) |> (x -> qe_points(x))

# From DataFrames
p = model_data(nodes_df, edges_df, points_df; group_col="Condition") |> qe_plot
qe_export_html(p, "output.html")

# Introspect available groups / units
qe_groups(p)   # ["FirstGame", "SecondGame"]
qe_units(p)    # ["FirstGame::alice", ...]
```

# Chain API

All chain functions accept a `QEPlot` as first argument, modify a copy,
and return the copy — safe to use with `|>` or sequential assignment.

- `qe_group(p, names...; intervals=true)` — which group means to show
- `qe_edges(p; group, unit, compare, also, show)` — which edge network to draw
- `qe_points(p; show=true)` — show/hide unit scatter dots
- `qe_trajectories(p; units, smooth, ...)` — show supplied trajectory paths
- `qe_labels(p; nodes, means, points)` — label visibility modes
"""
module QEViz

using JSON3
using Printf
using Statistics
using DataFrames

export QEPlot,
       qe_plot,
       qe_group, qe_edges, qe_points, qe_trajectories, qe_axes, qe_labels, qe_nodes,
       qe_colors, qe_range, qe_palette,
       qe_groups, qe_units, qe_trajectory_units,
       qe_export_html, qe_html, qe_fragment,
       model_data


# The chain functions below follow the R package (R/R/render.R) line for line:
# the same option names, the same validation and the same <qe-graph> markup, so
# a plot built in Julia matches one built in R (tests/golden/).

# ── QEPlot struct ───────────────────────────────────────────────────────────────

"""
    QEPlot

A lazily-rendered qeviz plot.

Created by [`qe_plot`](@ref). Build the view with [`qe_edges`](@ref),
[`qe_points`](@ref), [`qe_group`](@ref), [`qe_nodes`](@ref),
[`qe_labels`](@ref) and friends; they mirror the R package's `qe_*()`
functions. All chain functions return a *new* `QEPlot` — the original is not
mutated, and functions that add data copy the model frames they change.

Display options:
- Return the object from a Jupyter / Pluto cell — the `text/html` MIME
  hook renders the plot inline.
- Call [`qe_export_html`](@ref) to write a self-contained `.html` file.
"""
mutable struct QEPlot
    model::Dict{String,Any}
    title::String
    width::String
    height::String
    opts::Dict{String,Any}
end

# Options are deep-copied; the model dict is copied shallowly — frames are
# replaced, never edited in place, so copies stay independent.
_copy(p::QEPlot)::QEPlot = QEPlot(copy(p.model), p.title, p.width, p.height, deepcopy(p.opts))

# Set an option; `nothing` removes it (as assigning NULL does in R).
_set!(p::QEPlot, key::String, value) = isnothing(value) ? delete!(p.opts, key) : (p.opts[key] = value)

struct _Unset end
const _UNSET = _Unset()       # "argument not supplied" (qe_labels() semantics)

const _PALETTE = ["#4477AA", "#EE6677", "#228833", "#CCBB44",
                  "#66CCEE", "#AA3377", "#BBBBBB", "#000000"]

"""
    qe_palette() -> Vector{String}

The default qeviz colour palette (Paul Tol "bright"), as R's `qe_palette()`.
"""
qe_palette() = copy(_PALETTE)


# ── Constructor ─────────────────────────────────────────────────────────────────

function _check_range(range, fn::String)
    range isa Union{Tuple,AbstractVector,AbstractDict} &&
        error("$(fn)(): only symmetric ranges are supported: \"network\", \"points\" or a number.")
    isnothing(range) || range in ("network", "points") ||
        (range isa Real && !(range isa Bool) && isfinite(range) && range > 0) ||
        error("$(fn)(): range must be \"network\", \"points\" or a positive number.")
    nothing
end

"""
    qe_plot(model; title=nothing, width=700, height=500, range=nothing,
            scale_points=true, point_scale=nothing, center="origin", palette=nothing)

Create a [`QEPlot`](@ref) from a ModelData `Dict` (R's `qe_plot()`).

`title` is drawn above the plot when given, and is the window / file title
(default `"qeviz"`). `width` / `height` are pixels (integers) or CSS strings.
`range` sets the symmetric axis range (`"network"`, `"points"` or a number);
`scale_points=false` draws points and means at raw coordinates, `point_scale`
sets an explicit factor; `center="content"` centres the view on the nodes and
points; `palette` replaces the default colours.

# Examples

```julia
p = qe_plot(model_dict)
p = qe_plot(model_dict; title="My ENA", width="100%", height=480, range="points")
```
"""
function qe_plot(model::Dict{String,Any};
                 title::Union{AbstractString,Nothing} = nothing,
                 width::Union{Int,AbstractString}  = 700,
                 height::Union{Int,AbstractString} = 500,
                 range = nothing,
                 scale_points::Bool = true,
                 point_scale::Union{Real,Nothing} = nothing,
                 center::AbstractString = "origin",
                 palette::Union{AbstractVector,Nothing} = nothing)::QEPlot
    center in ("origin", "content") || error("qe_plot(): center must be \"origin\" or \"content\".")
    isnothing(point_scale) || (isfinite(point_scale) && point_scale > 0) ||
        error("qe_plot(): point_scale must be a positive number.")
    _check_range(range, "qe_plot")
    isnothing(palette) || !isempty(palette) || error("qe_plot(): palette must be a vector of colours.")
    w = width  isa AbstractString ? String(width)  : "$(width)px"
    h = height isa AbstractString ? String(height) : "$(height)px"
    m = copy(model)
    isnothing(palette) || (m["palette"] = String[string(c) for c in palette])
    p = QEPlot(m, isnothing(title) ? "qeviz" : String(title), w, h, Dict{String,Any}())
    isnothing(title) || (p.opts["plot-title"] = String(title))
    isnothing(range) || (p.opts["range"] = range)
    scale_points || (p.opts["scale-points"] = "false")
    center == "content" && (p.opts["center"] = "content")
    isnothing(point_scale) || (p.opts["point-scale"] = point_scale)
    p
end


# ── Introspection ───────────────────────────────────────────────────────────────

_group_key(model) = something(get(model, "group_col", nothing), "group")

"""
    qe_groups(p::QEPlot) -> Vector{String}

Return the group names in the model's groups frame (named and explicit means).
"""
function qe_groups(p::QEPlot)::Vector{String}
    frame = get(p.model, "groups", nothing)
    isnothing(frame) && return String[]
    key = _group_key(p.model)
    result = String[]
    for row in get(frame, "data", [])
        val = get(row, key, nothing)
        if isnothing(val) && !isempty(row)
            val = first(values(row))
        end
        isnothing(val) || push!(result, string(val))
    end
    result
end

"""
    qe_units(p::QEPlot) -> Vector{String}

Return the unit IDs present in the model's points frame.
"""
function qe_units(p::QEPlot)::Vector{String}
    frame = get(p.model, "points", nothing)
    isnothing(frame) && return String[]
    id_col = something(get(p.model, "id_col", nothing), "QEUNIT")
    String[string(row[id_col]) for row in get(frame, "data", []) if haskey(row, id_col)]
end

"""
    qe_trajectory_units(p::QEPlot) -> Vector{String}

Return unit IDs present in the model's trajectories frame. Falls back to
the points frame because qeviz can use point rows as trajectory states.
"""
function qe_trajectory_units(p::QEPlot)::Vector{String}
    frame = get(p.model, "trajectories", get(p.model, "points", nothing))
    isnothing(frame) && return String[]
    id_col = something(get(p.model, "id_col", nothing), "QEUNIT")
    result = String[]
    for row in get(frame, "data", [])
        if haskey(row, id_col)
            val = string(row[id_col])
            val in result || push!(result, val)
        end
    end
    result
end


# ── Frame helpers ───────────────────────────────────────────────────────────────

_is_na(v) = isnothing(v) || ismissing(v) || (v isa AbstractFloat && !isfinite(v))
_native(v) = _is_na(v) ? nothing : v isa AbstractString ? String(v) : v

# R's qe_frame() column type, inferred from the non-missing values.
function _value_type(vals)::String
    vs = [v for v in vals if !_is_na(v)]
    isempty(vs) && return "logical"
    all(v -> v isa Bool, vs) && return "logical"
    all(v -> v isa Integer && !(v isa Bool), vs) && return "integer"
    all(v -> v isa Real && !(v isa Bool), vs) && return "numeric"
    "character"
end

_frame_rows(frame) = isnothing(frame) ? Dict{String,Any}[] :
    Dict{String,Any}[Dict{String,Any}(r) for r in get(frame, "data", [])]

function _frame_from_rows(rows::Vector{Dict{String,Any}}, cols::Vector{String} = String[])
    if isempty(cols)
        for r in rows, k in keys(r)
            k in cols || push!(cols, k)
        end
    end
    data = Dict{String,Any}[Dict{String,Any}(k => _native(get(r, k, nothing)) for k in cols) for r in rows]
    types = Dict{String,Any}(k => _value_type([r[k] for r in data]) for k in cols)
    Dict{String,Any}("data" => data, "types" => types)
end

# R's .qe_upsert_rows(): replace rows sharing `key` (or matching `drop`),
# append `rows`, pad missing columns.
function _upsert_rows(frame, rows::Vector{Dict{String,Any}}; key = nothing, drop = nothing)
    old = _frame_rows(frame)
    if !isempty(old)
        if !isnothing(drop)
            old = filter(r -> !drop(r), old)
        else
            new_keys = Set(get(r, key, nothing) for r in rows)
            old = filter(r -> get(r, key, nothing) ∉ new_keys, old)
        end
    end
    cols = isempty(old) ? String[] : String[k for k in keys(frame["types"])]
    for r in rows, k in keys(r)
        k in cols || push!(cols, k)
    end
    _frame_from_rows(vcat(old, rows), cols)
end

# Attribute values formatted as R's as.character() does.
function _fmt(v)::String
    v isa Bool && return v ? "TRUE" : "FALSE"
    v isa AbstractFloat && return isinteger(v) ? string(Int(v)) : @sprintf("%.15g", v)
    string(v)
end
_esc(v) = replace(_fmt(v), "&" => "&amp;", "<" => "&lt;", "\"" => "&quot;")


# ── Student t quantile (exact; no Distributions.jl) ─────────────────────────────

const _LANCZOS = (0.99999999999980993, 676.5203681218851, -1259.1392167224028,
                  771.32342877765313, -176.61502916214059, 12.507343278686905,
                  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7)

function _lgamma(x::Float64)::Float64
    x < 0.5 && return log(pi / abs(sin(pi * x))) - _lgamma(1.0 - x)
    x -= 1.0
    a = _LANCZOS[1]
    t = x + 7.5
    for i in 1:8
        a += _LANCZOS[i + 1] / (x + i)
    end
    0.5 * log(2pi) + (x + 0.5) * log(t) - t + log(a)
end

function _betacf(a, b, x)
    tiny, eps = 1e-300, 1e-16
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (abs(d) > tiny ? d : tiny)
    h = d
    for m in 1:1000
        m2 = 2m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d; d = 1.0 / (abs(d) > tiny ? d : tiny)
        c = 1.0 + aa / c; c = abs(c) > tiny ? c : tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d; d = 1.0 / (abs(d) > tiny ? d : tiny)
        c = 1.0 + aa / c; c = abs(c) > tiny ? c : tiny
        delta = d * c
        h *= delta
        abs(delta - 1.0) < eps && break
    end
    h
end

function _betainc(a, b, x)
    x <= 0 && return 0.0
    x >= 1 && return 1.0
    lbt = _lgamma(a + b) - _lgamma(a) - _lgamma(b) + a * log(x) + b * log1p(-x)
    x < (a + 1) / (a + b + 2) ? exp(lbt) * _betacf(a, b, x) / a :
                                1.0 - exp(lbt) * _betacf(b, a, 1 - x) / b
end

function _t_cdf(t, df)
    tail = 0.5 * _betainc(df / 2, 0.5, df / (df + t * t))
    t > 0 ? 1.0 - tail : tail
end

"""Quantile of Student's t, as R's `qt(p, df)`."""
function _t_quantile(p::Real, df::Integer)::Float64
    0 < p < 1 || throw(ArgumentError("_t_quantile(): p must be in (0, 1)."))
    p == 0.5 && return 0.0
    p < 0.5 && return -_t_quantile(1 - p, df)
    lo, hi = 0.0, 1.0
    while _t_cdf(hi, df) < p
        hi *= 2
    end
    for _ in 1:200                       # bisection to machine precision
        mid = (lo + hi) / 2
        _t_cdf(mid, df) < p ? (lo = mid) : (hi = mid)
        hi - lo <= 1e-15 * max(1.0, hi) && break
    end
    (lo + hi) / 2
end

# R's group_summary(): per sorted group, mean, t CI and (optionally) the
# outlier interval Q1 − 1.5·IQR … Q3 + 1.5·IQR.
function _group_summary(rows, x_col::String, y_col::String, group_col::String;
                        conf_level::Real = 0.95, outlier::Bool = false)
    groups = sort(unique(String[string(r[group_col]) for r in rows if !_is_na(get(r, group_col, nothing))]))
    out = Dict{String,Any}[]
    for g in groups
        sub = [r for r in rows if string(get(r, group_col, "")) == g]
        n = length(sub)
        t_v = _t_quantile((1 + conf_level) / 2, max(1, n - 1))
        row = Dict{String,Any}(group_col => g)
        vals = Dict{String,Vector{Float64}}()
        for d in (x_col, y_col)
            v = Float64[Float64(r[d]) for r in sub if !_is_na(get(r, d, nothing))]
            vals[d] = v
            m = mean(v)
            se = (length(v) > 1 ? std(v; corrected = true) : NaN) / sqrt(n)
            row[d] = m
            row[d * ".low"] = m - t_v * se
            row[d * ".high"] = m + t_v * se
        end
        if outlier
            for d in (x_col, y_col)
                q1, q3 = quantile(vals[d], 0.25), quantile(vals[d], 0.75)
                row[d * ".olow"] = q1 - 1.5 * (q3 - q1)
                row[d * ".ohigh"] = q3 + 1.5 * (q3 - q1)
            end
        end
        push!(out, row)
    end
    out
end

const _SHAPES = Dict("circle" => "circle", "square" => "rect", "rect" => "rect",
                     "triangle" => "triangle", "triangle-up" => "triangle", "diamond" => "diamond")

function _shape(shape, fn::String)
    vals = shape isa AbstractString ? [shape] : collect(shape)
    all(s -> haskey(_SHAPES, s), vals) ||
        error("$(fn)(): shape must be \"circle\", \"square\", \"triangle\" or \"diamond\".")
    shape isa AbstractString ? _SHAPES[shape] : [_SHAPES[s] for s in vals]
end

_norm_name(n) = replace(string(n), " & " => ".")

function _edge_columns(model)::Vector{String}
    idc = something(get(model, "node_id_col", nothing), "code")
    codes = [string(r[idc]) for r in model["nodes"]["data"]]
    pairs = Set(a * "." * b for a in codes for b in codes)
    String[c for c in _ordered_keys(model["edges"]) if c in pairs]
end

# Column order of a frame: an explicit "_order" entry when present (frames
# built by _qe_frame record it), else the types' key order.
_ordered_keys(frame) = haskey(frame, "_order") ? frame["_order"] : collect(keys(frame["types"]))

function _numeric_cols(df::DataFrame)
    String[c for c in names(df) if nonmissingtype(eltype(df[!, c])) <: Real]
end

# Weights as Dict(edge column => value) over every model edge column.
function _resolve_weights(x, cols::Vector{String}, arg::String)::Dict{String,Float64}
    named = if x isa AbstractDict
        Dict{String,Float64}(_norm_name(k) => Float64(v) for (k, v) in x)
    elseif x isa DataFrame
        nc = _numeric_cols(x)
        Dict{String,Float64}(_norm_name(c) => mean(Float64.(x[!, c])) for c in nc)
    elseif x isa AbstractMatrix
        size(x, 2) == length(cols) ||
            error("qe_edges(): unnamed `$(arg)` has $(size(x, 2)) columns; the model has $(length(cols)) edge columns.")
        Dict{String,Float64}(cols[j] => mean(Float64.(x[:, j])) for j in eachindex(cols))
    else
        v = Float64.(collect(x))
        length(v) == length(cols) ||
            error("qe_edges(): unnamed `$(arg)` has $(length(v)) values; the model has $(length(cols)) edge columns.")
        Dict{String,Float64}(zip(cols, v))
    end
    unknown = [k for k in keys(named) if k ∉ cols]
    isempty(unknown) ||
        error("qe_edges(): `$(arg)` has edges not in the model: $(join(first(unknown, 3), ", "))\n" *
              "Examples of valid names: $(join(first(cols, 3), ", "))")
    Dict{String,Float64}(c => get(named, c, 0.0) for c in cols)
end

function _group_network(model, group::String, cols::Vector{String})
    gcol = model["group_col"]
    rows = [r for r in model["edges"]["data"] if string(get(r, gcol, "")) == group]
    isempty(rows) && error("qe_edges(): compare = \"$(group)\" not found in model.")
    Dict{String,Float64}(c => mean(Float64[r[c] for r in rows]) for c in cols)
end

# R's .qe_point_frame(): id + the model's x / y (+ group) per row.
function _point_frame(model, x)::Vector{Dict{String,Any}}
    id_col, x_col, y_col = something(get(model, "id_col", nothing), "QEUNIT"), model["x_col"], model["y_col"]
    df = x isa DataFrame ? x : DataFrame(x, :auto)
    num = _numeric_cols(df)
    length(num) >= 2 || error("need at least two numeric (dimension) columns in `points`.")
    dims = (x_col in num && y_col in num) ? [x_col, y_col] : num[1:2]
    ids = id_col in names(df) ? string.(df[!, id_col]) : string.(1:nrow(df))
    gcol = get(model, "group_col", nothing)
    rows = Dict{String,Any}[]
    for i in 1:nrow(df)
        r = Dict{String,Any}(id_col => ids[i], x_col => Float64(df[i, dims[1]]),
                             y_col => Float64(df[i, dims[2]]))
        !isnothing(gcol) && gcol in names(df) && (r[gcol] = string(df[i, gcol]))
        push!(rows, r)
    end
    rows
end

function _update_groups_filter!(p::QEPlot)
    named = get(p.opts, "groups-named", nothing)
    expl = get(p.opts, "groups-explicit", String[])
    groups = if isempty(expl)
        isnothing(named) || isempty(named) ? nothing : join(named, ",")
    elseif isnothing(named)
        join(expl, ",")
    elseif isempty(named)
        nothing
    else
        join(vcat(named, expl), ",")
    end
    _set!(p, "groups", groups)
end

function _layer_attrs(colors, threshold)::Vector{Pair{String,Any}}
    out = Pair{String,Any}[]
    if !isnothing(colors)
        cols = colors isa AbstractString ? [colors] : collect(colors)
        (length(cols) in (1, 2) && all(c -> c isa AbstractString, cols)) ||
            error("qe_edges(): colors must be one or two colours.")
        push!(out, "colors" => join(cols, ","))
    end
    if !isnothing(threshold)
        thr = threshold isa Real ? [threshold] : collect(threshold)
        (length(thr) in (1, 2) && all(t -> t isa Real && isfinite(t) && t >= 0, thr)) ||
            error("qe_edges(): threshold must be (min, max) or min, non-negative.")
        push!(out, "threshold" => join([_fmt(Float64(t)) for t in thr], ","))
    end
    out
end

function _append_network(frame, name::String, w::Dict{String,Float64}, cols::Vector{String})
    row = Dict{String,Any}("name" => name)
    for (k, v) in w
        row[k] = v
    end
    if isnothing(frame)
        types = Dict{String,Any}("name" => "character")
        for c in cols
            types[c] = "numeric"
        end
        return Dict{String,Any}("data" => Dict{String,Any}[row], "types" => types)
    end
    data = Dict{String,Any}[r for r in frame["data"] if get(r, "name", nothing) != name]
    push!(data, row)
    Dict{String,Any}("data" => data, "types" => frame["types"])
end


# ── Chain functions ─────────────────────────────────────────────────────────────

"""
    qe_group(p, names...; points=nothing, label=nothing, color=nothing, shape=nothing,
             by=nothing, intervals="box", conf_level=0.95, outlier=false,
             fixed_size=false, show=true)

Group means: by name, or the mean of any subset of points (R's `qe_group()`).

Pass group names to show only those groups' means; omit names to show every
group. `points` (a DataFrame or matrix of positions) instead adds the mean of
that subset, with its own t interval, named `label` (default `"mean 1"`, …);
each such mean keeps its own `intervals` / `outlier`. `intervals` is `"box"`,
`"crosshairs"` or `"none"` (`true` / `false` mean `"box"` / `"none"`);
`outlier=true` also draws Q1 − 1.5·IQR … Q3 + 1.5·IQR. `show=false` hides all
means.

# Examples

```julia
qe_group(p)                                  # all groups
qe_group(p, "FirstGame"; intervals="crosshairs")
qe_group(p; points=subset_df, label="high", color="#CCBB44", outlier=true)
```
"""
function qe_group(p::QEPlot, names::AbstractString...;
                  points = nothing, label::Union{AbstractString,Nothing} = nothing,
                  color::Union{AbstractString,Nothing} = nothing,
                  shape::Union{AbstractString,Nothing} = nothing,
                  by::Union{AbstractString,Nothing} = nothing,
                  intervals::Union{AbstractString,Bool} = "box",
                  conf_level::Real = 0.95, outlier::Bool = false,
                  fixed_size::Bool = false, show::Bool = true)::QEPlot
    p = _copy(p)
    if !show
        p.opts["means-show"] = false
        return p
    end
    delete!(p.opts, "means-show")
    if !isnothing(by)
        gcol = get(p.model, "group_col", nothing)
        isnothing(gcol) || by == gcol ||
            error("qe_group(): by = \"$(by)\" does not match the model's group column (\"$(gcol)\").")
    end
    intervals isa Bool && (intervals = intervals ? "box" : "none")
    intervals in ("box", "crosshairs", "none") ||
        error("qe_group(): intervals must be \"box\", \"crosshairs\" or \"none\".")
    0 < conf_level < 1 || error("qe_group(): conf_level must be a number in (0, 1).")
    !isnothing(points) && !isempty(names) &&
        error("qe_group(): supply group names or `points`, not both.")

    p.opts["intervals"] = String(intervals)
    p.opts["confidence"] = intervals != "none"
    p.opts["mean-outlier"] = outlier || get(p.opts, "mean-outlier", false) === true
    p.opts["mean-fixed-size"] = fixed_size

    m = p.model
    if !isnothing(points)
        rows = _point_frame(m, points)
        expl = get(p.opts, "groups-explicit", String[])
        lbl = isnothing(label) ? "mean $(length(expl) + 1)" : String(label)
        lbl in qe_groups(p) && lbl ∉ expl &&
            error("qe_group(): label \"$(lbl)\" is already a group in the model.")
        gkey = _group_key(m)
        for r in rows
            r[gkey] = lbl
        end
        row = _group_summary(rows, m["x_col"], m["y_col"], gkey;
                             conf_level = conf_level, outlier = outlier)[1]
        isnothing(color) || (row["color"] = String(color))
        isnothing(shape) || (row["shape"] = _shape(shape, "qe_group"))
        row["intervals"] = String(intervals)
        row["outlier"] = outlier
        m["groups"] = _upsert_rows(get(m, "groups", nothing), [row]; key = gkey)
        p.opts["groups-explicit"] = lbl in expl ? expl : vcat(expl, lbl)
    else
        if !isempty(names)
            available = qe_groups(p)
            bad = [n for n in names if n ∉ available]
            isempty(bad) || error("qe_group(): group(s) not found in model: $(bad)\n" *
                                  "Available: $(available)")
        end
        p.opts["groups-named"] = String[String(n) for n in names]     # empty = all
        if (conf_level != 0.95 || outlier) && haskey(m, "points")
            rows = _group_summary(_frame_rows(m["points"]), m["x_col"], m["y_col"],
                                  m["group_col"]; conf_level = conf_level, outlier = outlier)
            m["groups"] = _upsert_rows(get(m, "groups", nothing), rows; key = m["group_col"])
        end
    end
    _update_groups_filter!(p)
    p
end

"""
    qe_edges(p; group=nothing, unit=nothing, weights=nothing, compare=nothing,
             also=nothing, colors=nothing, threshold=nothing, name=nothing,
             show=true, color_scale="model", edge_width=nothing, magnify=nothing)

Draw an edge network: a group's or unit's (by name), or explicit weights
(R's `qe_edges()`).

By name, `group` (a group's mean network) or `unit` (one unit's network),
with `compare` (subtract a second group) or `also` (overlay it); a second call
replaces it. `weights` instead draws a network from data — a `Dict` of edge
weights, an unnamed vector in the model's edge-column order, a DataFrame or
matrix (averaged over rows), or a `Vector` of those (one layer each) — and
`compare` then subtracts a group name or second weights. Every `weights` call
adds a layer; one with the same `name` replaces it. `colors` (one or two),
`threshold` (`min` or `(min, max)`: |w| < min not drawn, |w| > max drawn at
max) and `name` apply to the layer. `show=false` removes all networks.

# Examples

```julia
qe_edges(p; group="FirstGame", compare="SecondGame")
qe_edges(p; weights=w, colors=["#228833", "#AA3377"], threshold=(0.05, 0.3))
```
"""
function qe_edges(p::QEPlot;
                  group::Union{AbstractString,Nothing} = nothing,
                  unit::Union{AbstractString,Nothing} = nothing,
                  weights = nothing, compare = nothing,
                  also::Union{AbstractString,Nothing} = nothing,
                  colors = nothing, threshold = nothing,
                  name::Union{AbstractString,Nothing} = nothing,
                  show::Bool = true,
                  color_scale::AbstractString = "model",
                  edge_width::Union{Real,Nothing} = nothing,
                  magnify::Union{Real,Nothing} = nothing)::QEPlot
    !isnothing(group) && !isnothing(unit) &&
        error("qe_edges(): supply either `group` or `unit`, not both.")
    !isnothing(weights) && (!isnothing(group) || !isnothing(unit)) &&
        error("qe_edges(): supply `weights` or a `group` / `unit` name, not both.")
    p = _copy(p)
    if !show
        p.opts["edges"] = "false"
        for k in ("group", "unit", "compare", "also", "edge-named", "edge-layers")
            delete!(p.opts, k)
        end
        delete!(p.model, "networks")
        return p
    end
    color_scale in ("model", "plot", "absolute") ||
        error("qe_edges(): color_scale must be \"model\", \"plot\", or \"absolute\".")
    isnothing(edge_width) || 0 < edge_width <= 1 || error("qe_edges(): edge_width must be a number in (0, 1].")
    isnothing(magnify) || (isfinite(magnify) && magnify > 0) || error("qe_edges(): magnify must be a positive number.")
    layer_attrs = _layer_attrs(colors, threshold)

    p.opts["edges"] = true
    _set!(p, "edge-color-scale", color_scale == "model" ? nothing : String(color_scale))
    isnothing(edge_width) || (p.opts["edge-width"] = edge_width)
    isnothing(magnify) || (p.opts["edge-magnify"] = magnify)

    # ── Explicit data: append one layer per network ─────────────────────────
    if !isnothing(weights)
        isnothing(also) || error("qe_edges(): `also` takes group names; for data, pass a vector to `weights`.")
        cols = _edge_columns(p.model)
        many = weights isa AbstractVector && !isempty(weights) && !(first(weights) isa Real)
        nets = many ? collect(weights) : [weights]
        base = length(get(p.opts, "edge-layers", []))
        for (k, net) in enumerate(nets)
            w = _resolve_weights(net, cols, "weights")
            if !isnothing(compare)
                c = compare isa AbstractString ? _group_network(p.model, String(compare), cols) :
                                                 _resolve_weights(compare, cols, "compare")
                w = Dict{String,Float64}(e => w[e] - c[e] for e in cols)
            end
            lname = (!isnothing(name) && length(nets) == 1) ? String(name) : "network $(base + k)"
            p.model["networks"] = _append_network(get(p.model, "networks", nothing), lname, w, cols)
            layers = get(p.opts, "edge-layers", Vector{Vector{Pair{String,Any}}}())
            p.opts["edge-layers"] = vcat(layers, [vcat(Pair{String,Any}["network" => lname], layer_attrs)])
        end
        return p
    end

    # ── By name: replace the named network ──────────────────────────────────
    available_groups = qe_groups(p)
    function check_group(nm, arg)
        !isnothing(nm) && string(nm) ∉ available_groups &&
            error("qe_edges(): $(arg) = \"$(nm)\" not found in model.\n" *
                  "Available groups: $(available_groups)")
    end
    !isnothing(compare) && !(compare isa AbstractString) &&
        error("qe_edges(): `compare` as data needs `weights`; with `group` it takes a group name.")
    check_group(group, "group"); check_group(compare, "compare"); check_group(also, "also")
    !isnothing(unit) && string(unit) ∉ qe_units(p) &&
        error("qe_edges(): unit = \"$(unit)\" not found in model.\n" *
              "Use qe_units(p) to see available unit IDs.")
    !isnothing(compare) && !isnothing(also) &&
        error("qe_edges(): supply either `compare` or `also`, not both.")
    !isnothing(unit) && (!isnothing(compare) || !isnothing(also)) &&
        error("qe_edges(): `compare` and `also` cannot be combined with `unit`.")

    _set!(p, "group", isnothing(group) ? nothing : String(group))
    _set!(p, "unit", isnothing(unit) ? nothing : String(unit))
    _set!(p, "compare", isnothing(compare) ? nothing : String(compare))
    _set!(p, "also", isnothing(also) ? nothing : String(also))
    named = vcat(isnothing(name) ? Pair{String,Any}[] : Pair{String,Any}["name" => String(name)], layer_attrs)
    _set!(p, "edge-named", isempty(named) ? nothing : named)
    p
end

"""
    qe_points(p; show=true, units=nothing, points=nothing, color=nothing,
              shape=nothing, labels=nothing, name=nothing, size=nothing,
              fixed_size=false)

Unit points: all of them (coloured by group), or an explicit point set (R's
`qe_points()`).

With no `units` / `points`, shows every unit point. `units` (unit IDs) or
`points` (a DataFrame or matrix of positions) instead adds a point set with
optional `color`, `shape` (`"circle"`, `"square"`, `"triangle"`, `"diamond"`)
and `labels`, one value or one per point; one with the same `name` replaces
it. `show=false` hides all points. `size` overrides the dot size (default 2.5);
`fixed_size` keeps dots a constant on-screen size.
"""
function qe_points(p::QEPlot; show::Bool = true, units = nothing, points = nothing,
                   color = nothing, shape = nothing, labels = nothing,
                   name::Union{AbstractString,Nothing} = nothing,
                   size::Union{Real,Nothing} = nothing, fixed_size::Bool = false)::QEPlot
    p = _copy(p)
    if !show
        p.opts["points"] = false
        delete!(p.opts, "point-sets")
        delete!(p.model, "pointsets")
        return p
    end
    if isnothing(units) && isnothing(points)
        p.opts["points"] = true
        _set!(p, "point-size", size)
        p.opts["point-fixed-size"] = fixed_size
        return p
    end
    !isnothing(units) && !isnothing(points) && error("qe_points(): supply `units` or `points`, not both.")

    m = p.model
    id_col = something(get(m, "id_col", nothing), "QEUNIT")
    gcol = get(m, "group_col", nothing)
    rows = if !isnothing(units)
        us = units isa AbstractString ? [String(units)] : String[string(u) for u in units]
        all_rows = Dict(string(r[id_col]) => r for r in _frame_rows(get(m, "points", nothing)))
        bad = [u for u in us if !haskey(all_rows, u)]
        isempty(bad) || error("qe_points(): unit(s) not in model: $(first(bad, 3))")
        [all_rows[u] for u in us]
    else
        _point_frame(m, points)
    end
    n = length(rows)
    sets = get(p.opts, "point-sets", Dict{String,Any}[])
    set_name = isnothing(name) ? "points $(length(sets) + 1)" : String(name)
    per_point(v, arg) = begin
        isnothing(v) && return nothing
        vals = v isa AbstractString ? [v] : collect(v)
        length(vals) in (1, n) || error("qe_points(): `$(arg)` must have length 1 or $(n).")
        String[string(x) for x in (length(vals) == 1 ? fill(vals[1], n) : vals)]
    end
    cols = per_point(color, "color")
    shapes = per_point(isnothing(shape) ? nothing : _shape(shape, "qe_points"), "shape")
    labs = per_point(labels, "labels")
    new = Dict{String,Any}[]
    for (i, r) in enumerate(rows)
        row = Dict{String,Any}("set" => set_name, "id" => string(r[id_col]),
                               m["x_col"] => r[m["x_col"]], m["y_col"] => r[m["y_col"]])
        !isnothing(gcol) && haskey(r, gcol) && (row["group"] = string(r[gcol]))
        isnothing(cols) || (row["color"] = cols[i])
        isnothing(shapes) || (row["shape"] = shapes[i])
        isnothing(labs) || (row["label"] = labs[i])
        push!(new, row)
    end
    m["pointsets"] = _upsert_rows(get(m, "pointsets", nothing), new;
                                  drop = r -> get(r, "set", nothing) == set_name)
    p.opts["point-sets"] = vcat([s for s in sets if s["set"] != set_name],
                                [Dict{String,Any}("set" => set_name, "size" => size, "fixed" => fixed_size)])
    p
end

"""
    qe_nodes(p; show="auto", unconnected="dot", positions=nothing, labels=nothing)

Code nodes: when to draw them, and where (R's `qe_nodes()`). `"auto"`
(default) draws nodes only with an edge network, matching rENA; `"always"` /
`true` and `"never"` / `false` override that. `unconnected="hide"` hides nodes
with no drawn edges. `positions` (a DataFrame with a code column and x / y
columns) moves nodes; `labels` (a `Dict` code => text) relabels them.
"""
function qe_nodes(p::QEPlot; show::Union{Bool,AbstractString} = "auto",
                  unconnected::AbstractString = "dot",
                  positions::Union{DataFrame,Nothing} = nothing,
                  labels::Union{AbstractDict,Nothing} = nothing)::QEPlot
    s = show === true ? "always" : show === false ? "never" : String(show)
    s in ("auto", "always", "never") ||
        throw(ArgumentError("qe_nodes(): show must be \"auto\", \"always\", or \"never\"."))
    unconnected in ("dot", "hide") ||
        throw(ArgumentError("qe_nodes(): unconnected must be \"dot\" or \"hide\"."))
    p = _copy(p)
    p.opts["nodes-show"] = s
    _set!(p, "nodes-unconnected", unconnected == "hide" ? "hide" : nothing)
    if !isnothing(positions) || !isnothing(labels)
        m = p.model
        idc = something(get(m, "node_id_col", nothing), "code")
        rows = _frame_rows(m["nodes"])
        codes = [string(r[idc]) for r in rows]
        check(got, arg) = begin
            bad = [g for g in got if g ∉ codes]
            isempty(bad) || error("qe_nodes(): `$(arg)` has codes not in the model: $(first(bad, 3))\n" *
                                  "Model codes: $(first(codes, 4))")
        end
        cols = _ordered_keys(m["nodes"])
        if !isnothing(positions)
            pc = idc in names(positions) ? string.(positions[!, idc]) :
                 "code" in names(positions) ? string.(positions[!, "code"]) :
                 error("qe_nodes(): `positions` needs a code column.")
            num = _numeric_cols(positions)
            length(num) >= 2 || error("qe_nodes(): `positions` needs two numeric (x, y) columns.")
            dims = (m["x_col"] in num && m["y_col"] in num) ? [m["x_col"], m["y_col"]] : num[1:2]
            check(pc, "positions")
            for (i, code) in enumerate(pc)
                r = rows[findfirst(==(code), codes)]
                r[m["x_col"]] = Float64(positions[i, dims[1]])
                r[m["y_col"]] = Float64(positions[i, dims[2]])
            end
        end
        if !isnothing(labels)
            check([string(k) for k in keys(labels)], "labels")
            for r in rows
                haskey(r, "label") || (r["label"] = nothing)
            end
            for (code, text) in labels
                rows[findfirst(==(string(code)), codes)]["label"] = string(text)
            end
            "label" in cols || (cols = vcat(cols, "label"))
        end
        m["nodes"] = _frame_from_rows(rows, String[c for c in cols])
        m["nodes"]["_order"] = cols
    end
    p
end

"""
    qe_axes(p; x=false, y=false, show=true)

Show or hide the axes (a `<qe-axes>` layer). Axis labels are opt-in: `x` / `y`
default to `false` (no label); `true` uses the dimension name (e.g. `"SVD1"`),
a `String` sets custom text. `show=false` suppresses the axes entirely.
"""
function qe_axes(p::QEPlot; x::Union{Bool,AbstractString} = false,
                 y::Union{Bool,AbstractString} = false, show::Bool = true)::QEPlot
    p = _copy(p)
    if !show
        p.opts["axes"] = false
        return p
    end
    p.opts["axes"] = true
    p.opts["axis-x"] = x isa AbstractString ? String(x) : x
    p.opts["axis-y"] = y isa AbstractString ? String(y) : y
    p
end

"""
    qe_trajectories(p; units=nothing, smooth="none", max_degree=3, degree_selection="loocv_2d", ...)

Show or hide supplied ordered unit trajectory paths.

qeviz renders rows already present in the model; trajectory modeling,
accumulation, dooring, and inference remain caller-side work.

`max_degree` bounds the polynomial degree when `smooth="poly"`.
`degree_selection="loocv_2d"` (default) picks the degree in `1..max_degree` by
joint 2D leave-one-out cross-validation; `"fixed"` always uses `max_degree`.
Near-origin points are excluded from the fit (still drawn), matching
`ena.plot.trajectory()`.
"""
function qe_trajectories(p::QEPlot;
                         units::Union{AbstractString,Vector{<:AbstractString},Nothing} = nothing,
                         smooth::AbstractString = "none",
                         max_degree::Int = 3,
                         degree_selection::AbstractString = "loocv_2d",
                         points::Bool = true,
                         tips::Bool = true,
                         playhead::Union{Real,Nothing} = nothing,
                         line_style::AbstractString = "uniform",
                         stroke_width::Real = 2,
                         stroke_width_range::Tuple{<:Real,<:Real} = (1, 6),
                         opacity_range::Tuple{<:Real,<:Real} = (0.3, 1),
                         show::Bool = true)::QEPlot
    p = _copy(p)
    if !show
        p.opts["trajectories"] = false
        return p
    end
    smooth in ("none", "poly") || error("qe_trajectories(): smooth must be \"none\" or \"poly\".")
    degree_selection in ("loocv_2d", "fixed") ||
        error("qe_trajectories(): degree_selection must be \"loocv_2d\" or \"fixed\".")
    line_style in ("uniform", "tapered") ||
        error("qe_trajectories(): line_style must be \"uniform\" or \"tapered\".")
    selected = isnothing(units) ? nothing :
               units isa AbstractString ? [String(units)] : String[String(u) for u in units]
    if !isnothing(selected)
        available = qe_trajectory_units(p)
        bad = [u for u in selected if u ∉ available]
        isempty(bad) || error("qe_trajectories(): unit(s) not found in model: $(bad)\n" *
                              "Available: $(available)")
    end
    p.opts["trajectories"] = true
    _set!(p, "trajectory-units", isnothing(selected) ? nothing : join(selected, ","))
    p.opts["trajectory-smooth"] = String(smooth)
    p.opts["trajectory-max-degree"] = max_degree
    p.opts["trajectory-degree-selection"] = String(degree_selection)
    p.opts["trajectory-points"] = points
    p.opts["trajectory-tips"] = tips
    _set!(p, "trajectory-playhead", playhead)
    p.opts["trajectory-line-style"] = String(line_style)
    p.opts["trajectory-stroke-width"] = stroke_width
    p.opts["trajectory-stroke-width-range"] = join(_fmt.(stroke_width_range), ",")
    p.opts["trajectory-opacity-range"] = join(_fmt.(opacity_range), ",")
    p
end

"""
    qe_labels(p; nodes, means, points, font_size, font_family, font_color)

Label visibility and font (R's `qe_labels()`). `nodes` / `means` / `points`
take `"on"`, `"off"`, `"click"` or `"auto"`; `font_size` is in pixels (the
title is drawn at 1.35×); `font_family` and `font_color` apply to labels and
the title. Only the arguments supplied change; a bare `qe_labels(p)` applies
the defaults (`"on"`, `"on"`, `"auto"`).
"""
function qe_labels(p::QEPlot; nodes = _UNSET, means = _UNSET, points = _UNSET,
                   font_size = _UNSET, font_family = _UNSET, font_color = _UNSET)::QEPlot
    font_size isa _Unset || isnothing(font_size) || (font_size isa Real && font_size > 0) ||
        error("qe_labels(): font_size must be a positive number of pixels.")
    p = _copy(p)
    bare = all(v -> v isa _Unset, (nodes, means, points, font_size, font_family, font_color))
    for (key, val, default) in (("label-nodes", nodes, "on"), ("label-means", means, "on"),
                                ("label-points", points, "auto"))
        if !(val isa _Unset)
            _set!(p, key, isnothing(val) ? nothing : String(val))
        elseif bare
            p.opts[key] = default
        end
    end
    for (key, val) in (("label-font-size", font_size), ("label-font-family", font_family),
                       ("label-font-color", font_color))
        val isa _Unset || _set!(p, key, val isa AbstractString ? String(val) : val)
    end
    p
end

"""
    qe_colors(p, "Group" => "#hex", ...)

Pin groups to colours (R's `qe_colors()`): each group's mean, unit points and
networks use it; unlisted groups keep the palette colour.
"""
function qe_colors(p::QEPlot, colors::Pair...)::QEPlot
    isempty(colors) && error("qe_colors(): give group => colour pairs, e.g. qe_colors(p, \"FirstGame\" => \"#E69F00\").")
    cols = Dict(string(k) => string(v) for (k, v) in colors)
    bad = [g for g in keys(cols) if g ∉ qe_groups(p)]
    isempty(bad) || error("qe_colors(): group(s) not found in model: $(bad)")
    p = _copy(p)
    gcol = p.model["group_col"]
    rows = _frame_rows(p.model["groups"])
    for r in rows
        haskey(r, "color") || (r["color"] = nothing)
        g = string(get(r, gcol, ""))
        haskey(cols, g) && (r["color"] = cols[g])
    end
    names_ = String[k for k in keys(p.model["groups"]["types"])]
    "color" in names_ || push!(names_, "color")
    p.model["groups"] = _frame_from_rows(rows, names_)
    p
end

"""
    qe_range(p, range)

Set the symmetric axis range (R's `qe_range()`): `"network"` (node extent ×
1.2), `"points"` (unit points' extent × 1.2), a positive number, or `nothing`
for the default.
"""
function qe_range(p::QEPlot, range)::QEPlot
    _check_range(range, "qe_range")
    p = _copy(p)
    _set!(p, "range", range)
    p
end


# ── Internal: HTML rendering ─────────────────────────────────────────────────────

function _bundle_script_tag()::String
    bundle_path = joinpath(@__DIR__, "..", "assets", "qeviz.umd.js")
    if isfile(bundle_path)
        js = read(bundle_path, String)
        # Inlined, the relative source-map URL would resolve against the page.
        js = replace(js, r"\n//# sourceMappingURL=[^\n]*\s*$" => "\n")
        return "<script>" * js * "</script>"
    end
    "<script src=\"qeviz.umd.js\"></script>"
end

_attr_parts(a) = String["$(k)=\"$(_fmt(v))\"" for (k, v) in a]

# `<qe-graph …>…</qe-graph>` with child layer elements (R's
# .build_graph_element(), line for line).
function _build_graph_element(p::QEPlot)::String
    opts = p.opts
    o(k) = get(opts, k, nothing)
    children = String[]

    # <qe-means>: present unless qe_group(show = false).
    means_parts = String[]
    isnothing(o("groups")) || push!(means_parts, "groups=\"$(o("groups"))\"")
    o("confidence") === false || push!(means_parts, "confidence")
    !isnothing(o("intervals")) && o("intervals") != "box" && push!(means_parts, "intervals=\"$(o("intervals"))\"")
    o("mean-outlier") === true && push!(means_parts, "outlier")
    push!(means_parts, "label=\"$(something(o("label-means"), "on"))\"")
    o("mean-fixed-size") === true && push!(means_parts, "fixed-size")
    o("means-show") === false || push!(children, "    <qe-means $(join(means_parts, " "))></qe-means>")

    # <qe-points>: all unit points, then explicit point sets.
    pt_label = something(o("label-points"), "auto")
    if o("points") === true
        pt = ["label=\"$(pt_label)\""]
        isnothing(o("point-size")) || push!(pt, "size=\"$(_fmt(o("point-size")))\"")
        o("point-fixed-size") === true && push!(pt, "fixed-size")
        push!(children, "    <qe-points $(join(pt, " "))></qe-points>")
    end
    for ps in something(o("point-sets"), [])
        pt = ["set=\"$(ps["set"])\"", "label=\"$(pt_label)\""]
        isnothing(ps["size"]) || push!(pt, "size=\"$(_fmt(ps["size"]))\"")
        ps["fixed"] === true && push!(pt, "fixed-size")
        push!(children, "    <qe-points $(join(pt, " "))></qe-points>")
    end

    # <qe-edges>: the named network, then one per explicit layer.
    if o("edges") != "false"
        edge_parts = String["$(k)=\"$(o(k))\"" for k in ("group", "unit", "compare", "also") if !isnothing(o(k))]
        layers = Vector{String}[]
        isempty(edge_parts) || push!(layers, vcat(edge_parts, _attr_parts(something(o("edge-named"), []))))
        for L in something(o("edge-layers"), [])
            push!(layers, _attr_parts(L))
        end
        # Plot-wide settings ride on the first layer.
        if !isempty(layers)
            isnothing(o("edge-magnify")) || push!(layers[1], "magnify=\"$(_fmt(o("edge-magnify")))\"")
            isnothing(o("edge-color-scale")) || push!(layers[1], "color-scale=\"$(o("edge-color-scale"))\"")
        end
        for parts in layers
            push!(children, "    <qe-edges $(join(parts, " "))></qe-edges>")
        end
    end
    has_network = any(c -> startswith(c, "    <qe-edges"), children)

    # <qe-trajectories>
    if o("trajectories") === true
        tp = String[]
        isnothing(o("trajectory-units")) || push!(tp, "units=\"$(o("trajectory-units"))\"")
        append!(tp, [
            "smooth=\"$(something(o("trajectory-smooth"), "none"))\"",
            "max-degree=\"$(_fmt(something(o("trajectory-max-degree"), 3)))\"",
            "degree-selection=\"$(something(o("trajectory-degree-selection"), "loocv_2d"))\"",
            "points=\"$(o("trajectory-points") === false ? "false" : "true")\"",
            "tips=\"$(o("trajectory-tips") === false ? "false" : "true")\"",
        ])
        isnothing(o("trajectory-playhead")) || push!(tp, "playhead=\"$(_fmt(o("trajectory-playhead")))\"")
        append!(tp, [
            "line-style=\"$(something(o("trajectory-line-style"), "uniform"))\"",
            "stroke-width=\"$(_fmt(something(o("trajectory-stroke-width"), 2)))\"",
            "stroke-width-range=\"$(something(o("trajectory-stroke-width-range"), "1,6"))\"",
            "opacity-range=\"$(something(o("trajectory-opacity-range"), "0.3,1"))\"",
        ])
        push!(children, "    <qe-trajectories $(join(tp, " "))></qe-trajectories>")
    end

    # <qe-axes>: lines, plus a label per axis when asked.
    if o("axes") === true
        axis_parts = String[]
        for attr in ("x", "y")
            val = o("axis-" * attr)
            val === true ? push!(axis_parts, attr) :
                val isa AbstractString && push!(axis_parts, "$(attr)=\"$(val)\"")
        end
        push!(children, "    <qe-axes" * (isempty(axis_parts) ? "" : " " * join(axis_parts, " ")) * "></qe-axes>")
    end

    # <qe-nodes>: "auto" draws them only with an edge network, as rENA does.
    node_show = something(o("nodes-show"), "auto")
    if node_show == "always" || (node_show == "auto" && has_network)
        unconn = o("nodes-unconnected") == "hide" ? " unconnected=\"hide\"" : ""
        pushfirst!(children, "    <qe-nodes label=\"$(something(o("label-nodes"), "on"))\"$(unconn)></qe-nodes>")
    end

    gattr = ("edge-width", "plot-title", "range", "center", "scale-points", "point-scale",
             "label-font-size", "label-font-family", "label-font-color")
    ga = join([" $(k)=\"$(_esc(o(k)))\"" for k in gattr if !isnothing(o(k))])
    "<qe-graph width=\"$(p.width)\" height=\"$(p.height)\"$(ga)>\n" * join(children, "\n") * "\n  </qe-graph>"
end

# Model JSON for the page; the internal column-order hint is not sent.
function _model_json(p::QEPlot)::String
    m = copy(p.model)
    for (k, v) in m
        if v isa AbstractDict && haskey(v, "_order")
            v2 = copy(v); delete!(v2, "_order"); m[k] = v2
        end
    end
    JSON3.write(m)
end

function _build_fragment(p::QEPlot)::String
    uid        = "qeviz" * string(round(Int, time() * 1000) % 100_000)
    model_json = _model_json(p)
    graph_elem = _build_graph_element(p)
    bundle     = _bundle_script_tag()

    bundle * "\n" *
    "<qe-visual id=\"" * uid * "\">\n" *
    "  " * graph_elem * "\n" *
    "</qe-visual>\n" *
    "<script>\n" *
    "  (function(){\n" *
    "    document.getElementById('" * uid * "').setModelData(" * model_json * ");\n" *
    "  })();\n" *
    "</script>"
end

function _build_html_doc(p::QEPlot)::String
    model_json = _model_json(p)
    graph_elem = _build_graph_element(p)
    bundle     = _bundle_script_tag()

    "<!DOCTYPE html>\n" *
    "<html lang=\"en\">\n" *
    "<head>\n" *
    "  <meta charset=\"UTF-8\">\n" *
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" *
    "  <title>" * p.title * "</title>\n" *
    "  <style>\n" *
    "    * { box-sizing: border-box; margin: 0; padding: 0; }\n" *
    "    body { font-family: system-ui, sans-serif; background: #fff; }\n" *
    "  </style>\n" *
    "  " * bundle * "\n" *
    "</head>\n" *
    "<body>\n" *
    "  <qe-visual id=\"vis\">\n" *
    "    " * graph_elem * "\n" *
    "  </qe-visual>\n" *
    "  <script>\n" *
    "    (function(){\n" *
    "      document.getElementById('vis').setModelData(" * model_json * ");\n" *
    "    })();\n" *
    "  </script>\n" *
    "</body>\n" *
    "</html>"
end


# ── Display ──────────────────────────────────────────────────────────────────────

function Base.show(io::IO, p::QEPlot)
    groups  = qe_groups(p)
    n_units = length(qe_units(p))
    active  = Dict(k => v for (k, v) in p.opts if !isnothing(v))
    print(io, "QEPlot(groups=$(groups), units=$(n_units), opts=$(active))")
end

"""Jupyter / Pluto rich HTML display hook."""
function Base.show(io::IO, ::MIME"text/html", p::QEPlot)
    print(io, _build_fragment(p))
end


# ── Output functions ─────────────────────────────────────────────────────────────

"""
    qe_export_html(p, path) -> String

Write a self-contained HTML file with the qeviz bundle inlined.
Returns the absolute path of the written file.

# Examples

```julia
qe_export_html(p, "output.html")
qe_export_html(qe_group(p, "FirstGame"), "fg.html")
```
"""
function qe_export_html(p::QEPlot, path::AbstractString)::String
    abs_path = abspath(path)
    open(abs_path, "w") do io
        write(io, _build_html_doc(p))
    end
    abs_path
end

"""
    qe_html(p) -> String

Return the full HTML document as a string.
"""
function qe_html(p::QEPlot)::String
    _build_html_doc(p)
end

"""
    qe_fragment(p) -> String

Return an embeddable HTML fragment (no `<html>` wrapper) suitable for
embedding in a larger document or a Pluto / Jupyter cell.
"""
function qe_fragment(p::QEPlot)::String
    _build_fragment(p)
end


# ── model_data ───────────────────────────────────────────────────────────────────

const _TYPE_MAP = Dict{Type,String}(
    Float64 => "numeric",
    Float32 => "numeric",
    Int64   => "integer",
    Int32   => "integer",
    Int16   => "integer",
    Int8    => "integer",
    Bool    => "logical",
    String  => "character",
)

function _col_type(col_type::Type)::String
    T = nonmissingtype(col_type)
    get(_TYPE_MAP, T, "character")
end

function _qe_frame(df::DataFrame)::Dict{String,Any}
    types = Dict{String,Any}(col => _col_type(eltype(df[!, col])) for col in names(df))
    data = Dict{String,Any}[Dict{String,Any}(col => _native(row[col]) for col in names(df))
                            for row in eachrow(df)]
    # "_order" keeps the column order (Dicts are unordered); it is internal
    # and stripped before the model is written to the page.
    Dict{String,Any}("data" => data, "types" => types, "_order" => names(df))
end

"""Per-group means with t CI bounds (R's `group_summary()`), as a DataFrame."""
function _group_summaries(points_df::DataFrame, group_col::String,
                          dim_cols::Vector{String};
                          conf_level::Float64 = 0.95, outlier::Bool = false)::DataFrame
    rows = [Dict{String,Any}(c => r[c] for c in names(points_df)) for r in eachrow(points_df)]
    out = _group_summary(rows, dim_cols[1], dim_cols[2], group_col;
                         conf_level = conf_level, outlier = outlier)
    cols = vcat([group_col], dim_cols, [d * s for d in dim_cols for s in (".low", ".high")],
                outlier ? [d * s for d in dim_cols for s in (".olow", ".ohigh")] : String[])
    DataFrame([c => [r[c] for r in out] for c in cols])
end

"""
    model_data(nodes, edges, points=nothing; kwargs...) -> Dict{String,Any}

Build a qeviz ModelData dict from DataFrames.

# Arguments
- `nodes`        : One row per code node. Must contain `node_id_col`, `x_col`, `y_col`.
- `edges`        : One row per unit. First column is the unit identifier (`id_col`);
                   remaining columns are dot-separated edge weights (`"A.B"`).
- `points`       : Unit projection positions. Must contain `id_col`, `x_col`, `y_col`.
- `trajectories` : Ordered observations for trajectory rendering. Must contain
                   `id_col`, `x_col`, `y_col`, and ideally `time`, `RowID`, or
                   `ActivityNumber`.
- `id_col`       : Unit-identifier column. Default `"QEUNIT"`.
- `node_id_col`  : Node-identifier column. Default `"code"`.
- `x_col`        : X-position column. Default `"SVD1"`.
- `y_col`        : Y-position column. Default `"SVD2"`.
- `group_col`    : Grouping column in `points`. When provided, group means and CI
                   bounds are added as the `"groups"` frame.
- `directed`     : `true` for ONA / directed networks. Default `false`.
- `conf_level`   : Confidence level for CI boxes. Default `0.95`.

# Examples

```julia
m = model_data(nodes_df, edges_df, points_df; group_col="Condition")
p = qe_plot(m)
```
"""
function model_data(nodes::DataFrame,
                    edges::DataFrame,
                    points::Union{DataFrame,Nothing} = nothing;
                    trajectories::Union{DataFrame,Nothing} = nothing,
                    id_col::AbstractString       = "QEUNIT",
                    node_id_col::AbstractString  = "code",
                    x_col::AbstractString        = "SVD1",
                    y_col::AbstractString        = "SVD2",
                    group_col::Union{AbstractString,Nothing} = nothing,
                    directed::Bool               = false,
                    conf_level::Float64          = 0.95)::Dict{String,Any}
    result = Dict{String,Any}(
        "nodes"       => _qe_frame(nodes),
        "edges"       => _qe_frame(edges),
        "updated"     => round(Int, time() * 1000),
        "directed"    => directed,
        "id_col"      => String(id_col),
        "node_id_col" => String(node_id_col),
        "x_col"       => String(x_col),
        "y_col"       => String(y_col),
    )
    isnothing(group_col) || (result["group_col"] = String(group_col))

    if !isnothing(points)
        result["points"] = _qe_frame(points)
        if !isnothing(group_col) && String(group_col) in names(points)
            groups_df = _group_summaries(
                points, String(group_col), [String(x_col), String(y_col)];
                conf_level = conf_level,
            )
            result["groups"] = _qe_frame(groups_df)
        end
    end

    if !isnothing(trajectories)
        result["trajectories"] = _qe_frame(trajectories)
    end

    result
end

end # module QEViz
