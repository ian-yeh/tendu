import { Scraper, BrowserPool, StaticStrategy, DynamicStrategy } from '../index.js';
import type { ScrapingConfig, ScrapingRule } from '../types/index.js';

/**
 * Example: Basic Usage
 * Demonstrates the core features of the scraping layer
 */

async function main() {
  // Initialize browser pool with 2 concurrent browsers
  const pool = new BrowserPool({
    maxBrowsers: 2,
    maxPagesPerBrowser: 5,
  });

  // Create scraper with rate limiting
  const scraper = new Scraper(pool, {
    maxRequests: 5,
    windowMs: 60000,
    delayMs: 500,
  });

  try {
    // Example 1: Simple scrape with default extraction
    console.log('=== Example 1: Simple Scrape ===');
    const simpleResult = await scraper.scrape({
      url: 'https://example.com',
      timeout: 30000,
      retries: 3,
    });
    console.log('Success:', simpleResult.success);
    console.log('Title:', simpleResult.pageTitle);
    console.log('Duration:', simpleResult.duration, 'ms');

    // Example 2: Rule-based extraction
    console.log('\n=== Example 2: Rule-Based Extraction ===');
    const rules: ScrapingRule[] = [
      {
        selector: 'h1',
        type: 'css',
        transform: 'trim',
      },
      {
        selector: 'a[href]',
        type: 'css',
        multiple: true,
        attribute: 'href',
      },
      {
        selector: 'p',
        type: 'css',
        multiple: true,
        transform: 'trim',
      },
    ];

    const ruleResult = await scraper.scrapeWithRules(
      { url: 'https://example.com' },
      rules
    );
    console.log('Extracted:', ruleResult.data);

    // Example 3: Static strategy (for SSR sites)
    console.log('\n=== Example 3: Static Strategy ===');
    const staticConfig: ScrapingConfig = {
      url: 'https://example.com',
      timeout: 15000, // Shorter timeout for static
    };

    const staticStrategy = new StaticStrategy(staticConfig, [
      { selector: 'title', type: 'css' },
      { selector: 'meta[name="description"]', type: 'css', attribute: 'content' },
    ]);

    const staticResult = await scraper.scrape(staticConfig, async (page) => {
      return staticStrategy.execute(page);
    });
    console.log('Static data:', staticResult.data);

    // Example 4: Dynamic strategy (for SPAs)
    console.log('\n=== Example 4: Dynamic Strategy ===');
    const dynamicResult = await scraper.scrape(
      { url: 'https://spa.example.com' },
      async (page) => {
        const strategy = new DynamicStrategy(
          { url: 'https://spa.example.com' },
          {
            waitFor: [{ type: 'selector' as const, value: '[data-loaded="true"]' }],
            actions: [
              { type: 'click' as const, selector: '#expand-content' },
              { type: 'wait' as const, duration: 500 },
            ],
            scrollToBottom: true,
            scrollIterations: 3,
          }
        );
        return strategy.execute(page);
      }
    );
    console.log('Dynamic data:', dynamicResult.data);

    // Example 5: Batch scraping
    console.log('\n=== Example 5: Batch Scraping ===');
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3',
    ];

    const batchConfigs = urls.map((url) => ({
      url,
      timeout: 20000,
      retries: 2,
    }));

    const batchResults = await scraper.scrapeMany(
      batchConfigs,
      async (page) => page.title(),
      3 // concurrency
    );

    batchResults.forEach((result, idx) => {
      console.log(`[${idx}] ${result.url}: ${result.success ? '✓' : '✗'} ${result.data || result.error}`);
    });

    // Example 6: With proxy
    console.log('\n=== Example 6: Proxy Configuration ===');
    const proxyResult = await scraper.scrape({
      url: 'https://example.com',
      proxy: {
        server: 'http://proxy.example.com:8080',
        username: 'user',
        password: 'pass',
      },
      userAgent: 'Mozilla/5.0 (compatible; Bot/1.0)',
    });
    console.log('Proxied result:', proxyResult.success);

    // Example 7: Custom extraction function
    console.log('\n=== Example 7: Custom Extraction ===');
    const customResult = await scraper.scrape(
      { url: 'https://example.com' },
      async (page) => {
        // Extract specific data using page.evaluate
        return page.evaluate(() => {
          const products: Array<{ name: string; price: number }> = [];

          document.querySelectorAll('.product').forEach((el) => {
            const nameEl = el.querySelector('.product-name');
            const priceEl = el.querySelector('.product-price');

            if (nameEl && priceEl) {
              products.push({
                name: nameEl.textContent?.trim() ?? '',
                price: parseFloat(priceEl.textContent?.replace(/[^0-9.]/g, '') ?? '0'),
              });
            }
          });

          return products;
        });
      }
    );
    console.log('Products:', customResult.data);

    // Get pool statistics
    console.log('\n=== Pool Statistics ===');
    console.log(scraper['browserPool'].getStats());

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always cleanup
    await scraper.dispose();
    console.log('\nScraper disposed');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
