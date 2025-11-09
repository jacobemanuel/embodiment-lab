export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string;
}

export const preTestQuestions: Question[] = [
  {
    id: "pre-1",
    text: "What is a Minijob in Germany?",
    options: [
      "A job requiring minimal qualifications",
      "A part-time position earning up to €538/month tax-free",
      "Any student job under 10 hours per week",
      "A job that lasts less than 3 months"
    ],
    correctAnswer: "A part-time position earning up to €538/month tax-free"
  },
  {
    id: "pre-2",
    text: "What is the Grundfreibetrag (basic tax allowance) in 2024?",
    options: [
      "€9,984",
      "€10,908",
      "€11,604",
      "€12,000"
    ],
    correctAnswer: "€11,604"
  },
  {
    id: "pre-3",
    text: "As a student, when should you file a Steuererklärung (tax return)?",
    options: [
      "Only if you earned over €50,000",
      "Never—students are exempt",
      "Always mandatory by July 31",
      "Voluntary, but beneficial if taxes were withheld from your income"
    ],
    correctAnswer: "Voluntary, but beneficial if taxes were withheld from your income"
  },
  {
    id: "pre-4",
    text: "What is the difference between 'Sonderausgaben' and 'Werbungskosten'?",
    options: [
      "They are the same thing",
      "Sonderausgaben are for first degrees (limited to €6,000), Werbungskosten are for career-related expenses (unlimited)",
      "Werbungskosten are only for business owners",
      "Sonderausgaben are always better for students"
    ],
    correctAnswer: "Sonderausgaben are for first degrees (limited to €6,000), Werbungskosten are for career-related expenses (unlimited)"
  },
  {
    id: "pre-5",
    text: "Can you deduct your laptop purchase as a student?",
    options: [
      "No, personal electronics aren't deductible",
      "Yes, but only 50% of the cost",
      "Yes, fully deductible as study equipment (depreciated over 3 years if over €800)",
      "Only if you're studying computer science"
    ],
    correctAnswer: "Yes, fully deductible as study equipment (depreciated over 3 years if over €800)"
  },
  {
    id: "pre-6",
    text: "What is ELSTER?",
    options: [
      "A German tax consulting company",
      "The official government portal for electronic tax filing",
      "A type of tax deduction for students",
      "A Munich-specific tax form"
    ],
    correctAnswer: "The official government portal for electronic tax filing"
  },
  {
    id: "pre-7",
    text: "How long do you have to file a voluntary tax return retroactively?",
    options: [
      "1 year",
      "2 years",
      "4 years",
      "10 years"
    ],
    correctAnswer: "4 years"
  },
  {
    id: "pre-8",
    text: "Is a mandatory internship (Pflichtpraktikum) taxed the same as a voluntary internship?",
    options: [
      "Yes, all internships are taxed identically",
      "No—Pflichtpraktikum under 3 months earning under €538/month is often tax-free",
      "Mandatory internships are always completely tax-free",
      "Only international students pay taxes on internships"
    ],
    correctAnswer: "No—Pflichtpraktikum under 3 months earning under €538/month is often tax-free"
  },
  {
    id: "pre-9",
    text: "Can you deduct your Munich semester ticket (MVV transit pass)?",
    options: [
      "No, transportation is never deductible",
      "Only if you live more than 20km from university",
      "Yes, fully deductible as part of your semester contribution",
      "Only for Master's students"
    ],
    correctAnswer: "Yes, fully deductible as part of your semester contribution"
  },
  {
    id: "pre-10",
    text: "What happens if you earn less than the Grundfreibetrag but had taxes withheld?",
    options: [
      "You lose that money permanently",
      "It automatically gets refunded without filing",
      "You can get it refunded by filing a Steuererklärung",
      "You can only use it as credit for next year"
    ],
    correctAnswer: "You can get it refunded by filing a Steuererklärung"
  }
];

export const postTestQuestions: Question[] = [...preTestQuestions];

export const demographicQuestions: Question[] = [
  {
    id: "demo-age",
    text: "What is your age range?",
    options: ["18-24", "25-34", "35-44", "45-54", "55+", "Prefer not to say"]
  },
  {
    id: "demo-education",
    text: "What is your highest level of education?",
    options: [
      "High school or less",
      "Some college",
      "Bachelor's degree",
      "Master's degree",
      "Doctoral degree",
      "Prefer not to say"
    ]
  },
  {
    id: "demo-ai-experience",
    text: "How much experience do you have with AI?",
    options: [
      "None—I'm completely new",
      "A little—I've used AI tools a few times",
      "Moderate—I use AI regularly",
      "Extensive—I work with AI professionally",
      "Prefer not to say"
    ]
  }
];
