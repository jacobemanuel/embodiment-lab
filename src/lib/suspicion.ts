export type SuspicionRule = {
  id: string;
  points: number;
  summary: string;
  reason: string;
  match: (flag: string) => boolean;
};

export const SUSPICION_RULES: SuspicionRule[] = [
  {
    id: 'page_fast',
    points: 30,
    summary: 'Page completed faster than the minimum expected time',
    reason: 'Time on page is below the configured minimum for this section.',
    match: (flag) => flag.startsWith('Page completed in'),
  },
  {
    id: 'fast_answers_ratio',
    points: 25,
    summary: 'More than 50% of answers were too fast',
    reason: 'A high share of answers were below the per-question minimum time.',
    match: (flag) => flag.includes('% of answers were suspiciously fast'),
  },
  {
    id: 'avg_answer_fast',
    points: 20,
    summary: 'Average answer time is far below the minimum',
    reason: 'Mean answer time is below half of the expected per-question time.',
    match: (flag) => flag.startsWith('Average answer time:'),
  },
  {
    id: 'slide_view_fast',
    points: 25,
    summary: 'Average slide view time is too fast to read',
    reason: 'Slides were viewed for less than the minimum reading time on average.',
    match: (flag) => flag.startsWith('Average slide view time:'),
  },
];

export type SuspicionFlagDetails = {
  flag: string;
  points?: number;
  summary?: string;
  reason?: string;
};

export const describeSuspicionFlag = (flag: string): SuspicionFlagDetails => {
  const rule = SUSPICION_RULES.find((r) => r.match(flag));
  if (!rule) {
    return { flag };
  }
  return {
    flag,
    points: rule.points,
    summary: rule.summary,
    reason: rule.reason,
  };
};

export const SUSPICION_SCORE_BANDS = [
  { range: '0-19', label: 'Normal', note: 'Valid data' },
  { range: '20-39', label: 'Low risk', note: 'Minor flags' },
  { range: '40-59', label: 'Medium risk', note: 'Review needed' },
  { range: '60+', label: 'High risk', note: 'Likely invalid' },
];
