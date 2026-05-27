import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { WalletProvider, useWallet, truncateAddress } from '@/components/WalletProvider';
import { secureStorage } from '@/app/lib/secureStorage';

// Mock secureStorage
jest.mock('@/app/lib/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('WalletProvider', () => {
  let mockEthereum: any;
  let mockSolana: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    (secureStorage.getItem as jest.Mock).mockResolvedValue(null);
    (secureStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Setup mock Ethereum provider
    mockEthereum = {
      isMetaMask: true,
      request: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    // Setup mock Solana provider
    mockSolana = {
      isPhantom: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    // Attach to window
    (window as any).ethereum = mockEthereum;
    (window as any).solana = mockSolana;
  });

  afterEach(() => {
    delete (window as any).ethereum;
    delete (window as any).solana;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WalletProvider>{children}</WalletProvider>
  );

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWallet(), { wrapper });

      expect(result.current.address).toBeNull();
      expect(result.current.chainId).toBeNull();
      expect(result.current.walletType).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should restore persisted wallet session on mount', async () => {
      const persistedData = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: '0x1',
        walletType: 'metamask',
      };

      (secureStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(persistedData)
      );

      const { result } = renderHook(() => useWallet(), { wrapper });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.address).toBe(persistedData.address);
      expect(result.current.chainId).toBe(persistedData.chainId);
      expect(result.current.walletType).toBe('metamask');
    });

    it('should handle malformed persisted data gracefully', async () => {
      (secureStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const { result } = renderHook(() => useWallet(), { wrapper });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });
  });

  describe('MetaMask Connection', () => {
    it('should connect to MetaMask successfully', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockChainId = '0x1';

      mockEthereum.request.mockImplementation((args: any) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve([mockAddress]);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve(mockChainId);
        }
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(result.current.chainId).toBe(mockChainId);
      expect(result.current.walletType).toBe('metamask');
      expect(result.current.error).toBeNull();
      expect(secureStorage.setItem).toHaveBeenCalled();
    });

    it('should handle MetaMask not installed', async () => {
      delete (window as any).ethereum;

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toContain('MetaMask is not installed');
    });

    it('should handle user rejection (code 4001)', async () => {
      mockEthereum.request.mockRejectedValue({ code: 4001 });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toContain('Connection rejected');
    });

    it('should handle no accounts returned', async () => {
      mockEthereum.request.mockImplementation((args: any) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve([]);
        }
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toContain('No accounts returned');
    });

    it('should set isConnecting to true during connection', async () => {
      mockEthereum.request.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(['0x123']), 100)
          )
      );

      const { result } = renderHook(() => useWallet(), { wrapper });

      act(() => {
        result.current.connectMetaMask();
      });

      expect(result.current.isConnecting).toBe(true);

      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
      });
    });
  });

  describe('Phantom Connection', () => {
    it('should connect to Phantom successfully', async () => {
      const mockAddress = 'SolanaAddressExample123456789';

      mockSolana.connect.mockResolvedValue({
        publicKey: {
          toBase58: () => mockAddress,
        },
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectPhantom();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBe(mockAddress);
      expect(result.current.walletType).toBe('phantom');
      expect(result.current.error).toBeNull();
      expect(secureStorage.setItem).toHaveBeenCalled();
    });

    it('should handle Phantom not installed', async () => {
      delete (window as any).solana;

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectPhantom();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toContain('Phantom wallet not detected');
    });

    it('should handle user rejection (code 4001)', async () => {
      mockSolana.connect.mockRejectedValue({ code: 4001 });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectPhantom();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toContain('Connection rejected');
    });

    it('should set isConnecting to true during connection', async () => {
      mockSolana.connect.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  publicKey: { toBase58: () => 'SolanaAddress' },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useWallet(), { wrapper });

      act(() => {
        result.current.connectPhantom();
      });

      expect(result.current.isConnecting).toBe(true);

      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
      });
    });
  });

  describe('Disconnect', () => {
    it('should disconnect wallet and clear state', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';

      mockEthereum.request.mockImplementation((args: any) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve([mockAddress]);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0x1');
        }
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      // Connect first
      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.isConnected).toBe(true);

      // Disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.address).toBeNull();
      expect(result.current.chainId).toBeNull();
      expect(result.current.walletType).toBeNull();
      expect(secureStorage.removeItem).toHaveBeenCalledWith('clipcash_wallet');
    });

    it('should call Phantom disconnect when disconnecting Phantom wallet', async () => {
      const mockAddress = 'SolanaAddressExample123456789';

      mockSolana.connect.mockResolvedValue({
        publicKey: {
          toBase58: () => mockAddress,
        },
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      // Connect Phantom
      await act(async () => {
        await result.current.connectPhantom();
      });

      // Disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(mockSolana.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should clear error when clearError is called', async () => {
      delete (window as any).ethereum;

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear error when connection attempt starts', async () => {
      delete (window as any).ethereum;

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.error).not.toBeNull();

      // Restore ethereum and try again
      (window as any).ethereum = mockEthereum;
      mockEthereum.request.mockResolvedValue(['0x123']);

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Event Listeners', () => {
    it('should listen for MetaMask account changes', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper });

      // Verify event listener was registered
      expect(mockEthereum.on).toHaveBeenCalledWith(
        'accountsChanged',
        expect.any(Function)
      );
    });

    it('should listen for MetaMask chain changes', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper });

      // Verify event listener was registered
      expect(mockEthereum.on).toHaveBeenCalledWith(
        'chainChanged',
        expect.any(Function)
      );
    });

    it('should listen for Phantom account changes', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper });

      // Verify event listener was registered
      expect(mockSolana.on).toHaveBeenCalledWith(
        'accountChanged',
        expect.any(Function)
      );
    });

    it('should listen for Phantom connect events', async () => {
      const { result } = renderHook(() => useWallet(), { wrapper });

      // Verify event listener was registered
      expect(mockSolana.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function)
      );
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useWallet(), { wrapper });

      unmount();

      expect(mockEthereum.removeListener).toHaveBeenCalled();
      expect(mockSolana.removeListener).toHaveBeenCalled();
    });
  });

  describe('Session Persistence', () => {
    it('should persist session to secure storage on successful connection', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockChainId = '0x1';

      mockEthereum.request.mockImplementation((args: any) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve([mockAddress]);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve(mockChainId);
        }
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      expect(secureStorage.setItem).toHaveBeenCalledWith(
        'clipcash_wallet',
        JSON.stringify({
          address: mockAddress,
          chainId: mockChainId,
          walletType: 'metamask',
        })
      );
    });

    it('should remove session from storage on disconnect', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';

      mockEthereum.request.mockImplementation((args: any) => {
        if (args.method === 'eth_requestAccounts') {
          return Promise.resolve([mockAddress]);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0x1');
        }
      });

      const { result } = renderHook(() => useWallet(), { wrapper });

      await act(async () => {
        await result.current.connectMetaMask();
      });

      act(() => {
        result.current.disconnect();
      });

      expect(secureStorage.removeItem).toHaveBeenCalledWith('clipcash_wallet');
    });
  });
});

describe('truncateAddress', () => {
  it('should truncate long addresses correctly', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const truncated = truncateAddress(address);

    expect(truncated).toBe('0x1234...7890');
  });

  it('should return short addresses as-is', () => {
    const address = '0x123';
    const truncated = truncateAddress(address);

    expect(truncated).toBe('0x123');
  });

  it('should handle Solana addresses', () => {
    const address = 'SolanaAddressExample123456789012345678901234567890';
    const truncated = truncateAddress(address);

    expect(truncated).toBe('Solana...7890');
  });
});
