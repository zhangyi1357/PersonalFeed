import { useEffect, useState } from 'react';
import { fetchFeedToday, fetchFeedByDate } from './api';
import type { FeedItem, FeedResponse } from './types';
import './App.css';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="score score-unknown">?</span>;
  let cls = 'score-low';
  if (score >= 90) cls = 'score-high';
  else if (score >= 70) cls = 'score-medium';
  else if (score >= 50) cls = 'score-ok';
  return <span className={`score ${cls}`}>{score}</span>;
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="tags">
      {tags.map((tag) => (
        <span key={tag} className="tag">{tag}</span>
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const hnUrl = `https://news.ycombinator.com/item?id=${item.hn_id}`;

  return (
    <div className={`feed-card ${item.status === 'error' ? 'feed-card-error' : ''}`}>
      <div className="feed-header">
        <ScoreBadge score={item.global_score} />
        <h3 className="feed-title">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
          ) : (
            <span>{item.title}</span>
          )}
        </h3>
      </div>

      {item.domain && <div className="feed-domain">{item.domain}</div>}

      {item.summary_short && (
        <p className="feed-summary">{item.summary_short}</p>
      )}

      <TagList tags={item.tags} />

      <div className="feed-meta">
        <span>{item.hn_score} points</span>
        <span>{item.descendants} comments</span>
        <span>by {item.by}</span>
        <a href={hnUrl} target="_blank" rel="noopener noreferrer">HN</a>
        {item.summary_long && (
          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Less' : 'More'}
          </button>
        )}
      </div>

      {expanded && item.summary_long && (
        <div className="feed-detail">
          <p>{item.summary_long}</p>
        </div>
      )}

      {item.status === 'error' && item.error_reason && (
        <div className="feed-error">Error: {item.error_reason}</div>
      )}
    </div>
  );
}

function App() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

  useEffect(() => {
    setLoading(true);
    setError(null);

    const today = formatDate(new Date());
    const fetchFn = selectedDate === today ? fetchFeedToday : () => fetchFeedByDate(selectedDate);

    fetchFn()
      .then(setFeed)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const goToDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatDate(d));
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Daily Feed</h1>
        <div className="date-nav">
          <button onClick={() => goToDate(-1)}>&larr;</button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button onClick={() => goToDate(1)}>&rarr;</button>
        </div>
      </header>

      <main>
        {loading && <div className="loading">Loading...</div>}
        {error && <div className="error">{error}</div>}
        {feed && !loading && (
          <>
            <div className="feed-info">
              {feed.count} articles for {feed.date}
            </div>
            <div className="feed-list">
              {feed.items.map((item) => (
                <FeedCard key={item.hn_id} item={item} />
              ))}
            </div>
            {feed.count === 0 && (
              <div className="empty">No articles for this date</div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
