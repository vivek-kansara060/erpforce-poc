import type { ReactElement } from 'react';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import AltRouteIcon from '@mui/icons-material/AltRouteOutlined';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDownOutlined';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUpOutlined';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturnOutlined';
import AutorenewIcon from '@mui/icons-material/AutorenewOutlined';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermarkOutlined';
import BuildCircleIcon from '@mui/icons-material/BuildCircleOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthOutlined';
import CategoryIcon from '@mui/icons-material/CategoryOutlined';
import ChecklistIcon from '@mui/icons-material/ChecklistOutlined';
import CreditScoreIcon from '@mui/icons-material/CreditScoreOutlined';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import DatasetIcon from '@mui/icons-material/DatasetOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweepOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import DomainIcon from '@mui/icons-material/DomainOutlined';
import DynamicFormIcon from '@mui/icons-material/DynamicFormOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailableOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeatOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import FindReplaceIcon from '@mui/icons-material/FindReplaceOutlined';
import GavelIcon from '@mui/icons-material/GavelOutlined';
import GroupsIcon from '@mui/icons-material/GroupsOutlined';
import HandshakeIcon from '@mui/icons-material/HandshakeOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import InboxIcon from '@mui/icons-material/InboxOutlined';
import InventoryIcon from '@mui/icons-material/InventoryOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import ListAltIcon from '@mui/icons-material/ListAltOutlined';
import LocalAtmIcon from '@mui/icons-material/LocalAtmOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOnOutlined';
import MoveToInboxIcon from '@mui/icons-material/MoveToInboxOutlined';
import OutboxIcon from '@mui/icons-material/OutboxOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import PercentIcon from '@mui/icons-material/PercentOutlined';
import PersonSearchIcon from '@mui/icons-material/PersonSearchOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import PriceChangeIcon from '@mui/icons-material/PriceChangeOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStatsOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import RequestPageIcon from '@mui/icons-material/RequestPageOutlined';
import RequestQuoteIcon from '@mui/icons-material/RequestQuoteOutlined';
import SavingsIcon from '@mui/icons-material/SavingsOutlined';
import SellIcon from '@mui/icons-material/SellOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggestOutlined';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBagOutlined';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCartOutlined';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import StorageIcon from '@mui/icons-material/StorageOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import SummarizeIcon from '@mui/icons-material/SummarizeOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHorizOutlined';
import SyncAltIcon from '@mui/icons-material/SyncAltOutlined';
import TagIcon from '@mui/icons-material/TagOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAltOutlined';
import TrackChangesIcon from '@mui/icons-material/TrackChangesOutlined';
import TuneIcon from '@mui/icons-material/TuneOutlined';
import ViewQuiltIcon from '@mui/icons-material/ViewQuiltOutlined';
import WidgetsIcon from '@mui/icons-material/WidgetsOutlined';

/** Top-level group / entry icons, keyed by menu label. */
const BY_LABEL: Record<string, ReactElement> = {
  'Dashboard': <SpaceDashboardIcon />,
  'Rental Dashboard': <SpaceDashboardIcon />,
  'Dashboards': <SpaceDashboardIcon />,
  'Journal Entry': <MenuBookIcon />,
  'Payment Entry': <PaymentsIcon />,
  'Payment Request': <RequestQuoteIcon />,
  'Invoice': <ReceiptLongIcon />,
  'Invoicing': <ReceiptLongIcon />,
  'Credits': <CreditScoreIcon />,
  'Expense': <AccountBalanceWalletIcon />,
  'Commissions': <PercentIcon />,
  'Fixed Asset Management': <DomainIcon />,
  'Budget': <SavingsIcon />,
  'Master Data': <StorageIcon />,
  'Reports': <AssessmentIcon />,
  'Settings': <SettingsIcon />,
  'Orders': <AssignmentIcon />,
  'Fleet Management': <LocalShippingIcon />,
  'Product Management': <Inventory2Icon />,
  'Configuration': <TuneIcon />,
  'Operations': <FactCheckIcon />,
  'Demand Planning': <QueryStatsIcon />,
  'Rental': <KeyIcon />,
  'Agreements': <HandshakeIcon />,
  'Purchase': <ShoppingCartIcon />,
  'Cross Hire': <SwapHorizIcon />,
};

/** Sub-module icons, keyed by route path (labels repeat across groups, paths do not). */
const BY_PATH: Record<string, ReactElement> = {
  '/accounting/payments': <ArrowCircleUpIcon />,
  '/accounting/pdc-send': <OutboxIcon />,
  '/accounting/collections': <ArrowCircleDownIcon />,
  '/accounting/pdc-receive': <MoveToInboxIcon />,
  '/accounting/bills': <DescriptionIcon />,
  '/accounting/invoices': <RequestPageIcon />,
  '/accounting/cash-expense': <LocalAtmIcon />,
  '/accounting/debit-notes': <RemoveCircleOutlineIcon />,
  '/accounting/credit-notes': <AddCircleOutlineIcon />,
  '/accounting/expense-reimbursement': <PriceChangeIcon />,
  '/accounting/expense-report': <SummarizeIcon />,
  '/accounting/commission-setup': <SettingsSuggestIcon />,
  '/accounting/authorize-commission': <TaskAltIcon />,
  '/accounting/commission': <MonetizationOnIcon />,
  '/accounting/month-wise-commission': <CalendarMonthIcon />,
  '/accounting/assets': <PrecisionManufacturingIcon />,
  '/accounting/asset-transfer': <SyncAltIcon />,
  '/accounting/customers': <GroupsIcon />,
  '/accounting/vendors': <StorefrontIcon />,
  '/accounting/chart-of-accounts': <AccountTreeIcon />,
  '/accounting/currency': <CurrencyExchangeIcon />,
  '/accounting/journal-types': <CategoryIcon />,
  '/accounting/tax-code': <TagIcon />,
  '/accounting/tax-template': <ViewQuiltIcon />,
  '/accounting/bank-accounts': <AccountBalanceIcon />,
  '/accounting/payment-terms': <EventNoteIcon />,
  '/accounting/settings': <ManageAccountsIcon />,
  '/crm/leads': <PersonSearchIcon />,
  '/crm/opportunities': <TrackChangesIcon />,
  '/crm/quotations': <RequestQuoteIcon />,
  '/crm/sales-orders': <ShoppingBagIcon />,
  '/crm/delivery-orders': <InventoryIcon />,
  '/crm/amc-orders': <BuildCircleIcon />,
  '/crm/customer-returns': <AssignmentReturnIcon />,
  '/crm/fleet': <EventAvailableIcon />,
  '/crm/trips': <AltRouteIcon />,
  '/crm/masters': <DatasetIcon />,
  '/inventory/items': <WidgetsIcon />,
  '/inventory/categories': <CategoryIcon />,
  '/inventory/sub-categories': <AccountTreeIcon />,
  '/inventory/brands': <BrandingWatermarkIcon />,
  '/inventory/asset-types': <PrecisionManufacturingIcon />,
  '/inventory/pricing': <SellIcon />,
  '/inventory/locations': <PlaceIcon />,
  '/inventory/disposals': <DeleteSweepIcon />,
  '/inventory/stock-verification': <ChecklistIcon />,
  '/rental/items': <WidgetsIcon />,
  '/rental/categories': <CategoryIcon />,
  '/rental/invoicing': <RequestPageIcon />,
  '/rental/previous-jobs': <HistoryIcon />,
  '/rental/replacements': <FindReplaceIcon />,
  '/rental/renewals': <AutorenewIcon />,
  '/rental/purchase-rfq': <RequestQuoteIcon />,
  '/rental/purchase-orders': <ListAltIcon />,
  '/rental/cross-hire': <InboxIcon />,
  '/rental/cross-hire-process': <PlayCircleOutlineIcon />,
  '/rental/cross-hire-rfq': <RequestQuoteIcon />,
  '/rental/cross-hire-orders': <ListAltIcon />,
  '/rental/settings': <TuneIcon />,
  '/rental/billing-cycle': <EventRepeatIcon />,
  '/rental/terms': <GavelIcon />,
  '/rental/forms': <DynamicFormIcon />,
  '/rental/template-editor': <EditNoteIcon />,
};

export const menuIcon = (item: { label: string; path?: string }, depth: number, fallback?: ReactElement) =>
  (depth === 0 ? BY_LABEL[item.label] : undefined) ?? (item.path ? BY_PATH[item.path] : undefined) ?? fallback;
