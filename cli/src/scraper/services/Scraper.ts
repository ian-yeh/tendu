import type { Page, Response } from 'playwright';
import { BrowserPool } from './BrowserPool.js';
import type {
  ScrapingConfig,
  ScrapingResult,
  ScrapingRule,
  RateLimitConfig,
  ErrorContext,
  ExtractedElement,
} from '../types/index.js';

/**
 * Main scraping orchestrator with retry logic, rate limiting, and error handling.
 */
export class Scraper {
  private browserPool: BrowserPool;
  private rateLimitConfig?: RateLimitConfig;
  private requestTimes: number[] = [];
  private lastRequestTime = 0;

  constructor(browserPool?: BrowserPool, rateLimitConfig?: RateLimitConfig) {
    this.browserPool = browserPool ?? new BrowserPool();
    this.rateLimitConfig = rateLimitConfig;
  }

  /**
   * Scrape a single URL with configured options
   */
  async scrape<T = unknown>(
    config: ScrapingConfig,
    extractor?: (page: Page) => Promise<T>
  ): Promise<ScrapingResult<T>> {
    const startTime = Date.now();
    const retries = config.retries ?? 3;
    const retryDelay = config.retryDelay ?? 1000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Respect rate limits
        await this.enforceRateLimit();

        const result = await this.executeScrape<T>(config, extractor);
        result.duration = Date.now() - startTime;
        
        return result;
      } catch (error) {
        const errorContext: ErrorContext = {
          url: config.url,
          attempt,
          error: error as Error,
          config,
        };

        if (attempt === retries) {
          return this.createErrorResult<T>(config, startTime, error as Error);
        }

        console.warn(`Scrape attempt ${attempt} failed for ${config.url}: ${(error as Error).message}`);
        await this.delay(retryDelay * attempt); // Exponential backoff
      }
    }

    // Should never reach here
    return this.createErrorResult<T>(config, startTime, new Error('Unknown error'));
  }

  /**
   * Execute the actual scrape
   */
  private async executeScrape<T>(
    config: ScrapingConfig,
    extractor?: (page: Page) => Promise<T>
  ): Promise<ScrapingResult<T>> {
    const { page, release } = await this.browserPool.acquirePage({
      headless: config.headless ?? true,
      proxy: config.proxy,
      viewport: config.viewport,
      userAgent: config.userAgent,
    });

    try {
      // Set default timeout
      page.setDefaultTimeout(config.timeout ?? 30000);
      page.setDefaultNavigationTimeout(config.timeout ?? 30000);

      // Add custom headers
      if (config.headers) {
        await page.setExtraHTTPHeaders(config.headers);
      }

      // Enable request/response interception if needed
      if (config.interceptRequests) {
        await page.route('**/*', (route) => route.continue());
      }

      // Navigate to URL
      const response = await page.goto(config.url, {
        waitUntil: 'networkidle',
        timeout: config.timeout ?? 30000,
      });

      if (!response) {
        throw new Error('No response received from page');
      }

      // Extract data
      let data: T;
      if (extractor) {
        data = await extractor(page);
      } else {
        data = await this.defaultExtractor(page) as unknown as T;
      }

      const pageTitle = await page.title().catch(() => undefined);

      return {
        data,
        url: config.url,
        timestamp: new Date(),
        duration: 0, // Will be set by caller
        success: true,
        statusCode: response.status(),
        pageTitle,
      };
    } finally {
      await release();
    }
  }

  /**
   * Default extractor: gets page metadata and content
   */
  private async defaultExtractor(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
          level: h.tagName,
          text: h.textContent?.trim(),
        })),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent?.trim(),
          href: a.getAttribute('href'),
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
        })),
      };
    });
  }

  /**
   * Extract data using scraping rules
   */
  async scrapeWithRules(
    config: ScrapingConfig,
    rules: ScrapingRule[]
  ): Promise<ScrapingResult<Record<string, unknown>>> {
    return this.scrape(config, async (page) => {
      return this.executeRules(page, rules);
    });
  }

  /**
   * Execute scraping rules on a page
   */
  private async executeRules(
    page: Page,
    rules: ScrapingRule[]
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const rule of rules) {
      const key = `extracted_${rules.indexOf(rule)}`;
      
      if (rule.type === 'css') {
        if (rule.multiple) {
          const elements = await page.locator(rule.selector).all();
          const extracted = await Promise.all(
            elements.map(el => this.extractFromElement(el, rule))
          );
          result[key] = extracted;
        } else {
          const element = page.locator(rule.selector).first();
          result[key] = await this.extractFromElement(element, rule);
        }
      } else if (rule.type === 'xpath') {
        // XPath handling would require additional implementation
        result[key] = null;
      }
    }

    return result;
  }

  /**
   * Extract data from a single element
   */
  private async extractFromElement(
    element: { getAttribute: (name: string) => Promise<string | null>; textContent: () => Promise<string | null> },
    rule: ScrapingRule
  ): Promise<unknown> {
    let value: string | null;

    if (rule.attribute) {
      value = await element.getAttribute(rule.attribute);
    } else {
      value = await element.textContent();
    }

    // Apply transformation
    if (value && rule.transform) {
      switch (rule.transform) {
        case 'trim':
          return value.trim();
        case 'number':
          return parseFloat(value.replace(/[^0-9.-]/g, ''));
        case 'boolean':
          return ['true', '1', 'yes'].includes(value.toLowerCase());
        case 'lowerCase':
          return value.toLowerCase();
        case 'upperCase':
          return value.toUpperCase();
        default:
          return value;
      }
    }

    return value;
  }

  /**
   * Scraping multiple URLs concurrently with controlled concurrency
   */
  async scrapeMany<T = unknown>(
    configs: ScrapingConfig[],
    extractor?: (page: Page) => Promise<T>,
    concurrency = 3
  ): Promise<ScrapingResult<T>[]> {
    const results: ScrapingResult<T>[] = [];
    
    // Process in batches
    for (let i = 0; i < configs.length; i += concurrency) {
      const batch = configs.slice(i, i + concurrency);
      const batchPromises = batch.map(config => this.scrape<T>(config, extractor));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    if (!this.rateLimitConfig) return;

    const { maxRequests, windowMs, delayMs = 0 } = this.rateLimitConfig;
    const now = Date.now();

    // Remove old request times
    this.requestTimes = this.requestTimes.filter(time => now - time < windowMs);

    // Check if within rate limit
    if (this.requestTimes.length >= maxRequests) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = windowMs - (now - oldestRequest);
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }

    // Apply minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (delayMs > 0 && timeSinceLastRequest < delayMs) {
      await this.delay(delayMs - timeSinceLastRequest);
    }

    this.requestTimes.push(Date.now());
    this.lastRequestTime = Date.now();
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an error result
   */
  private createErrorResult<T>(
    config: ScrapingConfig,
    startTime: number,
    error: Error
  ): ScrapingResult<T> {
    return {
      data: null as unknown as T,
      url: config.url,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
    };
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.browserPool.dispose();
  }
}
