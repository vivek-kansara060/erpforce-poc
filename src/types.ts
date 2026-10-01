import type { ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';

/** How a POC element relates to the existing ERP. Drives the NEW / CHANGED badges in Review Mode. */
export type ChangeKind = 'new' | 'changed';

/** Classification used in the Change Register (requirement mapping table). */
export type Classification = 'EXISTING' | 'EXISTING WITH CHANGE' | 'NEW' | 'REMOVED';

export interface MenuItem {
  label: string;
  /** absolute path, e.g. /crm/leads. Omit for group headers. */
  path?: string;
  icon?: ReactElement;
  /** marks the menu entry itself as new / changed vs the existing sidebar */
  change?: ChangeKind;
  children?: MenuItem[];
}

export interface ChangeEntry {
  /** module label, e.g. "CRM / Sales" */
  module: string;
  /** screen or feature name, e.g. "Quotation" */
  screen: string;
  classification: Classification;
  /** what exists today (one line, from the baseline analysis). Use "-" for NEW */
  existing: string;
  /** what the requirement document changes / adds (one line) */
  change: string;
  /** requirement document reference, e.g. "CRM > Quotation" */
  ref: string;
  /** route in the POC where the reviewer can see it */
  path?: string;
}

/** A slice of a module built by one builder. The module index.tsx composes parts. */
export interface PartDef {
  /** top-level sidebar entries (or groups) owned by this part */
  menu: MenuItem[];
  /** routes RELATIVE to the module basePath, e.g. { path: 'leads' }, { path: 'leads/:id' } */
  routes: RouteObject[];
  changes: ChangeEntry[];
}

export interface ModuleDef extends PartDef {
  id: string;
  label: string;
  /** absolute base path, e.g. /crm */
  basePath: string;
  icon: ReactElement;
  /** launcher tile background (existing ERP module tile colours) */
  tileBg: string;
}
