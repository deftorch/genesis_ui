import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { getGeminiApiKeys } from '@/config/constants';
import { logger } from '@/lib/logger';

export interface UserKeys {
  google?: string;
  openRouter?: string;
  customBaseUrl?: string;
  customApiKey?: string;
}

/**
 * Creates a custom fetch function that implements key rotation for Google APIs.
 * It reads the API keys and intercepts requests, injecting a different key if a quota error occurs.
 */
function createKeyRotatingFetch(userKey?: string) {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const apiKeys = getGeminiApiKeys(userKey);
    if (apiKeys.length === 0) {
      throw new Error('Gemini API key not configured');
    }

    let lastErrorText = '';
    let lastStatus = 500;
    
    // Parse the URL to manipulate query params
    const requestUrl = new URL(url.toString());

    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      // Override the key parameter
      requestUrl.searchParams.set('key', currentKey);
      
      logger.debug('Gateway: Gemini request attempt', { keyIndex: i + 1, totalKeys: apiKeys.length });
      
      try {
        const response = await fetch(requestUrl.toString(), init);

        if (response.ok) {
          return response;
        }

        lastStatus = response.status;
        const textResponse = await response.text();
        
        // Check if it's a quota/rate limit error
        const isQuota = lastStatus === 429 ||
                        textResponse.toLowerCase().includes('quota') ||
                        textResponse.toLowerCase().includes('exhausted') ||
                        textResponse.toLowerCase().includes('rate limit') ||
                        textResponse.toLowerCase().includes('limit reached');

        if (!isQuota) {
          // If it's not a quota error, don't rotate, just return the response to let SDK handle it
          return new Response(textResponse, { status: response.status, headers: response.headers });
        }
        
        logger.warn('Gateway: Gemini key exhausted', { keyIndex: i + 1, status: lastStatus });
        lastErrorText = textResponse;
      } catch (fetchError: any) {
        logger.error('Gateway: Gemini fetch error', { keyIndex: i + 1, error: fetchError.message });
        lastErrorText = fetchError.message;
        lastStatus = 500;
      }
    }

    // All keys exhausted
    throw new Error(`All Gemini API keys exhausted. Last error (${lastStatus}): ${lastErrorText}`);
  };
}

/**
 * Deftorch Local AI Gateway
 * Dynamically resolves the requested model ID to the correct AI SDK LanguageModel,
 * injecting BYOK (Bring Your Own Key) credentials and handling failovers automatically.
 */
export function getLanguageModel(modelId: string, userKeys?: UserKeys) {
  // 1. Dynamic Custom Provider (OpenAI Compatible)
  if (userKeys?.customBaseUrl && userKeys?.customApiKey) {
    logger.info('Gateway: Routing to Custom Provider', { modelId, baseUrl: userKeys.customBaseUrl });
    const customProvider = createOpenAI({
      baseURL: userKeys.customBaseUrl,
      apiKey: userKeys.customApiKey,
    });
    return customProvider(modelId);
  }

  // 2. Google Gemini Models
  if (modelId.startsWith('gemini-') || modelId.startsWith('google:')) {
    const rawModelId = modelId.replace('google:', '');
    
    // Map internal aliases to Google model IDs
    const modelMap: Record<string, string> = {
      'gemini-3.5-flash': 'gemini-3-flash-preview',
      'gemini-3.1-pro-preview': 'gemini-1.5-pro',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    };
    
    const targetModelId = modelMap[rawModelId] || rawModelId;
    
    logger.info('Gateway: Routing to Google AI', { targetModelId });
    
    const google = createGoogleGenerativeAI({
      // We pass a dummy key here to satisfy typing, but our custom fetch overrides it
      apiKey: 'dummy-key-overridden-by-fetch', 
      fetch: createKeyRotatingFetch(userKeys?.google)
    });
    
    return google(targetModelId);
  }

  // 3. OpenRouter Models
  const openRouterKey = userKeys?.openRouter || process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error('OpenRouter API Key is not configured for non-Gemini models');
  }

  const rawModelId = modelId.replace('openrouter:', '');
  
  // Map internal aliases to OpenRouter targets
  const orModelMap: Record<string, string> = {
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'o3-mini': 'openai/o3-mini',
    'claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
    'llama-3.3-70b-specdec': 'meta-llama/llama-3.3-70b-instruct',
    'deepseek-chat': 'deepseek/deepseek-chat',
    'deepseek-reasoner': 'deepseek/deepseek-reasoner'
  };

  const targetModelId = orModelMap[rawModelId] || (rawModelId.includes('/') ? rawModelId : `openrouter/${rawModelId}`);
  
  logger.info('Gateway: Routing to OpenRouter', { targetModelId });
  const openrouter = createOpenRouter({
    apiKey: openRouterKey,
  });
  
  return openrouter(targetModelId);
}
