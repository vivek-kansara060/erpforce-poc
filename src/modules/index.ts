import type { MenuItem, ModuleDef } from '@/types';
import crm from './crm';
import rental from './rental';
import procurement from './procurement';
import inventory from './inventory';
import accounting from './accounting';
import hrms from './hrms';
import admin from './admin';

/** Module registry. Order = launcher order. */
export const modules: ModuleDef[] = [crm, rental, procurement, inventory, accounting, hrms, admin];

/**
 * Review view (7 Oct): only what is new or changed is shown. A module appears when at least one of its Change Register entries is not plain EXISTING,
 * and a sidebar entry appears when it carries a NEW / CHANGED tag (or a child that does). Routes of hidden screens still resolve if opened by link.
 */
export const visibleModules: ModuleDef[] = modules.filter((m) => m.changes.some((c) => c.classification !== 'EXISTING'));
export function changedMenu(items: MenuItem[]): MenuItem[] {
  return items.flatMap((i) => {
    if (!i.children) return i.change ? [i] : [];
    const kids = changedMenu(i.children);
    if (kids.length) return [{ ...i, children: kids }];
    return i.change ? [i] : [];
  });
}
