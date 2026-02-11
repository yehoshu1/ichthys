# Redis Implementation Notes for Production

## Current Rate Limiting Implementation

The current rate limiting implementation in `src/dashboard/middleware.ts` uses in-memory storage which is suitable for single-instance deployments but has limitations in production:

1. **Memory Exhaustion**: In-memory storage can grow without bounds
2. **Instance Isolation**: Rate limits are not shared across multiple instances
3. **Restart Loss**: All rate limit data is lost on application restart

## Recommended Production Implementation

For production deployments, implement Redis-backed rate limiting:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimitRedis(identifier: string, windowMs: number, maxRequests: number): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`;
  const windowStart = Date.now();
  const windowEnd = windowStart + windowMs;
  
  // Use Redis transactions to atomically increment and set expiration
  const result = await redis.multi()
    .incr(key)
    .expire(key, Math.ceil(windowMs / 1000)) // Convert to seconds
    .ttl(key)
    .exec();
  
  const currentCount = result[0][1];
  
  if (currentCount > maxRequests) {
    // Calculate remaining time in the window
    const ttl = result[2][1]; // TTL in seconds
    return {
      allowed: false,
      retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / 1000)
    };
  }
  
  return { allowed: true };
}
```

## Implementation Steps

1. Add Redis dependency: `npm install ioredis @types/ioredis`
2. Update environment configuration to include Redis URL
3. Create a Redis service wrapper
4. Replace in-memory rate limiting with Redis implementation
5. Add fallback mechanism for when Redis is unavailable
6. Update Docker configuration to include Redis container

## Additional Considerations

- Connection pooling and error handling
- Graceful degradation when Redis is unavailable
- Monitoring and alerting for rate limiting
- Different rate limits for different API endpoints
- Whitelisting for trusted IPs/services