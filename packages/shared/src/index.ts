/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */
export interface CustomerRecord {
  id: string;
  name: string;
  budget: number;
}

export type UniversalAppSchema = {
  Customer: CustomerRecord;
};
