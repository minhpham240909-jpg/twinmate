import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionTimer from '../SessionTimer';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

// Mock toast
jest.mock('react-hot-toast', () => {
  const mockToast = jest.fn();
  mockToast.success = jest.fn();
  mockToast.error = jest.fn();
  return { default: mockToast };
});

describe('SessionTimer', () => {
  const mockProps = {
    sessionId: 'test-session-123',
    sessionStatus: 'WAITING',
    startedAt: null,
    durationMinutes: 0,
    isHost: true,
    onSessionUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders timer with initial time', () => {
    render(<SessionTimer {...mockProps} />);

    expect(screen.getByText('Session Timer')).toBeInTheDocument();
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('shows start button for host when session is not active', () => {
    render(<SessionTimer {...mockProps} />);

    const startButton = screen.getByText(/Start/);
    expect(startButton).toBeInTheDocument();
  });

  it('shows pause button for host when session is active', () => {
    render(
      <SessionTimer
        {...mockProps}
        sessionStatus="ACTIVE"
        startedAt={new Date().toISOString()}
      />
    );

    const pauseButton = screen.getByText(/Pause/);
    expect(pauseButton).toBeInTheDocument();
  });

  it('does not show control buttons for non-host users', () => {
    render(<SessionTimer {...mockProps} isHost={false} />);

    expect(screen.queryByText(/Start/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pause/)).not.toBeInTheDocument();
  });

  it('formats time correctly with hours', () => {
    render(
      <SessionTimer
        {...mockProps}
        sessionStatus="ACTIVE"
        startedAt={new Date(Date.now() - 3661000).toISOString()}
        durationMinutes={0}
      />
    );

    // Should show 1:01:01 format
    expect(screen.getByText(/1:01:01/)).toBeInTheDocument();
  });

  it('increments timer every second when active', async () => {
    render(
      <SessionTimer
        {...mockProps}
        sessionStatus="ACTIVE"
        startedAt={new Date().toISOString()}
      />
    );

    expect(screen.getByText('0:00')).toBeInTheDocument();

    // Advance by 1 second
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('0:01')).toBeInTheDocument();
    });

    // Advance by 59 more seconds
    jest.advanceTimersByTime(59000);
    await waitFor(() => {
      expect(screen.getByText('1:00')).toBeInTheDocument();
    });
  });

  it('calls start API when start button is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    render(<SessionTimer {...mockProps} />);

    const startButton = screen.getByText(/Start/);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/study-sessions/test-session-123/start',
        { method: 'POST' }
      );
    });

    expect(mockProps.onSessionUpdate).toHaveBeenCalled();
  });

  it('calls pause API when pause button is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    render(
      <SessionTimer
        {...mockProps}
        sessionStatus="ACTIVE"
        startedAt={new Date().toISOString()}
      />
    );

    const pauseButton = screen.getByText(/Pause/);
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/study-sessions/test-session-123/pause',
        { method: 'POST' }
      );
    });

    expect(mockProps.onSessionUpdate).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<SessionTimer {...mockProps} />);

    const startButton = screen.getByText(/Start/);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Should not crash and onSessionUpdate should not be called
    expect(mockProps.onSessionUpdate).not.toHaveBeenCalled();
  });

  it('disables button while loading', async () => {
    (global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<SessionTimer {...mockProps} />);

    const startButton = screen.getByText(/Start/);
    fireEvent.click(startButton);

    expect(startButton).toBeDisabled();
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('shows correct status message for non-host when active', () => {
    render(
      <SessionTimer
        {...mockProps}
        isHost={false}
        sessionStatus="ACTIVE"
        startedAt={new Date().toISOString()}
      />
    );

    expect(screen.getByText(/Session in progress/)).toBeInTheDocument();
  });

  it('shows correct status message for non-host when paused', () => {
    render(<SessionTimer {...mockProps} isHost={false} sessionStatus="PAUSED" />);

    expect(screen.getByText(/Session paused/)).toBeInTheDocument();
  });

  it('does not show controls when session is completed', () => {
    render(<SessionTimer {...mockProps} sessionStatus="COMPLETED" />);

    expect(screen.queryByText(/Start/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pause/)).not.toBeInTheDocument();
  });
});
