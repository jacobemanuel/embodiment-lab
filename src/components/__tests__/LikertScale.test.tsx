import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LikertScale } from '../LikertScale';

// Mock useIsMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

describe('LikertScale', () => {
  const defaultProps = {
    id: 'test-likert',
    value: '',
    onChange: vi.fn(),
  };

  it('renders all 5 default options', () => {
    const { getByText } = render(<LikertScale {...defaultProps} />);
    
    expect(getByText('Strongly disagree')).toBeInTheDocument();
    expect(getByText('Disagree')).toBeInTheDocument();
    expect(getByText('Neutral')).toBeInTheDocument();
    expect(getByText('Agree')).toBeInTheDocument();
    expect(getByText('Strongly agree')).toBeInTheDocument();
  });

  it('renders custom labels when provided', () => {
    const customLabels = ['Bad', 'Poor', 'OK', 'Good', 'Excellent'];
    const { getByText } = render(<LikertScale {...defaultProps} labels={customLabels} />);
    
    customLabels.forEach(label => {
      expect(getByText(label)).toBeInTheDocument();
    });
  });

  it('calls onChange with correct value when option clicked', () => {
    const onChange = vi.fn();
    const { getByText } = render(<LikertScale {...defaultProps} onChange={onChange} />);
    
    const agreeButton = getByText('Agree').closest('button');
    agreeButton?.click();
    
    expect(onChange).toHaveBeenCalledWith('4');
  });

  it('displays selected state correctly', () => {
    const { getByText } = render(<LikertScale {...defaultProps} value="3" />);
    
    const neutralButton = getByText('Neutral').closest('button');
    expect(neutralButton).toHaveClass('border-primary');
  });

  it('renders all 5 numeric labels (1-5)', () => {
    const { getByText } = render(<LikertScale {...defaultProps} />);
    
    for (let i = 1; i <= 5; i++) {
      expect(getByText(String(i))).toBeInTheDocument();
    }
  });

  it('handles multiple clicks correctly', () => {
    const onChange = vi.fn();
    const { getByText } = render(<LikertScale {...defaultProps} onChange={onChange} />);
    
    getByText('Strongly disagree').closest('button')?.click();
    getByText('Strongly agree').closest('button')?.click();
    
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, '1');
    expect(onChange).toHaveBeenNthCalledWith(2, '5');
  });
});
