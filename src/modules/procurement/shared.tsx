import { useCollection } from '@/store/store';
import { COLP, type ProcurementSettings, type PurchaseOrder } from './data';
import { seedProcurement } from './seed';

/* ------------------------------------------------------------------ hooks (seed once, then live) */
const use = <T extends { id: string }>(name: string) => { seedProcurement(); return useCollection<T>(name); };
export const usePOs = () => use<PurchaseOrder>(COLP.orders);
export const useProcSettings = () => use<ProcurementSettings>(COLP.settings);

export const money = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;
