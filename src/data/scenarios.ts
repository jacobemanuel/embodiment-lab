import { Scenario } from "@/types/study";

export const scenarios: Scenario[] = [
  {
    id: "tax-basics",
    title: "Grundlagen des Steuersystems",
    description: "Understanding the German tax system basics for students",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "tax-1",
        aiMessage: "Willkommen! Let's talk about taxes in Germany. As a student in Munich, you might have a part-time job. Have you heard the terms 'Minijob' or 'Werkstudent'? What do you think is the main difference between them?",
        expectedTopics: ["income limits", "tax", "insurance"],
        nextTurnId: "tax-2"
      },
      {
        id: "tax-2",
        aiMessage: "Exactly! A Minijob allows you to earn up to €538 per month tax-free, while a Werkstudent position can earn more but has different tax rules. Why do you think the government created these special categories for students?",
        expectedTopics: ["education support", "flexibility", "social benefits"],
        nextTurnId: "tax-3"
      },
      {
        id: "tax-3",
        aiMessage: "Right! It helps students focus on education while earning money. Now, imagine you work 15 hours per week earning €600/month. Which category would you fall into, and what does this mean for your taxes?",
        expectedTopics: ["werkstudent", "tax deduction", "annual income"],
        nextTurnId: "tax-4"
      },
      {
        id: "tax-4",
        aiMessage: "Good thinking! As a Werkstudent, you'll have taxes deducted from your paycheck. But here's the interesting part: many students in Germany get money back when they file their tax return. Why do you think that happens?",
        expectedTopics: ["tax allowance", "Grundfreibetrag", "overpayment"],
      }
    ]
  }
];
