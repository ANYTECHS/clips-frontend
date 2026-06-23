import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import EarningsPage from '@/app/earnings/page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock AuthProvider
jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

// Mock API
jest.mock('@/app/lib/mockApi', () => ({
  MockApi: {
    getEarningsReport: jest.fn().mockResolvedValue({
      summary: {
        total: '1234.56',
        completed: '1000.00',
        pending: '234.56',
      },
      transactions: [
        {
          id: 'TX001',
          date: '2024-01-15',
          description: 'YouTube Revenue',
          amount: 150.0,
          platform: 'YouTube',
          status: 'completed',
          type: 'revenue',
          taxId: 'TAX-001',
        },
        {
          id: 'TX002',
          date: '2024-02-20',
          description: 'TikTok Revenue',
          amount: 200.0,
          platform: 'TikTok',
          status: 'completed',
          type: 'revenue',
          taxId: 'TAX-002',
        },
        {
          id: 'TX003',
          date: '2024-03-10',
          description: 'Instagram Revenue',
          amount: 100.0,
          platform: 'Instagram',
          status: 'pending',
          type: 'revenue',
          taxId: 'TAX-003',
        },
      ],
    }),
  },
}));

describe('Earnings Page - Filter Persistence', () => {
  let mockPush: jest.Mock;
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    mockPush = jest.fn();
    mockSearchParams = new URLSearchParams();

    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (usePathname as jest.Mock).mockReturnValue('/earnings');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Filter state initialization from URL', () => {
    it('should load default filters when no URL params exist', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByText(/YouTube Revenue/i)).toBeInTheDocument();
        expect(screen.getByText(/TikTok Revenue/i)).toBeInTheDocument();
        expect(screen.getByText(/Instagram Revenue/i)).toBeInTheDocument();
      });
    });

    it('should initialize search filter from URL', async () => {
      mockSearchParams.set('search', 'YouTube');

      render(<EarningsPage />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by ID/i) as HTMLInputElement;
        expect(searchInput.value).toBe('YouTube');
      });
    });

    it('should initialize date range from URL', async () => {
      mockSearchParams.set('startDate', '2024-02-01');
      mockSearchParams.set('endDate', '2024-02-28');

      render(<EarningsPage />);

      await waitFor(() => {
        const startDateInput = screen.getByLabelText(/From/i) as HTMLInputElement;
        const endDateInput = screen.getByLabelText(/To/i) as HTMLInputElement;
        
        expect(startDateInput.value).toBe('2024-02-01');
        expect(endDateInput.value).toBe('2024-02-28');
      });
    });
  });

  describe('Search filter updates persist to URL', () => {
    it('should update URL when search term changes', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by ID/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by ID/i);
      fireEvent.change(searchInput, { target: { value: 'TikTok' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('search=TikTok'),
          { scroll: false }
        );
      });
    });

    it('should clear search param when search is cleared', async () => {
      mockSearchParams.set('search', 'YouTube');

      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by ID/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by ID/i);
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/earnings', { scroll: false });
      });
    });

    it('should show clear button when search has value', async () => {
      mockSearchParams.set('search', 'YouTube');

      render(<EarningsPage />);

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: '' });
        expect(clearButton).toBeInTheDocument();
      });
    });
  });

  describe('Date range filter updates persist to URL', () => {
    it('should update URL when start date changes', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/From/i)).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText(/From/i);
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2024-01-01'),
          { scroll: false }
        );
      });
    });

    it('should update URL when end date changes', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/To/i)).toBeInTheDocument();
      });

      const endDateInput = screen.getByLabelText(/To/i);
      fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('endDate=2024-12-31'),
          { scroll: false }
        );
      });
    });

    it('should update URL with both date filters', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/From/i)).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText(/From/i);
      const endDateInput = screen.getByLabelText(/To/i);

      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });

      await waitFor(() => {
        const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1][0];
        expect(lastCall).toContain('startDate=2024-01-01');
        expect(lastCall).toContain('endDate=2024-12-31');
      });
    });

    it('should show clear dates button when dates are set', async () => {
      mockSearchParams.set('startDate', '2024-01-01');
      mockSearchParams.set('endDate', '2024-12-31');

      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Clear dates/i)).toBeInTheDocument();
      });
    });

    it('should clear date params when clear button is clicked', async () => {
      mockSearchParams.set('startDate', '2024-01-01');
      mockSearchParams.set('endDate', '2024-12-31');

      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Clear dates/i)).toBeInTheDocument();
      });

      const clearButton = screen.getByText(/Clear dates/i);
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/earnings', { scroll: false });
      });
    });
  });

  describe('Combined filters', () => {
    it('should handle search and date filters together', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by ID/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by ID/i);
      const startDateInput = screen.getByLabelText(/From/i);

      fireEvent.change(searchInput, { target: { value: 'YouTube' } });
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1][0];
        expect(lastCall).toContain('search=YouTube');
        expect(lastCall).toContain('startDate=2024-01-01');
      });
    });
  });

  describe('Shareable URLs', () => {
    it('should load page with all filters from shared URL', async () => {
      mockSearchParams.set('search', 'TikTok');
      mockSearchParams.set('startDate', '2024-02-01');
      mockSearchParams.set('endDate', '2024-02-28');

      render(<EarningsPage />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by ID/i) as HTMLInputElement;
        const startDateInput = screen.getByLabelText(/From/i) as HTMLInputElement;
        const endDateInput = screen.getByLabelText(/To/i) as HTMLInputElement;

        expect(searchInput.value).toBe('TikTok');
        expect(startDateInput.value).toBe('2024-02-01');
        expect(endDateInput.value).toBe('2024-02-28');
      });
    });
  });

  describe('Browser navigation compatibility', () => {
    it('should use router.push for filter changes', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by ID/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by ID/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.any(String),
          { scroll: false }
        );
      });
    });
  });

  describe('Transaction filtering', () => {
    it('should filter transactions by search term', async () => {
      mockSearchParams.set('search', 'YouTube');

      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByText(/YouTube Revenue/i)).toBeInTheDocument();
        expect(screen.queryByText(/TikTok Revenue/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Instagram Revenue/i)).not.toBeInTheDocument();
      });
    });

    it('should filter transactions by date range', async () => {
      mockSearchParams.set('startDate', '2024-02-01');
      mockSearchParams.set('endDate', '2024-02-28');

      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.queryByText(/YouTube Revenue/i)).not.toBeInTheDocument(); // Jan
        expect(screen.getByText(/TikTok Revenue/i)).toBeInTheDocument(); // Feb
        expect(screen.queryByText(/Instagram Revenue/i)).not.toBeInTheDocument(); // Mar
      });
    });

    it('should show transaction count', async () => {
      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByText(/3 of 3 transactions/i)).toBeInTheDocument();
      });
    });

    it('should update transaction count when filtered', async () => {
      mockSearchParams.set('search', 'YouTube');

      render(<EarningsPage />);

      await waitFor(() => {
        expect(screen.getByText(/1 of 3 transactions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filter state persistence across navigation', () => {
    it('should maintain filters when returning from export', async () => {
      mockSearchParams.set('search', 'YouTube');
      mockSearchParams.set('startDate', '2024-01-01');

      render(<EarningsPage />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by ID/i) as HTMLInputElement;
        expect(searchInput.value).toBe('YouTube');
      });

      // Filters remain in URL, so they persist across navigation
    });
  });
});
