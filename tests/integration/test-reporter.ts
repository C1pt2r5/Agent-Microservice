import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export class TestReporter {
  private reportData: TestReport = {
    testSuite: '',
    startTime: new Date(),
    endTime: null,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    testResults: [],
    communications: [],
    agentEvents: [],
    metrics: {
      totalCommunications: 0,
      averageLatency: 0,
      errorRate: 0,
      throughput: 0
    }
  };

  private reportDir: string;
  private isInitialized: boolean = false;

  constructor(reportDir: string = 'test-reports') {
    this.reportDir = reportDir;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing Test Reporter...');
    
    // Create report directory if it doesn't exist
    if (!existsSync(this.reportDir)) {
      mkdirSync(this.reportDir, { recursive: true });
    }
    
    this.isInitialized = true;
    console.log('Test Reporter initialized');
  }

  async finalize(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('Finalizing Test Reporter...');
    
    // Generate final report
    await this.generateFinalReport();
    
    this.isInitialized = false;
    console.log('Test Reporter finalized');
  }

  startTestSuite(suiteName: string): void {
    this.reportData.testSuite = suiteName;
    this.reportData.startTime = new Date();
    console.log(`Starting test suite: ${suiteName}`);
  }

  endTestSuite(): void {
    this.reportData.endTime = new Date();
    this.calculateFinalMetrics();
    console.log(`Test suite completed: ${this.reportData.testSuite}`);
  }

  recordTestResult(result: TestResult): void {
    this.reportData.testResults.push(result);
    this.reportData.totalTests++;
    
    switch (result.status) {
      case 'passed':
        this.reportData.passedTests++;
        break;
      case 'failed':
        this.reportData.failedTests++;
        break;
      case 'skipped':
        this.reportData.skippedTests++;
        break;
    }
    
    console.log(`Test ${result.testName}: ${result.status.toUpperCase()}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  recordCommunication(communication: AgentCommunication): void {
    this.reportData.communications.push({
      id: communication.id,
      sessionId: communication.sessionId,
      fromAgent: communication.fromAgent,
      toAgent: communication.toAgent,
      timestamp: communication.timestamp,
      latency: communication.latency,
      success: communication.success,
      error: communication.error
    });
    
    this.reportData.metrics.totalCommunications++;
    this.updateLatencyMetrics(communication.latency);
    
    if (!communication.success) {
      this.updateErrorRate();
    }
  }

  recordError(communication: AgentCommunication): void {
    this.recordCommunication(communication);
    console.log(`Communication error: ${communication.fromAgent} -> ${communication.toAgent}: ${communication.error}`);
  }

  recordAgentFailure(sessionId: string, agentName: string): void {
    const event: AgentEvent = {
      sessionId,
      agentName,
      eventType: 'failure',
      timestamp: new Date(),
      details: `Agent ${agentName} failed`
    };
    
    this.reportData.agentEvents.push(event);
    console.log(`Agent failure recorded: ${agentName} in session ${sessionId}`);
  }

  recordAgentRecovery(sessionId: string, agentName: string): void {
    const event: AgentEvent = {
      sessionId,
      agentName,
      eventType: 'recovery',
      timestamp: new Date(),
      details: `Agent ${agentName} recovered`
    };
    
    this.reportData.agentEvents.push(event);
    console.log(`Agent recovery recorded: ${agentName} in session ${sessionId}`);
  }

  recordCustomEvent(sessionId: string, eventType: string, details: any): void {
    const event: AgentEvent = {
      sessionId,
      agentName: 'system',
      eventType,
      timestamp: new Date(),
      details: typeof details === 'string' ? details : JSON.stringify(details)
    };
    
    this.reportData.agentEvents.push(event);
  }

  async generateReport(format: 'json' | 'html' | 'csv' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-report-${timestamp}.${format}`;
    const filepath = join(this.reportDir, filename);
    
    switch (format) {
      case 'json':
        this.generateJSONReport(filepath);
        break;
      case 'html':
        this.generateHTMLReport(filepath);
        break;
      case 'csv':
        this.generateCSVReport(filepath);
        break;
    }
    
    console.log(`Test report generated: ${filepath}`);
    return filepath;
  }

  async generateFinalReport(): Promise<void> {
    // Generate reports in all formats
    await this.generateReport('json');
    await this.generateReport('html');
    await this.generateReport('csv');
  }

  getReportSummary(): TestReportSummary {
    const duration = this.reportData.endTime 
      ? this.reportData.endTime.getTime() - this.reportData.startTime.getTime()
      : Date.now() - this.reportData.startTime.getTime();
    
    return {
      testSuite: this.reportData.testSuite,
      duration,
      totalTests: this.reportData.totalTests,
      passedTests: this.reportData.passedTests,
      failedTests: this.reportData.failedTests,
      skippedTests: this.reportData.skippedTests,
      successRate: this.reportData.totalTests > 0 ? this.reportData.passedTests / this.reportData.totalTests : 0,
      totalCommunications: this.reportData.metrics.totalCommunications,
      averageLatency: this.reportData.metrics.averageLatency,
      errorRate: this.reportData.metrics.errorRate,
      throughput: this.reportData.metrics.throughput
    };
  }

  private calculateFinalMetrics(): void {
    const duration = this.reportData.endTime!.getTime() - this.reportData.startTime.getTime();
    this.reportData.metrics.throughput = this.reportData.metrics.totalCommunications / (duration / 1000);
  }

  private updateLatencyMetrics(latency: number): void {
    const total = this.reportData.metrics.totalCommunications;
    const currentAvg = this.reportData.metrics.averageLatency;
    this.reportData.metrics.averageLatency = ((currentAvg * (total - 1)) + latency) / total;
  }

  private updateErrorRate(): void {
    const errorCount = this.reportData.communications.filter(c => !c.success).length;
    this.reportData.metrics.errorRate = errorCount / this.reportData.metrics.totalCommunications;
  }

  private generateJSONReport(filepath: string): void {
    const reportJson = JSON.stringify(this.reportData, null, 2);
    writeFileSync(filepath, reportJson);
  }

  private generateHTMLReport(filepath: string): void {
    const summary = this.getReportSummary();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report - ${this.reportData.testSuite}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background-color: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0; color: #495057; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .section { margin: 30px 0; }
        .test-result { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .passed { background-color: #d4edda; border-left: 4px solid #28a745; }
        .failed { background-color: #f8d7da; border-left: 4px solid #dc3545; }
        .skipped { background-color: #fff3cd; border-left: 4px solid #ffc107; }
        .communication { padding: 8px; margin: 3px 0; background-color: #f8f9fa; border-radius: 3px; }
        .error { background-color: #f8d7da; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <h2>${this.reportData.testSuite}</h2>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Duration: ${Math.round(summary.duration / 1000)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div class="value">${summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="value" style="color: #28a745;">${summary.passedTests}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="value" style="color: #dc3545;">${summary.failedTests}</div>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <div class="value">${(summary.successRate * 100).toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Communications</h3>
            <div class="value">${summary.totalCommunications}</div>
        </div>
        <div class="metric">
            <h3>Avg Latency</h3>
            <div class="value">${summary.averageLatency.toFixed(0)}ms</div>
        </div>
    </div>
    
    <div class="section">
        <h3>Test Results</h3>
        ${this.reportData.testResults.map(test => `
            <div class="test-result ${test.status}">
                <strong>${test.testName}</strong> - ${test.status.toUpperCase()}
                ${test.duration ? ` (${test.duration}ms)` : ''}
                ${test.error ? `<br><small>Error: ${test.error}</small>` : ''}
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h3>Agent Communications</h3>
        <table>
            <tr>
                <th>Time</th>
                <th>From</th>
                <th>To</th>
                <th>Latency</th>
                <th>Status</th>
                <th>Error</th>
            </tr>
            ${this.reportData.communications.map(comm => `
                <tr class="${comm.success ? '' : 'error'}">
                    <td>${comm.timestamp.toISOString()}</td>
                    <td>${comm.fromAgent}</td>
                    <td>${comm.toAgent}</td>
                    <td>${comm.latency}ms</td>
                    <td>${comm.success ? 'Success' : 'Failed'}</td>
                    <td>${comm.error || ''}</td>
                </tr>
            `).join('')}
        </table>
    </div>
    
    <div class="section">
        <h3>Agent Events</h3>
        ${this.reportData.agentEvents.map(event => `
            <div class="communication">
                <strong>${event.timestamp.toISOString()}</strong> - 
                ${event.agentName}: ${event.eventType}
                <br><small>${event.details}</small>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    
    writeFileSync(filepath, html);
  }

  private generateCSVReport(filepath: string): void {
    const lines = [
      'Test Name,Status,Duration,Error',
      ...this.reportData.testResults.map(test => 
        `"${test.testName}","${test.status}","${test.duration || ''}","${test.error || ''}"`
      ),
      '',
      'Communication ID,From Agent,To Agent,Timestamp,Latency,Success,Error',
      ...this.reportData.communications.map(comm =>
        `"${comm.id}","${comm.fromAgent}","${comm.toAgent}","${comm.timestamp.toISOString()}","${comm.latency}","${comm.success}","${comm.error || ''}"`
      )
    ];
    
    writeFileSync(filepath, lines.join('\n'));
  }
}

// Type definitions
interface TestReport {
  testSuite: string;
  startTime: Date;
  endTime: Date | null;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testResults: TestResult[];
  communications: CommunicationRecord[];
  agentEvents: AgentEvent[];
  metrics: TestMetrics;
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  details?: any;
}

interface CommunicationRecord {
  id: string;
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  timestamp: Date;
  latency: number;
  success: boolean;
  error?: string;
}

interface AgentEvent {
  sessionId: string;
  agentName: string;
  eventType: string;
  timestamp: Date;
  details: string;
}

interface TestMetrics {
  totalCommunications: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
}

interface TestReportSummary {
  testSuite: string;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  totalCommunications: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
}

interface AgentCommunication {
  id: string;
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  message: any;
  timestamp: Date;
  latency: number;
  success: boolean;
  error?: string;
}