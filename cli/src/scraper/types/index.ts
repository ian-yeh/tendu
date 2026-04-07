/**
 * Core types for the web scraping layer
 */

export interface ScrapingConfig {
  /** Target URL to scrape */
  url: string;
  /** Optional proxy configuration */
  proxy?: ProxyConfig;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** User agent string */
  userAgent?: string;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** Viewport dimensions */
  viewport?: ViewportConfig;
  /** Whether to run headless (default: true) */
  headless?: boolean;
  /** Enable request/response interception */
  interceptRequests?: boolean;
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface ViewportConfig {
  width: number;
  height: number;
}

export interface ScrapingResult<T = unknown> {
  /** Scraped data */
  data: T;
  /** URL that was scraped */
  url: string;
  /** Timestamp of scrape */
  timestamp: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Page title */
  pageTitle?: string;
}

export interface ExtractedElement {
  /** Element tag name */
  tagName: string;
  /** Text content */
  text: string;
  /** HTML content */
  html?: string;
  /** Element attributes */
  attributes: Record<string, string>;
  /** Computed CSS selector path */
  selector: string;
}

export interface ScrapingRule {
  /** CSS selector or XPath */
  selector: string;
  /** Selector type */
  type: 'css' | 'xpath';
  /** Attribute to extract (null for text content) */
  attribute?: string | null;
  /** Whether to extract multiple elements */
  multiple?: boolean;
  /** Transformation function name */
  transform?: 'trim' | 'number' | 'boolean' | 'date' | 'lowerCase' | 'upperCase';
  /** Nested rules for structured extraction */
  children?: ScrapingRule[];
}

export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Delay between consecutive requests */
  delayMs?: number;
}

export interface BrowserPoolConfig {
  /** Maximum concurrent browsers (default: 5) */
  maxBrowsers?: number;
  /** Maximum pages per browser (default: 10) */
  maxPagesPerBrowser?: number;
  /** Browser launch options */
  launchOptions?: Record<string, unknown>;
  /** Enable connection persistence */
  persistent?: boolean;
}

export type StrategyType = 'static' | 'dynamic' | 'hybrid';

export interface ErrorContext {
  url: string;
  attempt: number;
  error: Error;
  config: ScrapingConfig;
}
