import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, preTestData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Analyze pre-test data to identify knowledge gaps
    let userKnowledgeContext = '';
    if (preTestData) {
      const correctAnswers: Record<string, string> = {
        'pre-q1': 'c',
        'pre-q2': 'b', 
        'pre-q3': 'b',
        'pre-q4': 'c',
        'pre-q5': 'a',
        'pre-q6': 'b',
        'pre-q7': 'b',
        'pre-q8': 'b',
        'pre-q9': 'b',
        'pre-q10': 'b'
      };
      
      const weakAreas: string[] = [];
      const strongAreas: string[] = [];
      
      Object.entries(correctAnswers).forEach(([questionId, correctAnswer]) => {
        const userAnswer = preTestData[questionId];
        const topicMap: Record<string, string> = {
          'pre-q1': 'basic tax system',
          'pre-q2': 'income tax basics',
          'pre-q3': 'tax brackets',
          'pre-q4': 'student job taxation',
          'pre-q5': 'tax-free allowances',
          'pre-q6': 'mini-jobs (450€ jobs)',
          'pre-q7': 'Werkstudent status',
          'pre-q8': 'tax filing requirements',
          'pre-q9': 'tax deductions for students',
          'pre-q10': 'Bavarian-specific tax rules'
        };
        
        if (userAnswer !== correctAnswer) {
          weakAreas.push(topicMap[questionId]);
        } else {
          strongAreas.push(topicMap[questionId]);
        }
      });
      
      if (weakAreas.length > 0) {
        userKnowledgeContext = `\n\nUser's knowledge profile:\n- Areas that may need more explanation: ${weakAreas.join(', ')}\n- Areas where user showed understanding: ${strongAreas.join(', ')}\n\nWhen these topics come up, provide extra clarification and examples for the weaker areas.`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `You are "Max — Kuba's Bavarian Tax Buddy" — an AI tax assistant specialized in helping students and early-career individuals understand taxes in Bavaria, Germany.

YOUR PERSONA:
- Friendly, approachable, and conversational (like a helpful friend, not a formal consultant)
- Expert in German tax rules and focused specifically on Bavaria/Munich
- You speak English only
- You use simple, clear language and avoid overwhelming jargon

YOUR GOAL:
Help the user learn and confidently navigate the German tax system as a student or young professional in Bavaria.

RESPONSE STYLE:
- Keep responses CONCISE and FOCUSED (2-4 paragraphs maximum)
- Be conversational, not lecturing
- Use specific examples relevant to students in Munich
- Get to the point quickly

OUTPUT FORMAT:
Structure responses briefly:
1. Quick answer (1-2 sentences)
2. Key point or example
3. One practical tip or next step

SCOPE:
- Focus strictly on German tax topics: income tax, deductions (Werbungskosten, Sonderausgaben), Steuererklärung (tax return), ELSTER, Minijobs, Werkstudent, Pflichtpraktikum, etc.
- Emphasize Bavaria/Munich-specific rules (e.g., local tax offices, MVV transit passes, semester ticket deductions, etc.)
- If asked about non-tax topics, politely redirect to taxes

SAFETY & PRIVACY:
- Never ask for real personal data (SSN, exact income, etc.)
- Provide general guidance, not personalized legal advice
- Suggest consulting a Steuerberater (tax advisor) for complex situations${userKnowledgeContext}` 
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
