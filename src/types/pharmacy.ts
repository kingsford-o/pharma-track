export type TransactionType = 'Received' | 'Dispensed' | 'Adjustment' | 'Transfer';

export interface BatchItem {
  id: string;
  batchNo: string;
  shelfLocation: string;
  expiryDate: string; // ISO date or formatted
  expiryDaysLeft: number;
  initialQuantity: number;
  currentQuantity: number;
  costPriceGhc: number;
  supplierName: string;
  isEarliestExpiry?: boolean;
}

export interface FormularyItem {
  id: string;
  sku: string;
  name: string;
  presentation: string; // e.g. "Solid Oral", "Capsule", "WHO standard formula sachets"
  category: string; // "Analgesic", "Antibiotic", "Chronic Care", "Antimalarial", etc.
  unit: string; // "tabs", "caps", "sachets"
  currentBalance: number;
  minThreshold: number;
  shelfLocation: string;
  formDescription: string; // e.g. "Oral Tablets (Blister pack 10x10)"
  costPriceGhc: number;
  sellingPriceGhc: number;
  earliestExpiry: string;
  status: 'In stock' | 'Low stock' | 'Expiring soon' | 'Out of stock';
  matchedSku?: boolean;
  batches: BatchItem[];
}

export interface LedgerTransaction {
  id: string;
  date: string; // "01 Oct 2026"
  rawDate: string;
  type: TransactionType;
  supplierOrCustomer: string; // e.g. "PrimeCare Wholesale Ltd" or "Outpatient Dispensary (OPD #1098)"
  referenceDetails?: string; // "GRN #PRC-77192" or "Requisition #W3-8820"
  batchNo: string;
  expiryLabel: string; // "Nov 2026"
  qtyIn: number | null;
  qtyOut: number | null;
  balanceAfter: number;
  recordedBy: string; // "S. Jenkins, Pharmacist"
  isHighlight?: boolean;
  isBreachAlert?: boolean;
}

export interface MarketBenchmark {
  itemName: string;
  wholesaleRefGhc: number;
  retailCapGhc: number;
  marketRangeMinGhc: number;
  marketRangeMaxGhc: number;
  source: string;
  trend: 'stable' | 'increasing' | 'decreasing';
  lastUpdated: string;
}

export type ActiveScreen = 'dashboard' | 'receive' | 'dispense' | 'inventory' | 'bincard' | 'sales' | 'finance' | 'reconciliation';
