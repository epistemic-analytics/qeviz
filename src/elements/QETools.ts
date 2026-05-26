import QEVisualElement from "./QEVisual";
import { QEGraphElement } from "./QEGraph";

export namespace VizENATools {
  export function getviz(): QEVisualElement | null {
    return document.querySelector("visual-ena");
  }

  export function graphs_from_event(ev: CustomEvent<any>): QEGraphElement[] {
    return ev.detail.data.graph.map((g: any) => {
      const idx = parseInt(g);
      return isNaN(idx) ? g : (VizENATools.getviz() as any)?.get_graphs()[idx];
    });
  }
}