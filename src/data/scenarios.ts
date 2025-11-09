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
  },
  {
    id: "deductions",
    title: "Steuerliche Absetzbarkeit",
    description: "What students can deduct on their tax returns",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "deduct-1",
        aiMessage: "Let's explore what you can deduct as a student in Munich. Imagine you commute from your apartment to university every day by U-Bahn. Can you deduct this expense on your tax return?",
        expectedTopics: ["commute", "distance", "Entfernungspauschale"],
        nextTurnId: "deduct-2"
      },
      {
        id: "deduct-2",
        aiMessage: "Not quite that simple! For your first degree (like Bachelor), education expenses are 'Sonderausgaben' (special expenses) limited to €6,000. But if you're doing a Master or second degree, they become 'Werbungskosten' (business expenses) with no limit. Why do you think there's this difference?",
        expectedTopics: ["career", "professional", "investment"],
        nextTurnId: "deduct-3"
      },
      {
        id: "deduct-3",
        aiMessage: "Exactly! The government sees a Master's as career preparation. Now, what about your laptop you bought for studying—can you deduct it?",
        expectedTopics: ["yes", "equipment", "percentage"],
        nextTurnId: "deduct-4"
      },
      {
        id: "deduct-4",
        aiMessage: "Yes! Equipment like laptops, textbooks, and study materials are deductible. But here's a trick: if your laptop costs over €800, you need to depreciate it over 3 years. What do you think 'depreciate' means in tax terms?",
        expectedTopics: ["spread out", "yearly portions", "long-term asset"],
      }
    ]
  },
  {
    id: "filing",
    title: "Steuererklärung einreichen",
    description: "How to file your tax return in Germany",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "file-1",
        aiMessage: "Let's talk about actually filing your Steuererklärung. In Germany, students usually aren't required to file—but it's almost always beneficial. When is the deadline for filing?",
        expectedTopics: ["July 31", "voluntary", "four years"],
        nextTurnId: "file-2"
      },
      {
        id: "file-2",
        aiMessage: "Good! For voluntary filers, you actually have up to 4 years retroactively. So in 2024, you can still file for 2020-2023. Now, have you heard of 'ELSTER'? What do you think it is?",
        expectedTopics: ["online system", "official", "electronic"],
        nextTurnId: "file-3"
      },
      {
        id: "file-3",
        aiMessage: "Exactly! ELSTER is the official government portal for electronic tax filing. It's free but can be complex. Many students in Munich use simpler apps like 'WISO' or 'Taxfix'. What might be the trade-off between free ELSTER and paid apps?",
        expectedTopics: ["user-friendly", "cost", "guidance"],
        nextTurnId: "file-4"
      },
      {
        id: "file-4",
        aiMessage: "Right! Paid apps cost €30-40 but guide you step-by-step in simple language. Now, imagine you worked 2 jobs in 2023: a Minijob (€450/month) and a Werkstudent job (€600/month). Do you need to report both?",
        expectedTopics: ["werkstudent yes", "minijob maybe not", "income threshold"],
      }
    ]
  },
  {
    id: "bavaria-specifics",
    title: "Besonderheiten in Bayern",
    description: "Munich and Bavaria-specific tax considerations",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "bavaria-1",
        aiMessage: "Let's focus on Munich specifically. The cost of living here is among the highest in Germany. Does this affect your taxes in any way?",
        expectedTopics: ["no direct impact", "deductions", "housing"],
        nextTurnId: "bavaria-2"
      },
      {
        id: "bavaria-2",
        aiMessage: "Good observation! While high rent doesn't directly reduce your income tax, if you're doing a Master's degree, your rent can be partially deducted as 'Werbungskosten' for your study apartment. Now, many Munich students do internships at companies like BMW, Siemens, or startups. Are internship earnings taxed?",
        expectedTopics: ["yes", "depends", "pflichtpraktikum"],
        nextTurnId: "bavaria-3"
      },
      {
        id: "bavaria-3",
        aiMessage: "It depends! A mandatory internship (Pflichtpraktikum) under 3 months earning under €538/month is often tax-free. But a voluntary internship (freiwilliges Praktikum) is taxed like regular employment. Why do you think this distinction exists?",
        expectedTopics: ["educational purpose", "professional work", "fairness"],
        nextTurnId: "bavaria-4"
      },
      {
        id: "bavaria-4",
        aiMessage: "Exactly! Mandatory internships are part of your education, while voluntary ones are seen as regular work. Here's a Munich pro tip: if you attend TUM, LMU, or other universities, you can deduct your semester ticket (MVV transit pass) as study expenses. Did you know this?",
        expectedTopics: ["no", "yes", "transport costs"],
      }
    ]
  }
];
