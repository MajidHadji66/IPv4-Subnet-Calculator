import { CalculationMode, CalculationResult, Subnet } from '../types';

const ipToBigInt = (ip: string): bigint => {
  return ip.split('.').reduce((acc, octet) => (acc << 8n) + BigInt(parseInt(octet, 10)), 0n);
};

const bigIntToIp = (ipInt: bigint): string => {
  return Array.from({ length: 4 }, (_, i) => (ipInt >> BigInt(8 * (3 - i))) & 255n).join('.');
};

const getIpClassInfo = (ip: string): { class: 'A' | 'B' | 'C' | 'D' | 'E', defaultMaskBits: number, networkBits: number, hostBits: number } => {
  const firstOctet = parseInt(ip.split('.')[0], 10);
  if (firstOctet >= 1 && firstOctet <= 126) return { class: 'A', defaultMaskBits: 8, networkBits: 8, hostBits: 24 };
  if (firstOctet >= 128 && firstOctet <= 191) return { class: 'B', defaultMaskBits: 16, networkBits: 16, hostBits: 16 };
  if (firstOctet >= 192 && firstOctet <= 223) return { class: 'C', defaultMaskBits: 24, networkBits: 24, hostBits: 8 };
  if (firstOctet >= 224 && firstOctet <= 239) return { class: 'D', defaultMaskBits: 0, networkBits: 0, hostBits: 0 }; // Multicast
  return { class: 'E', defaultMaskBits: 0, networkBits: 0, hostBits: 0 }; // Reserved
};

export const calculateSubnetting = (ipAddress: string, mode: CalculationMode, value: number): CalculationResult => {
  const classInfo = getIpClassInfo(ipAddress);
  if (classInfo.class === 'D' || classInfo.class === 'E') {
    throw new Error(`IP address ${ipAddress} is in Class ${classInfo.class} and cannot be subnetted.`);
  }

  let subnetBits = 0;
  if (mode === CalculationMode.SUBNETS) {
    if (value <= 0) throw new Error("Number of subnets must be positive.");
    subnetBits = Math.ceil(Math.log2(value));
  } else { // CalculationMode.HOSTS
    if (value <= 0) throw new Error("Number of hosts must be positive.");
    const requiredHostBits = Math.ceil(Math.log2(value + 2));
    if (requiredHostBits > classInfo.hostBits) {
      throw new Error(`Not enough host bits in Class ${classInfo.class} for ${value} hosts.`);
    }
    subnetBits = classInfo.hostBits - requiredHostBits;
  }
  
  if (subnetBits < 0 || classInfo.defaultMaskBits + subnetBits > 30) {
    throw new Error('Invalid number of subnets or hosts requested for this IP class.');
  }

  const newCidr = classInfo.defaultMaskBits + subnetBits;
  const newMaskInt = (0xffffffffn << BigInt(32 - newCidr)) & 0xffffffffn;

  const totalSubnets = 2 ** subnetBits;
  const hostsPerSubnet = (2 ** (32 - newCidr)) - 2;

  if (hostsPerSubnet < 1 && mode === CalculationMode.HOSTS) {
      throw new Error(`The calculation results in 0 usable hosts per subnet. Please request fewer hosts or subnets.`);
  }

  const ipInt = ipToBigInt(ipAddress);
  const networkAddressInt = ipInt & newMaskInt;
  
  const subnets: Subnet[] = [];
  const increment = 1n << BigInt(32 - newCidr);

  for (let i = 0; i < totalSubnets; i++) {
    const currentSubnetInt = networkAddressInt + (BigInt(i) * increment);
    const broadcastAddressInt = currentSubnetInt + increment - 1n;
    
    subnets.push({
      id: i + 1,
      networkAddress: bigIntToIp(currentSubnetInt),
      usableHostRange: `${bigIntToIp(currentSubnetInt + 1n)} - ${bigIntToIp(broadcastAddressInt - 1n)}`,
      broadcastAddress: bigIntToIp(broadcastAddressInt),
    });
  }

  return {
    subnetMask: bigIntToIp(newMaskInt),
    cidr: newCidr,
    totalSubnets: totalSubnets,
    hostsPerSubnet: hostsPerSubnet < 0 ? 0 : hostsPerSubnet,
    subnets: subnets,
  };
};
