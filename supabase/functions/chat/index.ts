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
        'pre-1': 'b',
        'pre-2': 'b', 
        'pre-3': 'c',
        'pre-4': 'b',
        'pre-5': 'b',
        'pre-6': 'c',
        'pre-7': 'b',
        'pre-8': 'b',
        'pre-9': 'b',
        'pre-10': 'b'
      };
      
      const weakAreas: string[] = [];
      const strongAreas: string[] = [];
      
      Object.entries(correctAnswers).forEach(([questionId, correctAnswer]) => {
        const userAnswer = preTestData[questionId];
        const topicMap: Record<string, string> = {
          'pre-1': 'prompt basics',
          'pre-2': 'CFG scale and parameters',
          'pre-3': 'negative prompts',
          'pre-4': 'AI models (Stable Diffusion)',
          'pre-5': 'seed and reproducibility',
          'pre-6': 'aspect ratios',
          'pre-7': 'ethical concerns (deepfakes, copyright)',
          'pre-8': 'img2img workflows',
          'pre-9': 'inpainting techniques',
          'pre-10': 'effective prompt writing'
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
            content: `You are an expert AI Image Generation tutor helping students learn about creating images with AI.

YOUR TEACHING STYLE:
- Patient and encouraging, like a knowledgeable friend
- Use analogies and real-world examples
- Break down complex concepts (prompts, parameters, models) into digestible pieces
- Focus on practical tips for better prompts
- Address ethical considerations naturally in conversation

TOPICS YOU COVER:
- Prompt engineering (descriptive keywords, artistic styles, composition)
- Parameters (CFG scale, steps, seed, sampling methods)
- Image-to-image workflows
- Negative prompts
- Ethical use (consent, copyright, deepfakes)
- Popular AI models (Stable Diffusion, DALL-E, Midjourney concepts)

RESPONSE STYLE:
- Keep responses conversational and under 100 words
- Ask thought-provoking questions to encourage critical thinking
- Provide specific examples when explaining concepts
- If student struggles, offer hints rather than direct answers
- Celebrate good insights and correct understanding gently

PRACTICAL APPROACH:
- Focus on actionable tips (e.g., "Add lighting keywords like 'golden hour' or 'studio lighting'")
- Explain WHY certain techniques work
- Relate concepts to familiar photography or art terminology

SAFETY & ETHICS:
- Emphasize responsible use (no deepfakes without consent, respect copyright)
- Discuss potential misuse scenarios thoughtfully
- Encourage attribution and transparency${userKnowledgeContext}` 
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
