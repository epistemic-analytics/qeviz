# tools/widget-demo/app.R — Shiny check for qeOutput() / renderQe().
#
#   RENA_SRC=/path/to/rENA Rscript -e 'shiny::runApp("tools/widget-demo", port = 7802)'
suppressPackageStartupMessages({
  rena_src <- Sys.getenv("RENA_SRC", "")
  if (nzchar(rena_src)) pkgload::load_all(rena_src, quiet = TRUE, export_all = FALSE)
  else library(rENA)
  pkgload::load_all(file.path(getwd(), "..", "..", "R"), quiet = TRUE, export_all = FALSE)
})
library(shiny)

data(RS.data)
codes <- c("Data", "Technical.Constraints", "Performance.Parameters",
           "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration")
set <- ena.make.set(ena.accumulate.data(
  units = RS.data[, c("Condition", "UserName")],
  conversation = RS.data[, c("Condition", "GroupName")],
  codes = RS.data[, codes], window.size.back = 4))

ui <- fluidPage(
  selectInput("g", "Group", c("FirstGame", "SecondGame")),
  checkboxInput("sub", "Subtract the other group"),
  qeOutput("plot", height = "480px")
)
server <- function(input, output) {
  output$plot <- renderQe({
    other <- setdiff(c("FirstGame", "SecondGame"), input$g)
    p <- qe_plot(set, title = input$g, group_col = "Condition")
    p <- if (input$sub) qe_edges(p, input$g, compare = other) else qe_edges(p, input$g)
    p |> qe_group(input$g) |> qe_labels(nodes = "on")
  })
}
shinyApp(ui, server)
