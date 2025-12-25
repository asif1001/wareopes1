
import { Timestamp } from 'firebase/firestore';

export interface OilTank {
  id: string;        // e.g., "branchId_tank_0"
  oilTypeId: string; // Link to oilTypes collection
  oilTypeName: string;
  currentLevel: number; // Current liters
  capacity: number;     // Max liters
  lastUpdated: Timestamp | any; // allow any for serializable dates
  lastUpdatedBy: string;
  // Optional dimensions for 3D viz (if not in DB, we'll default)
  height?: number; 
  radius?: number;
}

export interface Branch {
  id: string;
  name: string;      // e.g., "Main Tanks Plaza"
  location: string;  // e.g., "Warehouse"
  oilTanks: OilTank[];
}

export interface TankUpdateLog {
  branchId: string;
  tankId: string;
  updatedAt: Timestamp;
  oldLevel: number;
  newLevel: number;
  updatedBy: string;
}

export interface Transaction {
  id: string;
  branchId: string;
  tankId: string;
  type: 'supply' | 'loading';
  amount: number;
  timestamp: Timestamp;
}
