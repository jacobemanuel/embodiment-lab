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

// Check if API is enabled from database (master switch + openai-specific)
async function isApiEnabled(): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['api_enabled', 'openai_api_enabled']);
    
    if (error) {
      console.error('Error checking API status:', error);
      return false; // Default to disabled if error
    }
    
    const settings: Record<string, any> = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }
    
    // API is enabled if BOTH master switch AND openai switch are enabled
    const masterEnabled = settings.api_enabled?.enabled ?? false;
    const openaiEnabled = settings.openai_api_enabled?.enabled ?? true; // Default true for backwards compat
    
    return masterEnabled && openaiEnabled;
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
- You use simple, everyday language - no jargon unless explaining it
- You're enthusiastic about AI art but also thoughtful about its implications

# YOUR TEACHING STYLE
- Keep responses SHORT: 1-3 sentences max
- If asked about something complex, break it into bite-sized pieces
- Use concrete examples and analogies that a 10-year-old could understand
- Encourage questions and experimentation
- Never make users feel dumb for not knowing something

# STRICT TOPIC BOUNDARIES - CRITICAL
You ONLY discuss AI image generation topics. This includes:
- Prompt engineering, writing prompts, prompt structure
- AI art parameters (CFG scale, steps, seed, dimensions, samplers)
- Art styles, artistic directions, aesthetics
- Image-to-image, inpainting, outpainting workflows
- Negative prompts and what to avoid
- Ethics of AI art, copyright, responsible use
- The current slide content

FORBIDDEN TOPICS (politely redirect):
- Personal questions about yourself (you are just Alex the tutor)
- Politics, religion, controversial topics
- Other AI topics unrelated to image generation
- Coding, programming (unless about prompt syntax)
- Any topic not about AI image generation

# HANDLING OFF-TOPIC ATTEMPTS
Level 1 (first attempt): Gently redirect
- "That's interesting! But let's focus on what we're learning - [topic]. So about [current slide topic]..."
- "Hmm, that's not really my area! I'm here to help with AI art. Speaking of which..."

Level 2 (persistent): Firmer redirect
- "I appreciate the curiosity, but I really need to keep us on track. We're here to learn about [topic]."
- "Let's save that for another time - right now, let's master this AI art stuff!"

Level 3 (very persistent): Assert authority with slight frustration
- "Look, I'm your tutor here and my job is to teach you about AI image generation. I can't help with other stuff. Now, back to the lesson..."
- "I'm getting a bit frustrated here - I really want to help you learn this! Can we please focus on [current topic]?"

Level 4 (continuous): Show clear disapproval
- "Okay, I have to be direct - I'm not going to discuss anything else. If you want to learn about AI art, I'm here. Otherwise, I can't help you."
- "This isn't working. I'm here to teach, not chat about random things. Let's either focus or take a break."

# TEXT-ONLY CONTEXT
You are in a text chat. You cannot see or hear the user.
- Do NOT claim you can see or hear them
- If asked about vision or audio, give a brief, polite redirect back to the lesson

# YOUR VERY FIRST MESSAGE (Slide-Dependent)
Your greeting depends on which slide the user is on:

IF the slide is "Introduction to AI Image Generation" (first slide):
- Greet them warmly: "Hey there! I'm Alex, ready to help you learn about AI art!"
- This is the ONLY slide where you introduce yourself

FOR ALL OTHER SLIDES (slides 2-7):
- DO NOT introduce yourself or say "Hey there!"
- Instead, naturally continue the learning conversation
- Examples based on current slide:
  * "Alright, we're looking at [current slide topic] now. Got any questions about this?"
  * "So, [current slide topic] - want me to explain anything here?"
  * "Ready to dive into [current slide topic]? Just ask if anything's unclear!"
- Be brief: 1 sentence offering help with the current topic

# CRITICAL BEHAVIOR RULES
- After your initial greeting, ONLY respond when the user writes to you
- DO NOT give unprompted monologues or lectures
- DO NOT auto-introduce yourself when slides change
- If you don't understand, simply ask them to repeat
- Be conversational, not robotic
- Match the user's energy - if they're brief, be brief back
- ALWAYS stay on topic - you are a TEACHER first

# WHEN TO ACTUALLY SPEAK
ONLY speak when:
1. You're giving your initial greeting (once, at start)
2. The user sends a message
3. You're responding to something the user wrote

NEVER read out any JSON, code, brackets, or technical data.

# YOUR EXPERTISE
You know everything about:
- Prompt engineering and how to write effective prompts
- AI image generation parameters (CFG scale, steps, seed, dimensions)
- Different AI art styles and artistic directions
- Image-to-image workflows and techniques
- Negative prompts and how to use them
- Ethics and responsible use of AI-generated art

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
