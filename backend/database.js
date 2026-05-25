upsert(article) {
  const db = getDB();
  const tags = Array.isArray(article.tags) ? article.tags.join(',') : (article.tags || '');
  const stmt = db.prepare(`
    INSERT INTO articles (
      id, title, headline, subheadline, body, summary, description,
      url, source, source_weight, alcaldia, geo_confidence, category,
      urgency, seo_title, tags, social_tweet, social_instagram, social_facebook,
      pub_date, scraped_at, rewritten_at, status, reading_time
    ) VALUES (
      @id, @title, @headline, @subheadline, @body, @summary, @description,
      @url, @source, @source_weight, @alcaldia, @geo_confidence, @category,
      @urgency, @seo_title, @tags, @social_tweet, @social_instagram, @social_facebook,
      @pub_date, @scraped_at, @rewritten_at, @status, @reading_time
    )
    ON CONFLICT(id) DO NOTHING
  `);
  return stmt.run({
    ...article,
    tags,
    source_weight: article.sourceWeight || 5,
    geo_confidence: article.geoConfidence || 0,
    status: article.status || 'pending_rewrite',
  });
},
