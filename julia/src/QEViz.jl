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
using Statistics
using DataFrames

export QEPlot,
       qe_plot,
       qe_group, qe_edges, qe_points, qe_trajectories, qe_axes, qe_labels, qe_nodes,
       qe_groups, qe_units, qe_trajectory_units,
       qe_export_html, qe_html, qe_fragment,
       model_data


# ── QEPlot struct ───────────────────────────────────────────────────────────────

"""
    QEPlot

A lazily-rendered qeviz plot.

Created by [`qe_plot`](@ref). Customise the view with
[`qe_group`](@ref), [`qe_edges`](@ref), [`qe_points`](@ref), and
[`qe_labels`](@ref).  All chain functions return a *new* `QEPlot` —
the original is not mutated.

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

function _copy(p::QEPlot)::QEPlot
    QEPlot(p.model, p.title, p.width, p.height, copy(p.opts))
end


# ── Constructor ─────────────────────────────────────────────────────────────────

"""
    qe_plot(model; title="qeviz", width=700, height=500)

Create a [`QEPlot`](@ref) from a ModelData `Dict`.

`width` and `height` may be integers (treated as pixels) or CSS strings
such as `"100%"`.

# Examples

```julia
p = qe_plot(model_dict)
p = qe_plot(model_dict; title="My ENA", width="100%", height=480)
```
"""
function qe_plot(model::Dict{String,Any};
                 title::AbstractString = "qeviz",
                 width::Union{Int,AbstractString}  = 700,
                 height::Union{Int,AbstractString} = 500)::QEPlot
    w = width  isa AbstractString ? String(width)  : "$(width)px"
    h = height isa AbstractString ? String(height) : "$(height)px"
    QEPlot(model, String(title), w, h, Dict{String,Any}())
end


# ── Introspection ───────────────────────────────────────────────────────────────

"""
    qe_groups(p::QEPlot) -> Vector{String}

Return the group names present in the model's groups frame.
"""
function qe_groups(p::QEPlot)::Vector{String}
    frame = get(p.model, "groups", nothing)
    isnothing(frame) && return String[]
    group_col = something(get(p.model, "group_col", nothing), "group")
    result = String[]
    for row in get(frame, "data", [])
        val = get(row, group_col, nothing)
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


# ── Chain methods ────────────────────────────────────────────────────────────────

"""
    qe_group(p, names...; intervals=true)

Select which group means (and CI boxes) to display.

Pass one or more group names to restrict the view; omit all names to show
every group in the model (the default).  Independent of edge rendering —
use [`qe_edges`](@ref) to choose whose network to draw.

# Examples

```julia
qe_group(p)                          # all groups
qe_group(p, "FirstGame")             # one group mean
qe_group(p, "FirstGame", "SecondGame"; intervals=false)
```
"""
function qe_group(p::QEPlot, names::AbstractString...;
                  intervals::Bool = true, fixed_size::Bool = false)::QEPlot
    p = _copy(p)
    available = qe_groups(p)
    if !isempty(names)
        bad = [n for n in names if n ∉ available]
        if !isempty(bad)
            error("qe_group(): group(s) not found in model: $(bad)\n" *
                  "Available: $(available)")
        end
        p.opts["groups"] = join(names, ",")
    else
        delete!(p.opts, "groups")
    end
    p.opts["confidence"] = intervals
    p.opts["mean_fixed_size"] = fixed_size
    p
end

"""
    qe_edges(p; group=nothing, unit=nothing, compare=nothing, also=nothing, show=true)

Select which edge network to draw.

Supply either `group` (a group's mean network) or `unit` (an individual
unit's personal network) as the primary source.  Omit both to draw no
network.  `show=false` suppresses any previously configured edges.

# Examples

```julia
qe_edges(p; group="FirstGame")
qe_edges(p; unit="FirstGame::alice")
qe_edges(p; group="FirstGame", compare="SecondGame")
qe_edges(p; group="FirstGame", also="SecondGame")
qe_edges(p; show=false)
```
"""
function qe_edges(p::QEPlot;
                  group::Union{AbstractString,Nothing}   = nothing,
                  unit::Union{AbstractString,Nothing}    = nothing,
                  compare::Union{AbstractString,Nothing} = nothing,
                  also::Union{AbstractString,Nothing}    = nothing,
                  show::Bool = true,
                  color_scale::AbstractString = "model",
                  edge_width::Union{Real,Nothing} = nothing,
                  magnify::Union{Real,Nothing} = nothing)::QEPlot
    color_scale in ("model", "plot", "absolute") ||
        error("qe_edges(): color_scale must be \"model\", \"plot\", or \"absolute\".")
    !isnothing(edge_width) && !(0 < edge_width <= 1) &&
        error("qe_edges(): edge_width must be in (0, 1].")
    !isnothing(magnify) && !(magnify > 0) &&
        error("qe_edges(): magnify must be a positive number.")
    !isnothing(group) && !isnothing(unit) &&
        error("qe_edges(): supply either `group` or `unit`, not both.")

    p = _copy(p)

    if !show
        p.opts["show_edges"] = false
        for k in ("group", "unit", "compare", "also")
            delete!(p.opts, k)
        end
        return p
    end

    available_groups = qe_groups(p)
    available_units  = qe_units(p)

    function check_group(name, arg)
        !isnothing(name) && string(name) ∉ available_groups &&
            error("qe_edges(): $(arg)=$(repr(name)) not found in model.\n" *
                  "Available groups: $(available_groups)")
    end
    check_group(group,   "group")
    check_group(compare, "compare")
    check_group(also,    "also")

    if !isnothing(unit) && string(unit) ∉ available_units
        error("qe_edges(): unit=$(repr(unit)) not found in model.\n" *
              "Use qe_units(p) to see available unit IDs.")
    end
    !isnothing(compare) && !isnothing(also) &&
        error("qe_edges(): supply either `compare` or `also`, not both.")
    !isnothing(unit) && (!isnothing(compare) || !isnothing(also)) &&
        error("qe_edges(): `compare` and `also` cannot be combined with `unit`.")

    p.opts["show_edges"] = true
    p.opts["group"]      = isnothing(group)   ? nothing : string(group)
    p.opts["unit"]       = isnothing(unit)    ? nothing : string(unit)
    p.opts["compare"]    = isnothing(compare) ? nothing : string(compare)
    p.opts["also"]       = isnothing(also)    ? nothing : string(also)
    p.opts["edge_color_scale"] = color_scale == "model" ? nothing : String(color_scale)
    p.opts["edge_width"]   = edge_width
    p.opts["edge_magnify"] = magnify
    p
end

"""
    qe_points(p; show=true, size=nothing, fixed_size=false)

Show or hide individual unit scatter dots. `fixed_size` keeps the dots a
constant on-screen pixel size regardless of data extent, container size, or zoom
(default: dots scale with the coordinate space, like nodes and edges).
"""
function qe_points(p::QEPlot; show::Bool = true, size::Union{Real,Nothing} = nothing,
                   fixed_size::Bool = false)::QEPlot
    p = _copy(p)
    p.opts["show_points"] = show
    p.opts["point_size"] = size
    p.opts["point_fixed_size"] = fixed_size
    p
end

"""
    qe_nodes(p; show="auto", unconnected="dot")

Show or hide the code nodes. `"auto"` (default) draws nodes only when an edge
network is drawn, matching rENA; `"always"` / `true` and `"never"` / `false`
override that. Node positions always set the plot extent. A node's diameter
equals the summed widths of its edges (directed: only edges directed at it,
plus its self-connection);
`unconnected="hide"` hides nodes with no drawn edges (default `"dot"`).
"""
function qe_nodes(p::QEPlot; show::Union{Bool,AbstractString} = "auto",
                  unconnected::AbstractString = "dot")::QEPlot
    s = show === true ? "always" : show === false ? "never" : String(show)
    s in ("auto", "always", "never") ||
        throw(ArgumentError("qe_nodes(): show must be \"auto\", \"always\", or \"never\"."))
    unconnected in ("dot", "hide") ||
        throw(ArgumentError("qe_nodes(): unconnected must be \"dot\" or \"hide\"."))
    p = _copy(p)
    p.opts["nodes_show"] = s
    p.opts["nodes_unconnected"] = String(unconnected)
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
        p.opts["show_axes"] = false
        return p
    end
    p.opts["show_axes"] = true
    p.opts["axis_x"] = x isa AbstractString ? String(x) : x
    p.opts["axis_y"] = y isa AbstractString ? String(y) : y
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
        p.opts["show_trajectories"] = false
        return p
    end

    smooth_s = String(smooth)
    degree_selection_s = String(degree_selection)
    line_style_s = String(line_style)
    smooth_s in ("none", "poly") ||
        error("qe_trajectories(): smooth must be \"none\" or \"poly\".")
    degree_selection_s in ("loocv_2d", "fixed") ||
        error("qe_trajectories(): degree_selection must be \"loocv_2d\" or \"fixed\".")
    line_style_s in ("uniform", "tapered") ||
        error("qe_trajectories(): line_style must be \"uniform\" or \"tapered\".")

    selected_units = if isnothing(units)
        nothing
    elseif units isa AbstractString
        [String(units)]
    else
        String[String(u) for u in units]
    end

    if !isnothing(selected_units)
        available = qe_trajectory_units(p)
        bad = [u for u in selected_units if u ∉ available]
        if !isempty(bad)
            error("qe_trajectories(): unit(s) not found in model: $(bad)\n" *
                  "Available: $(available)")
        end
    end

    p.opts["show_trajectories"] = true
    p.opts["trajectory_units"] = isnothing(selected_units) ? nothing : join(selected_units, ",")
    p.opts["trajectory_smooth"] = smooth_s
    p.opts["trajectory_max_degree"] = max_degree
    p.opts["trajectory_degree_selection"] = degree_selection_s
    p.opts["trajectory_points"] = points
    p.opts["trajectory_tips"] = tips
    p.opts["trajectory_playhead"] = playhead
    p.opts["trajectory_line_style"] = line_style_s
    p.opts["trajectory_stroke_width"] = stroke_width
    p.opts["trajectory_stroke_width_range"] = join(stroke_width_range, ",")
    p.opts["trajectory_opacity_range"] = join(opacity_range, ",")
    p
end

"""
    qe_labels(p; nodes="on", means="on", points="auto")

Control label visibility.

Each argument accepts `"on"`, `"off"`, `"click"`, or `"auto"`.
"""
function qe_labels(p::QEPlot;
                   nodes::AbstractString  = "on",
                   means::AbstractString  = "on",
                   points::AbstractString = "auto")::QEPlot
    p = _copy(p)
    p.opts["label_nodes"]  = String(nodes)
    p.opts["label_means"]  = String(means)
    p.opts["label_points"] = String(points)
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

function _build_graph_element(p::QEPlot)::String
    opts = p.opts
    children = String[]

    # <qe-nodes> is inserted here once <qe-edges> is decided (below).

    # <qe-means> — always present; groups/confidence control what is shown
    means_parts = String[]
    grps = get(opts, "groups", nothing)
    !isnothing(grps) && push!(means_parts, "groups=\"" * grps * "\"")
    if get(opts, "confidence", true) !== false
        push!(means_parts, "confidence")
    end
    means_label = get(opts, "label_means", "on")
    push!(means_parts, "label=\"" * means_label * "\"")
    get(opts, "mean_fixed_size", false) === true && push!(means_parts, "fixed-size")
    push!(children, "    <qe-means " * join(means_parts, " ") * "></qe-means>")

    # <qe-points> — only when show_points=true
    if get(opts, "show_points", false) === true
        pt_label = get(opts, "label_points", "auto")
        pt_parts = ["label=\"" * pt_label * "\""]
        ps = get(opts, "point_size", nothing)
        !isnothing(ps) && push!(pt_parts, "size=\"" * string(ps) * "\"")
        get(opts, "point_fixed_size", false) === true && push!(pt_parts, "fixed-size")
        push!(children, "    <qe-points " * join(pt_parts, " ") * "></qe-points>")
    end

    # <qe-edges> — only when not suppressed and a primary target is set
    if get(opts, "show_edges", true) !== false
        edge_parts = String[]
        g = get(opts, "group",   nothing)
        u = get(opts, "unit",    nothing)
        c = get(opts, "compare", nothing)
        a = get(opts, "also",    nothing)
        !isnothing(g) && push!(edge_parts, "group=\""   * g * "\"")
        !isnothing(u) && push!(edge_parts, "unit=\""    * u * "\"")
        !isnothing(c) && push!(edge_parts, "compare=\"" * c * "\"")
        !isnothing(a) && push!(edge_parts, "also=\""    * a * "\"")
        mg = get(opts, "edge_magnify", nothing)
        !isempty(edge_parts) && !isnothing(mg) && push!(edge_parts, "magnify=\"" * string(mg) * "\"")
        cs = get(opts, "edge_color_scale", nothing)
        !isempty(edge_parts) && !isnothing(cs) && push!(edge_parts, "color-scale=\"" * cs * "\"")
        if !isempty(edge_parts)
            push!(children, "    <qe-edges " * join(edge_parts, " ") * "></qe-edges>")
        end
    end

    # <qe-nodes> — draw code nodes (positions always come from the model).
    # "auto" draws them only with an edge network, as rENA does.
    node_show   = get(opts, "nodes_show", "auto")
    has_network = any(c -> startswith(c, "    <qe-edges"), children)
    if node_show == "always" || (node_show == "auto" && has_network)
        node_label = get(opts, "label_nodes", "on")
        unconn = get(opts, "nodes_unconnected", "dot") == "hide" ? " unconnected=\"hide\"" : ""
        pushfirst!(children, "    <qe-nodes label=\"" * node_label * "\"" * unconn * "></qe-nodes>")
    end

    # <qe-trajectories> — only when explicitly shown
    if get(opts, "show_trajectories", false) === true
        traj_parts = String[]
        tu = get(opts, "trajectory_units", nothing)
        !isnothing(tu) && push!(traj_parts, "units=\"" * tu * "\"")
        push!(traj_parts, "smooth=\"" * get(opts, "trajectory_smooth", "none") * "\"")
        push!(traj_parts, "max-degree=\"" * string(get(opts, "trajectory_max_degree", 3)) * "\"")
        push!(traj_parts, "degree-selection=\"" * get(opts, "trajectory_degree_selection", "loocv_2d") * "\"")
        push!(traj_parts, "points=\"" * string(get(opts, "trajectory_points", true)) * "\"")
        push!(traj_parts, "tips=\"" * string(get(opts, "trajectory_tips", true)) * "\"")
        tp = get(opts, "trajectory_playhead", nothing)
        !isnothing(tp) && push!(traj_parts, "playhead=\"" * string(tp) * "\"")
        push!(traj_parts, "line-style=\"" * get(opts, "trajectory_line_style", "uniform") * "\"")
        push!(traj_parts, "stroke-width=\"" * string(get(opts, "trajectory_stroke_width", 2)) * "\"")
        push!(traj_parts, "stroke-width-range=\"" * get(opts, "trajectory_stroke_width_range", "1,6") * "\"")
        push!(traj_parts, "opacity-range=\"" * get(opts, "trajectory_opacity_range", "0.3,1") * "\"")
        push!(children, "    <qe-trajectories " * join(traj_parts, " ") * "></qe-trajectories>")
    end

    # <qe-axes> — axis lines + optional per-axis labels
    if get(opts, "show_axes", false) === true
        axis_parts = String[]
        for (attr, val) in (("x", get(opts, "axis_x", false)), ("y", get(opts, "axis_y", false)))
            if val === true
                push!(axis_parts, attr)
            elseif val isa AbstractString
                push!(axis_parts, attr * "=\"" * val * "\"")
            end
        end
        push!(children, "    <qe-axes" * (isempty(axis_parts) ? "" : " " * join(axis_parts, " ")) * "></qe-axes>")
    end

    children_str = join(children, "\n")
    "<qe-graph width=\"" * p.width * "\" height=\"" * p.height * "\"" *
    (isnothing(get(p.opts, "edge_width", nothing)) ? "" : " edge-width=\"" * string(p.opts["edge_width"]) * "\"") *
    ">\n" *
    children_str * "\n  </qe-graph>"
end

function _build_fragment(p::QEPlot)::String
    uid        = "qeviz" * string(round(Int, time() * 1000) % 100_000)
    model_json = JSON3.write(p.model)
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
    model_json = JSON3.write(p.model)
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
    get(_TYPE_MAP, T, T <: AbstractString ? "character" : "character")
end

function _qe_frame(df::DataFrame)::Dict{String,Any}
    types = Dict{String,String}(
        col => _col_type(eltype(df[!, col]))
        for col in names(df)
    )
    data = Vector{Dict{String,Any}}(undef, nrow(df))
    for (i, row) in enumerate(eachrow(df))
        row_dict = Dict{String,Any}()
        for col in names(df)
            val = row[col]
            if ismissing(val)
                row_dict[col] = nothing
            elseif val isa AbstractFloat && isnan(val)
                row_dict[col] = nothing
            else
                row_dict[col] = val
            end
        end
        data[i] = row_dict
    end
    Dict{String,Any}("data" => data, "types" => types)
end

function _t_quantile(p::Float64, df::Int)::Float64
    # Lookup table; add Distributions.jl for exact values
    lut = [(1, 12.706), (2, 4.303), (3, 3.182), (5, 2.571), (10, 2.228),
           (20, 2.086), (30, 2.042), (60, 2.000), (120, 1.980)]
    for (threshold, tval) in lut
        df <= threshold && return tval
    end
    1.960
end

function _group_summaries(points_df::DataFrame, group_col::String,
                           dim_cols::Vector{String};
                           conf_level::Float64 = 0.95)::DataFrame
    groups    = unique(points_df[!, group_col])
    col_names = vcat([group_col], dim_cols,
                     [d * ".low"  for d in dim_cols],
                     [d * ".high" for d in dim_cols])
    rows = Dict{String,Any}[]

    for g in groups
        mask = points_df[!, group_col] .== g
        sub  = points_df[mask, :]
        n    = nrow(sub)
        row  = Dict{String,Any}(group_col => string(g))

        for d in dim_cols
            vals = Float64.(sub[!, d])
            m    = mean(vals)
            row[d] = m
            if n >= 2
                se = std(vals; corrected=true) / sqrt(n)
                t  = _t_quantile((1.0 + conf_level) / 2.0, n - 1)
                row[d * ".low"]  = m - t * se
                row[d * ".high"] = m + t * se
            end
        end
        push!(rows, row)
    end

    DataFrame(rows)
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
        "group_col"   => isnothing(group_col) ? nothing : String(group_col),
    )

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
