export enum CalculationMode {
  SUBNETS = 'subnets',
  HOSTS = 'hosts',
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
}
