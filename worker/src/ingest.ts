import { Env, getConfig } from './env';
import { FeedItem } from './types';
import { getTopStoryIds, getItems, filterValidItems } from './hn';
import { fetchArticleContent } from './reader';
import { generateSummary } from './llm';
import { getItemProcessingStatesByIds, getScoreCalibrationItems, updateGlobalScore, upsertItem } from './db';
import { getShanghaiDateISO, getISOTimestamp, extractDomain } from './utils';
import { recalibrateGlobalScores, shouldRecalibrateGlobalScores } from './score';

export interface IngestResult {
  date: string;
  ingested: number;
  failed: number;
  errors: string[];
}

export async function runIngest(
  env: Env,
  limit?: number,
  options?: { force?: boolean }
): Promise<IngestResult> {
  const config = getConfig(env);
  const hnLimit = limit ?? config.hnLimit;
  const date = getShanghaiDateISO();
  const force = options?.force === true;

  const result: IngestResult = {
    date,
    ingested: 0,
    failed: 0,
    errors: [],
  };

  console.log(`Starting ingest for date ${date}, limit ${hnLimit}`);

  // Step 1: Get top story IDs
  let storyIds: number[];
  try {
    storyIds = await getTopStoryIds(hnLimit);
    console.log(`Fetched ${storyIds.length} story IDs`);
  } catch (error) {
    result.errors.push(`Failed to fetch story IDs: ${error}`);
    return result;
  }

  // Step 2: Get story details
  const stories = await getItems(storyIds);
  const validStories = filterValidItems(stories);
  console.log(`Got ${validStories.length} valid stories with URLs`);

  const states = await getItemProcessingStatesByIds(
    env.daily_feed_db,
    date,
    validStories.map((s) => s.id)
  );

  const toProcessStories = validStories.filter((story) => {
    if (force) return true;
    const existing = states.get(story.id);
    if (!existing) return true;
    if (
      existing.status === 'ok' &&
      typeof existing.summary_short === 'string' &&
      existing.summary_short.length > 0 &&
      typeof existing.summary_long === 'string' &&
      existing.summary_long.length > 0 &&
      typeof existing.recommend_reason === 'string' &&
      existing.recommend_reason.length > 0 &&
      existing.global_score !== null &&
      !Number.isNaN(Number(existing.global_score))
    ) {
      return false;
    }
    return true;
  });

  if (!force && toProcessStories.length !== validStories.length) {
    console.log(
      `Skipping ${validStories.length - toProcessStories.length} already-processed items for ${date}`
    );
  }

  // Step 3: Process each story in parallel with concurrency limit
  const CONCURRENCY = Math.min(5, toProcessStories.length || 1);
  const chunks = [];
  for (let i = 0; i < toProcessStories.length; i += CONCURRENCY) {
    chunks.push(toProcessStories.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (story) => {
        const now = getISOTimestamp();

        const feedItem: FeedItem = {
          hn_id: story.id,
          date,
          title: story.title || '',
          url: story.url || null,
          domain: story.url ? extractDomain(story.url) : null,
          by: story.by || null,
          hn_score: story.score || null,
          descendants: story.descendants || null,
          hn_time: story.time || null,
          fetched_at: now,
          summary_short: null,
          summary_long: null,
          recommend_reason: null,
          global_score: null,
          usage_prompt_tokens: null,
          usage_completion_tokens: null,
          usage_total_tokens: null,
          tags: null,
          status: 'ok',
          error_reason: null,
          updated_at: now,
        };

        try {
          // Step 3a: Fetch article content
          let content = '';
          if (story.url) {
            const { content: fetched, success } = await fetchArticleContent(
              story.url,
              config.maxArticleChars
            );
            if (success) {
              content = fetched;
            } else {
              // Fallback: use title as content
              content = story.title || '';
              console.log(`Failed to fetch content for ${story.id}, using title as fallback`);
            }
          }

          // Step 3b: Generate summary via LLM with retries and exponential backoff
          let summary = null;
          let lastError = '';
          let retries = 3;
          let delay = 2000;

          while (retries > 0) {
            const { result: llmResult, error: llmError } = await generateSummary(
              story.title || '',
              story.url || '',
              content,
              config.llmApiKey,
              config.llmBaseUrl,
              config.llmModel,
              config.maxOutputTokens,
              config.temperature
            );

            if (llmResult) {
              summary = llmResult;
              break;
            }

            lastError = llmError || 'Unknown LLM Error';
            retries--;

            if (retries > 0) {
              console.log(`Retrying LLM for story ${story.id} (${retries} left) due to: ${lastError}. Waiting ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              delay *= 2; // Exponential backoff
            }
          }

          if (summary) {
            feedItem.summary_short = summary.summary_short;
            feedItem.summary_long = summary.summary_long;
            feedItem.recommend_reason = summary.recommend_reason;
            feedItem.global_score = summary.global_score;
            feedItem.usage_prompt_tokens = summary.usage.prompt_tokens;
            feedItem.usage_completion_tokens = summary.usage.completion_tokens;
            feedItem.usage_total_tokens = summary.usage.total_tokens;
            feedItem.tags = JSON.stringify(summary.tags);
          } else {
            // LLM failed after retries
            feedItem.status = 'error';
            feedItem.error_reason = lastError || 'LLM generation failed after retries';
            result.failed++;
            result.errors.push(`LLM failed for story ${story.id}: ${lastError}`);
          }

          // Step 3c: Save to database
          await upsertItem(env.daily_feed_db, feedItem);

          if (feedItem.status === 'ok') {
            result.ingested++;
          }

          console.log(`Processed story ${story.id}: ${feedItem.status}`);
        } catch (error) {
          feedItem.status = 'error';
          feedItem.error_reason = String(error);
          feedItem.updated_at = getISOTimestamp();

          try {
            await upsertItem(env.daily_feed_db, feedItem);
          } catch (dbError) {
            console.error(`Failed to save error state for ${story.id}:`, dbError);
          }

          result.failed++;
          result.errors.push(`Error processing story ${story.id}: ${error}`);
        }
      })
    );
  }

  try {
    const calibrationItems = await getScoreCalibrationItems(env.daily_feed_db, date);
    if (shouldRecalibrateGlobalScores(calibrationItems)) {
      const mapping = recalibrateGlobalScores(calibrationItems);
      const updatedAt = getISOTimestamp();
      await Promise.all(
        Array.from(mapping.entries()).map(([hnId, score]) =>
          updateGlobalScore(env.daily_feed_db, date, hnId, score, updatedAt)
        )
      );
      console.log(`Recalibrated global_score for ${mapping.size} items on ${date}`);
    }
  } catch (error) {
    console.error(`Failed to recalibrate scores for ${date}:`, error);
  }

  console.log(`Ingest complete: ${result.ingested} ingested, ${result.failed} failed`);
  return result;
}
