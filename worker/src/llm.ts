import { LLMSummaryResult } from './types';
import { fetchWithTimeout, extractDomain } from './utils';

const SYSTEM_PROMPT = `你是一个资深信息流编辑和分析员。你的任务是根据给定的文章内容，生成 **简洁的一句话总结** 和 **详细的条目式摘要式总结**，同时按照要求为每篇文章给一个 **0-100 的全局评分**，并生成 **3-6 个相关的标签**。你输出的是标准的 JSON 格式，只包含 \`summary_short\`（一句话总结）、\`summary_long\`（详细摘要式总结）、\`global_score\`、\`tags\` 字段，不输出任何其他文本或符号。

【用户画像】
目标读者是一名软件工程师，专注于以下领域：机器人、具身智能、大模型、AI Agents、AI Coding、系统架构设计和 C/C++。同时也关注全球重大新闻事件以及一切有趣、新奇的内容。请优先推荐高质量、有深度、具有技术洞察力或极具趣味性的内容，在评分时对这些领域相关的优质内容给予更高分数。`;

function buildUserPrompt(title: string, url: string, content: string): string {
  const domain = extractDomain(url) || 'unknown';
  return `请阅读以下文章并生成总结和评分。

【信息】
标题: ${title}
来源: ${domain}
链接: ${url}
正文（可能截断）:
${content}

【输出要求】
1. 一句话总结（\`summary_short\`）：用一句简洁的话总结，突出文章的核心内容，不超过一句话，字数 <= 50 字。
2. 详细摘要式总结（\`summary_long\`）：更详细的条目式摘要，字数 <= 200 字。
3. 全局评分（\`global_score\`）：请给这篇文章打一个 0-100 的分数，越高代表越值得阅读。
4. 生成标签（\`tags\`）：3-6 个与文章主题相关的标签，使用小写英文词，如 \`ai\`, \`security\`, \`tech\`等。

评分规则：
- 90-100：信息密度、独创性强，可操作性强，适合技术工作者。
- 70-89：有一定的价值，有用信息。
- 50-69：一般的资讯、评论。
- 0-49：内容贫乏或不可靠。`;
}

export async function generateSummary(
  title: string,
  url: string,
  content: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  maxTokens: number,
  temperature: number
): Promise<LLMSummaryResult | null> {
  try {
    const apiUrl = `${baseUrl}/chat/completions`;
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(title, url, content) },
          ],
          max_tokens: maxTokens,
          temperature,
          response_format: { type: 'json_object' },
        }),
      },
      60000
    );

    if (!response.ok) {
      console.error(`LLM API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const messageContent = data.choices?.[0]?.message?.content;
    if (!messageContent) {
      return null;
    }

    const parsed = JSON.parse(messageContent) as LLMSummaryResult;

    // Validate the response structure
    if (
      typeof parsed.summary_short !== 'string' ||
      typeof parsed.summary_long !== 'string' ||
      typeof parsed.global_score !== 'number' ||
      !Array.isArray(parsed.tags)
    ) {
      console.error('Invalid LLM response structure');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('LLM generation failed:', error);
    return null;
  }
}
