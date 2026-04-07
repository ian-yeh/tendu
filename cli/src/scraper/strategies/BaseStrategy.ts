import type { Page } from 'playwright';
import type { ScrapingConfig, ScrapingResult, ScrapingRule } from '../types/index.js';

/**
 * Abstract base class for scraping strategies.
 * Implement specific strategies for different types of websites.
 */
export abstract class BaseStrategy<T = unknown> {
  protected config: ScrapingConfig;

  constructor(config: ScrapingConfig) {
    this.config = config;
  }

  /**
   * Execute the scraping strategy
   */
  abstract execute(page: Page): Promise<T>;

  /**
   * Pre-process the page before extraction
   * Override in subclasses for custom preprocessing
   */
  async preProcess(page: Page): Promise<void> {
    // Default: wait for network idle
    await page.waitForLoadState('networkidle');
  }

  /**
   * Post-process the extracted data
   * Override in subclasses for data cleaning/transforming
   */
  async postProcess(data: T): Promise<T> {
    return data;
  }

  /**
   * Handle page errors
   * Override for custom error recovery
   */
  async handleError(error: Error, page: Page): Promise<T | null> {
    console.error(`Strategy error: ${error.message}`);
    throw error;
  }

  /**
   * Check if the strategy is applicable to the current page
   * Used for strategy selection
   */
  abstract isApplicable(page: Page): Promise<boolean>;

  /**
   * Get strategy name
   */
  abstract getName(): string;

  /**
   * Get strategy description
   */
  abstract getDescription(): string;
}

/**
 * Result wrapper with metadata
 */
export interface StrategyResult<T> {
  strategy: string;
  data: T;
  success: boolean;
  error?: string;
}
