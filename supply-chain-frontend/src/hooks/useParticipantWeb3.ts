import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export type ParticipantRole = 'manufacturer' | 'distributor' | 'deliveryHub' | 'customer';

interface Web3State {
  account: string | null;
  isConnected: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  chainId?: string | null;
}

const STORAGE_KEY_PREFIX = 'participant_wallet_';

const getStorageKey = (participant: ParticipantRole): string => {
  return `${STORAGE_KEY_PREFIX}${participant}`;
};

const saveParticipantAccount = (participant: ParticipantRole, account: string | null) => {
  if (account) {
    localStorage.setItem(getStorageKey(participant), account);
  } else {
    localStorage.removeItem(getStorageKey(participant));
  }
};

const getParticipantAccount = (participant: ParticipantRole): string | null => {
  return localStorage.getItem(getStorageKey(participant));
};

/**
 * Hook for participant-specific wallet connections
 * Each participant (Manufacturer, Distributor, Delivery Hub, Customer) has their own independent wallet connection
 */
export const useParticipantWeb3 = (participant: ParticipantRole) => {
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
        // Always force account selection by using wallet_requestPermissions
        // This should show account selection dialog even when permissions exist
        let accounts: string[] = [];
        
        try {
          // Always request permissions - this should show account selection dialog if multiple accounts exist
          // Even if permissions already exist, MetaMask should show account selection when multiple accounts exist
          await (window as any).ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          });
          
          // After requesting permissions, get the accounts
          // This should return the account selected in the permissions dialog
          accounts = await (window as any).ethereum.request({
            method: 'eth_requestAccounts',
          });
        } catch (error: any) {
          // If user rejects (4001), return early
          if (error.code === 4001) {
            console.log('User rejected account selection');
            return;
          }
          // If wallet_requestPermissions fails, try eth_requestAccounts directly
          try {
            accounts = await (window as any).ethereum.request({
              method: 'eth_requestAccounts',
            });
          } catch (accountsError: any) {
            if (accountsError.code === 4001) {
              console.log('User rejected account selection');
              return;
            }
            throw accountsError;
          }
        }
        
        if (!accounts || accounts.length === 0) {
          console.log('No account selected');
          return;
        }

        const provider = new ethers.BrowserProvider((window as any).ethereum);

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

        // Get signer for the selected account
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        
        // Use the signer's address (this is the currently active account in MetaMask)
        const accountToUse = signerAddress;

        // Save this participant's account
        saveParticipantAccount(participant, accountToUse);
        
        setWeb3State({
          account: accountToUse,
          isConnected: true,
          provider,
          signer,
          chainId: sepoliaHex,
        });
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error: any) {
      if (error.code === 4001) {
        console.log('User rejected wallet connection');
      } else {
        console.error(`Error connecting ${participant} wallet:`, error);
      }
    }
  };

  const disconnect = () => {
    saveParticipantAccount(participant, null);
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
          const signerAddress = await signer.getAddress();
          
          // Save this participant's account
          saveParticipantAccount(participant, signerAddress);
          
          setWeb3State({
            account: signerAddress,
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
        console.log(`${participant}: User rejected account selection`);
      } else {
        console.error(`Error switching ${participant} account:`, error);
      }
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof (window as any).ethereum !== 'undefined') {
        try {
          // Check if this participant has a saved account
          const savedAccount = getParticipantAccount(participant);
          
          if (savedAccount) {
            // Try to verify the account is still connected
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const accounts = await provider.listAccounts();
            
            // Check if the saved account is in the list of connected accounts
            const accountExists = accounts.some(
              acc => acc.address.toLowerCase() === savedAccount.toLowerCase()
            );
            
            if (accountExists) {
              // Get signer - this will use the currently active account in MetaMask
              // Note: We can't directly select a specific account, but we can verify it matches
              const signer = await provider.getSigner();
              const signerAddress = await signer.getAddress();
              
              // If the signer matches the saved account, use it
              // Otherwise, we'll need to prompt the user to switch
              if (signerAddress.toLowerCase() === savedAccount.toLowerCase()) {
                const chainId = await provider.send('eth_chainId', []);
                setWeb3State({
                  account: signerAddress,
                  isConnected: true,
                  provider,
                  signer,
                  chainId,
                });
              } else {
                // Saved account exists but is not currently active
                // We'll set the account but mark as needing reconnection
                setWeb3State({
                  account: savedAccount,
                  isConnected: false,
                  provider: null,
                  signer: null,
                  chainId: null,
                });
              }
            } else {
              // Saved account is not connected, clear it
              saveParticipantAccount(participant, null);
              setWeb3State({
                account: null,
                isConnected: false,
                provider: null,
                signer: null,
              });
            }
          }
        } catch (error) {
          console.error(`Error checking ${participant} connection:`, error);
        }
      }
    };

    checkConnection();

    // Listen for account changes - but only update if it affects this participant's saved account
    if ((window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        const savedAccount = getParticipantAccount(participant);
        
        if (accounts.length === 0) {
          // All accounts disconnected
          if (savedAccount) {
            setWeb3State(prev => ({
              ...prev,
              isConnected: false,
              provider: null,
              signer: null,
            }));
          } else {
            disconnect();
          }
        } else {
          // Check if the saved account is still in the list
          const accountExists = accounts.some(
            acc => acc.toLowerCase() === savedAccount?.toLowerCase()
          );
          
          if (savedAccount && accountExists) {
            // Reconnect if the saved account is still available
            checkConnection();
          } else if (!savedAccount) {
            // No saved account, but accounts are available - don't auto-connect
            // User needs to explicitly connect
          }
        }
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      
      (window as any).ethereum.on('chainChanged', (chainId: string) => {
        setWeb3State(prev => ({ ...prev, chainId }));
      });

      return () => {
        if ((window as any).ethereum) {
          (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [participant]);

  return {
    ...web3State,
    connect,
    disconnect,
    switchAccount,
  };
};

