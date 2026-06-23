export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

export const SEPOLIA_RPC_URLS = [
  'https://rpc.sepolia.org',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia-rpc.publicnode.com',
  'https://sepolia.gateway.tenderly.co',
];

export const getSepoliaRpcUrls = (): string[] => {
  const envUrls = import.meta.env.VITE_RPC_URLS;
  if (envUrls) {
    return envUrls.split(',').map((url: string) => url.trim());
  }
  return SEPOLIA_RPC_URLS;
};
