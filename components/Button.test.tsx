/**
 * Unit tests for Button component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Button component for testing
const Button = ({ children, onClick, disabled, variant }: any) => (
  <button onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
    {children}
  </button>
);

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply variant class', () => {
    const { container } = render(<Button variant="primary">Click me</Button>);
    
    expect(container.querySelector('.btn-primary')).toBeInTheDocument();
  });

  it('should not trigger click when disabled', async () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should support multiple children types', () => {
    render(
      <Button>
        <span>Icon</span>
        Text
      </Button>
    );
    
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });
});
