import { Env, getConfig } from './env';
import { FeedItem } from './types';
import { getTopStoryIds, getItems, filterValidItems } from './hn';
import { fetchArticleContent } from './reader';
import { generateSummary } from './llm';
import { upsertItem } from './db';
import { getShanghaiDateISO, getISOTimestamp, extractDomain } from './utils';

export interface IngestResult {
  date: string;
  ingested: number;
  failed: number;
  errors: string[];
}

export async function runIngest(env: Env, limit?: number): Promise<IngestResult> {
  const config = getConfig(env);
  const hnLimit = limit ?? config.hnLimit;
  const date = getShanghaiDateISO();

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

  // Step 3: Process each story
  for (const story of validStories) {
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
      global_score: null,
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

      // Step 3b: Generate summary via LLM
      const summary = await generateSummary(
        story.title || '',
        story.url || '',
        content,
        config.llmApiKey,
        config.llmBaseUrl,
        config.llmModel,
        config.maxOutputTokens,
        config.temperature
      );

      if (summary) {
        feedItem.summary_short = summary.summary_short;
        feedItem.summary_long = summary.summary_long;
        feedItem.global_score = summary.global_score;
        feedItem.tags = JSON.stringify(summary.tags);
      } else {
        // LLM failed
        feedItem.status = 'error';
        feedItem.error_reason = 'LLM generation failed';
        result.failed++;
        result.errors.push(`LLM failed for story ${story.id}`);
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
  }

  console.log(`Ingest complete: ${result.ingested} ingested, ${result.failed} failed`);
  return result;
}
