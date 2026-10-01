export interface AppNotification { id: string; title: string; message: string; category: string; time: string; read: boolean; link?: string }

/** Notification categories from the requirement: approval-pending, expiry reminders, overdue alerts, task/priority, event confirmations, daily digest. */
export const notificationSeed: AppNotification[] = [
  { id: 'n1', title: 'Approval pending: Quotation QT-26-00088', message: 'Discount 12% above threshold, awaiting Sales Manager approval.', category: 'Approval-pending alert', time: '10 min ago', read: false },
  { id: 'n2', title: 'Certificate expiring: AST-1005 Insurance', message: 'Insurance expires in 14 days (reminder lead time 30 days).', category: 'Expiry reminder', time: '1 h ago', read: false },
  { id: 'n3', title: 'Overdue on-hire: SO-26-00038', message: 'AST-1008 is 6 days past Contract End Date. Escalation threshold: 5 days.', category: 'Overdue alert', time: '3 h ago', read: false },
  { id: 'n4', title: 'Low stock: Oil Filter (Cummins C-Series)', message: 'Stock 14 is below minimum 20. Requisition PR-26-00071 auto-generated.', category: 'Overdue alert', time: '5 h ago', read: true },
  { id: 'n5', title: 'Delivery confirmed: DO-26-00102', message: 'AST-1006 delivered to Route 2020 Depot. E-signature captured.', category: 'Event confirmation', time: 'Yesterday', read: true },
  { id: 'n6', title: 'Daily digest', message: '7 approvals pending, 3 certificates expiring, 2 overdue returns.', category: 'Daily digest email', time: 'Yesterday', read: true },
];
