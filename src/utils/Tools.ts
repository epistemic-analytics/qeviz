// const __ = {
//   matrix_string: (matrix) => {
//     let matrix_str = ['a','b','c','d','e','f'].map( l => matrix[l] ).join(" ")
//     return `matrix(${matrix_str})`
//   },
//   isArray: (obj) => {
//     return typeof Array.isArray === "function" ? Array.isArray(obj) :
//         (obj && typeof obj === "object" && obj.constructor.name === "Array");
//   },
//   recurse: (obj, opt, iterator) => {
//     function recurse(obj, i, parent = null) {
//       if (__.isArray(obj)) {
//         for (const [i, o] of obj.entries()) {
//           recurse(o, i, parent);
//         }
//       } else {
//         iterator(obj, i, parent);
//         if (obj && __.isArray(obj[opt.children])) {
//           for (const [i, o] of obj[opt.children].entries()) {
//             recurse(o, i, obj);
//           }
//         }
//       }
//     }

//     recurse(obj);
//   },
//   geom: {
//     point: {
//       // source https://github.com/HarryStevens/geometric/
//       translate: (point, angle, distance) => {
//         const r = __.geom.angle.torad(angle);
//         return [point[0] + distance * Math.cos(r), point[1] + distance * Math.sin(r)];
//       },

//       // source https://github.com/HarryStevens/geometric/
//       rotate: (point, angle, origin) => {

//         // See: https://en.wikipedia.org/wiki/Cartesian_coordinate_system#Rotation
//         function rotate(point, angle){
//           return [
//             (point[0] * Math.cos(angle)) - point[1] * Math.sin(angle),
//             (point[0] * Math.sin(angle)) + point[1] * Math.cos(angle)
//           ];
//         }

//         const r = __.geom.angle.torad(angle);

//         if (!origin || (origin[0] === 0 && origin[1] === 0)){
//           return rotate(point, r);
//         }
//         else {
//           // See: https://math.stackexchange.com/questions/1964905/rotation-around-non-zero-point
//           const p0 = point.map((c, i) => c - origin[i]);
//           const rotated = rotate(p0, r);
//           return rotated.map((c, i) => c + origin[i]);
//         }
//       }
//     },
//     line: {
//       slope: (p1, p2) => {
//         let
//           m = (p2[1] - p1[1])/(p2[0] - p1[0]),
//           n = p1[0] - m * p1[0]
//         ;
//         return m;
//       },
//       intercept: (p1, p2) => {
//         let
//           m = __.geom.line.slope(p1, p2),
//           n = p1[1] - m * p1[0]
//         ;
//         return n;
//       },
//       slope_intercept: (p1, p2) => {
//         return {
//           slope: __.geom.line.slope(p1, p2),
//           intercept: __.geom.line.intercept(p1, p2)
//         };
//       },
//       midpoint: (p1, p2, w = 0.5) => {
//         if(Array.isArray(p1[0])) {
//           p2 = (p1[1]);
//           p1 = (p1[0]);
//         }
//         return [0, 1].map( i => (parseFloat(p1[i]) + parseFloat(p2[i])) * w );
//       },
//       length: (p1, p2) => {
//         if(Array.isArray(p1[0])) {
//           p2 = p1[1];
//           p1 = p1[0];
//         }
//         return Math.sqrt([0, 1].map( i => Math.pow(p2[i] - p1[i], 2) ).reduce( (a,b) => a + b, 0))
//       },
//       interpolate: (line) => {
//         // source https://github.com/HarryStevens/geometric/
//         return t =>
//           t === 0 ?
//             line[0] :
//             t === 1 ?
//               line[1] :
//               __.geom.point.translate(line[0], __.geom.angle.line(line), __.geom.line.length(line) * t)
//         ;
//       },
//       point_along: (line, distance = 0) => {
//         let
//           len = __.geom.line.length(line),
//           ratio = distance / len,
//           Xt = ((1 - ratio) * line[0][0] + (ratio * line[1][0])),
//           Yt = ((1 - ratio) * line[0][1] + (ratio * line[1][1]))
//         ;
//         return [Xt, Yt];
//       },
//       rotate: (line, by = [0, 0]) => {
//         let
//           translated = [line[1][0] - by[0], line[1][1] - by[1]],
//           rotated = [-(translated[1]), translated[0]],
//           rotated_reflection = [-(rotated[0]), -(rotated[1])],
//           untranslated  = [rotated[0] + by[0], rotated[1] + by[1]],
//           untranslated2 = [rotated_reflection[0] + by[0], rotated_reflection[1] + by[1]]
//         ;
//         return [untranslated, untranslated2];
//       },
//       rotate2: (line, fixed, angle = 90) => {
//         let
//           line_si = __.geom.line.slope_intercept(line[0], line[1]),
//           P = [0, line_si.intercept],
//           Q = [1, line_si.slope + line_si.intercept]
//         ;
//         line = [P, Q];

//         let
//           xx = [line[0][0], line[1][0]],
//           yy = [line[0][1], line[1][1]],
//           x_fixed = fixed[0],
//           y_fixed = fixed[1],
//           angle_rad = -2 * Math.PI * angle/360,
//           xx_new = xx.map( (x, i) => (x - x_fixed) * Math.cos(angle_rad) - (yy[i] - y_fixed) * Math.sin(angle_rad) + x_fixed ),
//           yy_new = yy.map( (y, i) => (xx[i] - x_fixed) * Math.sin(angle_rad) - (y - y_fixed) * Math.cos(angle_rad) + y_fixed ),
//           object_new = [
//             [xx_new[0], yy_new[0]],
//             [xx_new[1], yy_new[1]]
//           ]
//         ;

//         return(object_new);
//       },
//       intersection: (lineA, lineB) => {
//         const
//           [[x1, y1], [x2, y2]] = lineA,
//           [[x3, y3], [x4, y4]] = lineB,
//           D = ( (x1 - x2) * (y3 - y4) ) - ( (y1 - y2) * (x3 - x4) ),
//           num1 = ( ((x1 * y2) - (y1 * x2)) * (x3 - x4) ) -
//                   ( (x1 - x2) * ((x3 * y4) - (y3 * x4)) ),
//           num2 = ( ((x1 * y2) - (y1 * x2)) * (y3 - y4) ) -
//                   ( (y1 - y2) * ((x3 * y4) - (y3 * x4)) )
//         ;
//         return [num1 / D, num2 / D];
//       },
//       intersect_circle(line, circle_xy, circle_r) {
//         let { slope: m, intercept: n } = __.geom.line.slope_intercept(line[0], line[1]);
//         let
//           a = 1 + Math.pow(m,2),
//           b = 2 * m * n - 2 * circle_xy[1] * m - 2 * circle_xy[0],
//           c = Math.pow(circle_xy[0], 2) + Math.pow(n, 2) + Math.pow(circle_xy[1], 2) - 2 * circle_xy[1] * n - Math.pow(circle_r, 2),
//           int
//         ;
//         if (Math.sqrt( Math.pow(b, 2) - (4 * a * c)) >= 0) {
//           let
//             x1 = (-b + Math.sqrt( Math.pow(b, 2) - (4 * a * c)))/(2 * a),
//             x2 = (-b - Math.sqrt( Math.pow(b, 2) - (4 * a * c)))/(2 * a),
//             y1 = m * x1 + n,
//             y2 = m * x2 + n
//           ;
//           int = [[x1, y1], [x2, y2]];
//         }
//         else {
//           int = "The line and the circumference do not intersect"
//         }
//         return(int)
//       }
//     },
//     angle: {
//       torad: (a) => a / 180 * Math.PI,
//       todeg: (a) => a * 180 / Math.PI,
//       line: (line) => {
//         // source https://github.com/HarryStevens/geometric/
//         return __.geom.angle.todeg(
//           Math.atan2(line[1][1] - line[0][1], line[1][0] - line[0][0])
//         );
//       }
//     }
//   },
//   object: {
//     proxy(obj, handler, deep = false) {
//       if(deep === false) {
//         return new Proxy(obj, handler);
//       }
//       else {
//         if (typeof obj !== 'object' || obj === null) {
//           return obj;
//         }

//         for (const key in obj) {
//           if (obj.hasOwnProperty(key)) {
//             obj[key] = __.object.proxy(obj[key], handler, deep);
//           }
//         }

//         return new Proxy(obj, handler);
//       }
//     },
//     handler: {
//       set: function(target, property, value) {
//         target[property] = value;
//         window.dispatchEvent(__.event("settingUpdate", this, { target, property, value }))

//         return true;
//       },
//       get: function(target, property) {
//         return target[property];
//       }
//     },
//     get: (obj, key) => {
//       const parts = key.split(".");
//       let current = obj;
//       for (const part of parts) {
//         if (current && typeof current === "object" && current.hasOwnProperty(part)) {
//           current = current[part];
//         }
//         else {
//           return undefined;
//         }
//       }
//       return current;
//     },
//     set: (obj, key, value) => {
//       const parts = key.split(".");
//       let current = obj,
//           i
//       ;

//       for (i = 0; i < parts.length - 1; i++) {
//         const part = parts[i];
//         if (current && typeof current === "object") {
//           if (!current.hasOwnProperty(part)) {
//             current[part] = {};
//           }
//           current = current[part];
//         }
//         else {
//           return false;
//         }
//       }

//       if (current && typeof current === "object") {
//         current[parts[i]] = value;
//         return true;
//       }
//       else {
//         return false;
//       }
//     }
//   },
//   array: {
//     unique: (x) => [...new Set(x)],
//     divide: (a, b) => {
//       let ret;

//       if(Array.isArray(a)) {
//         if(Array.isArray(b)) {
//           if(a.length === b.length) {
//             ret = a.map( (a_,i) => a_ / b[i] )
//           }
//           else {
//             console.error("If both are arrays, they must be equal length.")
//           }
//         }
//         else {
//           ret = a.map( a_ => a_ / b );
//         }
//       }
//       else {
//         ret = a / b;
//       }

//       return(ret);
//     },
//     multiply: (a, b) => {
//       let ret;

//       if(Array.isArray(a)) {
//         if(Array.isArray(b)) {
//           if(a.length === b.length) {
//             ret = a.map( (a_,i) => a_ * b[i] )
//           }
//           else {
//             console.error("If both are arrays, they must be equal length.")
//           }
//         }
//         else {
//           ret = a.map( a_ => a_ * b );
//         }
//       }
//       else {
//         ret = a * b;
//       }

//       return(ret);
//     },
//     subtract: (a, b) => {
//       let ret;

//       if(Array.isArray(a)) {
//         if(Array.isArray(b)) {
//           if(a.length === b.length) {
//             ret = a.map( (a_,i) => a_ - b[i] )
//           }
//           else {
//             console.error("If both are arrays, they must be equal length.")
//           }
//         }
//         else {
//           ret = a.map( a_ => a_ - b );
//         }
//       }
//       else {
//         ret = a - b;
//       }

//       return(ret);
//     },
//     shift: () => {
//       return Array.from(a, (b, i) => a[i + 1]);
//     }
//   },
//   math: {
//     sum: (a) => a.reduce( (a,b) => a + b, 0),
//     mean: (a) => __.math.sum(a) / a.length,
//     round: (a, b) => {
//       const factor = Math.pow(10, b);
//       return Math.round(a * factor) / factor;
//     }
//   },
//   event: (nm, elm, data) => {
//     return new CustomEvent(nm, {
//       bubbles: true,
//       cancelable: true,
//       detail: {
//         element: elm,
//         data: data || (elm ? elm.__data__ : undefined)
//       }
//     })
//   },
//   hash: {
//     parts: () => location.hash.replace(/#/,'').split(/\//).filter(a => a).map(a => a.split(/:/)),
//     exists: (x) => __.hash.parts().flat().findIndex(a => a === x) >= 0
//   },
//   url: {
//     parse: (l = window.location) => {
//     },
//     query: {
//       parse: (l = window.location.search) =>
//         Object.fromEntries(l.replace(/^\?/,'').split(/&/).map( i => i.split(/=/) ))
//       ,
//       keys: (l = window.location.search) =>
//         l.replace(/^\?/,'').split(/&/).map( i => i.split(/=/)[0] )
//       ,
//       has: (k, l = window.location.search) =>
//         __.url.query.keys(l).findIndex(i => i == k) >= 0
//     }
//   }
// };

export namespace Tools {
  export namespace Matrix {
    export function matrixString(matrix: Record<string, number>): string {
      const matrixStr = ['a', 'b', 'c', 'd', 'e', 'f'].map(l => matrix[l]).join(' ');
      return `matrix(${matrixStr})`;
    }
  }

  export namespace Geometry {
    export namespace Point {
      export function translate(point: [number, number], angle: number, distance: number): [number, number] {
        const r = Angle.toRad(angle);
        return [point[0] + distance * Math.cos(r), point[1] + distance * Math.sin(r)];
      }

      export function rotate(point: [number, number], angle: number, origin?: [number, number]): [number, number] {
        const r = Angle.toRad(angle);

        function rotatePoint(p: [number, number], a: number): [number, number] {
          return [
            p[0] * Math.cos(a) - p[1] * Math.sin(a),
            p[0] * Math.sin(a) + p[1] * Math.cos(a),
          ];
        }

        if (!origin || (origin[0] === 0 && origin[1] === 0)) {
          return rotatePoint(point, r);
        } else {
          const p0 = point.map((c, i) => c - origin[i]) as [number, number];
          const rotated = rotatePoint(p0, r);
          return rotated.map((c, i) => c + origin[i]) as [number, number];
        }
      }
    }

    export namespace Line {
      export function slope(p1: [number, number], p2: [number, number]): number {
        return (p2[1] - p1[1]) / (p2[0] - p1[0]);
      }
      export function intercept(p1: [number, number], p2: [number, number]): number {
        const m = slope(p1, p2);
        return p1[1] - m * p1[0];
      }
      export function slopeIntercept(p1: [number, number], p2: [number, number]): { slope: number; intercept: number } {
        return {
          slope: slope(p1, p2),
          intercept: intercept(p1, p2),
        };
      }
      export function point_along(line: [[number, number], [number, number]], distance: number = 0): [number, number] {
        const ratio = distance;
        const Xt = ((1 - ratio) * line[0][0] + (ratio * line[1][0]));
        const Yt = ((1 - ratio) * line[0][1] + (ratio * line[1][1]));
        return [Xt, Yt];
      }
      export function midpoint(p1: [number, number], p2: [number, number], w = 0.5): [number, number] {
        if (Array.isArray(p1[0])) {
          p2 = (p1[1] as any);
          p1 = (p1[0] as any);
        }

        return [0, 1].map(i => (parseFloat(p1[i] as any) + parseFloat(p2[i] as any)) * w) as [number, number];
      }
      export function length(
        p1: [number, number] | [[number, number], [number, number]],
        p2?: [number, number]
      ): number {
        if (Array.isArray((p1 as any)[0])) {
          p2 = (p1 as [[number, number], [number, number]])[1];
          p1 = (p1 as [[number, number], [number, number]])[0];
        }
        return Math.sqrt(
          [0, 1].map(i => Math.pow((p2 as [number, number])[i] - (p1 as [number, number])[i], 2)).reduce((a, b) => a + b, 0)
        );
      }
      export function rotate(
        line: [[number, number], [number, number]],
        by: [number, number] = [0, 0]
      ): [[number, number], [number, number]] {
        const translated: [number, number] = [
          line[1][0] - by[0],
          line[1][1] - by[1]
        ];
        const rotated: [number, number] = [
          -translated[1],
          translated[0]
        ];
        const rotated_reflection: [number, number] = [
          -rotated[0],
          -rotated[1]
        ];
        const untranslated: [number, number] = [
          rotated[0] + by[0],
          rotated[1] + by[1]
        ];
        const untranslated2: [number, number] = [
          rotated_reflection[0] + by[0],
          rotated_reflection[1] + by[1]
        ];
        return [untranslated, untranslated2];
      }
      export function rotate2(
        line: [[number, number], [number, number]],
        fixed: [number, number],
        angle: number = 90
      ): [[number, number], [number, number]] {
        // Calculate slope and intercept
        const m = Tools.Geometry.Line.slope(line[0], line[1]);
        const n = Tools.Geometry.Line.intercept(line[0], line[1]);
        const P: [number, number] = [0, n];
        const Q: [number, number] = [1, m + n];
        line = [P, Q];

        const xx = [line[0][0], line[1][0]];
        const yy = [line[0][1], line[1][1]];
        const x_fixed = fixed[0];
        const y_fixed = fixed[1];
        const angle_rad = -2 * Math.PI * angle / 360;
        const xx_new = xx.map((x, i) =>
          (x - x_fixed) * Math.cos(angle_rad) - (yy[i] - y_fixed) * Math.sin(angle_rad) + x_fixed
        );
        const yy_new = yy.map((y, i) =>
          (xx[i] - x_fixed) * Math.sin(angle_rad) - (y - y_fixed) * Math.cos(angle_rad) + y_fixed
        );
        const object_new: [[number, number], [number, number]] = [
          [xx_new[0], yy_new[0]],
          [xx_new[1], yy_new[1]]
        ];

        return object_new;
      }
      export function intersection(
        lineA: [[number, number], [number, number]],
        lineB: [[number, number], [number, number]]
      ): [number, number] {
        const
          [[x1, y1], [x2, y2]] = lineA,
          [[x3, y3], [x4, y4]] = lineB,
          D = ((x1 - x2) * (y3 - y4)) - ((y1 - y2) * (x3 - x4)),
          num1 = (((x1 * y2) - (y1 * x2)) * (x3 - x4)) -
            ((x1 - x2) * ((x3 * y4) - (y3 * x4))),
          num2 = (((x1 * y2) - (y1 * x2)) * (y3 - y4)) -
            ((y1 - y2) * ((x3 * y4) - (y3 * x4)));
        return [num1 / D, num2 / D];
      }
      export function intersect_circle(line: [[number, number], [number, number]], circle_xy: [number, number], circle_r: number): [[number, number], [number, number]] {
        let { slope: m, intercept: n } = Tools.Geometry.Line.slopeIntercept(line[0], line[1]);
        let
          a = 1 + Math.pow(m, 2),
          b = 2 * m * n - 2 * circle_xy[1] * m - 2 * circle_xy[0],
          c = Math.pow(circle_xy[0], 2) + Math.pow(n, 2) + Math.pow(circle_xy[1], 2) - 2 * circle_xy[1] * n - Math.pow(circle_r, 2),
          int: [[number, number], [number, number]] = [[Infinity, Infinity], [Infinity, Infinity]]
          ;

        if (Math.sqrt(Math.pow(b, 2) - (4 * a * c)) >= 0) {
          let
            x1 = (-b + Math.sqrt(Math.pow(b, 2) - (4 * a * c))) / (2 * a),
            x2 = (-b - Math.sqrt(Math.pow(b, 2) - (4 * a * c))) / (2 * a),
            y1 = m * x1 + n,
            y2 = m * x2 + n
            ;
          int = [[x1, y1], [x2, y2]];
        }
        else {
          console.error("The line and the circumference do not intersect");
        }

        return (int)
      }
      export function interpolate(line: [[number, number], [number, number]]): (t: number) => [number, number] {
        // source https://github.com/HarryStevens/geometric/
        return t =>
          t === 0 ?
            line[0] :
            t === 1 ?
              line[1] :
              Tools.Geometry.Point.translate(line[0], Tools.Geometry.Angle.line(line), Tools.Geometry.Line.length(line) * t)
          ;
      }
    }

    export namespace Angle {
      export function toRad(angle: number): number {
        return (angle / 180) * Math.PI;
      }

      export function toDeg(angle: number): number {
        return (angle * 180) / Math.PI;
      }
      // source https://github.com/HarryStevens/geometric/
      export function line(line: [[number, number], [number, number]]): number {
        if (line.length !== 2 || !Array.isArray(line[0]) || !Array.isArray(line[1]) || line[0].length !== 2 || line[1].length !== 2) {
          throw new Error('Invalid line format. Expected [[x1, y1], [x2, y2]].');
        }
        //console.log("line: ", line)
        return Tools.Geometry.Angle.toDeg(
          Math.atan2(line[1][1] - line[0][1], line[1][0] - line[0][0])
        );
      }
    }
  }

  export namespace ArrayTools {
    export function unique<T>(arr: T[]): T[] {
      return [...new Set(arr)];
    }

    export function divide(a: number | number[], b: number | number[]): number | number[] {
      if (Array.isArray(a)) {
        if (Array.isArray(b)) {
          if (a.length !== b.length) throw new Error('Arrays must be of equal length');
          return a.map((val, i) => val / b[i]);
        }
        return a.map(val => val / (b as number));
      }
      return (a as number) / (b as number);
    }

    export function isArray(obj: any): boolean {
      return typeof Array.isArray === "function" ? Array.isArray(obj) :
        (obj && typeof obj === "object" && obj.constructor.name === "Array");
    }
  }

  export namespace Mathematics {
    export function sum(arr: number[]): number {
      return arr.reduce((a, b) => a + b, 0);
    }

    export function mean(arr: number[]): number {
      return sum(arr) / arr.length;
    }

    export function round(value: number, decimals: number): number {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    }
  }

  export namespace Events {
    export function createEvent(name: string, element?: HTMLElement, data?: any): CustomEvent {
      return new CustomEvent(name, {
        bubbles: true,
        cancelable: true,
        detail: {
          element,
          data: data || (element ? (element as any).__data__ : undefined),
        },
      });
    }
  }

  export namespace Hash {
    export function parts(): string[][] {
      return location.hash
        .replace(/#/, '')
        .split(/\//)
        .filter(a => a)
        .map(a => a.split(/:/));
    }

    export function exists(key: string): boolean {
      return parts().flat().findIndex(a => a === key) >= 0;
    }
  }


  export namespace Objects {
    export function proxy<T extends object>(obj: T, handler: ProxyHandler<any>, deep = false): T {
      if (!deep) {
        return new Proxy(obj, handler);
      } else {
        if (typeof obj !== 'object' || obj === null) {
          return obj;
        }

        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (obj as any)[key] = proxy((obj as any)[key], handler, deep);
          }
        }

        return new Proxy(obj, handler);
      }
    }

    export const handler: ProxyHandler<any> = {
      set(target, property, value) {
        target[property] = value;
        window.dispatchEvent(
          Tools.Events.createEvent("settingUpdate", window as any, { target, property, value })
        );
        return true;
      },
      get(target, property) {
        return target[property];
      }
    };

    export function get(obj: any, key: string): any {
      const parts = key.split(".");
      let current = obj;
      for (const part of parts) {
        if (current && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, part)) {
          current = current[part];
        } else {
          return undefined;
        }
      }
      return current;
    }

    export function set(obj: any, key: string, value: any): boolean {
      const parts = key.split(".");
      let current = obj;
      let i: number;

      for (i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current && typeof current === "object") {
          if (!Object.prototype.hasOwnProperty.call(current, part)) {
            current[part] = {};
          }
          current = current[part];
        } else {
          return false;
        }
      }

      if (current && typeof current === "object") {
        current[parts[i]] = value;
        return true;
      } else {
        return false;
      }
    }
  }

  export namespace URL {
    export function parse(location: Location = window.location): Record<string, string> {
      return Object.fromEntries(new URLSearchParams(location.search));
    }

    export namespace Query {
      export function parse(location: string = window.location.search): Record<string, string> {
        return Object.fromEntries(
          location.replace(/^\?/, '').split(/&/).map(i => i.split(/=/))
        );
      }

      export function keys(location: string = window.location.search): string[] {
        return location.replace(/^\?/, '').split(/&/).map(i => i.split(/=/)[0]);
      }

      export function has(key: string, location: string = window.location.search): boolean {
        return keys(location).findIndex(i => i === key) >= 0;
      }
    }
  }
}

