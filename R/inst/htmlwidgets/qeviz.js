// htmlwidgets binding for qe_widget().
//
// x.graph is the <qe-graph> markup that qe_html() builds (layers as child
// elements, plot attributes); x.model is the ModelData JSON string, parsed
// here so R-side serialisation matches qe_html() exactly.
HTMLWidgets.widget({
  name: "qeviz",
  type: "output",

  factory: function (el, width, height) {
    var vis = null, markup = null;

    return {
      renderValue: function (x) {
        // Rebuild only when the layer markup changes; a Shiny re-render with
        // the same layers just swaps the model on the existing element.
        if (!vis || markup !== x.graph) {
          el.innerHTML = '<qe-visual style="display:block;width:100%;height:100%">' +
                         x.graph + '</qe-visual>';
          vis = el.firstElementChild;
          markup = x.graph;
          var g = vis.querySelector("qe-graph");
          if (g) g.style.cssText = "display:block;width:100%;height:100%";
        }
        vis.setModelData(typeof x.model === "string" ? JSON.parse(x.model) : x.model);
      },

      // The graph fills el; qe-graph re-lays out its pixel-sized text itself.
      resize: function (width, height) {}
    };
  }
});
