
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
  const calculateSubnetting = (payload) => {
    const { ipAddress, calculationMode } = payload;
    const classInfo = getIpClassInfo(ipAddress);

    if (classInfo.class === 'D' || classInfo.class === 'E') {
      throw new Error(\`IP address \${ipAddress} is in Class \${classInfo.class} and cannot be subnetted.\`);
    }

    let newCidr = 0;
    let subnetBits = 0;

    if (calculationMode === 'subnets') {
        const requiredSubnets = payload.requiredSubnets || 1;
        if (requiredSubnets <= 0) throw new Error("Number of subnets must be a positive number.");
        subnetBits = Math.ceil(Math.log2(requiredSubnets));
        newCidr = classInfo.defaultMaskBits + subnetBits;
        if (32 - newCidr < 2) {
             throw new Error(\`Not enough host bits to support \${requiredSubnets.toLocaleString()} subnets.\`);
        }
    } else if (calculationMode === 'hosts') {
        const requiredHosts = payload.requiredHosts || 1;
        if (requiredHosts <= 0) throw new Error("Number of hosts must be a positive number.");
        const neededHostBits = Math.ceil(Math.log2(requiredHosts + 2));
        newCidr = 32 - neededHostBits;
        subnetBits = newCidr - classInfo.defaultMaskBits;
        if (subnetBits < 0) {
             throw new Error(\`A Class \${classInfo.class} network is not large enough to provide \${requiredHosts.toLocaleString()} hosts per subnet.\`);
        }
    } else { // 'mask'
      if (typeof payload.mask !== 'string') throw new Error("Subnet mask must be a string.");
      newCidr = parseMask(payload.mask);

      if (newCidr < classInfo.defaultMaskBits) {
        throw new Error(\`Provided mask /\${newCidr} is smaller than the default mask /\${classInfo.defaultMaskBits} for a Class \${classInfo.class} address.\`);
      }
      subnetBits = newCidr - classInfo.defaultMaskBits;
    }

    if (newCidr > 32) {
      throw new Error('The resulting CIDR mask cannot be larger than /32.');
    }
    if (subnetBits > 16) {
      throw new Error(\`This calculation would generate over 100,000 subnets (\${(Math.pow(2, subnetBits)).toLocaleString()}), which is too large for this tool.\`);
    }

    const newMaskInt = (0xffffffffn << BigInt(32 - newCidr)) & 0xffffffffn;
    const defaultMaskInt = (0xffffffffn << BigInt(32 - classInfo.defaultMaskBits)) & 0xffffffffn;
    const totalSubnets = Math.pow(2, subnetBits);
    const hostsPerSubnet = Math.pow(2, 32 - newCidr) - 2;
    const ipInt = ipToBigInt(ipAddress);
    const originalMaskInt = (0xffffffffn << BigInt(32 - classInfo.defaultMaskBits)) & 0xffffffffn;
    const baseNetworkAddressInt = ipInt & originalMaskInt;
    const subnets = [];
    const increment = 1n << BigInt(32 - newCidr);
    
    // Limit loop to prevent browser freeze for very large subnet counts
    const loopLimit = Math.min(totalSubnets, 65536);

    for (let i = 0; i < loopLimit; i++) {
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

  const calculateVlsm = (baseIp, baseCidr, requestedSubnets) => {
    if (requestedSubnets.length === 0) {
      throw new Error("Please add at least one subnet group to calculate.");
    }

    const flattenedSubnets = [];
    requestedSubnets.forEach(group => {
      const count = Number(group.count);
      if (isNaN(count) || count <= 0) {
        throw new Error(\`Invalid number of subnets for group '\${group.name}'. Must be a positive number.\`);
      }
      for (let i = 0; i < count; i++) {
        flattenedSubnets.push({
          id: \`\${group.id}-\${i}\`,
          name: count > 1 ? \`\${group.name} \${i + 1}\` : group.name,
          hosts: group.hosts,
        });
      }
    });

    if (flattenedSubnets.length === 0) {
      throw new Error("Please specify at least one subnet to calculate.");
    }

    const baseIpInt = ipToBigInt(baseIp);
    const baseMaskInt = (0xffffffffn << BigInt(32 - baseCidr)) & 0xffffffffn;
    const baseNetworkAddressInt = baseIpInt & baseMaskInt;

    if (baseNetworkAddressInt !== ipToBigInt(baseIp)) {
        throw new Error(\`The provided IP address (\${baseIp}) is a host address, not a network address for the /\${baseCidr} block. Please use \${bigIntToIp(baseNetworkAddressInt)}.\`);
    }

    const totalHostsInBlock = Math.pow(2, 32 - baseCidr);

    const subnetsToAllocate = flattenedSubnets.map(s => {
      const requiredHosts = Number(s.hosts);
      if (isNaN(requiredHosts) || requiredHosts <= 0) {
        throw new Error(\`Invalid number of hosts for subnet '\${s.name}'. Must be a positive number.\`);
      }
      const hostBits = Math.ceil(Math.log2(requiredHosts + 2));
      const subnetCidr = 32 - hostBits;
      const allocatedHosts = Math.pow(2, hostBits) - 2;
      return { ...s, requiredHosts, hostBits, subnetCidr, allocatedHosts };
    }).sort((a, b) => b.hostBits - a.hostBits);

    const totalRequiredHosts = subnetsToAllocate.reduce((sum, s) => sum + s.requiredHosts, 0);
    const totalAllocatedHosts = subnetsToAllocate.reduce((sum, s) => sum + s.allocatedHosts, 0);

    let currentAddressInt = baseNetworkAddressInt;
    const allocatedSubnets = [];
    const broadcastAddressOfBaseNetworkInt = baseNetworkAddressInt + (1n << BigInt(32 - baseCidr)) - 1n;

    for (const subnet of subnetsToAllocate) {
      const subnetSize = 1n << BigInt(subnet.hostBits);
      if (currentAddressInt + subnetSize > broadcastAddressOfBaseNetworkInt + 1n) {
        throw new Error(\`Not enough address space in the network \${baseIp}/\${baseCidr} to fit all requested subnets.\`);
      }

      const networkAddressInt = currentAddressInt;
      const broadcastAddressInt = networkAddressInt + subnetSize - 1n;
      const maskInt = (0xffffffffn << BigInt(subnet.hostBits)) & 0xffffffffn;
      const startHost = networkAddressInt + 1n;
      const endHost = broadcastAddressInt - 1n;

      allocatedSubnets.push({
        id: subnet.id,
        name: subnet.name,
        requiredHosts: subnet.requiredHosts,
        allocatedHosts: subnet.allocatedHosts,
        networkAddress: bigIntToIp(networkAddressInt),
        cidr: subnet.subnetCidr,
        subnetMask: bigIntToIp(maskInt),
        usableHostRange: startHost > endHost ? 'N/A' : \`\${bigIntToIp(startHost)} - \${bigIntToIp(endHost)}\`,
        broadcastAddress: bigIntToIp(broadcastAddressInt),
      });

      currentAddressInt += subnetSize;
    }

    const unallocatedRanges = [];
    if (currentAddressInt <= broadcastAddressOfBaseNetworkInt) {
        const remainingSize = broadcastAddressOfBaseNetworkInt - currentAddressInt + 1n;
        if (remainingSize > 0) {
            unallocatedRanges.push({
                networkAddress: bigIntToIp(currentAddressInt),
                size: remainingSize.toString(),
                usableHostRange: \`\${bigIntToIp(currentAddressInt)} - \${bigIntToIp(broadcastAddressOfBaseNetworkInt)}\`
            });
        }
    }

    return {
      baseNetwork: \`\${baseIp}/\${baseCidr}\`,
      totalHostsInBlock,
      totalRequiredHosts,
      totalAllocatedHosts,
      allocatedSubnets,
      unallocatedRanges,
      efficiency: totalAllocatedHosts > 0 ? (totalRequiredHosts / totalAllocatedHosts) * 100 : 0,
    };
  };

  self.onmessage = (e) => {
    try {
      const { calculator, payload } = e.data;
      let result;
      if (calculator === 'standard') {
        result = calculateSubnetting(payload);
      } else if (calculator === 'vlsm') {
        const { ipAddress, cidr, subnets } = payload;
        result = calculateVlsm(ipAddress, cidr, subnets);
      } else {
         throw new Error('Unknown calculator type');
      }
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