import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface Web3State {
  account: string | null;
  isConnected: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  chainId?: string | null;
}

export const useWeb3 = () => {
  const [web3State, setWeb3State] = useState<Web3State>({
    account: null,
    isConnected: false,
    provider: null,
    signer: null,
    chainId: null,
  });

  const connect = async () => {
    try {
      if (typeof (window as any).ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);

        // Ensure Sepolia network
        const currentChain = await provider.send('eth_chainId', []);
        const sepoliaHex = '0xaa36a7'; // 11155111
        if (currentChain !== sepoliaHex) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: sepoliaHex }],
            });
          } catch (switchError: any) {
            if (switchError?.code === 4902) {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: sepoliaHex,
                  chainName: 'Sepolia Testnet',
                  rpcUrls: ['https://sepolia.infura.io/v3/6dab3e86aa4d434eb6eacc622ffbab80'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                }],
              });
            } else {
              throw switchError;
            }
          }
        }
        const signer = await provider.getSigner();
        
        setWeb3State({
          account: accounts[0],
          isConnected: true,
          provider,
          signer,
          chainId: sepoliaHex,
        });
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
    }
  };

  const disconnect = () => {
    setWeb3State({
      account: null,
      isConnected: false,
      provider: null,
      signer: null,
    });
  };

  const switchAccount = async () => {
    try {
      if (typeof (window as any).ethereum !== 'undefined') {
        // Request accounts again - MetaMask will show account selection dialog if multiple accounts exist
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        if (accounts && accounts.length > 0) {
          // Reconnect with the newly selected account
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const chainId = await provider.send('eth_chainId', []);
          
          setWeb3State({
            account: accounts[0],
            isConnected: true,
            provider,
            signer,
            chainId,
          });
        }
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error: any) {
      if (error.code === 4001) {
        // User rejected the account selection
        console.log('User rejected account selection');
      } else {
        console.error('Error switching account:', error);
      }
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof (window as any).ethereum !== 'undefined') {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            const chainId = await provider.send('eth_chainId', []);
            setWeb3State({
              account: accounts[0].address,
              isConnected: true,
              provider,
              signer,
              chainId,
            });
          }
        } catch (error) {
          console.error('Error checking connection:', error);
        }
      }
    };

    checkConnection();

    // Listen for account and chain changes
    if ((window as any).ethereum) {
      (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          checkConnection();
        }
      });
      (window as any).ethereum.on('chainChanged', (chainId: string) => {
        setWeb3State(prev => ({ ...prev, chainId }));
        checkConnection();
      });
    }
  }, []);

  return {
    ...web3State,
    connect,
    disconnect,
    switchAccount,
  };
};
