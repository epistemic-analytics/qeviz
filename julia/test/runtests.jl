using Test
using QEViz
using DataFrames

# ── Shared fixtures ─────────────────────────────────────────────────────────────

function _make_model()::Dict{String,Any}
    Dict{String,Any}(
        "id_col"      => "QEUNIT",
        "node_id_col" => "code",
        "x_col"       => "SVD1",
        "y_col"       => "SVD2",
        "group_col"   => "Condition",
        "directed"    => false,
        "nodes"       => Dict{String,Any}(
            "data" => [
                Dict("code" => "A", "SVD1" => 0.5,  "SVD2" =>  0.3),
                Dict("code" => "B", "SVD1" => -0.4, "SVD2" =>  0.6),
                Dict("code" => "C", "SVD1" => 0.1,  "SVD2" => -0.5),
            ],
            "types" => Dict("code" => "character", "SVD1" => "numeric", "SVD2" => "numeric"),
        ),
        "edges" => Dict{String,Any}(
            "data" => [
                Dict("QEUNIT" => "FirstGame::alice",  "Condition" => "FirstGame",  "A.B" => 0.2, "A.C" => 0.1, "B.C" => 0.4),
                Dict("QEUNIT" => "FirstGame::bob",    "Condition" => "FirstGame",  "A.B" => 0.3, "A.C" => 0.2, "B.C" => 0.1),
                Dict("QEUNIT" => "SecondGame::alice", "Condition" => "SecondGame", "A.B" => 0.1, "A.C" => 0.4, "B.C" => 0.2),
                Dict("QEUNIT" => "SecondGame::bob",   "Condition" => "SecondGame", "A.B" => 0.5, "A.C" => 0.1, "B.C" => 0.3),
            ],
            "types" => Dict("QEUNIT" => "character", "Condition" => "character",
                            "A.B" => "numeric", "A.C" => "numeric", "B.C" => "numeric"),
        ),
        "points" => Dict{String,Any}(
            "data" => [
                Dict("QEUNIT" => "FirstGame::alice",  "Condition" => "FirstGame",  "SVD1" =>  0.2, "SVD2" =>  0.1),
                Dict("QEUNIT" => "FirstGame::bob",    "Condition" => "FirstGame",  "SVD1" =>  0.4, "SVD2" => -0.1),
                Dict("QEUNIT" => "SecondGame::alice", "Condition" => "SecondGame", "SVD1" => -0.3, "SVD2" =>  0.2),
                Dict("QEUNIT" => "SecondGame::bob",   "Condition" => "SecondGame", "SVD1" => -0.1, "SVD2" => -0.2),
            ],
            "types" => Dict("QEUNIT" => "character", "Condition" => "character",
                            "SVD1" => "numeric", "SVD2" => "numeric"),
        ),
        "trajectories" => Dict{String,Any}(
            "data" => [
                Dict("QEUNIT" => "FirstGame::alice", "Condition" => "FirstGame", "SVD1" => 0.1, "SVD2" => 0.0, "RowID" => 1),
                Dict("QEUNIT" => "FirstGame::alice", "Condition" => "FirstGame", "SVD1" => 0.2, "SVD2" => 0.1, "RowID" => 2),
                Dict("QEUNIT" => "SecondGame::bob", "Condition" => "SecondGame", "SVD1" => -0.2, "SVD2" => -0.1, "RowID" => 1),
                Dict("QEUNIT" => "SecondGame::bob", "Condition" => "SecondGame", "SVD1" => -0.1, "SVD2" => -0.2, "RowID" => 2),
            ],
            "types" => Dict("QEUNIT" => "character", "Condition" => "character",
                            "SVD1" => "numeric", "SVD2" => "numeric", "RowID" => "integer"),
        ),
        "groups" => Dict{String,Any}(
            "data" => [
                Dict("Condition" => "FirstGame",  "SVD1" =>  0.3, "SVD2" =>  0.0,
                     "SVD1.low" => 0.1, "SVD1.high" => 0.5, "SVD2.low" => -0.2, "SVD2.high" => 0.2),
                Dict("Condition" => "SecondGame", "SVD1" => -0.2, "SVD2" =>  0.0,
                     "SVD1.low" => -0.4, "SVD1.high" => 0.0, "SVD2.low" => -0.3, "SVD2.high" => 0.3),
            ],
            "types" => Dict("Condition" => "character",
                            "SVD1" => "numeric", "SVD2" => "numeric",
                            "SVD1.low" => "numeric", "SVD1.high" => "numeric",
                            "SVD2.low" => "numeric", "SVD2.high" => "numeric"),
        ),
    )
end

model = _make_model()


# ══ Construction ════════════════════════════════════════════════════════════════

@testset "qe_plot construction" begin
    p = qe_plot(model)
    @test p isa QEPlot
    @test p.title == "qeviz"
    @test p.width  == "700px"
    @test p.height == "500px"
    @test isempty(p.opts)
end

@testset "qe_plot custom size" begin
    p = qe_plot(model; title="My ENA", width=900, height=600)
    @test p.title  == "My ENA"
    @test p.width  == "900px"
    @test p.height == "600px"
end

@testset "qe_plot CSS string size" begin
    p = qe_plot(model; width="100%", height="480px")
    @test p.width  == "100%"
    @test p.height == "480px"
end


# ══ Introspection ════════════════════════════════════════════════════════════════

@testset "qe_groups" begin
    p = qe_plot(model)
    g = qe_groups(p)
    @test g == ["FirstGame", "SecondGame"]
end

@testset "qe_units" begin
    p = qe_plot(model)
    u = qe_units(p)
    @test length(u) == 4
    @test "FirstGame::alice"  ∈ u
    @test "SecondGame::bob"   ∈ u
end

@testset "qe_trajectory_units" begin
    p = qe_plot(model)
    u = qe_trajectory_units(p)
    @test u == ["FirstGame::alice", "SecondGame::bob"]
end

@testset "qe_trajectory_units falls back to points" begin
    m = copy(model)
    delete!(m, "trajectories")
    p = qe_plot(m)
    @test qe_trajectory_units(p) == qe_units(p)
end

@testset "qe_groups empty model" begin
    m = Dict{String,Any}()
    p = qe_plot(m)
    @test qe_groups(p) == String[]
    @test qe_units(p)  == String[]
end


# ══ Chain — qe_group ════════════════════════════════════════════════════════════

@testset "qe_group all groups" begin
    p  = qe_plot(model)
    p2 = qe_group(p)
    @test !haskey(p2.opts, "groups")
    @test p2.opts["confidence"] == true
end

@testset "qe_group single" begin
    p  = qe_plot(model)
    p2 = qe_group(p, "FirstGame")
    @test p2.opts["groups"] == "FirstGame"
end

@testset "qe_group multiple" begin
    p  = qe_plot(model)
    p2 = qe_group(p, "FirstGame", "SecondGame")
    @test p2.opts["groups"] == "FirstGame,SecondGame"
end

@testset "qe_group no intervals" begin
    p  = qe_plot(model)
    p2 = qe_group(p; intervals=false)
    @test p2.opts["confidence"] == false
end

@testset "qe_group unknown name" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_group(p, "UnknownGroup")
end

@testset "qe_group does not mutate original" begin
    p  = qe_plot(model)
    p2 = qe_group(p, "FirstGame")
    @test !haskey(p.opts, "groups")
    @test p2.opts["groups"] == "FirstGame"
end


# ══ Chain — qe_edges ════════════════════════════════════════════════════════════

@testset "qe_edges group" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; group="FirstGame")
    @test p2.opts["group"]      == "FirstGame"
    @test p2.opts["show_edges"] == true
    @test isnothing(p2.opts["unit"])
end

@testset "qe_edges unit" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; unit="FirstGame::alice")
    @test p2.opts["unit"]       == "FirstGame::alice"
    @test p2.opts["show_edges"] == true
    @test isnothing(p2.opts["group"])
end

@testset "qe_edges compare" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; group="FirstGame", compare="SecondGame")
    @test p2.opts["compare"] == "SecondGame"
    @test isnothing(p2.opts["also"])
end

@testset "qe_edges also" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; group="FirstGame", also="SecondGame")
    @test p2.opts["also"] == "SecondGame"
    @test isnothing(p2.opts["compare"])
end

@testset "qe_edges show=false" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; show=false)
    @test p2.opts["show_edges"] == false
    @test !haskey(p2.opts, "group")
end

@testset "qe_edges group+unit error" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_edges(p; group="FirstGame", unit="FirstGame::alice")
end

@testset "qe_edges compare+also error" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_edges(p; group="FirstGame", compare="SecondGame", also="SecondGame")
end

@testset "qe_edges unit+compare error" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_edges(p; unit="FirstGame::alice", compare="SecondGame")
end

@testset "qe_edges unknown group" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_edges(p; group="NoSuchGroup")
end

@testset "qe_edges unknown unit" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_edges(p; unit="FirstGame::nobody")
end

@testset "qe_edges does not mutate original" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; group="FirstGame")
    @test !haskey(p.opts, "group")
end


# ══ Chain — qe_points ════════════════════════════════════════════════════════════

@testset "qe_points show" begin
    p  = qe_plot(model)
    p2 = qe_points(p)
    @test p2.opts["show_points"] == true
end

@testset "qe_points hide" begin
    p  = qe_plot(model)
    p2 = qe_points(p; show=false)
    @test p2.opts["show_points"] == false
end

@testset "qe_points does not mutate original" begin
    p  = qe_plot(model)
    p2 = qe_points(p)
    @test !haskey(p.opts, "show_points")
end


# ══ Chain — qe_trajectories ═════════════════════════════════════════════════════

@testset "qe_trajectories show" begin
    p  = qe_plot(model)
    p2 = qe_trajectories(p; units="FirstGame::alice", smooth="poly",
                         max_degree=4, degree_selection="fixed", line_style="tapered")
    @test p2.opts["show_trajectories"] == true
    @test p2.opts["trajectory_units"] == "FirstGame::alice"
    @test p2.opts["trajectory_smooth"] == "poly"
    @test p2.opts["trajectory_max_degree"] == 4
    @test p2.opts["trajectory_degree_selection"] == "fixed"
    @test p2.opts["trajectory_line_style"] == "tapered"
end

@testset "qe_trajectories defaults to loocv_2d" begin
    p  = qe_plot(model)
    p2 = qe_trajectories(p; smooth="poly")
    @test p2.opts["trajectory_max_degree"] == 3
    @test p2.opts["trajectory_degree_selection"] == "loocv_2d"
end

@testset "qe_trajectories hide" begin
    p  = qe_plot(model)
    p2 = qe_trajectories(p; show=false)
    @test p2.opts["show_trajectories"] == false
end

@testset "qe_trajectories unknown unit" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_trajectories(p; units="missing")
end

@testset "qe_trajectories bad degree_selection" begin
    p = qe_plot(model)
    @test_throws ErrorException qe_trajectories(p; smooth="poly", degree_selection="bogus")
end

@testset "qe_trajectories does not mutate original" begin
    p  = qe_plot(model)
    p2 = qe_trajectories(p)
    @test !haskey(p.opts, "show_trajectories")
    @test p2.opts["show_trajectories"] == true
end


# ══ Chain — qe_labels ════════════════════════════════════════════════════════════

@testset "qe_labels defaults" begin
    p  = qe_plot(model)
    p2 = qe_labels(p)
    @test p2.opts["label_nodes"]  == "on"
    @test p2.opts["label_means"]  == "on"
    @test p2.opts["label_points"] == "auto"
end

@testset "qe_labels custom" begin
    p  = qe_plot(model)
    p2 = qe_labels(p; nodes="off", means="click", points="on")
    @test p2.opts["label_nodes"]  == "off"
    @test p2.opts["label_means"]  == "click"
    @test p2.opts["label_points"] == "on"
end


# ══ HTML output ══════════════════════════════════════════════════════════════════

@testset "graph element contains qe-nodes and qe-means" begin
    p   = qe_plot(model)
    g   = QEViz._build_graph_element(p)
    @test occursin("<qe-nodes", g)
    @test occursin("<qe-means", g)
end

@testset "graph element no qe-points by default" begin
    p = qe_plot(model)
    g = QEViz._build_graph_element(p)
    @test !occursin("<qe-points", g)
end

@testset "graph element has qe-points when shown" begin
    p  = qe_plot(model)
    p2 = qe_points(p)
    g  = QEViz._build_graph_element(p2)
    @test occursin("<qe-points", g)
end

@testset "qe_axes default dimension-name labels" begin
    g = QEViz._build_graph_element(qe_axes(qe_plot(model)))
    @test occursin("<qe-axes x y>", g)
end

@testset "qe_axes custom x label, default y" begin
    g = QEViz._build_graph_element(qe_axes(qe_plot(model); x="Task focus"))
    @test occursin("<qe-axes x=\"Task focus\" y>", g)
end

@testset "qe_axes lines-only" begin
    g = QEViz._build_graph_element(qe_axes(qe_plot(model); x=false, y=false))
    @test occursin("<qe-axes>", g)
end

@testset "qe_axes hidden and absent by default" begin
    @test !occursin("<qe-axes", QEViz._build_graph_element(qe_axes(qe_plot(model); show=false)))
    @test !occursin("<qe-axes", QEViz._build_graph_element(qe_plot(model)))
end

@testset "graph element has qe-trajectories when shown" begin
    p  = qe_plot(model)
    p2 = qe_trajectories(
        p;
        units="FirstGame::alice",
        smooth="poly",
        max_degree=4,
        degree_selection="fixed",
        line_style="tapered",
        stroke_width_range=(1, 8),
        opacity_range=(0.3, 1),
    )
    g  = QEViz._build_graph_element(p2)
    @test occursin("<qe-trajectories", g)
    @test occursin("units=\"FirstGame::alice\"", g)
    @test occursin("smooth=\"poly\"", g)
    @test occursin("max-degree=\"4\"", g)
    @test occursin("degree-selection=\"fixed\"", g)
    @test occursin("line-style=\"tapered\"", g)
    @test occursin("stroke-width-range=\"1,8\"", g)
end

@testset "graph element no qe-edges by default" begin
    p = qe_plot(model)
    g = QEViz._build_graph_element(p)
    @test !occursin("<qe-edges", g)
end

@testset "graph element has qe-edges with group" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; group="FirstGame")
    g  = QEViz._build_graph_element(p2)
    @test occursin("<qe-edges", g)
    @test occursin("group=\"FirstGame\"", g)
end

@testset "graph element has qe-edges with unit" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; unit="FirstGame::alice")
    g  = QEViz._build_graph_element(p2)
    @test occursin("<qe-edges", g)
    @test occursin("unit=\"FirstGame::alice\"", g)
end

@testset "graph element no qe-edges when show=false" begin
    p  = qe_plot(model)
    p2 = qe_edges(p; show=false)
    g  = QEViz._build_graph_element(p2)
    @test !occursin("<qe-edges", g)
end

@testset "graph element qe-means has groups attr" begin
    p  = qe_plot(model)
    p2 = qe_group(p, "FirstGame")
    g  = QEViz._build_graph_element(p2)
    @test occursin("groups=\"FirstGame\"", g)
end

@testset "graph element qe-means has confidence attr" begin
    p  = qe_plot(model)
    p2 = qe_group(p; intervals=true)
    g  = QEViz._build_graph_element(p2)
    @test occursin("confidence", g)
end

@testset "qe-graph width and height attributes" begin
    p = qe_plot(model; width=800, height=600)
    g = QEViz._build_graph_element(p)
    @test occursin("width=\"800px\"", g)
    @test occursin("height=\"600px\"", g)
end

@testset "qe_html returns complete document" begin
    p = qe_plot(model)
    h = qe_html(p)
    @test occursin("<!DOCTYPE html>", h)
    @test occursin("<qe-visual", h)
    @test occursin("setModelData(", h)
end

@testset "qe_fragment returns fragment without DOCTYPE" begin
    p = qe_plot(model)
    f = qe_fragment(p)
    @test !occursin("<!DOCTYPE html>", f)
    @test  occursin("<qe-visual",      f)
    @test  occursin("setModelData(",   f)
end

@testset "qe_fragment contains model JSON" begin
    p  = qe_plot(model)
    f  = qe_fragment(p)
    @test occursin("FirstGame", f)
    @test occursin("SecondGame", f)
end

@testset "qe_export_html writes file" begin
    p    = qe_plot(model)
    tmp  = tempname() * ".html"
    path = qe_export_html(p, tmp)
    @test isfile(path)
    content = read(path, String)
    @test occursin("<!DOCTYPE html>", content)
    @test occursin("setModelData(",   content)
    rm(path; force=true)
end


# ══ model_data from DataFrames ═══════════════════════════════════════════════════

@testset "model_data basic" begin
    nodes_df  = DataFrame(code=["A","B","C"], SVD1=[0.5,-0.4,0.1], SVD2=[0.3,0.6,-0.5])
    edges_df  = DataFrame(
        QEUNIT   = ["FG::alice","FG::bob"],
        AB       = [0.2, 0.3],
        AC       = [0.1, 0.2],
    )
    m = model_data(nodes_df, edges_df)
    @test haskey(m, "nodes")
    @test haskey(m, "edges")
    @test !haskey(m, "points")
    @test !haskey(m, "groups")
    @test m["directed"] == false
    @test m["id_col"]   == "QEUNIT"
end

@testset "model_data with points and group_col" begin
    nodes_df  = DataFrame(code=["A","B","C"], SVD1=[0.5,-0.4,0.1], SVD2=[0.3,0.6,-0.5])
    edges_df  = DataFrame(
        QEUNIT    = ["FG::alice","FG::bob","SG::alice","SG::bob"],
        Condition = ["FG","FG","SG","SG"],
        AB        = [0.2, 0.3, 0.1, 0.5],
    )
    points_df = DataFrame(
        QEUNIT    = ["FG::alice","FG::bob","SG::alice","SG::bob"],
        Condition = ["FG","FG","SG","SG"],
        SVD1      = [0.2, 0.4, -0.3, -0.1],
        SVD2      = [0.1, -0.1, 0.2, -0.2],
    )
    m = model_data(nodes_df, edges_df, points_df; group_col="Condition")
    @test haskey(m, "points")
    @test haskey(m, "groups")
    @test m["group_col"] == "Condition"

    groups_data = m["groups"]["data"]
    @test length(groups_data) == 2
    grp_names = [row["Condition"] for row in groups_data]
    @test "FG" ∈ grp_names
    @test "SG" ∈ grp_names
end

@testset "model_data with trajectories" begin
    nodes_df  = DataFrame(code=["A","B"], SVD1=[0.5,-0.5], SVD2=[0.3,-0.3])
    edges_df  = DataFrame(QEUNIT=["G1::u1","G2::u1"], AB=[0.3, 0.7])
    points_df = DataFrame(QEUNIT=["G1::u1","G2::u1"], SVD1=[0.4,-0.4], SVD2=[0.2,-0.2])
    traj_df   = DataFrame(
        QEUNIT = ["G1::u1","G1::u1","G2::u1","G2::u1"],
        SVD1   = [0.1,0.2,-0.1,-0.2],
        SVD2   = [0.0,0.1,0.0,-0.1],
        RowID  = [1,2,1,2],
    )
    m = model_data(nodes_df, edges_df, points_df; trajectories=traj_df)
    @test haskey(m, "trajectories")
    @test length(m["trajectories"]["data"]) == 4
end

@testset "model_data group summaries have CI columns" begin
    nodes_df  = DataFrame(code=["A"], SVD1=[0.0], SVD2=[0.0])
    edges_df  = DataFrame(QEUNIT=["FG::alice","SG::bob"])
    points_df = DataFrame(
        QEUNIT    = ["FG::alice","FG::bob","SG::alice","SG::bob"],
        Condition = ["FG","FG","SG","SG"],
        SVD1      = [0.2, 0.4, -0.3, -0.1],
        SVD2      = [0.1, -0.1, 0.2, -0.2],
    )
    m = model_data(nodes_df, edges_df, points_df; group_col="Condition")
    row = m["groups"]["data"][1]
    @test haskey(row, "SVD1.low")
    @test haskey(row, "SVD1.high")
    @test haskey(row, "SVD2.low")
    @test haskey(row, "SVD2.high")
end

@testset "model_data directed flag" begin
    nodes_df = DataFrame(code=["A"], SVD1=[0.0], SVD2=[0.0])
    edges_df = DataFrame(QEUNIT=["u1"])
    m = model_data(nodes_df, edges_df; directed=true)
    @test m["directed"] == true
end

@testset "model_data → qe_plot round-trip" begin
    nodes_df  = DataFrame(code=["A","B"], SVD1=[0.5,-0.5], SVD2=[0.3,-0.3])
    edges_df  = DataFrame(
        QEUNIT    = ["G1::u1","G2::u1"],
        Condition = ["G1","G2"],
        AB        = [0.3, 0.7],
    )
    points_df = DataFrame(
        QEUNIT    = ["G1::u1","G2::u1"],
        Condition = ["G1","G2"],
        SVD1      = [0.4, -0.4],
        SVD2      = [0.2, -0.2],
    )
    m = model_data(nodes_df, edges_df, points_df; group_col="Condition")
    p = qe_plot(m)
    @test qe_groups(p) == ["G1", "G2"]
    @test length(qe_units(p)) == 2
end


# ══ Base.show ════════════════════════════════════════════════════════════════════

@testset "Base.show text output" begin
    p = qe_plot(model)
    s = sprint(show, p)
    @test occursin("QEPlot", s)
    @test occursin("FirstGame", s)
end

@testset "Base.show text/html output" begin
    p = qe_plot(model)
    s = sprint(show, MIME("text/html"), p)
    @test occursin("<qe-visual", s)
    @test occursin("setModelData(", s)
end
