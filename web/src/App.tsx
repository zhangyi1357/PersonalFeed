import { useEffect, useState } from 'react';
import { fetchFeedToday, fetchFeedByDate } from './api';
import type { FeedItem, FeedResponse } from './types';
import './App.css';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="score-badge score-unknown">? 匹配度</span>;
  let cls = 'score-low';
  if (score >= 90) cls = 'score-high';
  else if (score >= 70) cls = 'score-medium';
  else if (score >= 50) cls = 'score-ok';
  return <span className={`score-badge ${cls}`}>{score}% 匹配度</span>;
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || !tags.length) return null;
  return (
    <div className="tags">
      {tags.map((tag) => (
        <span key={tag} className="tag">#{tag}</span>
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const hnUrl = `https://news.ycombinator.com/item?id=${item.hn_id}`;

  return (
    <div className={`feed-card ${item.status === 'error' ? 'feed-card-error' : ''}`}>
      {/* 顶部信息栏 */}
      <div className="card-top">
        <ScoreBadge score={item.global_score} />
        <span className="source">
          <span className="source-dot"></span>
          Hacker News
        </span>
        {item.domain && <span className="domain">{item.domain}</span>}
      </div>

      {/* 标题 */}
      <h2 className="card-title">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
        ) : (
          <span>{item.title}</span>
        )}
      </h2>

      {/* TL;DR 一句话摘要 */}
      {item.summary_short && (
        <div className="tldr">
          <span className="tldr-label">TL;DR</span>
          <span className="tldr-text">{item.summary_short}</span>
        </div>
      )}

      {/* 详细摘要 */}
      {item.summary_long && (
        <div className="summary-long">
          {expanded ? item.summary_long : item.summary_long.slice(0, 150) + (item.summary_long.length > 150 ? '...' : '')}
          {item.summary_long.length > 150 && (
            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      )}

      {/* 标签 */}
      <TagList tags={item.tags} />

      {/* 底部信息 */}
      <div className="card-footer">
        <div className="meta-left">
          <a href={hnUrl} target="_blank" rel="noopener noreferrer" className="hn-link">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            {item.hn_score} points · {item.descendants} comments
          </a>
        </div>
      </div>

      {item.status === 'error' && item.error_reason && (
        <div className="feed-error">处理失败: {item.error_reason}</div>
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
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Daily Feed</h1>
          <p className="subtitle">每日精选技术资讯</p>
        </div>
        <div className="date-nav">
          <button onClick={() => goToDate(-1)} className="nav-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
          <button onClick={() => goToDate(1)} className="nav-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="main">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <span>加载中...</span>
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}
        {feed && !loading && (
          <>
            <div className="feed-info">
              共 <strong>{feed.count}</strong> 篇文章 · {feed.date}
            </div>
            <div className="feed-list">
              {feed.items.map((item) => (
                <FeedCard key={item.hn_id} item={item} />
              ))}
            </div>
            {feed.count === 0 && (
              <div className="empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p>暂无文章</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
