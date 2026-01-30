import { LLMSummaryResult } from './types';
import { fetchWithTimeout, extractDomain } from './utils';

const SYSTEM_PROMPT = `你是一个资深信息流编辑和分析员。你的任务是根据给定的文章内容，生成 **简洁的一句话总结**、**详细的摘要总结** 以及 **推荐理由**。

【输出要求】
1. 一句话总结（\`summary_short\`）：用一句极其精炼的话概括核心价值，不超过 50 字。
2. 详细摘要总结（\`summary_long\`）：写一段完整、连贯的话，描述文章的主要内容、核心观点或技术细节。要求语言通顺，不要分点（不要使用 "•" 或数字列表）。总字数控制在 200 字左右。
3. 推荐理由（\`recommend_reason\`）：说明为什么这篇文章值得阅读，它对目标读者（软件工程师）有什么启发或价值。字数控制在 60 字以内。
4. 全局评分（\`global_score\`）：0-100 的整数，代表推荐指数，必须拉开区分度，避免大多数文章都集中在 80-90。
5. 标签（\`tags\`）：3-6 个核心主题标签（小写英文）。

你输出的是标准的 JSON 格式，不包含任何 Markdown 代码块包裹，只包含 \`summary_short\`, \`summary_long\`, \`recommend_reason\`, \`global_score\`, \`tags\` 五个字段。

【评分规则（必须遵守）】
- 评分基于：与用户关注点的相关性、技术深度/可操作性、信息密度与新颖性、可信度（来源/数据/代码/复现）、时效性与影响力。
- 90-100：极强推荐（罕见）；80-89：强推荐；65-79：值得一读；45-64：一般；0-44：不推荐。
- 分布约束：在一批随机的科技文章里，通常只有少数（约 10%-20%）能达到 80+，大多数应落在 45-79；不要默认给高分。
- 如果内容空泛、标题党、营销、无实质细节、无法判断可信度，必须显著降分（<= 60，严重则 < 40）。

【用户画像】
目标读者是一名软件工程师，关注：机器人、具身智能、大模型、AI Agents、AI Coding、系统架构设计。同时也关注全球重大科技新闻和趣闻。`;

function buildUserPrompt(title: string, url: string, content: string): string {
  const domain = extractDomain(url) || 'unknown';
  return `标题: ${title}
来源: ${domain}
链接: ${url}
内容:
${content}

请根据以上内容生成 JSON 摘要。`;
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
): Promise<{ result: LLMSummaryResult | null; error?: string }> {
  try {
    if (!apiKey) {
      return { result: null, error: 'LLM_API_KEY is missing' };
    }
    const apiUrl = `${baseUrl}/chat/completions`;

    // Safety check for content length to avoid context window issues
    // DeepSeek chat context is usually large, but let's be conservative
    const MAX_CONTENT_LENGTH = 16000;
    const safeContent = content.length > MAX_CONTENT_LENGTH
      ? content.slice(0, MAX_CONTENT_LENGTH) + '... [Content Truncated]'
      : content;

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
            { role: 'user', content: buildUserPrompt(title, url, safeContent) },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      },
      60000
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error body');
      console.error(`LLM API error: ${response.status} - ${errorText}`);

      let errorType = `API Error ${response.status}`;
      if (response.status === 429) errorType = 'Rate Limited (429)';
      if (response.status === 400 && errorText.includes('context')) errorType = 'Context Exceeded';

      return { result: null, error: `${errorType}: ${errorText.slice(0, 100)}` };
    }

    const data = await response.json() as any;
    const messageContent = data.choices?.[0]?.message?.content;
    const usage = data.usage;

    if (!messageContent) {
      console.error('LLM response missing content:', JSON.stringify(data));
      return { result: null, error: 'Empty LLM response' };
    }

    // Strip markdown code blocks if present
    let jsonContent = messageContent.trim();
    if (jsonContent.startsWith('```')) {
      // Remove opening ```json or ```
      jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '');
      // Remove closing ```
      jsonContent = jsonContent.replace(/\n?```\s*$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse LLM JSON:', jsonContent);
      return { result: null, error: 'JSON Parse Error' };
    }

    // Validate the response structure
    if (
      typeof parsed.summary_short !== 'string' ||
      typeof parsed.summary_long !== 'string' ||
      typeof parsed.recommend_reason !== 'string' ||
      typeof parsed.global_score !== 'number' ||
      !Array.isArray(parsed.tags)
    ) {
      console.error('Invalid LLM response structure');
      return { result: null, error: 'Invalid Structure' };
    }

    parsed.global_score = Math.max(0, Math.min(100, Math.round(parsed.global_score)));

    return {
      result: {
        ...parsed,
        usage: {
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          total_tokens: usage?.total_tokens || 0,
        },
      }
    };
  } catch (error) {
    console.error('LLM generation failed:', error);
    return { result: null, error: String(error) };
  }
}
