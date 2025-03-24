/**
 * SQLite implementation of the Repository interface
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import type { UserContent, AssistantContent, ToolContent } from 'ai';
import sqlite3 from 'sqlite3';

import { Message, Thread, generateId, Content } from '../memory/types';

import { Repository, ListThreadsOptions, ListMessagesOptions } from './repository';

export interface SQLiteRepositoryOptions {
  /**
   * Path to the SQLite database file
   * @default path.join(process.cwd(), 'memory.sqlite')
   */
  dbPath?: string;
}

/**
 * SQLite implementation of the Repository interface
 */
export class SQLiteRepository implements Repository {
  private db: sqlite3.Database;
  private initialized = false;

  constructor(options: SQLiteRepositoryOptions = {}) {
    const dbPath = options.dbPath || path.join(process.cwd(), 'memory.sqlite');

    // Make sure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath);
    // Enable WAL mode
    this.db.exec('PRAGMA journal_mode = WAL;', (err) => {
      if (err) console.error('Error setting journal mode:', err);
    });
  }

  // Helper method to run queries as promises
  private runQuery(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private getRow(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  private getAllRows(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Create threads table
    await this.runQuery(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        resourceId TEXT,
        title TEXT,
        metadata TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      )
    `);

    // Create messages table
    await this.runQuery(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        threadId TEXT NOT NULL,
        role TEXT NOT NULL,
        textContent TEXT NOT NULL,
        contentParts TEXT,
        createdAt INTEGER,
        metadata TEXT,
        FOREIGN KEY (threadId) REFERENCES threads(id)
      )
    `);

    // Create index on threadId for faster message queries
    await this.runQuery(`
      CREATE INDEX IF NOT EXISTS idx_messages_threadId ON messages(threadId)
    `);

    this.initialized = true;
  }

  async createThread(thread: Omit<Thread, 'createdAt' | 'updatedAt'>): Promise<Thread> {
    await this.init();

    const now = new Date();
    const newThread: Thread = {
      ...thread,
      id: thread.id || generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const metadata = newThread.metadata ? JSON.stringify(newThread.metadata) : null;

    await this.runQuery(
      `INSERT INTO threads (id, resourceId, title, metadata, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newThread.id,
        newThread.resourceId || null,
        newThread.title || null,
        metadata,
        newThread.createdAt.getTime(),
        newThread.updatedAt.getTime(),
      ],
    );

    return newThread;
  }

  async getThread(threadId: string): Promise<Thread | null> {
    await this.init();

    const row = await this.getRow('SELECT * FROM threads WHERE id = ?', [threadId]);

    if (!row) return null;

    return this.parseThreadRow(row);
  }

  async updateThread(threadId: string, update: Partial<Thread>): Promise<Thread> {
    await this.init();

    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const updatedThread: Thread = {
      ...thread,
      ...update,
      id: threadId, // Ensure ID doesn't change
      updatedAt: new Date(Date.now()),
    };

    const setStatements = [];
    const params = [];

    if (update.title !== undefined) {
      setStatements.push('title = ?');
      params.push(update.title);
    }

    if (update.resourceId !== undefined) {
      setStatements.push('resourceId = ?');
      params.push(update.resourceId);
    }

    if (update.metadata !== undefined) {
      setStatements.push('metadata = ?');
      params.push(JSON.stringify(update.metadata));
    }

    setStatements.push('updatedAt = ?');
    params.push(updatedThread.updatedAt.getTime());

    // Add the threadId for the WHERE clause
    params.push(threadId);

    await this.runQuery(`UPDATE threads SET ${setStatements.join(', ')} WHERE id = ?`, params);

    return updatedThread;
  }

  async listThreads(options: ListThreadsOptions = {}): Promise<Thread[]> {
    await this.init();

    const { limit = 100, offset = 0, resourceId } = options;

    let query = 'SELECT * FROM threads';
    const params: any[] = [];

    if (resourceId) {
      query += ' WHERE resourceId = ?';
      params.push(resourceId);
    }

    query += ' ORDER BY updatedAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.getAllRows(query, params);

    return rows.map((row) => this.parseThreadRow(row));
  }

  private parseThreadRow(row: any): Thread {
    return {
      id: row.id,
      resourceId: row.resourceId,
      title: row.title,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private serializeContent(content: UserContent | AssistantContent | ToolContent): {
    textContent: string;
    contentParts: string | null;
  } {
    // Handle string content (legacy)
    if (typeof content === 'string') {
      return { textContent: content, contentParts: null };
    }

    // For AI.js Content objects
    let textContent = '';

    if ('text' in content) {
      textContent = content.text as string;
    } else if ('content' in content && typeof content.content === 'string') {
      textContent = content.content;
    }

    // Serialize the full content object for storage
    return {
      textContent,
      contentParts: JSON.stringify(content),
    };
  }

  private deserializeContent(
    textContent: string,
    contentParts: string | null,
  ): UserContent | AssistantContent | ToolContent {
    if (!contentParts) {
      return textContent as string; // Cast to string to fix the type issue
    }

    try {
      return JSON.parse(contentParts);
    } catch (error) {
      console.error('Error parsing content:', error);
      return textContent as string; // Cast to string to fix the type issue
    }
  }

  async createMessage(message: Omit<Message, 'createdAt'>): Promise<Message> {
    await this.init();

    const { textContent, contentParts } = this.serializeContent(message.content);
    // Remove reference to message.metadata if it doesn't exist in the type
    const metadata = message.hasOwnProperty('metadata')
      ? JSON.stringify((message as any).metadata)
      : null;

    const now = new Date();
    const newMessage: Message = {
      ...message,
      id: message.id || generateId(),
      content: message.content,
      createdAt: now,
    };

    await this.runQuery(
      `INSERT INTO messages (id, threadId, role, textContent, contentParts, createdAt, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newMessage.id,
        newMessage.threadId,
        newMessage.role,
        textContent,
        contentParts,
        newMessage.createdAt.getTime(),
        metadata,
      ],
    );

    return newMessage;
  }

  async getMessage(messageId: string): Promise<Message | null> {
    await this.init();

    const row = await this.getRow('SELECT * FROM messages WHERE id = ?', [messageId]);

    if (!row) return null;

    return this.parseMessageRow(row);
  }

  async listMessages(threadId: string, options: ListMessagesOptions = {}): Promise<Message[]> {
    await this.init();

    const { limit = 100, before, after } = options;

    let query = 'SELECT * FROM messages WHERE threadId = ?';
    const params: any[] = [threadId];

    if (before !== undefined) {
      query += ' AND createdAt < ?';
      params.push(before);
    }

    if (after !== undefined) {
      query += ' AND createdAt > ?';
      params.push(after);
    }

    query += ' ORDER BY createdAt ASC LIMIT ?';
    params.push(limit);

    const rows = await this.getAllRows(query, params);

    return rows.map((row) => this.parseMessageRow(row));
  }

  async getLastMessages(threadId: string, limit: number): Promise<Message[]> {
    await this.init();

    const rows = await this.getAllRows(
      'SELECT * FROM messages WHERE threadId = ? ORDER BY createdAt DESC LIMIT ?',
      [threadId, limit],
    );

    // Return in chronological order (oldest first)
    return rows.map((row) => this.parseMessageRow(row)).reverse();
  }

  private parseMessageRow(row: any): Message {
    return {
      id: row.id,
      threadId: row.threadId,
      role: row.role,
      content: this.deserializeContent(row.textContent, row.contentParts),
      createdAt: new Date(row.createdAt),
      // Don't include metadata if it doesn't exist in the type
      ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
    } as Message;
  }
}
