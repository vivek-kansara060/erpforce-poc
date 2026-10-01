import type { ModuleDef } from '@/types';
import crm from './crm';
import rental from './rental';
import procurement from './procurement';
import inventory from './inventory';
import accounting from './accounting';
import hrms from './hrms';
import admin from './admin';

/** Module registry. Order = launcher order. */
export const modules: ModuleDef[] = [crm, rental, procurement, inventory, accounting, hrms, admin];
