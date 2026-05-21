import EnaGraphElement from "./ENAgraph";
import VizENAElement from "./VizENA";

export namespace VizENATools {
  export function getviz(): VizENAElement | null {
    return document.querySelector("visual-ena");
  }

  export function graphs_from_event(ev: CustomEvent<any>): EnaGraphElement[] {
    return ev.detail.data.graph.map((g: any) => {
      const idx = parseInt(g);
      return isNaN(idx) ? g : (VizENATools.getviz() as any)?.get_graphs()[idx];
    });
  }
}