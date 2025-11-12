export enum CalculationMode {
  SUBNETS = 'subnets',
  HOSTS = 'hosts',
  MASK = 'mask',
}

export interface CalculationPayload {
  calculationMode: CalculationMode;
  ipAddress: string;
  requiredSubnets?: number;
  requiredHosts?: number;
  mask?: string;
}

export interface Subnet {
  id: number;
  networkAddress: string;
  usableHostRange: string;
  broadcastAddress: string;
}

export interface CalculationResult {
  subnetMask: string;
  cidr: number;
  totalSubnets: number;
  hostsPerSubnet: number;
  subnets: Subnet[];
  ipClass: string;
  defaultMask: string;
}


// VLSM Types
export interface VlsmSubnetRequest {
  id: string;
  name: string;
  hosts: number;
  count: number;
}

export interface VlsmCalculationPayload {
  ipAddress: string;
  cidr: number;
  subnets: VlsmSubnetRequest[];
}

export interface VlsmSubnetResult {
  id: string;
  name: string;
  requiredHosts: number;
  allocatedHosts: number;
  networkAddress: string;
  cidr: number;
  subnetMask: string;
  usableHostRange: string;
  broadcastAddress: string;
}

export interface UnallocatedRange {
    networkAddress: string;
    size: string;
    usableHostRange: string;
}

export interface VlsmCalculationResult {
  baseNetwork: string;
  totalHostsInBlock: number;
  totalRequiredHosts: number;
  totalAllocatedHosts: number;
  allocatedSubnets: VlsmSubnetResult[];
  unallocatedRanges: UnallocatedRange[];
  efficiency: number;
}