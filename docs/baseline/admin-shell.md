# Existing ERP baseline: User / Administration, approvals, notifications, audit, e-signature, shell

## User module (modules/user)
Sidebar: Dashboard | User | Roles | Settings: Work Flow Automation, Localization, Template Editor (Emails, PDF), Forms.
- Users: list with View, Edit, Change Password, Add Access, Clone, Activate/Deactivate. Form: first/last name, country, phone, email, role, location, branch, company, profile image; time-based login (Does not repeat, Weekdays, Daily, Weekly ...); entity access (Company, Branch, Location, Department).
- Roles: role name, role type (Admin, Executive, Manager, Support, Operations), designation, modules / sub-modules / resources with resource policy table (own-data-only flags, allowed / not-allowed attributes and filters). Role list: Role, Role Type, Designation, Date Created, Status. Permissions expressed as canView / canAdd / canEdit / canDelete per resource.
- NOT existing: a consolidated role matrix screen for the roles named in the document, data-visibility rules screen (Sales Representatives see own records only, etc.), approval-threshold-by-role configuration.

## Approvals
Approval Workflow builder (external package, procurement only): criteria on Total Amount / Discount / Quantity / Status, approver type Department / Hierarchy / User, levels L1..Ln, escalation days. Approvals dashboard (procurement). Accounting uses per-document Submit / Quick Approval / Accept / Reject. NOT existing: a shared configurable Approval Engine used by every module with value-tier matrix, and an Alert/Reminder Engine (reminder lead times, escalation rules).

## Notifications
Header bell: unread badge, mark all read, deep links, socket toast. NOT existing: notification categories/channels configuration, expiry reminders with configurable lead time, overdue alerts, task/priority list, event confirmations, consolidated daily digest email, SMS/WhatsApp per type.

## Audit trail
Per-record Activity timeline (user, action, time). NOT existing: field-level change log (who changed what and when), global audit screen. Quotation revisions kept via "Revision Created" status only.

## E-signature
NOT existing (only a signature layout block in the PDF template editor).

## Shell (common)
Launcher of module tiles; each module has its own sidebar (300 px, collapsible to 65 px, search menu, accordion groups), top bar (module switcher, language, notification bell, help, user menu with roles / change password / logout), breadcrumb + sticky form header, list pages with ActionBar + table + footer pagination, view pages with Summary/Activity right panel and tabs, ConfirmPopUp dialogs, notistack snackbars. Languages en / es / ar with RTL. Master data import exists per list (Excel import / export buttons).
