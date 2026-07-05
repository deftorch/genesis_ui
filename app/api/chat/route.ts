import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText, CoreMessage, tool } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/gateway';
import { chatRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const ChatRequestSchema = z.object({
  messages: z.array(z.any()).min(1).max(100),
  model: z.string().optional(),
  modelId: z.string().optional(),
  config: z.any().optional(),
  providersConfig: z.any().optional(),
  images: z.array(z.object({
    base64: z.string().optional(),
    mimeType: z.string().optional(),
    url: z.string().url().optional(),
  })).max(10).optional(),
});

export async function POST(req: NextRequest) {
  try {
    chatRateLimiter.check(20, req);
  } catch {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = ChatRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { messages, model, modelId, config, providersConfig, images } = parseResult.data;

    let targetModel = modelId || model || 'gemini-3.5-flash';
    let systemPrompt = config?.systemInstruction || '';
    
    // Extract system messages if they exist in the messages array
    const systemMessageIndex = messages.findIndex((m: any) => m.role === 'system');
    if (systemMessageIndex !== -1) {
      systemPrompt = messages[systemMessageIndex].content;
      messages.splice(systemMessageIndex, 1);
    }

    const userKeys = {
      google: providersConfig?.google?.apiKey,
      openRouter: providersConfig?.openrouter?.apiKey,
      customBaseUrl: providersConfig?.custom?.baseUrl,
      customApiKey: providersConfig?.custom?.apiKey,
    };

    // Format Messages to CoreMessage (Vercel AI SDK Standard)
    const coreMessages: CoreMessage[] = messages.map((msg: any, idx: number) => {
      let role: "user" | "assistant" | "system" | "tool" = msg.role;
      if (role !== "user" && role !== "assistant" && role !== "system" && role !== "tool") {
         role = "user"; 
      }
      const coreMsg: CoreMessage = { role, content: msg.content };

      // Attach images to the LAST user message (Multimodal support)
      if (images && images.length > 0 && idx === messages.length - 1 && msg.role === 'user') {
        const contentParts: any[] = [{ type: 'text', text: msg.content }];
        
        for (const img of images) {
          if (img.base64 && img.mimeType) {
            contentParts.push({
              type: 'image',
              image: `data:${img.mimeType};base64,${img.base64}`,
            });
          } else if (img.url) {
            contentParts.push({
              type: 'image',
              image: new URL(img.url),
            });
          }
        }
        coreMsg.content = contentParts as any;
      }
      return coreMsg;
    });

    // Smart Routing Logic (Basic AI Gateway Override)
    if (targetModel === 'router-basic' || config?.compositeModel?.id === 'router-basic') {
      const lastUserMessage = coreMessages[coreMessages.length - 1]?.content;
      const lastContentStr = typeof lastUserMessage === 'string' ? lastUserMessage : JSON.stringify(lastUserMessage);
      const isCodeTask = /code|python|react|javascript|html|css|bug|error|p5|d3|svg/i.test(lastContentStr);
      targetModel = isCodeTask ? 'openrouter:llama-3.3-70b-specdec' : 'openrouter:gpt-4o';
      logger.info('Smart Router resolved model', { targetModel });
    }

    // Orchestrator-Worker Pattern (Sequential Reviewer Refactored)
    if (targetModel === 'sequential-reviewer' || config?.compositeModel?.id === 'sequential-reviewer') {
      logger.info('Sequential Reviewer (Orchestrator-Worker) running...');
      
      const drafterModel = getLanguageModel('openrouter:llama-3.3-70b-specdec', userKeys);
      const reviewerModel = getLanguageModel('openrouter:claude-3-5-sonnet', userKeys);
      
      // Step 1: Drafter creates a draft (Non-streaming)
      const { text: draftText } = await generateText({
        model: drafterModel,
        messages: coreMessages,
        system: 'You are the Drafter. Write a highly detailed first draft based on the user request. Focus on content completeness.',
      });

      // Step 2: Reviewer refines and streams the final output
      const originalPrompt = coreMessages[coreMessages.length - 1]?.content;
      const promptString = typeof originalPrompt === 'string' ? originalPrompt : JSON.stringify(originalPrompt);
      const reviewerPrompt = `[DRAFTER OUTPUT]\n${draftText}\n\n[ORIGINAL USER REQUEST]\n${promptString}\n\nYou are the final Reviewer. Refine the Drafter's output and produce the final polished response.`;
      
      const stream = streamText({
        model: reviewerModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: reviewerPrompt }],
        temperature: config?.temperature ?? 0.7,
      });

      return stream.toDataStreamResponse();
    }

    // Default flow: Standard Chat with Tool Calling Support
    const languageModel = getLanguageModel(targetModel, userKeys);
    
    // Tools logic
    const availableTools: Record<string, any> = {};
    if (config?.useSearchGrounding) {
       availableTools.googleSearch = tool({
         description: 'Search the web for real-time information.',
         parameters: z.object({ query: z.string() }),
         execute: async ({ query }) => {
           return `Simulated search results for: ${query}`;
         }
       });
    }

    if (config?.useCodeExecution) {
        availableTools.codeExecution = tool({
          description: 'Execute javascript or bash code.',
          parameters: z.object({ code: z.string() }),
          execute: async ({ code }) => {
            // Future Sandbox Implementation
            return `Simulated execution of: ${code}`;
          }
        });
    }

    const result = streamText({
      model: languageModel,
      messages: coreMessages,
      system: systemPrompt,
      temperature: config?.temperature ?? 0.7,
      maxSteps: Object.keys(availableTools).length > 0 ? 5 : 1, // Enable ReAct autonomous loop if tools exist
      tools: Object.keys(availableTools).length > 0 ? availableTools : undefined,
    });

    return result.toDataStreamResponse();

  } catch (error: any) {
    logger.error('Chat API error', { error: error.message, stack: error.stack });
    const isQuota = error.status === 429 || error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('429');
    
    return NextResponse.json(
      {
        error: isQuota
          ? 'Your daily usage limit has been reached. Please come back tomorrow.'
          : (error.message || 'Failed to process chat request'),
        details: error.details || error.message,
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
