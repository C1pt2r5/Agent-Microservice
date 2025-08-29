import { Request, Response } from 'express';
import { MockService } from './mock-service-manager';

export class MockRedisService extends MockService {
  private redisData: Map<string, any> = new Map();
  private keyExpiry: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    console.log('Initializing Mock Redis Service...');
    
    // Setup some default data
    this.setupDefaultData();
    
    // Start expiry cleanup
    this.startExpiryCleanup();
    
    console.log('Mock Redis Service initialized');
  }

  async cleanup(): Promise<void> {
    this.redisData.clear();
    this.keyExpiry.clear();
    console.log('Mock Redis Service cleaned up');
  }

  async handleCommand(req: Request, res: Response): Promise<void> {
    try {
      const command = req.params.command.toUpperCase();
      const endpoint = `POST /redis/${command}`;
      const args = req.body.args || [];
      
      let result;
      
      switch (command) {
        case 'SET':
          result = await this.handleSet(args);
          break;
        case 'GET':
          result = await this.handleGet(args);
          break;
        case 'DEL':
          result = await this.handleDel(args);
          break;
        case 'EXISTS':
          result = await this.handleExists(args);
          break;
        case 'EXPIRE':
          result = await this.handleExpire(args);
          break;
        case 'TTL':
          result = await this.handleTTL(args);
          break;
        case 'KEYS':
          result = await this.handleKeys(args);
          break;
        case 'FLUSHALL':
          result = await this.handleFlushAll();
          break;
        case 'HSET':
          result = await this.handleHSet(args);
          break;
        case 'HGET':
          result = await this.handleHGet(args);
          break;
        case 'HGETALL':
          result = await this.handleHGetAll(args);
          break;
        case 'LPUSH':
          result = await this.handleLPush(args);
          break;
        case 'RPOP':
          result = await this.handleRPop(args);
          break;
        case 'LLEN':
          result = await this.handleLLen(args);
          break;
        default:
          result = { error: `Unknown command: ${command}` };
      }
      
      const response = await this.handleRequest(endpoint, result);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleKeys(req: Request, res: Response): Promise<void> {
    try {
      const pattern = req.params.pattern || '*';
      const endpoint = `GET /redis/keys/${pattern}`;
      
      const keys = this.getKeysByPattern(pattern);
      const response = await this.handleRequest(endpoint, keys);
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleGet(req: Request, res: Response): Promise<void> {
    try {
      const key = req.params.key;
      const endpoint = `GET /redis/get/${key}`;
      
      const value = this.getValue(key);
      const response = await this.handleRequest(endpoint, { value });
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async handleSet(req: Request, res: Response): Promise<void> {
    try {
      const { key, value, ttl } = req.body;
      const endpoint = 'POST /redis/set';
      
      this.setValue(key, value, ttl);
      const response = await this.handleRequest(endpoint, { status: 'OK' });
      res.json(response);
      
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Redis command implementations
  private async handleSet(args: string[]): Promise<any> {
    if (args.length < 2) return { error: 'SET requires at least 2 arguments' };
    
    const [key, value, ...options] = args;
    let ttl: number | undefined;
    
    // Parse options (EX, PX, etc.)
    for (let i = 0; i < options.length; i += 2) {
      const option = options[i]?.toUpperCase();
      const optionValue = options[i + 1];
      
      if (option === 'EX' && optionValue) {
        ttl = parseInt(optionValue) * 1000; // Convert to milliseconds
      } else if (option === 'PX' && optionValue) {
        ttl = parseInt(optionValue);
      }
    }
    
    this.setValue(key, value, ttl);
    return 'OK';
  }

  private async handleGet(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'GET requires 1 argument' };
    
    const key = args[0];
    return this.getValue(key);
  }

  private async handleDel(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'DEL requires at least 1 argument' };
    
    let deletedCount = 0;
    for (const key of args) {
      if (this.redisData.has(key)) {
        this.redisData.delete(key);
        this.keyExpiry.delete(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  private async handleExists(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'EXISTS requires at least 1 argument' };
    
    let existsCount = 0;
    for (const key of args) {
      if (this.keyExists(key)) {
        existsCount++;
      }
    }
    
    return existsCount;
  }

  private async handleExpire(args: string[]): Promise<any> {
    if (args.length < 2) return { error: 'EXPIRE requires 2 arguments' };
    
    const [key, seconds] = args;
    const ttl = parseInt(seconds) * 1000; // Convert to milliseconds
    
    if (!this.keyExists(key)) return 0;
    
    this.keyExpiry.set(key, Date.now() + ttl);
    return 1;
  }

  private async handleTTL(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'TTL requires 1 argument' };
    
    const key = args[0];
    
    if (!this.keyExists(key)) return -2;
    
    const expiryTime = this.keyExpiry.get(key);
    if (!expiryTime) return -1; // No expiry set
    
    const ttl = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
    return ttl;
  }

  private async handleKeys(args: string[]): Promise<any> {
    const pattern = args[0] || '*';
    return this.getKeysByPattern(pattern);
  }

  private async handleFlushAll(): Promise<any> {
    this.redisData.clear();
    this.keyExpiry.clear();
    return 'OK';
  }

  // Hash operations
  private async handleHSet(args: string[]): Promise<any> {
    if (args.length < 3) return { error: 'HSET requires at least 3 arguments' };
    
    const [key, field, value] = args;
    
    if (!this.redisData.has(key)) {
      this.redisData.set(key, new Map());
    }
    
    const hash = this.redisData.get(key);
    if (!(hash instanceof Map)) {
      return { error: 'WRONGTYPE Operation against a key holding the wrong kind of value' };
    }
    
    const isNewField = !hash.has(field);
    hash.set(field, value);
    
    return isNewField ? 1 : 0;
  }

  private async handleHGet(args: string[]): Promise<any> {
    if (args.length < 2) return { error: 'HGET requires 2 arguments' };
    
    const [key, field] = args;
    const hash = this.redisData.get(key);
    
    if (!hash || !(hash instanceof Map)) return null;
    
    return hash.get(field) || null;
  }

  private async handleHGetAll(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'HGETALL requires 1 argument' };
    
    const key = args[0];
    const hash = this.redisData.get(key);
    
    if (!hash || !(hash instanceof Map)) return [];
    
    const result: string[] = [];
    for (const [field, value] of hash.entries()) {
      result.push(field, value);
    }
    
    return result;
  }

  // List operations
  private async handleLPush(args: string[]): Promise<any> {
    if (args.length < 2) return { error: 'LPUSH requires at least 2 arguments' };
    
    const [key, ...values] = args;
    
    if (!this.redisData.has(key)) {
      this.redisData.set(key, []);
    }
    
    const list = this.redisData.get(key);
    if (!Array.isArray(list)) {
      return { error: 'WRONGTYPE Operation against a key holding the wrong kind of value' };
    }
    
    list.unshift(...values);
    return list.length;
  }

  private async handleRPop(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'RPOP requires 1 argument' };
    
    const key = args[0];
    const list = this.redisData.get(key);
    
    if (!list || !Array.isArray(list)) return null;
    
    return list.pop() || null;
  }

  private async handleLLen(args: string[]): Promise<any> {
    if (args.length < 1) return { error: 'LLEN requires 1 argument' };
    
    const key = args[0];
    const list = this.redisData.get(key);
    
    if (!list || !Array.isArray(list)) return 0;
    
    return list.length;
  }

  // Helper methods
  private setValue(key: string, value: any, ttl?: number): void {
    this.redisData.set(key, value);
    
    if (ttl) {
      this.keyExpiry.set(key, Date.now() + ttl);
    } else {
      this.keyExpiry.delete(key);
    }
  }

  private getValue(key: string): any {
    if (!this.keyExists(key)) return null;
    return this.redisData.get(key);
  }

  private keyExists(key: string): boolean {
    if (!this.redisData.has(key)) return false;
    
    // Check if key has expired
    const expiryTime = this.keyExpiry.get(key);
    if (expiryTime && Date.now() > expiryTime) {
      this.redisData.delete(key);
      this.keyExpiry.delete(key);
      return false;
    }
    
    return true;
  }

  private getKeysByPattern(pattern: string): string[] {
    const keys: string[] = [];
    
    for (const key of this.redisData.keys()) {
      if (this.keyExists(key) && this.matchesPattern(key, pattern)) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    if (pattern === '*') return true;
    
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  private setupDefaultData(): void {
    // Setup some default Redis data for testing
    this.setValue('test:counter', '0');
    this.setValue('test:string', 'hello world');
    
    // Hash example
    const testHash = new Map();
    testHash.set('name', 'Test User');
    testHash.set('email', 'test@example.com');
    this.redisData.set('test:hash', testHash);
    
    // List example
    this.redisData.set('test:list', ['item1', 'item2', 'item3']);
    
    // Session data
    this.setValue('session:user123', JSON.stringify({
      userId: 'user123',
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    }), 3600000); // 1 hour TTL
  }

  private startExpiryCleanup(): void {
    // Clean up expired keys every 30 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiryTime] of this.keyExpiry.entries()) {
        if (now > expiryTime) {
          this.redisData.delete(key);
          this.keyExpiry.delete(key);
        }
      }
    }, 30000);
  }
}