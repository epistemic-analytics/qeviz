import { Tools } from "../utils/Tools";
import { Graph } from "../objects/Graph";
import { DimensionVector, Label, Line, PlottedObject, PlottedObjectOptions, Point } from "../objects/PlottedObject";
import { Mean, Node } from "../objects/Points";
import VizENAElement from "./VizENA";
import { Edge, MeanNodeEdge, NodeEdge } from "../objects/Edges";
import { Layer, LayerLike } from "../objects/Layers";

import { DataFrame, DataFrameColumnType, DataFrameRow } from "../types/DataFrame";

import { vizENA } from "./VizENA";
import { DrawableElement } from "./DrawableElement";
import { ENALayer, ENAElement, ENAArray } from "./ENALayer";
import { ENAPoint } from "./ENAPoint";
import { AxisPoint } from "../objects/AxisPoint";
import { ENALine } from "./ENALine";

interface ObjectHandler<T> {
  name?: string;
  size?: number; // Size of the object handler, used for points and labels
  plotted: Map<string, T>; // Used for labels and points
  get_pos?: (d: T, w: string) => any;
  enter: (enter: any) => any;
    update: (update: any) => any;
  draw: (animated: boolean, data?: any) => void;

  create?: (elm: any, at_origin: boolean, graph: any) => any;
  add?: (data: any, draw?: boolean) => void;
  show?: (data: any) => void;

  clear: (type?: any) => void;
}

// Legacy graph implementation — superseded by ENASvgElement ("ena-graph").
// Tag name kept with "-old" suffix to avoid collision. Class retained as a
// type reference by ENALayer, ENALine, and VizTools.
export class EnaGraphElement extends DrawableElement implements ENAElement {
  static tagName: string = "ena-graph-old";

  svg_element: SVGElement;
  graph: EnaGraphElement;
  parent: SVGElement | null;
  zoom_level: number = 1;

  __data__: Graph;
  __children__: ENAArray = new ENAArray();
  __name__: string;

  static get observedAttributes() {
    return ['updated', 'nodes', 'edges', 'points', 'labels', 'layers', 'extremes'];
  }
  static style: string = `
    ${DrawableElement.style}

    svg {
      width:  calc(attr(data-graph-size px) - var(--tabs-height));
      height: calc(attr(data-graph-size px) - var(--tabs-height));

      aspect-ratio: 1 / 1;
      background-color: #FFF;
    }
      svg > g.points > .point {
        cursor: pointer;
      }
      svg > g.points > .mean > path {
        fill: none;
      }

      svg .labels text {
        user-select: none;
        cursor: move;
      }

      /** Accessibility styling: graph **/
      svg .network:focus,
      svg .edges:focus,
      svg .nodes:focus,
      svg .edges g:focus,
      svg .edges .edge:focus,
      svg .points g:focus,
      svg .points .node circle:focus,
      svg .nodes g:focus,
      svg .nodes .node circle:focus {
        fill: inherit;
        outline: none;
      }
        svg .edges g:focus .edge,
        svg .edges .edge:focus {
          stroke: inherit;
          fill: inherit;
        }
        svg .nodes .node circle {
          stroke: transparent;
          stroke-width: 0px;
        }
        svg .nodes g:focus circle,
        svg .nodes .node circle:focus,
        svg .points g:focus circle,
        svg .points circle:focus {
          fill: inherit;
        }
  `;

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'updated' && oldValue !== newValue) {
      // Respond to update, e.g.:
      // this.handleModelUpdate();
      debugger;
    }
  }

  constructor() {
  }

  // #region declarations
  private _vizena!: VizENAElement;

  private _layersOld: ObjectHandler<Layer> = {
    size: 0,
    plotted: new Map<string, Layer>(),
    enter: (enter: any) => {
      let
        new_layers = enter.append("svg:g")
          .attr("class", (d: any) => `${d.name} layer`)
          .attr("transform", (d: any) => d.transform.toString())
          .attr("tabindex", (d: any) => d.tabindex)
          .html((d: any) => {
            if (d.name === 'axes') {
              return `<line x1="0" y1="-50%" x2="0" y2="50%" stroke-width="0.1%" stroke="#000000"></line>
                  <line x1="-50%" y1="0" x2="50%" y2="0" stroke-width="0.1%" stroke="#000000"></line>`
            }
          })
        ;

      new_layers.append('svg:title').text((d: any) => ("" + d.name + " layer"))

      return new_layers;
    },
    update: (update: any) => {
      update.call((update: any) =>
        update.transition().duration(750)
          .attr("transform", function (d: any) {
            return d.transform.toString();
          })
      );

      return update;
    },
    draw: () => {
      console.warn("Un-implemented draw for layer handler");
    },
    clear: (type?: any) => {
      console.warn("Un-implemented clear for layer handler");
    }
  };
  // Attempt at not using d3
  private _points: ObjectHandler<Point> = {
    name: "points",
    size: 0,
    plotted: new Map<string, Point>(),
    enter: (enter: any) => {
      console.warn("Unimplemented enter for points handler");
      return enter;
    },
    update: (update: any) => {
      console.warn("Unimplemented update for points handler");
      return update;
    },
    create: (elm, at_origin, graph) => {
      const element: EnaGraphElement = this;
    },
    add: (data: any, draw: boolean = true) => {
      if (!this.__data__) {
        console.warn("No object to add points to: ", this);
        return;
      }

      let point_layer: ENALayer | undefined = this.__children__.find( el => el.__name__ === "points" );

      // Remove points not in data
      const existing_point_ids = new Set(this.__data__.points.keys());
      data.rowNames?.forEach((rowName: string) => existing_point_ids.delete(rowName));
      existing_point_ids.forEach((id: string) => {
        this.__data__.points.delete(id);
      });

      // Add new points from data
      data.rows().forEach((d: DataFrameRow) => {
        let
          numeric_col_names: any[] = d.names.filter((n: string, i: number) => d.types[i] === DataFrameColumnType.Double),
          numeric_vals: any[] = d.types.map((t: DataFrameColumnType, i: number) => d.types[i] === DataFrameColumnType.Double ? d[i] : null).filter((v: any) => v !== null),
          numeric_row: DataFrameRow = new DataFrameRow(numeric_col_names, numeric_vals, d.rowName, d.parent),
          numeric_dims: DimensionVector = DimensionVector.fromArray(numeric_row),
          meta_col_names: any[] = d.names.filter((n: string, i: number) => d.types[i] !== DataFrameColumnType.Double),
          meta_vals: any[] = d.types.map((t: DataFrameColumnType, i: number) => d.types[i] !== DataFrameColumnType.Double ? d[i] : null).filter((v: any) => v !== null),
          meta_row: DataFrameRow = new DataFrameRow(meta_col_names, meta_vals, d.rowName, d.parent)
          ;

        let 
          new_point: Point = new Point(numeric_dims, {
            ID: d.rowName,
            meta: meta_row,
            size: 1,
            visible: true,
            shape: "circle"
          }),
          new_ena_point: ENAPoint = new ENAPoint(new_point, point_layer!.svg_element, this)
        ;

        if(point_layer) {
          point_layer.__children__.push(new_ena_point);
          point_layer.__data__.objects.set(new_point.ID, new_point);
        }
      });

      point_layer?.update();
    },
    draw: (animated = true) => {
      const element = this;
      if (!element.__data__ || !element.__data__.points) {
        console.warn("No points to draw in graph: ", element.__data__);
        return;
      }

      // Draw with just HTML/JS, no D3
      const pointsLayer = element.svg?.querySelector('g.points');
      if (!pointsLayer) {
        console.warn("No g.points layer found in SVG.");
        return;
      }

      // Get current points by ID
      const existing = new Map<string, SVGGElement>();
      pointsLayer.querySelectorAll('g.point').forEach((g: Element) => {
        const id = g.getAttribute('id');
        if (id) existing.set(id, g as SVGGElement);
      });

      // Add/update points
      for (const point of element._object.points.values()) {
        let g = existing.get(point.ID);
        const 
          shape = point.shape || 'circle',
          x = point.dimension(element._object.options.GRAPH.dimensions[0]) ?? 0,
          y = point.dimension(element._object.options.GRAPH.dimensions[1]) ?? 0,
          r = (typeof point.size !== "undefined" && point.size >= 0) ? Math.abs((point.size / 4) * +point.visible) : element._object.base_point_size(16),
          color = "#FF0000" //point.color
        ;

        if (!g) {
          g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.classList.add('point');
          g.setAttribute('id', point.ID);
          g.setAttribute('tabindex', '0');

          let shapeElem: SVGElement;
          if (shape === 'circle') {
            shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shapeElem.setAttribute('cx', x.toString());
            shapeElem.setAttribute('cy', y.toString());
            shapeElem.setAttribute('r', r.toString());
            shapeElem.setAttribute('fill', color.toString());
          }
          else if (shape === 'rect') {
            shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shapeElem.setAttribute('x', x.toString());
            shapeElem.setAttribute('y', y.toString());
            shapeElem.setAttribute('width', (point.size ?? 1 / 2).toString());
            shapeElem.setAttribute('height', (point.size ?? 1 / 2).toString());
            shapeElem.setAttribute('fill', color.toString());
          }
          else {
            continue;
          }

          shapeElem.setAttribute('data-id', point.ID);
          // Add attribute with the data like d3 at __data__
          // (shapeElem as any).__data__ = point;

          g.appendChild(shapeElem);
          (g as any).__data__ = point;
          // (g.dataset as any)['__data__'] = point;

          // Add title
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = point.ID;
          shapeElem.appendChild(title);

          pointsLayer.appendChild(g);
          this._points.plotted.set(point.ID, point);

          shapeElem
            .addEventListener('click', (ev: Event) => {
              if (ev.type === 'keypress' && (ev as KeyboardEvent).keyCode !== 13) return;

              let target_element = ev.target as HTMLElement;
              if (d.active === true) {
                element.vizena.dispatchEvent(Tools.Events.createEvent("deactivate.point", target_element));
              }
              else {
                if (vizENA.OPTIONS.NODE.labels === Label.DISPLAY_TYPES.CLICK) {
                  d.label.visible = !d.label.visible;
                  vizENA.labels.draw(false);
                }
                element.vizena.dispatchEvent(Tools.Events.createEvent("click.point", target_element));
              }
            })
          ;
          shapeElem
            .addEventListener('mouseover', (ev: Event) => {
              console.log("Mouse over point:", point, shapeElem);
              if (element._object.options[point.constructor.name.toUpperCase()].labels == Label.DISPLAY_TYPES.AUTO) {
                if (point.label) {
                  point.label.visible = true;

                  // const pointsLayer = element._object?.layers.search("layers", "points")
                    // svg = element.svg,
                    // pointElement = this,
                    // pointBBox = pointElement.getBBox(),
                    // pointX = pointBBox.x + pointBBox.width / 2,
                    // pointY = pointBBox.y + pointBBox.height / 2,
                    // screenPoint = new DOMPoint(pointX, pointY),
                    // screenCTM = svg.getScreenCTM().inverse(),
                    // svgPoint = screenPoint.matrixTransform(screenCTM),
                    // x = svgPoint.x,
                    // y = svgPoint.y
                    ;
                  // console.log('SVG Coordinates:', svgPoint.x, svgPoint.y);
                  // d.label.y = pointY;
                  // d.label.x = pointX;
                  if (pointsLayer) {
                    point.label.transform.a = (pointsLayer as SVGGElement).transform.baseVal[0].matrix.a;
                    point.label.transform.d = (pointsLayer as SVGGElement).transform.baseVal[0].matrix.d;
                    // point.label.transform.e = 0.02; // point.label.transform.e / pointsLayer.transform.a;
                    // point.label.transform.f = 0.02; // point.label.transform.f / pointsLayer.transform.d;
                    element._labels.draw(false);
                  }
                }
              }

              let target_element = ev.target as HTMLElement;
              target_element.classList.add("hovered");
              window.dispatchEvent(Tools.Events.createEvent("enter.point", target_element));
            })
          ;
          shapeElem
            .addEventListener('mouseout', (ev: Event) => {
              if (element._object.options.POINT.labels === Label.DISPLAY_TYPES.AUTO) {
                if (point.label) {
                  point.label.visible = false;
                  element._labels.draw(false);
                }
              }
              let target_element = ev.target as HTMLElement;
              target_element.classList.remove("hovered");
              window.dispatchEvent(Tools.Events.createEvent("exit.point", target_element));
            })
          ;
        }

        // Point <g/> exists - animate to new state
        else {
          const shapeElem = g.querySelector(shape) as SVGElement;

          if (shapeElem) {
            if (shape === 'circle') {
              animateSVGAttribute(shapeElem, 'cx', x);
              animateSVGAttribute(shapeElem, 'cy', y);
              animateSVGAttribute(shapeElem, 'r', r);
            }
            else if (shape === 'rect') {
              animateSVGAttribute(shapeElem, 'x', x);
              animateSVGAttribute(shapeElem, 'y', y);
              shapeElem.setAttribute('width', (point.size ?? 1 / 2).toString());
              shapeElem.setAttribute('height', (point.size ?? 1 / 2).toString());
            }
            shapeElem.setAttribute('fill', color.toString());
          }
          
          existing.delete(point.ID);
        }
      }

      // Remove points not in data (those remaining in existing[])
      for (const g of existing.values()) {
        g.classList.add('removing');
        g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500 }).onfinish = () => {
          g.remove();
        };
      }

      // Helper for animating SVG attributes
      function animateSVGAttribute(elem: SVGElement, attr: string, to: number) {
        const from = parseFloat(elem.getAttribute(attr) || '0');
        if (from === to) return;
        const duration = 500;
        const start = performance.now();
        function animate(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const value = from + (to - from) * t;
          elem.setAttribute(attr, value.toString());
          if (t < 1) requestAnimationFrame(animate);
          else elem.setAttribute(attr, to.toString());
        }
        requestAnimationFrame(animate);
      }
    },
    clear: () => {

    }
  };
  private _labels: ObjectHandler<Label> = {
    name: "labels",
    size: 0,
    plotted: new Map<string, Label>(),
    add: (data: any, draw: boolean = true) => {
      if (!this.object) {
        console.warn("No object to add points to: ", this);
        return;
      }

      // Remove labels not in data
      const existing_label_ids = new Set(this.object.labels.keys());
      console.log("Existing point IDs before adding labels: ", existing_label_ids);

      this.object.labels.set(data.ID, data);      
    },
    enter: (label: any) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('label');
      g.setAttribute('id', label.ID);
      
      return g;
    },
    update: (update: any) => {
      console.warn("Unimplemented update for labels handler");
      return update;
    },
    draw: (is_new = true) => {
      const 
        element = this
      ;
      if (!element._object || !element._object.labels) {
        console.warn("No labels to draw in graph: ", element._object);
        return;
      }

      // Draw with just HTML/JS, no D3
      const layer = element.svg?.querySelector(`g.${element._labels.name}`);
      if (!layer) {
        console.warn("No g.labels layer found in SVG.");
        return;
      }

      // Get current labels by ID
      const 
        existing = new Map<string, SVGGElement>()
      ;
      layer
        .querySelectorAll('g.label')
        .forEach((g: Element) => {
          const id = g.getAttribute('id');
          if (id) existing.set(id, g as SVGGElement);
        })
      ;

      // Add/update labels
      const 
        label_vals = [...element._object.points.values(), ...element._object.nodes.values()].flat()
      ;

      for (const label of label_vals) {
        let 
          g = existing.get(label.ID)
        ;
        if(!g) {
          // g = element._labels.add(label, false);
        }
      }
    },
    clear: (type?: any) => {
      console.warn("Unimplemented clear for labels handler");
    }
  };
  private _edges: ObjectHandler<Edge> = {
    size: 0,
    plotted: new Map<string, Edge>(),
    enter: (enter: any) => {
      console.warn("Unimplemented enter for edges handler");
    },
    update: (update: any) => {
      console.warn("Unimplemented update for edges handler");
    },
    create: function (elm: any, at_origin: boolean = true, element: any) {
      let
        adjust_weight = (d: any) => {
          // return ((d.weight ? Math.abs(d.weight * 1 * (d.visible * 1)) : 0) * element._object.SIZE_EFFECT);
          return Math.abs(d.weight) * d.scale_size; // * zoom_level
        }
        ;

      //#region edges as lines
      let
        line_elm = elm.filter((d2: any) => d2.shape === 'line')
        ;
      line_elm.select(".edge")
        .attr('x1', (d: any) => at_origin ? 0 : d.x1)
        .attr('y1', (d: any) => at_origin ? 0 : d.y1)
        .attr('x2', (d: any) => at_origin ? 0 : d.x2)
        .attr('y2', (d: any) => at_origin ? 0 : d.y2)
        .attr('stroke-width', (d: any) => {
          // return d.weight ? Math.abs(d.weight * element._object.SIZE_EFFECT  * (d.visible * 1)) : 0;
          // return Math.abs(d.weight);
          let
            wt = adjust_weight(d)
            ;
          return wt;
        })
        .attr('opacity', (d: any) => (d.visible * 1))
        .attr('stroke', (d: any) => d.color)
        .attr('data-edge-from', (d: any) => d.from.ID)
        .attr('data-edge-to', (d: any) => d.to.ID)
        ;
      //#endregion

      //#region edges as paths
      let path_elm = elm.filter((d2: any) => d2.shape !== 'line');
      path_elm.select(".edge")
        .attr('d', (d: any) => {
          // console.log(d.ID, " --> ", d.path, d);
          return d.path
        })
        .attr('fill', (d: any) => d.color)
        .attr('opacity', (d: any) => (d.visible * 1))
        .attr('stroke', (d: any) => {
          return d.color ? d.color.toString(1.25) : "#000";
        })
        // .attr('stroke-width', (d: any) => d.weight ? (Math.abs(d.weight) * element._object.SIZE_EFFECT / 10) : 0)
        .attr('stroke-width', (d: any) => {
          // return (d.weight ? (Math.abs(d.weight)) : 0) * element._object.SIZE_EFFECT;
          return 0.01 * element._object.SIZE_EFFECT;
        })
        .style('paint-order', 'stroke')
        .select("title").text((d: any) => ("" + d.to.ID + " edge -weight of: " + d.weight))
        // .attr("transform", "matrix(1 0 0 1 0 0)")
        ;
      path_elm.select(".edge-arrow")
        .attr("opacity", (d: any) => (d.visible && d.with_arrow) ? 0.2 : 0.0)
        .attr("d", (d: any) => {
          // debugger;
          return d.with_arrow ? d.arrow.path : ''
        })
        ;
      //#endregion

      //#region edge attributes
      // elm.attr('transform-s', (d: any) => {
      //   // console.log("D: ", d);
      //   return d.transform.toString();
      // });
      // elm.attr('data-edge-weight', (d: any) => d.weight);
      // elm.attr('data-edge-from', (d: any) => d.from.ID);
      // elm.attr('data-edge-weight-drawn', (d: any) => adjust_weight(d));
      // elm.attr('data-edge-to', (d: any) => d.to.ID);
      //#endregion

      return elm;
    },
    add: (data: any, draw = true, sorted = true) => {
      const element = this;
      if (data) {
        debugger;
        // let edges = data.map( e => {
        //   let new_edge, unit_pt, ndoes;
        //   if (e instanceof Edge) {
        //     new_edge = e;

        //     nodes = [e.from, e.to];
        //   }
        //   else {
        //     console.log("Element: ", element);
        //     nodes = ['from', 'to'].map( w => vizENA.object.nodes.get(e[w]) );

        //     let
        //       new_edge_fn = vizENA.edges.types.find( f => f.name === (e.shape+"Edge"))
        //     ;
        //     if( new_edge_fn ) {
        //       new_edge = new new_edge_fn(e, nodes[0], nodes[1], vizENA.object);
        //     }
        //     else {
        //       new_edge = new Edge(e, nodes[0], nodes[1], vizENA.object);
        //     }
        //   }

        //   new_edge.visible = true;
        //   console.log("Setting edge on node: ", new_edge.ID, nodes[0].ID, nodes[1].ID)
        //   nodes[0].edges.set(new_edge.ID, new_edge);
        //   nodes[1].edges.set(new_edge.ID, new_edge);

        //   unit_pt = vizENA.object.points.get(new_edge.meta.ENA_UNIT);
        //   if (unit_pt) {
        //     unit_pt.edges.set(new_edge.ID, new_edge);
        //   }

        //   return( new_edge );
        // });

        // if (sorted === true) {
        //   edges = edges.sort( (a, b) => {
        //     return a.weight < b.weight ? 1 : -1
        //   });
        // }

        // // vizENA.object.add_edges(edges);
        // element._vizena
      }
      if (draw) {
        element._edges.draw(false, undefined)
      }
    },
    show: (edges: any) => {
      const element = this;
      // [...edges.values()].forEach(e => {
      edges.forEach((e: any) => {
        // vizENA.object.add_edge(e);
      });
      element._edges.draw(false, undefined);
    },
    draw: (animated: boolean = true, data?: any) => {
      console.error("d3 removed");
      // const element = this;
      // let
      //   edge_enter = (enter: any) => {
      //     let
      //       edge_gs: any = enter
      //         .append("svg:g")
      //         .attr('id', (d: any) => d.ID)
      //         .classed('edge-g', true)
      //       ,
      //       edge_elems: any = edge_gs
      //         .append((d: any) => {
      //           // return d3.create(`svg:${d.shape != 'line' ? 'path' : 'line'}`).node()
      //         })
      //         .classed('edge', true)
      //         .attr("d", (d: any) => d.path)
      //         .call(element._edges.create, true, element)
      //       ,
      //       edge_arrs: any = edge_gs
      //         .select((d: any, i: number, elms: any) => {
      //           if (d.with_arrow && d.with_arrow === true) {
      //             let elm = elms[i];
      //             console.error("d3 removed");
      //             // d3.select(elm)
      //             //   .append("svg:path")
      //             //   .attr("d", d.arrow.path)
      //             //   .classed("edge-arrow", true)
      //             //   ;
      //           }
      //         })
      //       ;

      //     // console.log("Edge arrays: ", edge_arrs, edge_elems);

      //     edge_elems.append("svg:title").text((d: any) => ("" + d.ID + " edge -weight of: " + (d.totalweight || d.weight)))
      //     edge_elems.attr("tabindex", 0);
      //     edge_elems.attr("fill", (d: any) => d.color);

      //     return edge_gs;
      //   },
      //   edge_update = (update: any) => {
      //     update
      //       .call((update: any) =>
      //         update.transition().duration(500)
      //           .call(element._edges.create, false, element)
      //       )
      //       // .attr("transform", (d: any) => `matrix(${zoom_level} 0 0 ${zoom_level} 0 0)`)
      //       .select(function (d: any) {
      //         d.from.visible = d.visible;
      //         d.to.visible = d.visible;
      //       })
      //       ;

      //     return update;
      //   },
      //   edge_click = function (ev: Event, d: any) {
      //     if (ev.type === 'keypress' && (ev as KeyboardEvent).keyCode !== 13) return;

      //     d.active = !d.active;
      //     d.from.active = d.active;
      //     d.to.active = d.active;

      //     const target_element = ev.target as HTMLElement;
      //     window.dispatchEvent(Tools.Events.createEvent("click.edge", target_element));
      //   },
      //   edge_mouseover = function (ev: Event, d: any) {
      //     const target_element = ev.target as HTMLElement;
      //     target_element.classList.add("hovered");
      //     window.dispatchEvent(Tools.Events.createEvent("enter.edge", target_element));
      //   },
      //   edge_mouseout = function (ev: Event, d: any) {
      //     const target_element = ev.target as HTMLElement;
      //     target_element.classList.remove("hovered");
      //     window.dispatchEvent(Tools.Events.createEvent("exit.edge", target_element));
      //   }
      // ;

      // let
      //   // dat = data ? Array.isArray(data) ? data : data.edges : [...element._vizena.edges.values()],
      //   dat = data ?
      //     Array.isArray(data) ?
      //       data :
      //       data.edges :
      //     [...(element.object?.edges?.values() ?? [])]
      //   ,
      //   edge_elems = element.d3wrapper.select("svg g.edges")
      //     .selectAll('.edge-g')
      //     .data(
      //       dat
      //         .filter((n: any) => !(n instanceof NodeEdge) && !(n instanceof MeanNodeEdge))
      //         .sort(function (a: NodeEdge, b: NodeEdge) {
      //           return a.weight - b.weight
      //         })
      //       ,
      //       function (x: any) {
      //         return x.ID
      //       }
      //     )
      //     .join(
      //       edge_enter,
      //       edge_update,
      //       (exit: any) => exit.remove()
      //     )
      //   ,
      //   edgenodes_elems = element.d3wrapper.select("svg g.edgenodes")
      //     .selectAll('.edge-g')
      //     .data(
      //       [...element.vizena.edges.values()]
      //         .filter((n: any) => {
      //           return (n instanceof NodeEdge || n instanceof MeanNodeEdge)
      //         })
      //       ,
      //       function (x: any) {
      //         return x.ID;
      //       }
      //     )
      //     .join(
      //       edge_enter,
      //       edge_update,
      //       (exit: any) => exit.remove()
      //     )
      //   ;
      // edge_elems
      //   .on('click keypress', edge_click)
      //   .on('mouseover focus', edge_mouseover)
      //   .on('mouseout blur', edge_mouseout)
      //   ;
      // edgenodes_elems
      //   .on('click keypress', edge_click)
      //   .on('mouseover focus', edge_mouseover)
      //   .on('mouseout blur', edge_mouseout)
      //   ;

      // animated && element._edges.draw(false);
      // element._nodes.draw(false);
    },
    clear: () => {
      let element = this;
      [...element.vizena.edges.values()].forEach(e => {
        // e.weight = 0;
        e.visible = false;
      });
      [...element.vizena.points.values()].filter(p => p.active).forEach(p => p.active = false)
      element._edges.draw(false);
      element._nodes.draw(false);
    }
  };
  private _nodes: ObjectHandler<Node> = {
    plotted: new Map<string, Node>(),
    enter: (enter: any) => {
      console.warn("Unimplemented enter for nodes handler");
    },
    update: (update: any) => {
      console.warn("Unimplemented enter for nodes handler");
    },
    add: (data: DataFrame) => {
      if (!this.object) {
        console.warn("No object to add nodes to: ", this);
        return;
      }

      // Remove nodes not in data
      const existing_node_ids = new Set(this.object.nodes.keys());
      data.rowNames?.forEach((rowName: string) => existing_node_ids.delete(rowName));
      existing_node_ids.forEach((id: string) => {
        this.object.nodes.delete(id);
      });

      // Add new nodes from data
      data.rows().forEach((d: DataFrameRow) => {
        let 
          new_node: Node = new Node(d, {
            ID: d.rowName
          } as PlottedObjectOptions),
          new_node_label
        ;

        if(this.object.options.NODE.labels === Label.DISPLAY_TYPES.ON) {
          new_node_label = new Label(new_node.ID, new_node);
          new_node.label = new_node_label;
        }

        if (this.object) {
          this.object.nodes.set(new_node.ID, new_node);
          if(new_node_label) {
            this.object.labels.set(new_node_label.ID, new_node_label);
          }
        }
      });
    },
    draw: (animated = true) => {
      console.error("d3 removed");
      // const
      //   element = this
      // ;

      // let
      //   nd_vals = element.object ? [...element.object.nodes.values()] : [],
      //   node_elems = element.d3wrapper.select("g.nodes")
      //     .selectAll(':scope > g')
      //     .data(nd_vals, function (x: any) { return x.ID })
      //     .join(
      //       (enter: any) => {
      //         let
      //           g = enter.append('svg:g')
      //             .attr("transform", (d: any) => d.transform.toString())
      //             .attr('tabindex', (d: any, i: number) => 0) // i + 1)
      //             .attr('aria-describedby', (d: any) => ("label-" + d.ID))
      //             .classed("node", true)
      //             .attr('id', (d: any) => d.ID)
      //           ,
      //           circs = g.append("svg:circle")
      //             .attr('data-id', (d: any) => d.ID)
      //             .attr('cx', 0)
      //             .attr('cy', 0)
      //             .attr('fill', (d: any) => d.color)
      //             .attr('r', (d: any) => 0)
      //           ;
      //         circs.append("svg:title").text((d: any) => (d.ID + " node. size of: " + (d.size / 2)));

      //         return g;
      //       },
      //       (update: any) => {
      //         update.select("g.node")
      //           .call((update2: any) => {
      //             update.transition().duration(500)
      //               .attr("transform", (d: any) => {
      //                 d.transform.a = zoom_level;
      //                 d.transform.d = zoom_level;

      //                 return d.transform.toString()
      //               })
      //             ;
      //             update.select("circle").transition().duration(500)
      //               .attr('cx', (d: PlottedObject) => d.dimension(this.object.options.GRAPH.dimensions[0] ?? 0))
      //               .attr('cy', (d: PlottedObject) => d.dimension(this.object.options.GRAPH.dimensions[1] ?? 0))
      //               .attr('fill', (d: PlottedObject) => {
      //                 return d.active ? "yellow" : d.color
      //               })
      //               .attr('transform', (d: PlottedObject) => {
      //                 const
      //                   x: number = d.dimension(this.object.options.GRAPH.dimensions[0] ?? 0) ?? 0,
      //                   y: number = d.dimension(this.object.options.GRAPH.dimensions[1] ?? 0) ?? 0,
      //                   updated = zoom_level > 0 ?
      //                     `matrix(1 0 0 1 ${((1 / zoom_level) * x) - x} ${((1 / zoom_level) * y) - y})` :
      //                     `matrix(1 0 0 1 0 0)`
      //                 ;

      //                 return updated;
      //               })
      //               //        (d.size / 2) //  * element._object.SIZE_EFFECT // * d.scale_size
      //               // return d.size ? Math.abs(d.size * element._object.SIZE_EFFECT * (d.visible * 1)) : 0
      //               // return d.size ? (Math.abs(d.size * (d.visible * 1) / 2)) : 0
      //               // return 1

      //               // console.log("node r: ", element._object.SIZE_EFFECT);
      //               .attr('r', (d: PlottedObject) => {
      //                 // return (d.size / 2) //  * element._object.SIZE_EFFECT // * d.scale // * d.scale_size;
      //                 // return 1_size
      //                 // return d.size ? Math.abs(d.size * element._object.SIZE_EFFECT * (d.visible * 1)) : 0
      //                 // return d.size ? (Math.abs(d.size * (d.visible * 1) / 2)) : 0
      //                 // return 1

      //                 // console.log("node r: ", element._object.SIZE_EFFECT);
      //                 return (
      //                   (typeof d.size !== "undefined" && d.size >= 0) ?
      //                     Math.abs((d.size / 2) * (d.visible * 1)) :
      //                     this.object.base_point_size()
      //                 ) * (element._object?.SIZE_EFFECT ?? 1);
      //                 // return 1
      //               })
      //             ;
      //             update
      //               .select("title")
      //               .text((d: any) => {
      //                 return (d.ID + " node. size of: " + (d.size))
      //               })
      //             ;
      //             update
      //               .select("desc")
      //               .text((d: any) =>
      //                 ("size of: " + ((d.size / 2) * ((element._object?.SIZE_EFFECT ?? 1) * d.scale_size)) + "")
      //               )
      //             ;
      //             update
      //               .select(function (d: any) {
      //                 if (d.label) {
      //                   // d.label.visible = ((d.size / 2) * element._object.SIZE_EFFECT * d.scale_size) > 0 ? true : false;
      //                 }
      //                 d
      //               })
      //             ;

      //             return update2;
      //           })
      //         ;

      //         return update;
      //       }
      //       // ,exit => exit.remove()
      //     )
      // ;

      // node_elems
      //   .on('click keypress', function (ev: Event, d: any) {
      //     if (ev.type === 'keypress' && (ev as KeyboardEvent).keyCode !== 13) return;

      //     if (vizENA.OPTIONS.NODE.labels === Label.DISPLAY_TYPES.CLICK) {
      //       d.label.visible = !d.label.visible;
      //       vizENA.labels.draw(false);
      //     }

      //     const target_element = ev.target as HTMLElement;
      //     element.vizena.dispatchEvent(Tools.Events.createEvent("click.node", target_element));
      //   })
      //   .on('mouseover focus', function (ev: Event, d: any) {
      //     // if (vizENA.OPTIONS.NODE.labels === Label.DISPLAY_TYPES.AUTO) {
      //     //   d.label.visible = true;
      //     //   vizENA.labels.draw(false);
      //     // }

      //     const target_element = ev.target as HTMLElement;
      //     window.dispatchEvent(Tools.Events.createEvent("enter.node", target_element));
      //     target_element.classList.add("hovered");
      //   })
      //   .on('mouseout blur', function (ev: Event, d: any) {
      //     // if (vizENA.OPTIONS.NODE.labels === Label.DISPLAY_TYPES.AUTO) {
      //     //   d.label.visible = false;
      //     //   vizENA.labels.draw(false);
      //     // }

      //     const target_element = ev.target as HTMLElement;
      //     target_element.classList.remove("hovered");
      //     window.dispatchEvent(Tools.Events.createEvent("exit.node", target_element));
      //   })
      // ;

      // // element._labels.draw(true);
      // animated && element._nodes.draw(false);
      // // element.update();
    },
    clear: () => {
      let element: EnaGraphElement = this;
      element.edges.clear();

      for (let n of element.vizena.nodes.values()) {
        n.visible = false;
        if (n.label) {
          n.label.visible = false;
        }
      }
      // vizENA.nodes.draw(false);
      element._nodes.draw(false);
      element._labels.draw(false);
    }
  };
  // private _object: Graph;
  private _linked: any[] = [];
  private _networks_on_activate: boolean = true;
  // #endregion

  get options() {
    return this.vizena.options;
  }
  get linked() {
    return this._linked;
  }
  set linked(l) {
    this._linked = l;
  }
  get networks_on_activate() {
    return this._networks_on_activate;
  }

  /* 
  * ena-graph elements need to be connected to the vizena element
  * so that they can access the vizena object and its methods.
  * This is done in the connectedCallback method.
  */
  connectedCallback() {
    console.log("Connecting to the ena-graph here: ", this);

    if (!this._vizena) {
      let v = this.closest("ena-visual") as VizENAElement;
      if (!v) {
        console.error("No vizena found, cannot continue.");
        this.remove();
        return;
      }
      this._vizena = v;
    }

    let
      element = this,
      linked = element.getAttribute('link-to')
    ;
    if (linked) {
      element._linked = linked.split(/,/).map(l => l.trim());
    }
    else {
      element._linked = [];
    }
    element._networks_on_activate = !element.hasAttribute('no-networks');

    element.addEventListener("clicked.node", function (event: Event) {
      let
        node = (event as CustomEvent).detail.data.node
        ;

      // console.log("Node was clicked, do we care?: ", origin_graph.id, linked_graphs);
      if (!element.nodes.plotted?.has(node.ID)) {
        event.stopPropagation()
        event.preventDefault()
        console.log("Node isn't here yet, plot it.")
        return false
      }
      else {
        console.log("Node here, move on...")
      }
    });
    element.addEventListener("clicked.point", function (event: Event) {
      let
        point = (event as CustomEvent).detail.data.point,
        this_graph = element
      ;

      // console.log("Node was clicked, do we care?: ", origin_graph.id, linked_graphs);
      // if(!this.points.plotted.has(point.ID)) {
      // if(this.points.plotted.size === 0) {
      // if(point) {
      if (this_graph.points.size === 0) {
        event.stopPropagation();
        event.preventDefault();
        console.log("Point isn't here yet, plot it.");

        vizENA
          .nodes.show(null, parseInt(this_graph.id))
          .points.show(point.ID, parseInt(this_graph.id))
          .edges.show()
        ;

        return false
      }
      else {
        console.log("Point here, move on...")
      }
    });
    element.addEventListener("update.graph", function (event) {
      // this.update();
    });
    element.addEventListener("model_updated", function (event) {
      debugger;
    });

    // this.update(false);
    this.draw();
  }

  // set options(opts) {
  //   let
  //     element = this
  //   ;

  //   element._object = new Graph(
  //     element.options.GRAPH.width,
  //     element.options.GRAPH.height,
  //     element.options.GRAPH.axes,
  //     element.options
  //   );
  // }
  set vizena(v: VizENAElement) {
    const element: EnaGraphElement = this;

    element._vizena = v;
    element._vizena.addEventListener("updated.points", function (ev: Event) {
      const customEv = ev as CustomEvent<{ data: { points: Point[] } }>;

      if (customEv.detail?.data) {
        if (element._points && typeof element._points.add === "function") {
          element._points.add(customEv.detail.data.points, false);
        }
      }
      element._points.draw(true);
    });
    element._vizena.addEventListener("activated.point", function (ev: Event) {
      const customEv = ev as CustomEvent<{ data: { point: Point } }>;

      element._edges.draw(true, customEv.detail.data.point);
    });
    element._vizena.addEventListener("deactivated.point", function (ev) {
      element.nodes.clear();
    });
    element._vizena.addEventListener("draw.points", function (ev) {
      element._points.draw(true);
    });
    element._vizena.addEventListener("draw.nodes", function (ev) {
      element._nodes.draw(true);
    });
    element._vizena.addEventListener("update.graph", function (ev) {
      // element.draw(true);
    });

    // element._vizena.addEventListener("clear.points", function(ev) {
    //   element.#points.clear();
    // });
    // element._vizena.addEventListener("clear.edges", function(ev) {
    //   element.#points.clear();
    // });
    // element._vizena.addEventListener("hidden.all", function(ev) {
    //   element.#points.clear();
    //   element._nodes.clear();
    // });
    // element._vizena.addEventListener("changed.edges", function(ev) {
    //   element.#edges.draw(true);
    // });

    // this.options = {};
    // element.update(false);
  }
  get vizena(): VizENAElement {
    return this._vizena;
  }
  get labels(): ObjectHandler<Label> {
    return this._labels;
  }

  _svg: SVGElement | null = null;
  set svg(s: SVGElement | null) {
    this._svg = s;
  }
  get svg() {
    let s = this._svg;
    if(!s) {
      s = this.shadowRoot?.querySelector("svg") || null;
    }
    return s;
  }

  private _layers: any = [];
  get layers() {
    return this._layers;
  }
  set layers(layers: any) {
    this._layers = layers;
  }

  create(): SVGElement {
    const 
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    ;

    svg.classList.add("graph");
    svg.setAttribute("viewBox", (this.__data__ as Graph).extremes.as_viewBox());
    svg.setAttribute("transform", (this.__data__ as Graph).transform.toString());
    svg.setAttribute("role", "figure");
    svg.setAttribute("data-graph-size", `${Math.min((this.__data__ as Graph).extremes.width, (this.__data__ as Graph).extremes.height)}`);
    this.svg_element = svg;

    this.__data__.layers.forEach((layer: LayerLike) => {
      let 
        layer_g: ENALayer = new ENALayer(layer, this.svg_element, this)
      ;

      this.__children__.push(layer_g);
    });

    // point_layer.__children__.push(new_ena_point);
    let 
      axisPointLayer: LayerLike | undefined = this.__data__.layers.search("layers", "axis_points"),
      axisLineLayer: LayerLike | undefined =  this.__data__.layers.search("layers", "axis_lines")
    ;
    if(axisPointLayer) {
      debugger;
      [...axisPointLayer.objects.entries()].forEach(([id, point]: [string, AxisPoint]) => {
        let new_ena_point = new ENAPoint(point, this.svg_element, this);
        this.__children__.push(new_ena_point);
      });
    }
    if(axisLineLayer) {
      debugger;
      [...axisLineLayer.objects.entries()].forEach(([id, line]: [string, Line]) => {
        let new_ena_line = new ENALine(line, this.svg_element, this);
        this.__children__.push(new_ena_line);
      });
    }

    this.attach_events();

    return svg;
  }

  attach_events() {
    // Attach event for zooming
    this.svg_element.addEventListener("wheel", (ev: WheelEvent) => {
      console.log("Wheel event: ", ev);
      ev.preventDefault();
      const delta = Math.sign(ev.deltaY);
      if (delta < 0) {
        this.zoom_level *= 1.1;
      } else {
        this.zoom_level /= 1.1;
      }
      this.__data__.transform.zoom(this.zoom_level);
      this.update(true);
    });

    // Attach event for panning
    let isPanning = false;
    let startX: number, startY: number;

    this.svg_element.addEventListener("mousedown", (ev: MouseEvent) => {
      isPanning = true;
      startX = ev.clientX;
      startY = ev.clientY;
    });
    this.svg_element.addEventListener("mousemove", (ev: MouseEvent) => {
      if (!isPanning) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      this.__data__.transform.pan(dx, dy);
      startX = ev.clientX;
      startY = ev.clientY;
      this.update(true);
    });
    this.svg_element.addEventListener("mouseup", (ev: MouseEvent) => {
      isPanning = false;
    });
  }

  draw() {
    if(!this.svg_element) {
      console.error("No element to draw to: ", this);
      return;
    }
    
    this.wrapper?.appendChild(this.svg_element);

    this.__children__.forEach((enaLayer: ENALayer) => {
      enaLayer.draw();
    });
  }

  // #region orginal methods
  // draw(animated = true) {
  //   const element = this;
  //   this.update_extremes();
  //   const rect = this.parentElement?.parentElement?.getBoundingClientRect() || { width: 0, height: 0 };
  //   let { width, height } = rect;

  //   if (!element.wrapper) {
  //     return;
  //   }
    
  //   let 
  //     svg_elems = d3.select(element.wrapper)
  //       .selectAll("svg")
  //       .data([element._object])
  //       .join(
  //         (enter: any) => {
  //           enter
  //             .append("svg")
  //             .attr("viewBox", function (d: any) {
  //               return d.extremes.as_viewBox()
  //             })
  //             .attr("transform", (d: any) => d.transform.toString())
  //             .attr("role", "figure")
  //             .classed("graph", true)
  //             .attr("data-graph-size", function () {
  //               return `${Math.min(width, height)}`;
  //             })
  //             ;

  //           // this.update_layers();

  //           return (enter);
  //         },
  //         (update: any) => {
  //           update.call((up: any) => {
  //             up.transition()
  //               .duration(500)
  //               .attr("viewBox", (d: any) => {
  //                 return d.extremes.as_viewBox()
  //               })
  //               .attr("transform", (d: any) => d.transform.toString())
  //               .attr("font-size", (d: any) => `${d.extremes.width * 0.2}%`)
  //               .attr("data-graph-size", function () {
  //                 return `${Math.min(width, height)}`;
  //               });

  //             return up;
  //           });

  //           return update;
  //         },
  //         (exit: any) => exit.remove()
  //       )
  //   ;
  //   console.log("Drawing graph elements: ", svg_elems);

  //   // this._pointsD3.draw(false, undefined);
  //   // this._points.draw(false, undefined);
  //   // this._nodes.draw(false, undefined);
  //   // this._edges.draw(animated, undefined);
  //   // this.labels.draw(false, undefined);
  // }

  update(animate = true) {
    this.update_extremes();
    animate && this.update(false);
    this.update_layers();
  }

  update_extremes() {
    this.__data__.update_extremes();

    const svgRect = this.svg_element?.getBoundingClientRect();
    if(this.svg_element && svgRect) {
      let w, h;
      if(svgRect.width === 0 || svgRect.height === 0) {
        w = 1;
        h = 1;
      }
      else {
        w = svgRect.width;
        h = svgRect.height;
      }
      this.__data__.scale_x = 1 / (w /  (4 * this.__data__.extremes.x_max));
      this.__data__.scale_y = 1 / (h / (4 * this.__data__.extremes.y_max));
      // this.__data__.scale = Math.max(this.__data__.scale_x, this.__data__.scale_y);

      this.svg_element.setAttribute("transform", this.__data__.transform.toString());
    }
    // const element = this;
    // let
    //   // find_max = (a: any, wh: any) => Math.max(...a.map(p => wh.map(w => Math.abs(p[wh])).flat())),
    //   nodes = [...this.object.nodes.values()].flat(),
    //   points = [...this.object.points.values()].flat(),

    //   nodes_max_x = Math.max(...[...nodes].map(n => Math.abs(n._x))),
    //   nodes_max_y = Math.max(...[...nodes].map(n => Math.abs(n._y))),

    //   points_max_x = Math.max(...[...points].map(n => Math.abs(n._x))),
    //   points_max_y = Math.max(...[...points].map(n => Math.abs(n._y))),

    //   // all_points = [...element.points.plotted.values(), ...element.nodes.plotted.values()].flat(),
    //   //all_points = [...element.object.points.values(), ...element.object.nodes.values()].flat(),
    //   all_points = nodes.concat(points).flat(),
    //   //x_max = Math.max(...all_points.map(p => Math.abs(p.x))),
    //   //y_max = Math.max(...all_points.map(p => Math.abs(p.y))),
    //   //max = Math.max(x_max, y_max)
    //   // max_n = find_max(nodes, ['x_', 'y_']),
    //   // max_p = find_max(points, ['x_', 'y_']),
    //   max = Math.max(...[nodes_max_x, nodes_max_y, points_max_x, points_max_y]),
    //   // max_r = __.math.round(max, 1),
    //   max_r = Tools.Mathematics.round(max, 1)
    //   ;

    // if (element._object) {
    //   debugger;
    //   if (all_points.length) {
    //     element._object.extremes = new Extremes(max_r, max_r, { x: nodes_max_x, y: nodes_max_y }, { x: points_max_x, y: points_max_y });
    //   }
    //   else {
    //     element._object.extremes = new Extremes(1, 1, { x: 1, y: 1 }, { x: 1, y: 1 });
    //   }
    // }
  }

  update_layers() {
    // const
    //   element = this
    // ;

    // if (element && element.wrapper && element._object && element._object.layers) {
    //   d3.select(element.wrapper)
    //     .select("svg")
    //     .selectAll(":scope > g.layer")
    //     .data(element._object.layers, (d: any) => {
    //       // debugger;
    //       return d.ID
    //     })
    //     .join(
    //       element.layers.enter,
    //       element.layers.update,
    //       (exit: any) => {
    //         // exit.remove()
    //       }
    //     )
    //     .selectAll("g")
    //     .data(function (d: any, i: number) {
    //       return d.layers
    //     }, (d: any) => {
    //       return d?.ID
    //     }
    //     )
    //     .join(
    //       element.layers.enter,
    //       element.layers.update,
    //       (exit: any) => {
    //         // exit.remove()
    //       }
    //     )
    //     ;
    // }

    this.__children__.forEach((enaLayer: ENALayer) => {
      enaLayer.update();
    });
  }
}

export default EnaGraphElement;