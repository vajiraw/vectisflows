import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionPoolService } from '../connection-pool.service';
import { DEFAULT_CONNECTION_POOL_CONFIG } from '../constants';
import { describe, test, expect,beforeEach,it } from '@jest/globals'; 


describe('ConnectionPoolService', () => {
  let service: ConnectionPoolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConnectionPoolService],
    }).compile();

    service = module.get<ConnectionPoolService>(ConnectionPoolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with default config', () => {
    expect(service).toBeDefined();
    const stats = service.getStatistics();
    expect(stats).toBeDefined();
  });

  describe('acquireConnection', () => {
    it('should acquire a connection', async () => {
      const statsBefore = service.getStatistics();
      await service.acquireConnection();
      const statsAfter = service.getStatistics();

      expect(statsAfter.activeConnections).toBeGreaterThan(
        statsBefore.activeConnections,
      );
    });

    it('should increment active connections', async () => {
      const initialStats = service.getStatistics();
      const initialActive = initialStats.activeConnections;

      await service.acquireConnection();
      await service.acquireConnection();

      const finalStats = service.getStatistics();
      expect(finalStats.activeConnections).toBe(initialActive + 2);
    });
  });

  describe('releaseConnection', () => {
    it('should release a connection', async () => {
      await service.acquireConnection();
      const statsBefore = service.getStatistics();
      service.releaseConnection();
      const statsAfter = service.getStatistics();

      expect(statsAfter.activeConnections).toBeLessThan(
        statsBefore.activeConnections,
      );
      expect(statsAfter.idleConnections).toBeGreaterThan(
        statsBefore.idleConnections,
      );
    });
  });

  describe('getStatistics', () => {
    it('should return pool statistics', async () => {
      await service.acquireConnection();
      const stats = service.getStatistics();

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('waitingRequests');
      expect(stats).toHaveProperty('averageWaitTime');
    });

    it('should calculate total connections correctly', async () => {
      await service.acquireConnection();
      await service.acquireConnection();
      const stats = service.getStatistics();

      expect(stats.totalConnections).toBe(stats.activeConnections + stats.idleConnections);
    });
  });

  describe('validatePoolHealth', () => {
    it('should validate pool health', async () => {
      const health = await service.validatePoolHealth();
      expect(typeof health).toBe('boolean');
    });

    it('should return true when pool is healthy', async () => {
      const health = await service.validatePoolHealth();
      expect(health).toBe(true);
    });
  });

  describe('resetStatistics', () => {
    it('should reset statistics', async () => {
      await service.acquireConnection();
      const statsBefore = service.getStatistics();
      expect(statsBefore.averageWaitTime).toBeGreaterThanOrEqual(0);

      service.resetStatistics();
      const statsAfter = service.getStatistics();
      expect(statsAfter.averageWaitTime).toBe(0);
    });
  });

  describe('drain', () => {
    it('should drain all connections', async () => {
      await service.acquireConnection();
      await service.acquireConnection();

      await service.drain();
      const stats = service.getStatistics();

      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
    });
  });

  describe('getUptime', () => {
    it('should return uptime in milliseconds', () => {
      const uptime = service.getUptime();
      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
