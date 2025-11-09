export interface PostTestQuestion {
  id: string;
  text: string;
  type: 'likert' | 'multiple-choice';
  options: string[];
  category?: 'trust' | 'engagement' | 'satisfaction' | 'knowledge';
}

export const postTestQuestions: PostTestQuestion[] = [
  // Trust questions
  {
    id: "trust-1",
    text: "I trust the AI system to provide accurate tax information",
    type: 'likert',
    category: 'trust',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "trust-2",
    text: "I would rely on this AI system for making important tax decisions",
    type: 'likert',
    category: 'trust',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "trust-3",
    text: "The AI system's explanations were credible and trustworthy",
    type: 'likert',
    category: 'trust',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  
  // Engagement questions
  {
    id: "engagement-1",
    text: "The learning experience kept me engaged throughout",
    type: 'likert',
    category: 'engagement',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "engagement-2",
    text: "I felt motivated to complete all the scenarios",
    type: 'likert',
    category: 'engagement',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "engagement-3",
    text: "The interactive format was more engaging than traditional reading",
    type: 'likert',
    category: 'engagement',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  
  // Satisfaction questions
  {
    id: "satisfaction-1",
    text: "Overall, I am satisfied with this learning experience",
    type: 'likert',
    category: 'satisfaction',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "satisfaction-2",
    text: "I would recommend this learning format to other students",
    type: 'likert',
    category: 'satisfaction',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "satisfaction-3",
    text: "The learning mode I used was effective for understanding tax concepts",
    type: 'likert',
    category: 'satisfaction',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  
  // Knowledge check questions (from original pre-test)
  {
    id: "knowledge-1",
    text: "What is a Minijob in Germany?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "A job requiring minimal qualifications",
      "A part-time position earning up to €538/month tax-free",
      "Any student job under 10 hours per week",
      "A job that lasts less than 3 months"
    ]
  },
  {
    id: "knowledge-2",
    text: "What is the Grundfreibetrag (basic tax allowance) in 2024?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "€9,984",
      "€10,908",
      "€11,604",
      "€12,000"
    ]
  },
  {
    id: "knowledge-3",
    text: "As a student, when should you file a Steuererklärung (tax return)?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "Only if you earned over €50,000",
      "Never—students are exempt",
      "Always mandatory by July 31",
      "Voluntary, but beneficial if taxes were withheld from your income"
    ]
  },
  {
    id: "knowledge-4",
    text: "Can you deduct your laptop purchase as a student?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "No, personal electronics aren't deductible",
      "Yes, but only 50% of the cost",
      "Yes, fully deductible as study equipment (depreciated over 3 years if over €800)",
      "Only if you're studying computer science"
    ]
  },
  {
    id: "knowledge-5",
    text: "What is ELSTER?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "A German tax consulting company",
      "The official government portal for electronic tax filing",
      "A type of tax deduction for students",
      "A Munich-specific tax form"
    ]
  }
];
