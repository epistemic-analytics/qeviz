# Cross-language parity: every scenario in tests/golden/golden.json (built with
# the R package by tests/golden/gen_golden.R) rebuilt with the Julia API must
# produce the same <qe-graph> markup (attribute for attribute) and the same
# ModelData (numbers to 1e-9).

const GOLDEN_DIR = joinpath(@__DIR__, "..", "..", "tests", "golden")
const GOLDEN = JSON3.read(read(joinpath(GOLDEN_DIR, "golden.json"), String))

# The fixture CSVs are simple (quoted strings, plain numbers): no CSV.jl needed.
function read_fixture(f)
    lines = filter(!isempty, readlines(joinpath(GOLDEN_DIR, "fixture", f)))
    unq(s) = startswith(s, "\"") ? s[2:end-1] : s
    header = unq.(split(lines[1], ","))
    rows = [unq.(split(l, ",")) for l in lines[2:end]]
    cols = map(eachindex(header)) do j
        vals = [r[j] for r in rows]
        all(v -> !isnothing(tryparse(Int, v)), vals) ? parse.(Int, vals) :
        all(v -> !isnothing(tryparse(Float64, v)), vals) ? parse.(Float64, vals) : String.(vals)
    end
    DataFrame([h => c for (h, c) in zip(header, cols)])
end

const g_nodes, g_edges, g_points = read_fixture("nodes.csv"), read_fixture("edges.csv"), read_fixture("points.csv")
const g_m  = model_data(g_nodes, g_edges, g_points; id_col = "ENA_UNIT", x_col = "x", y_col = "y",
                        group_col = "Condition")
const g_m0 = model_data(g_nodes, g_edges, g_points[:, ["ENA_UNIT", "x", "y"]]; id_col = "ENA_UNIT",
                        x_col = "x", y_col = "y")
const g_ecols = [c for c in names(g_edges) if c ∉ ("ENA_UNIT", "Condition")]
const g_oa = g_edges.Condition .== "OA"
const g_w_oa = Dict(c => mean(g_edges[g_oa, c]) for c in g_ecols)            # named
const g_w_vec = [mean(g_edges[g_oa, c]) for c in g_ecols]                     # unnamed, column order
gbase(; kw...) = qe_plot(g_m; width = "100%", height = "440", kw...)
scaled(w, k) = Dict(c => v * k for (c, v) in w)

const SCENARIOS = Dict{String,Function}(
    "base"             => () -> gbase(),
    "edges_group"      => () -> qe_edges(gbase(); group = "OA"),
    "edges_compare"    => () -> qe_edges(gbase(); group = "OA", compare = "OB"),
    "edges_also_mag"   => () -> qe_edges(gbase(); group = "OA", also = "OB", magnify = 2,
                                         color_scale = "plot", edge_width = 0.05),
    "points_all"       => () -> qe_points(gbase(); size = 3, fixed_size = true),
    "axes_labels"      => () -> qe_axes(gbase(); x = true, y = "Second"),

    "w_vector"         => () -> qe_edges(gbase(); weights = g_w_oa, colors = ["#228833", "#AA3377"],
                                         threshold = (0.05, 0.3), name = "net A"),
    "w_unnamed"        => () -> qe_edges(gbase(); weights = g_w_vec, colors = "#228833", threshold = 0.1),
    "w_matrix_compare" => () -> qe_edges(gbase(); weights = g_edges[g_oa, g_ecols],
                                         compare = g_edges[.!g_oa, g_ecols]),
    "w_two_layers"     => () -> qe_edges(qe_edges(gbase(); weights = g_w_oa, name = "first");
                                         weights = scaled(g_w_oa, 0.5), name = "second", magnify = 1.5),
    "w_replace"        => () -> qe_edges(qe_edges(gbase(); weights = g_w_oa, name = "n");
                                         weights = scaled(g_w_oa, 2), name = "n"),
    "w_then_hide"      => () -> qe_edges(qe_edges(gbase(); weights = g_w_oa); show = false),

    "ps_units"         => () -> qe_points(gbase(); units = ["OA.alice", "OB.eve"], color = "#228833",
                                          shape = "triangle", labels = ["A", "E"], name = "picked"),
    "ps_points"        => () -> qe_points(gbase(); points = g_points[1:3, :], size = 4, shape = "diamond"),
    "ps_two_sets"      => () -> qe_points(qe_points(gbase(); points = g_points[1:2, :], name = "one");
                                          points = g_points[5:6, :], color = "#EE6677"),

    "g_named"          => () -> qe_group(gbase(), "OA"; intervals = "crosshairs"),
    "g_named_outlier"  => () -> qe_group(gbase(); conf_level = 0.9, outlier = true),
    "g_explicit"       => () -> qe_group(gbase(); points = g_points[1:4, :], label = "sub",
                                         color = "#CCBB44", shape = "diamond", intervals = "box",
                                         outlier = true, conf_level = 0.9),
    "g_explicit_two"   => () -> qe_group(qe_group(gbase(); points = g_points[1:4, :], label = "a");
                                         points = g_points[5:8, :], label = "b", intervals = "crosshairs"),
    "g_hidden"         => () -> qe_group(qe_edges(gbase(); group = "OA"); show = false),

    "n_positions"      => () -> qe_edges(qe_nodes(gbase(); positions = DataFrame(
                                     code = ["Data", "Tech"], x = [0.5, -0.5], y = [0.5, -0.5]));
                                     group = "OA"),
    "n_labels"         => () -> qe_nodes(gbase(); show = "always", unconnected = "hide",
                                         labels = Dict("Data" => "D", "Collab" => "C")),

    "plot_settings"    => () -> qe_edges(gbase(; title = "Settings", range = "points",
                                         scale_points = false, palette = ["#111111", "#222222"],
                                         center = "content", point_scale = 2); group = "OA"),
    "range_number"     => () -> qe_range(gbase(), 1.5),
    "colors_labels"    => () -> qe_labels(qe_labels(qe_colors(gbase(), "OA" => "#000000");
                                                    nodes = "off", means = "click");
                                          font_size = 12, font_family = "Georgia", font_color = "#333333"),

    "opts_060"         => () -> qe_labels(
                                     qe_axes(
                                       qe_nodes(
                                         qe_edges(gbase(; view_padding = 1); group = "OA",
                                                  fixed_size = true, self_size = "node");
                                         show = "always", sizes = Dict("Data" => 24, "Tech" => 12.5),
                                         fixed_size = true);
                                       x = true, fixed_size = true);
                                     font_weight = (nodes = "bold",)),
    "opts_060_layers"  => () -> begin
        p = qe_points(qe_points(gbase(); size = 3); points = g_points[1:2, :], name = "one")
        p = qe_labels(qe_labels(p; font_weight = 600); font_weight = Dict("means" => "bold"))
        qe_edges(qe_edges(p; weights = g_w_oa, name = "a", self_size = 0.3);
                 weights = scaled(g_w_oa, 0.5), name = "b")
    end,
    "opts_060_clear"   => () -> qe_edges(qe_edges(qe_labels(qe_labels(gbase(); font_weight = "bold");
                                                            font_weight = nothing);
                                                  group = "OA", fixed_size = true);
                                         group = "OB", fixed_size = false),
    "ps_label_na"      => () -> qe_points(gbase(); units = ["OA.alice", "OB.eve"], labels = ["A", nothing]),

    "nogroup_explicit" => () -> begin
        sub = g_points[1:4, ["ENA_UNIT", "x", "y"]]
        p = qe_group(qe_plot(g_m0; width = "100%", height = "440"); show = false)
        p = qe_points(qe_edges(p; weights = g_w_oa); points = sub)
        qe_group(p; points = sub, label = "subset")
    end,
)

# ── Comparison ──────────────────────────────────────────────────────────────────

const NUMS = r"^-?\d+(\.\d+)?(e-?\d+)?(,-?\d+(\.\d+)?(e-?\d+)?)*$"

# [(tag, Dict(attr => value))] in document order; width / height dropped (the
# renderer sizes the plot by CSS); numeric values compared as numbers.
function parse_graph(markup::AbstractString)
    out = []
    for t in eachmatch(r"<(qe-[a-z-]+)([^>]*)>", markup)
        d = Dict{String,Any}()
        for a in eachmatch(r"([a-z-]+)(?:=\"([^\"]*)\")?", t.captures[2])
            k, v = a.captures[1], something(a.captures[2], "")
            t.captures[1] == "qe-graph" && k in ("width", "height") && continue
            d[k] = occursin(NUMS, v) ? Tuple(parse.(Float64, split(v, ","))) : v
        end
        push!(out, (t.captures[1], d))
    end
    out
end

na(v) = v === nothing || (v isa AbstractFloat && isnan(v)) || v == "NA"

# Golden (R) vs Julia, recursively: NA == nothing == NaN, integer and numeric
# types equivalent, numbers to 1e-9. Returns a description of the first
# difference, or nothing.
function difference(a, b, path = "model")
    na(a) && na(b) && return nothing
    if a isa AbstractDict && b isa AbstractDict
        for k in sort!(unique(vcat(string.(collect(keys(a))), string.(collect(keys(b))))))
            k == "_order" && continue
            x, y = get(a, Symbol(k), get(a, k, nothing)), get(b, k, get(b, Symbol(k), nothing))
            d = difference(x, y, "$(path).$(k)")
            isnothing(d) || return d
        end
        return nothing
    elseif a isa AbstractVector && b isa AbstractVector
        length(a) == length(b) || return "$(path): $(length(a)) vs $(length(b)) items"
        for (i, (x, y)) in enumerate(zip(a, b))
            d = difference(x, y, "$(path)[$(i)]")
            isnothing(d) || return d
        end
        return nothing
    elseif a isa Bool || b isa Bool
        return a == b ? nothing : "$(path): $(repr(a)) vs $(repr(b))"
    elseif a isa Real && b isa Real
        return abs(a - b) <= 1e-9 * max(1.0, abs(a)) ? nothing : "$(path): $(a) vs $(b)"
    elseif a isa AbstractString && b isa AbstractString && Set([a, b]) ⊆ Set(["integer", "numeric"])
        return nothing
    end
    isequal(string(a), string(b)) ? nothing : "$(path): $(repr(a)) vs $(repr(b))"
end

@testset "golden parity with R" begin
    @test Set(keys(SCENARIOS)) == Set(string.(keys(GOLDEN)))
    for name in sort!(collect(keys(SCENARIOS)))
        p = SCENARIOS[name]()
        g = GOLDEN[Symbol(name)]
        @testset "$(name)" begin
            @test parse_graph(QEViz._build_graph_element(p)) == parse_graph(g.graph)
            model = JSON3.read(QEViz._model_json(p))
            d = difference(g.model, Dict(string(k) => v for (k, v) in model if string(k) != "updated"))
            isnothing(d) || @info "golden model difference" name d
            @test isnothing(d)
        end
    end
end
