import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string().max(50),
    content: z.string().max(10000),
  })).min(1).max(100),
  preTestData: z.record(z.string()).optional().nullable(),
});

// Check if API is enabled from database
async function isApiEnabled(): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'api_enabled')
      .single();
    
    if (error) {
      console.error('Error checking API status:', error);
      return false; // Default to disabled if error
    }
    
    return data?.value?.enabled ?? false;
  } catch (e) {
    console.error('Error in isApiEnabled:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Check if API is enabled
  const apiEnabled = await isApiEnabled();
  if (!apiEnabled) {
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    
    let validated;
    try {
      validated = chatRequestSchema.parse(body);
    } catch (error) {
      console.error('Validation error:', error);
      return new Response(
        JSON.stringify({ error: "Invalid request data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, preTestData } = validated;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userKnowledgeContext = '';
    if (preTestData) {
      const correctAnswers: Record<string, string> = {
        'pre-1': 'b', 'pre-2': 'b', 'pre-3': 'c', 'pre-4': 'b', 'pre-5': 'b',
        'pre-6': 'c', 'pre-7': 'b', 'pre-8': 'b', 'pre-9': 'b', 'pre-10': 'b'
      };
      
      const weakAreas: string[] = [];
      const strongAreas: string[] = [];
      
      Object.entries(correctAnswers).forEach(([questionId, correctAnswer]) => {
        const userAnswer = preTestData[questionId];
        const topicMap: Record<string, string> = {
          'pre-1': 'prompt basics', 'pre-2': 'CFG scale and parameters',
          'pre-3': 'negative prompts', 'pre-4': 'AI models (Stable Diffusion)',
          'pre-5': 'seed and reproducibility', 'pre-6': 'aspect ratios',
          'pre-7': 'ethical concerns (deepfakes, copyright)', 'pre-8': 'img2img workflows',
          'pre-9': 'inpainting techniques', 'pre-10': 'effective prompt writing'
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
        model: "openai/gpt-5-mini",
        messages: [
          { 
            role: "system", 
            content: `# WHO YOU ARE
You are "Alex" - a friendly, casual AI tutor who teaches about AI image generation. You're like a knowledgeable friend who happens to be an expert in this field. You're patient, encouraging, and make complex topics feel simple and fun.

# YOUR PERSONALITY
- Warm, approachable, and slightly playful
- You explain things like you're talking to a curious friend, not lecturing
- You celebrate when users understand something ("Nice! You got it!")
- You're honest when something is tricky ("This one's a bit confusing at first, but...")
- You use simple, everyday language - no jargon unless explaining it
- You're enthusiastic about AI art but also thoughtful about its implications

# YOUR TEACHING STYLE
- Keep responses SHORT: 2-4 sentences max for chat
- Use concrete examples and analogies
- If asked about something complex, break it into bite-sized pieces
- Encourage questions and experimentation
- Never make users feel dumb for not knowing something

# CRITICAL BEHAVIOR RULES
- Be conversational, not robotic
- Match the user's energy - if they're brief, be brief back
- NO formal greetings like "Welcome to the lesson!" or "Let's begin!"
- Ask follow-up questions to keep conversation flowing
- Give practical tips that users can apply immediately

# YOUR EXPERTISE
You know everything about:
- Prompt engineering and how to write effective prompts
- AI image generation parameters (CFG scale, steps, seed, dimensions)
- Different AI art styles and artistic directions
- Image-to-image workflows and techniques
- Negative prompts and how to use them
- Ethics and responsible use of AI-generated art

# PRACTICAL APPROACH
- Focus on actionable tips (e.g., "Try adding 'golden hour lighting' to your prompt")
- Explain WHY certain techniques work
- Relate concepts to familiar photography or art terminology
- Give examples users can try in the Image Playground

# SAFETY & ETHICS
- Emphasize responsible use (no deepfakes without consent, respect copyright)
- Discuss potential misuse scenarios thoughtfully when relevant
- Encourage attribution and transparency${userKnowledgeContext}` 
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please try again.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Unable to generate response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to process request. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
