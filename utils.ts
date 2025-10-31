// Helper functions for validation
export const validateIpFormat = (ip: string): string | null => {
    const octets = ip.split('.');
    if (octets.length !== 4) {
        return "Invalid IPv4 format. Must have 4 octets separated by dots.";
    }
    for (const octet of octets) {
        const num = parseInt(octet, 10);
        // Disallow non-numeric, values not matching parsed int (e.g. "01"), or out of range
        if (!/^\d+$/.test(octet) || String(num) !== octet || num < 0 || num > 255) {
            return "Invalid IPv4 format. Octets must be numbers between 0 and 255 without leading zeros.";
        }
    }
    return null;
};

export const getIpClassInfo = (ip: string) => {
  const firstOctet = parseInt(ip.split('.')[0], 10);
  if (firstOctet >= 1 && firstOctet <= 126) return { class: 'A', defaultMaskBits: 8, hostBits: 24 };
  if (firstOctet >= 128 && firstOctet <= 191) return { class: 'B', defaultMaskBits: 16, hostBits: 16 };
  if (firstOctet >= 192 && firstOctet <= 223) return { class: 'C', defaultMaskBits: 24, hostBits: 8 };
  if (firstOctet >= 224 && firstOctet <= 239) return { class: 'D' };
  return { class: 'E' };
};

const ipToBigInt = (ip: string): bigint => {
    return ip.split('.').reduce((acc, octet) => (acc << 8n) + BigInt(parseInt(octet, 10)), 0n);
};

const maskToCidr = (mask: string): number => {
    const maskInt = ipToBigInt(mask);
    const binaryString = maskInt.toString(2).padStart(32, '0');
    if (binaryString.includes('01')) {
      throw new Error(`Invalid subnet mask: ${mask}. Must have contiguous 1s followed by 0s.`);
    }
    const cidr = binaryString.indexOf('0');
    return cidr === -1 ? 32 : cidr;
};

export const parseMask = (maskValue: string): number => {
    let cleanMaskValue = maskValue.trim();
    if (cleanMaskValue.startsWith('/')) {
      cleanMaskValue = cleanMaskValue.substring(1);
    }
    if (!isNaN(parseInt(cleanMaskValue, 10)) && !cleanMaskValue.includes('.')) {
        const cidr = parseInt(cleanMaskValue, 10);
        if (cidr < 0 || cidr > 32) {
            throw new Error(`Invalid CIDR value: /${cidr}. Must be between 0 and 32.`);
        }
        return cidr;
    } else if (cleanMaskValue.includes('.')) {
        const ipFormatError = validateIpFormat(cleanMaskValue);
        if (ipFormatError) throw new Error(`Invalid subnet mask format: ${cleanMaskValue}.`);
        return maskToCidr(cleanMaskValue);
    }
    throw new Error(`Unrecognized mask format: ${maskValue}.`);
};
