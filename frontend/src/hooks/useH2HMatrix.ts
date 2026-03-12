import { useApiQuery } from "./useApiQuery";

export type H2HDriver = {
  id: number;
  first_name: string;
  last_name: string;
  profile_image: string | null;
};

export type H2HMatrix = {
  // matrix[row_driver_id][col_driver_id] = wins for row driver vs col driver
  [rowId: string]: { [colId: string]: number };
};

export type H2HData = {
  drivers: H2HDriver[];
  matrix: H2HMatrix;
};

export function useH2HMatrix() {
  return useApiQuery<H2HData>("/api/hall-of-fame/h2h/");
}
