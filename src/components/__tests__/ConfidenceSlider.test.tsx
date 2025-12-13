import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ConfidenceSlider } from '../ConfidenceSlider';

describe('ConfidenceSlider', () => {
  const defaultProps = {
    label: 'Rate your confidence',
    onValueChange: vi.fn(),
  };

  it('renders with label', () => {
    const { getByText } = render(<ConfidenceSlider {...defaultProps} />);
    
    expect(getByText('Rate your confidence')).toBeInTheDocument();
  });

  it('displays default value of 5', () => {
    const { getByText } = render(<ConfidenceSlider {...defaultProps} />);
    
    expect(getByText('5')).toBeInTheDocument();
  });

  it('displays custom default value', () => {
    const { getByText } = render(<ConfidenceSlider {...defaultProps} defaultValue={8} />);
    
    expect(getByText('8')).toBeInTheDocument();
  });

  it('renders min/max labels', () => {
    const { getByText } = render(<ConfidenceSlider {...defaultProps} />);
    
    expect(getByText('Not confident')).toBeInTheDocument();
    expect(getByText('Very confident')).toBeInTheDocument();
  });

  it('renders slider element', () => {
    const { getByRole } = render(<ConfidenceSlider {...defaultProps} />);
    
    expect(getByRole('slider')).toBeInTheDocument();
  });

  it('slider has correct min/max attributes', () => {
    const { getByRole } = render(<ConfidenceSlider {...defaultProps} />);
    
    const slider = getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '10');
  });
});
