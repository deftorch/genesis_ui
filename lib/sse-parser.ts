export interface UsageMetadata {
  candidatesTokenCount?: number;
  promptTokenCount?: number;
  totalTokenCount?: number;
}

export const parseSSEStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (textChunk: string) => void,
  onDone?: (finalUsageMetadata: UsageMetadata | null) => void,
  onEvent?: (eventData: any) => void
) => {
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';
  let finalUsageMetadata: UsageMetadata | null = null;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Simpan sisa string yang belum selesai

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // --- VERCEL AI SDK DATA STREAM PROTOCOL PARSING ---
        
        // 0: Text chunk
        if (trimmedLine.startsWith('0:')) {
          try {
            const textChunk = JSON.parse(trimmedLine.slice(2));
            onChunk(textChunk);
          } catch (e) {}
        } 
        
        // d: Finish message (includes usage metadata)
        else if (trimmedLine.startsWith('d:')) {
          try {
            const finishData = JSON.parse(trimmedLine.slice(2));
            if (finishData.usage) {
              finalUsageMetadata = {
                promptTokenCount: finishData.usage.promptTokens,
                candidatesTokenCount: finishData.usage.completionTokens,
                totalTokenCount: (finishData.usage.promptTokens || 0) + (finishData.usage.completionTokens || 0)
              };
            }
          } catch (e) {}
        }

        // 3: Error message
        else if (trimmedLine.startsWith('3:')) {
           try {
             const errorMsg = JSON.parse(trimmedLine.slice(2));
             if (onEvent) onEvent({ type: 'error', error: errorMsg });
           } catch (e) {}
        }
        
        // 9: Tool call
        else if (trimmedLine.startsWith('9:')) {
           try {
             const toolCallData = JSON.parse(trimmedLine.slice(2));
             // Mengirim event debug ke UI saat tool dipanggil
             if (onEvent) onEvent({ type: 'debug', message: `🛠️ Agen Memanggil Tool: ${toolCallData.toolName}` });
           } catch (e) {}
        }
        
        // a: Tool result
        else if (trimmedLine.startsWith('a:')) {
           try {
             if (onEvent) onEvent({ type: 'debug', message: `✅ Eksekusi Tool Selesai.` });
           } catch (e) {}
        }
        
        // 2: Data messages (custom events / tool data)
        else if (trimmedLine.startsWith('2:')) {
           try {
             const dataArray = JSON.parse(trimmedLine.slice(2));
             if (Array.isArray(dataArray) && onEvent) {
                dataArray.forEach(event => onEvent(event));
             }
           } catch (e) {}
        }

        // --- LEGACY SSE PARSING (Fallback untuk kompatibilitas ke belakang) ---
        else if (trimmedLine.startsWith('data:')) {
          const dataStr = trimmedLine.slice(5).trim();
          if (dataStr === '[DONE]' || !dataStr) continue;
          try {
            const eventData = JSON.parse(dataStr);
            if (onEvent) onEvent(eventData);

            if (eventData.type === 'chunk' && typeof eventData.text === 'string') {
              onChunk(eventData.text);
            } else if (eventData.type === 'finish' && eventData.usage) {
              finalUsageMetadata = {
                promptTokenCount: eventData.usage.promptTokens,
                candidatesTokenCount: eventData.usage.completionTokens,
                totalTokenCount: eventData.usage.totalTokens
              };
            } else if (eventData.candidates) {
              if (eventData.usageMetadata) finalUsageMetadata = eventData.usageMetadata;
              const parts = eventData.candidates?.[0]?.content?.parts || [];
              let combinedText = '';
              for (const part of parts) {
                if (part.text) combinedText += part.text;
                if (part.executableCode) combinedText += `\n\`\`\`python\n// Executing code...\n${part.executableCode.code}\n\`\`\`\n`;
                if (part.codeExecutionResult) combinedText += `\n\`\`\`\n// Execution result:\n${part.codeExecutionResult.output}\n\`\`\`\n`;
              }
              if (combinedText) onChunk(combinedText);
            } else if (eventData.choices) {
              const textChunk = eventData.choices?.[0]?.delta?.content;
              if (textChunk) onChunk(textChunk);
            }
          } catch (e) {}
        }
      }
    }
  }

  // Final parsing fallback for buffer edge cases
  if (buffer.trim().startsWith('data:')) {
    try {
      const dataStr = buffer.trim().slice(5).trim();
      if (dataStr && dataStr !== '[DONE]') {
        const eventData = JSON.parse(dataStr);
        if (eventData.type === 'chunk' && typeof eventData.text === 'string') {
          onChunk(eventData.text);
        }
      }
    } catch (e) {}
  }

  if (onDone) {
    onDone(finalUsageMetadata);
  }
};
