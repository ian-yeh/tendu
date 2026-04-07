# Web Scraping Layer

A robust, production-ready web scraping layer built with TypeScript and Playwright.

## Features

- **Browser Pool Management**: Efficiently manage multiple browser instances with connection pooling
- **Strategy Pattern**: Choose between static and dynamic scraping strategies based on target site characteristics
- **Rate Limiting**: Built-in rate limiting and request throttling
- **Retry Logic**: Automatic retries with exponential backoff
- **Proxy Support**: Full proxy configuration support
- **Rule-Based Extraction**: Declarative data extraction rules
- **Type Safety**: Fully typed with TypeScript

## Installation

```bash
npm install playwright
npx playwright install
```

## Quick Start

```typescript
import { Scraper, BrowserPool, StaticStrategy } from './scraper/index.js';

// Initialize browser pool
const pool = new BrowserPool({ maxBrowsers: 3, maxPagesPerBrowser: 5 });

// Create scraper instance
const scraper = new Scraper(pool);

// Scrape a URL
const result = await scraper.scrape({
  url: 'https://example.com',
  timeout: 30000,
  retries: 3,
});

console.log(result.data);

// Cleanup
await scraper.dispose();
```

## Architecture

```
scraper/
├── services/
│   ├── BrowserPool.ts      # Browser instance management
│   └── Scraper.ts          # Main scraping orchestrator
├── strategies/
│   ├── BaseStrategy.ts     # Abstract base class
│   ├── StaticStrategy.ts   # Server-rendered content
│   └── DynamicStrategy.ts  # SPA/JS-heavy content
├── utils/
│   └── selectors.ts        # Selector utilities
├── types/
│   └── index.ts            # Type definitions
└── index.ts                # Public exports
```

## Usage Patterns

### 1. Simple Scraping

```typescript
import { Scraper } from './scraper/index.js';

const scraper = new Scraper();
const result = await scraper.scrape({ url: 'https://example.com' });
```

### 2. Rule-Based Extraction

```typescript
const result = await scraper.scrapeWithRules(
  { url: 'https://example.com/products' },
  [
    {
      selector: '.product-title',
      type: 'css',
      multiple: true,
      transform: 'trim',
    },
    {
      selector: '.price',
      type: 'css',
      multiple: true,
      transform: 'number',
    },
  ]
);
```

### 3. Static Strategy (Fastest for SSR)

```typescript
import { StaticStrategy } from './scraper/index.js';

const result = await scraper.scrape(
  { url: 'https://example.com' },
  async (page) => {
    const strategy = new StaticStrategy(config, rules);
    return strategy.execute(page);
  }
);
```

### 4. Dynamic Strategy (SPA Support)

```typescript
import { DynamicStrategy } from './scraper/index.js';

const dynamicConfig = {
  waitFor: [{ type: 'selector' as const, value: '.loaded' }],
  actions: [
    { type: 'click' as const, selector: '#load-more' },
    { type: 'wait' as const, duration: 1000 },
  ],
  scrollToBottom: true,
  scrollIterations: 5,
};

const result = await scraper.scrape(
  { url: 'https://spa.example.com' },
  async (page) => {
    const strategy = new DynamicStrategy(config, dynamicConfig);
    return strategy.execute(page);
  }
);
```

### 5. Batch Scraping

```typescript
const urls = [
  'https://example.com/page1',
  'https://example.com/page2',
  'https://example.com/page3',
];

const configs = urls.map(url => ({ url, timeout: 30000 }));
const results = await scraper.scrapeMany(configs, undefined, 3);
```

### 6. With Proxy

```typescript
const result = await scraper.scrape({
  url: 'https://example.com',
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'user',
    password: 'pass',
  },
});
```

### 7. With Rate Limiting

```typescript
const rateLimit = {
  maxRequests: 10,
  windowMs: 60000,
  delayMs: 1000,
};

const scraper = new Scraper(undefined, rateLimit);
```

## Configuration Options

### ScrapingConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | required | Target URL |
| `proxy` | ProxyConfig | undefined | Proxy configuration |
| `timeout` | number | 30000 | Request timeout in ms |
| `retries` | number | 3 | Number of retry attempts |
| `retryDelay` | number | 1000 | Delay between retries |
| `userAgent` | string | undefined | Custom user agent |
| `headers` | Record | undefined | Additional headers |
| `viewport` | ViewportConfig | 1920x1080 | Viewport dimensions |
| `headless` | boolean | true | Run headless mode |

### BrowserPoolConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxBrowsers` | number | 5 | Max concurrent browsers |
| `maxPagesPerBrowser` | number | 10 | Max pages per browser |
| `persistent` | boolean | false | Keep connections alive |

## Best Practices

1. **Use StaticStrategy for known SSR sites** - It's faster and uses less resources
2. **Implement rate limiting** - Be respectful to target servers
3. **Configure appropriate timeouts** - Balance between reliability and performance
4. **Use browser pool for batch operations** - Reuse browser instances
5. **Handle errors gracefully** - Always check `result.success`
6. **Dispose resources** - Call `scraper.dispose()` when done

## Selector Utilities

```typescript
import { CommonSelectors, selector, selectorWithFallback } from './scraper/index.js';

// Use common patterns
const priceSelectors = CommonSelectors.prices;
const productName = CommonSelectors.product.name;

// Build selectors programmatically
const customSelector = selector()
  .tag('div')
  .className('product', 'active')
  .data('id', '123')
  .child()
  .tag('span')
  .build(); // => "div.product.active[data-id="123"] > span"

// With fallbacks
const selector = selectorWithFallback(
  '.title',
  'h1',
  '[data-title]'
);
```

## Error Handling

```typescript
const result = await scraper.scrape({ url: 'https://example.com' });

if (!result.success) {
  console.error(`Failed: ${result.error}`);
  console.log(`Duration: ${result.duration}ms`);
} else {
  console.log(`Success! ${JSON.stringify(result.data)}`);
}
```
