/**
 * Standardized logger to ensure consistent output formatting across the application
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    console.log(`ℹ️ [${this.context}] ${message}`);
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    console.log(`✅ [${this.context}] ${message}`);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: unknown): void {
    console.error(`❌ [${this.context}] ${message}`);
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error(`  ${error.stack.split('\n').slice(1).join('\n')}`);
      }
    } else if (error) {
      console.error(`  ${error}`);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    console.warn(`⚠️ [${this.context}] ${message}`);
  }

  /**
   * Log a section header
   */
  section(title: string): void {
    console.log(`\n🔹 ${title}`);
    console.log('─'.repeat(title.length + 3));
  }

  /**
   * Log a detail line (intended for use in details sections)
   */
  detail(label: string, value: string): void {
    console.log(`  ${label}: ${value}`);
  }
} 