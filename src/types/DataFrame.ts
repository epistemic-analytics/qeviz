export interface DataFrameRowInterface {
  get names(): string[];
  get rowName(): string | undefined;
  get types(): DataFrameColumnType[];
  get parent(): DataFrame | undefined;
}

export class DataFrameRow extends Array<any> implements DataFrameRowInterface {
  #rowNumber?: number;
  #rowName?: string;
  #names: string[];
  #parent?: DataFrame;
  #classes: string[] | undefined;

  constructor(names: string[], values: any[], rowName?: string, parent?: DataFrame, index?: number) {
    super(...values);
    this.#names = names;
    this.#rowName = rowName;
    this.#parent = parent;
    this.#classes = parent?.classes;
    this.#rowNumber = index;
  }

  get parent(): DataFrame | undefined {
    return this.#parent;
  }
  get names(): string[] {
    return this.#names;
  }
  get rowName(): string | undefined {
    return this.#rowName;
  }
  get types(): DataFrameColumnType[] {
    if (!this.#parent) throw new Error("No parent DataFrame attached to this row.");
    return this.#parent.types;
  }
  get classes(): string[] | undefined {
    return this.#classes;
  }

  get rowNumber(): number | undefined {
    return this.#rowNumber;
  }

  col(wh: string | number): DataFrameColumn | undefined {
    if (!this.#parent) throw new Error("No parent DataFrame attached to this row.");
    return this.#parent.col(wh);
  }
  cols(...wh: (string | number)[]): DataFrame {
    if (!this.#parent) throw new Error("No parent DataFrame attached to this row.");
    return this.#parent.cols(...wh);
  }

  filter(predicate: (value: any, index: number, array: any[]) => boolean): any {
    console.error("DataFrameRow does not currently support filtering.");
    // This method is intentionally left empty to prevent filtering on DataFrameRow.
  }
}

export enum DataFrameColumnType {
  Character = 'character',
  Double = 'double',
  Logical = 'logical',
  Integer = 'integer'
}

export interface DataFrameColumnInterface {
  get name(): string;
  get type(): DataFrameColumnType;
  get rowNames(): string[] | undefined;
}

export class DataFrameColumn extends Array<any> implements DataFrameColumnInterface {
  #name: string;
  #type: DataFrameColumnType;
  #rowNames: string[] | undefined;
  #parent?: DataFrame;

  constructor(name: string, column: any, rowNames?: string[], parent?: DataFrame) {
    super(column.length);
    for (let i = 0; i < column.length; i++) {
      this[i] = column[i];
    }
    this.#name = name;

    if (column.type !== undefined) {
      this.#type = column.type;
    }
    // If undefined, infer type
    else {
      if (column.every((v: any) => typeof v === 'string' || v === null || v === undefined)) {
        this.#type = DataFrameColumnType.Character;
      }
      else if (column.every((v: any) => Number.isInteger(v) || v === null || v === undefined)) {
        // If only 1 and 0, consider as logical
        if (column.every((v: any) => v === 0 || v === 1 || v === null || v === undefined)) {
          this.#type = DataFrameColumnType.Logical;
        }
        else {
          this.#type = DataFrameColumnType.Integer;
        }
      }
      else if (column.every((v: any) => typeof v === 'number' || v === null || v === undefined)) {
        this.#type = DataFrameColumnType.Double;
      }
      else if (column.every((v: any) => typeof v === 'boolean' || v === null || v === undefined)) {
        this.#type = DataFrameColumnType.Logical;
      }

      // Default to character if mixed types
      else {
        this.#type = DataFrameColumnType.Character;
      }
    }
    this.#parent = parent;

    if (rowNames && rowNames.length !== this.length) {
      throw new Error("Row names length must match the number of rows in the DataFrameColumn.");
    }
    if (rowNames && rowNames.length > 0) {
      this.#rowNames = rowNames;
    }
    else {
      this.#rowNames = undefined;
    }
  }

  get name(): string {
    return this.#name;
  }
  get type(): DataFrameColumnType {
    return this.#type;
  }
  get rowNames(): string[] | undefined {
    return this.#rowNames;
  }


  row(wh: string | number): DataFrameRow | undefined {
    if (!this.#parent) throw new Error("No parent DataFrame attached to this column.");
    return this.#parent.row(wh);
  }
  rows(...wh: (string | number)[]): DataFrameRow[] {
    if (!this.#parent) throw new Error("No parent DataFrame attached to this column.");
    return this.#parent.rows(...wh);
  }
}

export interface DataFrameInterface {
  // Methods
  getColumnByName(name: string): DataFrameColumn | undefined;
  getRowByIndex(index: number): any[];
  getRowByName(name: string): any[] | undefined;
  row(wh: string | number): any[] | undefined;
  type(wh: string | number): DataFrameColumnType | undefined;

  get names(): string[];
  get rowNames(): string[] | undefined;
  get types(): string[];

  // Properties
  nrow: number;
  ncol: number;
}

export class DataFrame extends Array<DataFrameColumn> implements DataFrameInterface {
  #names: string[];
  #rowNames: string[] | undefined;
  #classes: string[] | undefined;

  constructor(names?: string[], colValues?: any[], rowNames?: string[], classes?: string[]) {
    if (!names || !colValues) {
      colValues = [];
      names = [];
    }
    if (colValues.map( (c: any) => c.length ).every( (l: any) => l === names.length )) {
      // Transpose if needed
      const transposed: any[] = [];
      for (let i = 0; i < names.length; i++) {
        const col: any[] = [];
        for (let j = 0; j < colValues.length; j++) {
          col.push(colValues[j][i]);
        }
        transposed.push(col);
      }
      colValues = transposed;
    }

    super(colValues.length);

    colValues.forEach((col, index) => {
      if (col instanceof DataFrameColumn) {
        // If col is already a DataFrameColumn, just assign it
        this[index] = col as DataFrameColumn;
      } else {
        // Otherwise, create a new DataFrameColumn
        this[index] = new DataFrameColumn(names[index], col, rowNames, this) as DataFrameColumn;
      }
    });
    this.#names = names;
    if (rowNames && rowNames.length !== this[0].length) {
      throw new Error("Row names length must match the number of rows in the DataFrame.");
    }
    if (rowNames && rowNames.length > 0) {
      this.#rowNames = rowNames;
    }
    if (classes && classes.length !== this.length) {
      throw new Error("Classes length must match the number of columns in the DataFrame.");
    }
    if (classes && classes.length > 0) {
      this.#classes = classes;
    }
  }

  get classes(): string[] | undefined {
    return this.#classes;
  }

  getColumnByName(name: string): DataFrameColumn | undefined {
    const idx = this.#names.indexOf(name);
    return idx >= 0 ? this[idx] : undefined;
  }
  getRowByIndex(index: number): DataFrameRow {
    if (this && this.length === 0) {
      console.warn("DataFrame is empty, cannot get row by index", index);
      return new DataFrameRow(this.#names, [], undefined, this, index);
    }
    const result_vals: any[] = [];
    for (let col of this) {
      let v = col[index];
      result_vals.push(v);
    }
    return new DataFrameRow(this.#names, result_vals, this.#rowNames ? this.#rowNames[index] : undefined, this, index);
  }
  getRowByName(name: string): DataFrameRow | undefined {
    if (!this.#rowNames) return undefined;

    const index = this.#rowNames.indexOf(name);
    if (index === -1) return undefined;
    return this.getRowByIndex(index);
  }

  get types(): DataFrameColumnType[] {
    return this.map(col => col.type);
  }
  type(wh: string | number): DataFrameColumnType | undefined {
    if (typeof wh === 'number') {
      return this[wh]?.type;
    }
    else if (typeof wh === 'string') {
      const col = this.getColumnByName(wh);
      return col ? col.type : undefined;
    }
    return undefined;
  }

  // row(wh: string | number): DataFrameRow | undefined {

  row(wh: string | number): DataFrameRow | undefined {
    if (typeof wh === 'number') {
      return this.getRowByIndex(wh);
    }
    else if (typeof wh === 'string') {
      return this.getRowByName(wh);
    }
    return undefined;
  }
  // rows(...wh: (string | number)[]): DataFrame {
  rows(...wh: (string | number)[]): DataFrameRow[] {
    // Support: rows("Data"), rows("Data", "Design"), rows(["Data", "Design"]), rows()
    let
      selectors: (string | number)[],
      selectedRows: DataFrameRow[] = [],
      selectedRowNames: string[] | undefined = []
      ;

    // No arguments: return all rows
    if (wh.length === 0) {
      const numRows = this[0].length;
      selectedRows = Array.from({ length: numRows }, (_, i) => this.getRowByIndex(i));
      selectedRowNames = this.#rowNames;
    }

    else {
      // Single array argument
      if (wh.length === 1 && Array.isArray(wh[0])) {
        selectors = wh[0] as (string | number)[];
      }
      else {
        // Rest arguments
        selectors = wh;
      }

      selectedRows = selectors.map((item, i: number) => {
        let r = this.row(item);
        if (this.#rowNames && r) {
          selectedRowNames?.push(this.#rowNames[i]);
        }
        return r;
      }).filter((row): row is DataFrameRow => row !== undefined);
    }

    // Build columns from selected rows
    // const
    //   colNames = this.#names,
    //   columns = colNames.map((name, colIdx) => selectedRows.map(row => row[colIdx])),
    //   colObjs = colNames.map((name, idx) => new DataFrameColumn(name, { values: columns[idx], type: this[idx].type }, selectedRowNames, this))
    //   ;

    // return new DataFrame(
    //   colNames,
    //   colObjs,
    //   selectedRowNames
    // );

    return selectedRows;
  }

  col(wh: string | number): DataFrameColumn | undefined {
    if (typeof wh === 'number') {
      return this[wh];
    } else if (typeof wh === 'string') {
      return this.getColumnByName(wh);
    }
    return undefined;
  }

  cols(...wh: (string | number)[]): DataFrame {
    // Support: cols("Data"), cols("Data", "Design"), cols(["Data", "Design"]), cols()
    let
      selectors: (string | number)[],
      selectedCols: DataFrameColumn[],
      selectedNames: string[] = []
      ;

    // No arguments: return all columns
    if (wh.length === 0) {
      selectedCols = this.slice();
      selectedNames = this.#names;
    }
    else {
      // Single array argument
      if (wh.length === 1 && Array.isArray(wh[0])) {
        selectors = wh[0] as (string | number)[];
      }
      // Rest arguments
      else {
        selectors = wh;
      }

      selectedCols = selectors.map((item) => this.col(item)).filter((col): col is DataFrameColumn => col !== undefined);
      selectedNames = selectedCols.map(col => col.name);
    }

    return new DataFrame(selectedNames, selectedCols, this.#rowNames);
  }

  subset(rows?: (string | number)[], cols?: (string | number)[]): DataFrame {
    const selectedCols: DataFrameColumn[] = (cols && cols.length > 0)
      ? this.cols(...cols)
      : this.slice();

    return new DataFrame(
      selectedCols.map(col => col.name),
      selectedCols.map(col => col.values),
      this.#rowNames
    );
  }

  get names(): string[] {
    return this.#names;
  }

  get rowNames(): string[] | undefined {
    return this.#rowNames;
  }

  get nrow(): number {
    return this[0].length;
  }

  get ncol(): number {
    return this.length;
  }
}
