
export const workerScript = `
  const ipToBigInt = (ip) => {
    return ip.split('.').reduce((acc, octet) => (acc << 8n) + BigInt(parseInt(octet, 10)), 0n);
  };
  const bigIntToIp = (ipInt) => {
    return Array.from({ length: 4 }, (_, i) => (ipInt >> BigInt(8 * (3 - i))) & 255n).join('.');
  };
  const getIpClassInfo = (ip) => {
    const firstOctet = parseInt(ip.split('.')[0], 10);
    if (firstOctet >= 1 && firstOctet <= 126) return { class: 'A', defaultMaskBits: 8, networkBits: 8, hostBits: 24 };
    if (firstOctet >= 128 && firstOctet <= 191) return { class: 'B', defaultMaskBits: 16, networkBits: 16, hostBits: 16 };
    if (firstOctet >= 192 && firstOctet <= 223) return { class: 'C', defaultMaskBits: 24, networkBits: 24, hostBits: 8 };
    if (firstOctet >= 224 && firstOctet <= 239) return { class: 'D', defaultMaskBits: 0, networkBits: 0, hostBits: 0 };
    return { class: 'E', defaultMaskBits: 0, networkBits: 0, hostBits: 0 };
  };
  const maskToCidr = (mask) => {
    const maskInt = ipToBigInt(mask);
    const binaryString = maskInt.toString(2).padStart(32, '0');
    if (binaryString.includes('01')) {
      throw new Error(\`Invalid subnet mask: \${mask}. Must have contiguous 1s followed by 0s.\`);
    }
    const cidr = binaryString.indexOf('0');
    return cidr === -1 ? 32 : cidr;
  };
  const parseMask = (maskValue) => {
    let cleanMaskValue = maskValue.trim();
    if (cleanMaskValue.startsWith('/')) {
      cleanMaskValue = cleanMaskValue.substring(1);
    }
    if (!isNaN(parseInt(cleanMaskValue, 10)) && !cleanMaskValue.includes('.')) {
      const cidr = parseInt(cleanMaskValue, 10);
      if (cidr < 0 || cidr > 32) {
        throw new Error(\`Invalid CIDR value: /\${cidr}. Must be between 0 and 32.\`);
      }
      return cidr;
    } else if (cleanMaskValue.includes('.')) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(cleanMaskValue)) {
        throw new Error(\`Invalid subnet mask format: \${cleanMaskValue}.\`);
      }
      return maskToCidr(cleanMaskValue);
    }
    throw new Error(\`Unrecognized mask format: \${maskValue}.\`);
  };
  const calculateSubnetting = (ipAddress, mode, value) => {
    const classInfo = getIpClassInfo(ipAddress);
    if (classInfo.class === 'D' || classInfo.class === 'E') {
      throw new Error(\`IP address \${ipAddress} is in Class \${classInfo.class} and cannot be subnetted.\`);
    }
    let subnetBits = 0;
    let newCidr = 0;
    if (mode === 'subnets') {
      if (typeof value !== 'number' || value <= 0) throw new Error("Number of subnets must be a positive number.");
      subnetBits = Math.ceil(Math.log2(value));
      newCidr = classInfo.defaultMaskBits + subnetBits;
    } else if (mode === 'hosts') {
      if (typeof value !== 'number' || value <= 0) throw new Error("Number of hosts must be a positive number.");
      const requiredHostBits = Math.ceil(Math.log2(value + 2));
      if (requiredHostBits > classInfo.hostBits) {
        throw new Error(\`Not enough host bits in Class \${classInfo.class} for \${value} hosts.\`);
      }
      subnetBits = classInfo.hostBits - requiredHostBits;
      newCidr = classInfo.defaultMaskBits + subnetBits;
    } else { // 'mask'
      if (typeof value !== 'string') throw new Error("Subnet mask must be a string.");
      newCidr = parseMask(value);
      if (newCidr < classInfo.defaultMaskBits) {
        throw new Error(\`Provided mask /\${newCidr} is smaller than the default mask /\${classInfo.defaultMaskBits} for a Class \${classInfo.class} address.\`);
      }
      subnetBits = newCidr - classInfo.defaultMaskBits;
    }
    if (newCidr > 32) {
      throw new Error('The resulting CIDR mask cannot be larger than /32.');
    }
    if (subnetBits > 16) {
      throw new Error(\`This calculation would generate over 100,000 subnets (\${(2 ** subnetBits).toLocaleString()}), which is too large for this tool.\`);
    }
    const newMaskInt = (0xffffffffn << BigInt(32 - newCidr)) & 0xffffffffn;
    const defaultMaskInt = (0xffffffffn << BigInt(32 - classInfo.defaultMaskBits)) & 0xffffffffn;
    const totalSubnets = 2 ** subnetBits;
    const hostsPerSubnet = (2 ** (32 - newCidr)) - 2;
    const ipInt = ipToBigInt(ipAddress);
    const originalMaskInt = (0xffffffffn << BigInt(32 - classInfo.defaultMaskBits)) & 0xffffffffn;
    const baseNetworkAddressInt = ipInt & originalMaskInt;
    const subnets = [];
    const increment = 1n << BigInt(32 - newCidr);
    for (let i = 0; i < totalSubnets; i++) {
      const currentSubnetInt = baseNetworkAddressInt + (BigInt(i) * increment);
      const broadcastAddressInt = currentSubnetInt + increment - 1n;
      const startHost = currentSubnetInt + 1n;
      const endHost = broadcastAddressInt - 1n;
      subnets.push({
        id: i + 1,
        networkAddress: bigIntToIp(currentSubnetInt),
        usableHostRange: startHost > endHost ? 'N/A' : \`\${bigIntToIp(startHost)} - \${bigIntToIp(endHost)}\`,
        broadcastAddress: bigIntToIp(broadcastAddressInt),
      });
    }
    return {
      ipClass: classInfo.class,
      defaultMask: bigIntToIp(defaultMaskInt),
      subnetMask: bigIntToIp(newMaskInt),
      cidr: newCidr,
      totalSubnets: totalSubnets,
      hostsPerSubnet: hostsPerSubnet < 0 ? 0 : hostsPerSubnet,
      subnets: subnets,
    };
  };

  self.onmessage = (e) => {
    try {
      const { ipAddress, calculationMode, value } = e.data;
      const result = calculateSubnetting(ipAddress, calculationMode, value);
      self.postMessage({ result });
    } catch (err) {
      if (err instanceof Error) {
        self.postMessage({ error: err.message });
      } else {
        self.postMessage({ error: 'An unknown error occurred in the worker.' });
      }
    }
  };
`;
