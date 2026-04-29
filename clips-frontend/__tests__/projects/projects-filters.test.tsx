import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import ProjectsPage from '@/app/projects/page';

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

// Mock hooks
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    ToastEl: null,
  }),
}));

jest.mock('@/hooks/useUndoRedo', () => ({
  useUndoRedo: () => ({
    state: [],
    set: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
    canUndo: false,
    canRedo: false,
    clear: jest.fn(),
  }),
}));

describe('Projects Page - Filter Persistence', () => {
  let mockPush: jest.Mock;
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    mockPush = jest.fn();
    mockSearchParams = new URLSearchParams();

    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (usePathname as jest.Mock).mockReturnValue('/projects');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Filter state initialization from URL', () => {
    it('should load default filters when no URL params exist', () => {
      render(<ProjectsPage />);

      // Default filters should be applied
      // All clips with default filters should be visible
      expect(screen.getByText(/Clip #01/i)).toBeInTheDocument();
    });

    it('should initialize filters from URL query parameters', () => {
      mockSearchParams.set('style', 'Minimalist');
      mockSearchParams.set('virality', 'high');
      mockSearchParams.set('vault', 'listed');

      render(<ProjectsPage />);

      // Filters should be applied from URL
      // Only clips matching the filters should be visible
      waitFor(() => {
        expect(screen.queryByText(/Clip #01/i)).not.toBeInTheDocument(); // Bold & Dynamic, pending
        expect(screen.getByText(/Clip #02/i)).toBeInTheDocument(); // Minimalist, listed
      });
    });

    it('should handle multiple virality levels from URL', () => {
      mockSearchParams.set('virality', 'high,medium');

      render(<ProjectsPage />);

      // Should show clips with high or medium virality
      waitFor(() => {
        expect(screen.getByText(/Clip #01/i)).toBeInTheDocument(); // high
        expect(screen.getByText(/Clip #02/i)).toBeInTheDocument(); // medium
        expect(screen.queryByText(/Clip #05/i)).not.toBeInTheDocument(); // low
      });
    });
  });

  describe('Filter updates persist to URL', () => {
    it('should update URL when style filter changes', async () => {
      render(<ProjectsPage />);

      const styleButton = screen.getByText(/All Styles/i);
      fireEvent.click(styleButton);

      // Select a specific style
      const cinematicOption = screen.getByText(/Minimalist/i);
      fireEvent.click(cinematicOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('style=Minimalist'),
          { scroll: false }
        );
      });
    });

    it('should update URL when virality filter changes', async () => {
      render(<ProjectsPage />);

      // Toggle off a virality level
      const mediumButton = screen.getByRole('button', { name: /medium/i });
      fireEvent.click(mediumButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('virality=high%2Clow'),
          { scroll: false }
        );
      });
    });

    it('should update URL when vault filter changes', async () => {
      render(<ProjectsPage />);

      const listedButton = screen.getByText(/Listed/i);
      fireEvent.click(listedButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('vault=listed'),
          { scroll: false }
        );
      });
    });

    it('should update URL with multiple filter changes', async () => {
      render(<ProjectsPage />);

      // Change style
      const styleButton = screen.getByText(/All Styles/i);
      fireEvent.click(styleButton);
      const boldOption = screen.getByText(/Bold & Dynamic/i);
      fireEvent.click(boldOption);

      // Change vault
      const listedButton = screen.getByText(/Listed/i);
      fireEvent.click(listedButton);

      await waitFor(() => {
        const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1][0];
        expect(lastCall).toContain('style=Bold');
        expect(lastCall).toContain('vault=listed');
      });
    });
  });

  describe('Filter reset', () => {
    it('should clear URL params when filters are reset', async () => {
      mockSearchParams.set('style', 'Cinematic');
      mockSearchParams.set('virality', 'high');
      mockSearchParams.set('vault', 'listed');

      render(<ProjectsPage />);

      const resetButton = screen.getByText(/Reset/i);
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects', { scroll: false });
      });
    });
  });

  describe('Shareable URLs', () => {
    it('should create shareable URL with all active filters', () => {
      mockSearchParams.set('style', 'Emoji-Rich');
      mockSearchParams.set('virality', 'high,medium');
      mockSearchParams.set('vault', 'history');

      render(<ProjectsPage />);

      // The page should render with these filters applied
      // Verify the filters are active by checking filtered results
      waitFor(() => {
        expect(screen.queryByText(/Clip #01/i)).not.toBeInTheDocument(); // Bold & Dynamic
        expect(screen.getByText(/Clip #03/i)).toBeInTheDocument(); // Emoji-Rich, high, pending
      });
    });
  });

  describe('Browser navigation compatibility', () => {
    it('should use router.push for filter changes (enables back/forward)', async () => {
      render(<ProjectsPage />);

      const listedButton = screen.getByText(/Listed/i);
      fireEvent.click(listedButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.any(String),
          { scroll: false }
        );
      });

      // Verify scroll: false is set (prevents page jump on filter change)
      expect(mockPush.mock.calls[0][1]).toEqual({ scroll: false });
    });
  });

  describe('Filter state persistence across navigation', () => {
    it('should maintain filter state when returning from detail view', () => {
      // Simulate user applying filters
      mockSearchParams.set('style', 'Minimalist');
      mockSearchParams.set('vault', 'listed');

      render(<ProjectsPage />);

      // Filters should be applied
      waitFor(() => {
        expect(screen.getByText(/Clip #02/i)).toBeInTheDocument();
      });

      // When user navigates back (browser back button), the URL params
      // will still be present, and the hook will re-initialize from them
      // This is tested by the initialization tests above
    });
  });

  describe('Active filter count', () => {
    it('should show correct active filter count', () => {
      mockSearchParams.set('style', 'Cinematic');
      mockSearchParams.set('virality', 'high');

      render(<ProjectsPage />);

      // Should show 2 active filters (style changed, virality reduced)
      waitFor(() => {
        const filterCount = screen.getByText(/2/i);
        expect(filterCount).toBeInTheDocument();
      });
    });

    it('should show 0 active filters with defaults', () => {
      render(<ProjectsPage />);

      // With default filters, count should be 0
      waitFor(() => {
        expect(screen.queryByText(/active filters/i)).not.toBeInTheDocument();
      });
    });
  });
});
