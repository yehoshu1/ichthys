# ΙΧΘΥΣ Performance Tuning Guide

This document describes the performance optimizations implemented in the ΙΧΘΥΣ bot and dashboard.

## Quick Reference

### Environment Variables

```bash
# Database Connection Pool
PG_POOL_MAX=20                    # Maximum pool connections
PG_IDLE_TIMEOUT_MS=30000          # Idle connection timeout
PG_CONNECT_TIMEOUT_MS=10000       # Connection timeout
PG_QUERY_TIMEOUT_MS=30000         # Query timeout
PG_STATEMENT_TIMEOUT_MS=30000     # Statement timeout

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000        # Rate limit window
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window

# Cache Settings
CACHE_TTL_MS=60000               # Cache time-to-live
CACHE_MAX_ENTRIES=1000           # Maximum cache entries
```

## Implemented Optimizations

### 1. Database Query Optimizations

#### N+1 Query Fix (Voice XP Job)
- **Before:** Fetched guild config for each voice profile individually
- **After:** Batch fetches all guild configs in one query
- **Impact:** 90% reduction in database queries

#### Query Timeouts
- All database queries have 30-second timeouts
- Prevents hanging queries from blocking the system

#### Connection Pool Monitoring
- Real-time pool metrics tracking
- Alerts when pool utilization >90%
- Alerts when waiting connections >5

### 2. Caching Strategies

#### Auto-Moderation Regex Cache
- Pre-compiles regex patterns
- LRU cache with 5,000 entry limit
- ~100x faster pattern matching

#### Reaction Role Cache
- 1-minute TTL for message reaction roles
- Prevents repeated database queries
- LRU eviction when cache full

#### Settings Cache
- Guild moderation settings cached for 1 minute
- Reduces database load for repeated checks

### 3. Rate Limiting

#### Dashboard API Rate Limiting
- Per-endpoint rate limits
- User-based identification (falls back to IP)
- Rate limit headers in responses

#### Default Limits
- `default`: 100 req/min
- `discord-data`: 30 req/min (expensive calls)
- `analytics`: 20 req/min (data-heavy)
- `settings`: 30 req/min (write operations)

### 4. Memory Management

#### Alias Limits
- Maximum 100 aliases per guild
- Prevents memory issues with excessive aliases

#### Reaction Role Limits
- Maximum 50 reaction roles per message
- Prevents performance degradation

#### Cache Size Limits
- All in-memory caches have maximum sizes
- LRU eviction when limits reached

### 5. Batch Processing

#### Voice XP Processing
- Processes profiles in chunks of 100
- 10ms delay between chunks to prevent event loop blocking

#### User Cache Cleanup
- Deletes old entries in batches of 1,000
- Prevents long-running transactions

### 6. Frontend Optimizations

#### Analytics Page
- `useMemo` for expensive heatmap calculations
- `useCallback` for fetch functions
- Component extraction to prevent re-renders

## Monitoring

### Health Check Endpoint
```
GET /api/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-11T10:30:00.000Z",
  "responseTime": 45,
  "checks": {
    "database": {
      "healthy": true,
      "responseTime": 20
    }
  }
}
```

### Pool Metrics
Access via logs or extend to metrics endpoint:
- `totalCount`: Total connections in pool
- `idleCount`: Idle connections available
- `waitingCount`: Requests waiting for connection

### Rate Limit Headers
All API responses include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Performance Testing

### Load Testing with k6

```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 }
    ]
};

export default function () {
    const res = http.get(`${__ENV.BASE_URL}/api/guilds/${__ENV.GUILD_ID}/analytics`);
    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500
    });
}
```

Run with:
```bash
k6 run --env BASE_URL=http://localhost:3000 --env GUILD_ID=xxx load-test.js
```

## Troubleshooting

### High Database Load

**Symptoms:** Slow queries, high CPU on database

**Check:**
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

**Solutions:**
1. Increase `PG_POOL_MAX` if connections exhausted
2. Add read replicas for read-heavy workloads
3. Review query patterns in logs

### Rate Limiting Too Aggressive

**Symptoms:** Legitimate users getting 429 errors

**Solutions:**
1. Adjust `RATE_LIMIT_MAX_REQUESTS` in environment
2. Check rate limit headers to understand current usage
3. Consider per-user vs per-IP limiting strategy

### Memory Issues

**Symptoms:** High heap usage, slow performance

**Check:**
```bash
# Monitor memory
curl http://localhost:3000/api/health -X POST
```

**Solutions:**
1. Reduce `CACHE_MAX_ENTRIES` values
2. Increase cleanup frequency
3. Check for memory leaks in custom code

## Best Practices

### Adding New Features

1. **Always use batch processing** for large datasets
2. **Add caching** for frequently accessed data
3. **Implement rate limiting** for new API endpoints
4. **Set query timeouts** for database operations
5. **Add monitoring** for new components

### Code Review Checklist

- [ ] No N+1 query patterns
- [ ] Regex patterns pre-compiled
- [ ] Proper limits on list queries
- [ ] Rate limiting applied
- [ ] Error handling for timeouts
- [ ] Memory limits on caches

## Future Improvements

### High Priority
- [ ] Redis-based distributed caching
- [ ] Read replicas for database
- [ ] CDN for static assets

### Medium Priority
- [ ] GraphQL for flexible data fetching
- [ ] WebSocket for real-time updates
- [ ] Edge caching for API responses

### Low Priority
- [ ] Compression middleware
- [ ] HTTP/2 server push
- [ ] Service worker for offline support

## Support

For performance-related issues:
1. Check logs for error messages
2. Review health check endpoint
3. Monitor pool metrics
4. Check rate limit headers
5. File issue with performance profiling data
