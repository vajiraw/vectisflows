import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to database on module init', async () => {
      const connectSpy = jest.spyOn(service, '$connect');
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();
      connectSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database on module destroy', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect');
      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();
      disconnectSpy.mockRestore();
    });
  });

  describe('getHealthStatus', () => {
    it('should return true when database is healthy', async () => {
      jest.spyOn(service, '$queryRaw').mockResolvedValue([1]);
      const health = await service.getHealthStatus();
      expect(health).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      jest.spyOn(service, '$queryRaw').mockRejectedValue(new Error('Connection failed'));
      const health = await service.getHealthStatus();
      expect(health).toBe(false);
    });
  });

  describe('executeRawQuery', () => {
    it('should execute raw query successfully', async () => {
      const mockResult = [{ id: 1, name: 'test' }];
      jest
        .spyOn(service, '$queryRawUnsafe')
        .mockResolvedValue(mockResult as any);

      const result = await service.executeRawQuery('SELECT * FROM test');
      expect(result).toEqual(mockResult);
    });

    it('should throw error on query failure', async () => {
      jest
        .spyOn(service, '$queryRawUnsafe')
        .mockRejectedValue(new Error('Query failed'));

      await expect(
        service.executeRawQuery('SELECT * FROM invalid_table'),
      ).rejects.toThrow();
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      const mockStats = [
        {
          datname: 'verstack',
          active_connections: 5,
          size_bytes: 1024000,
        },
      ];
      jest.spyOn(service, '$queryRaw').mockResolvedValue(mockStats);

      const stats = await service.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats[0]).toHaveProperty('datname');
      expect(stats[0]).toHaveProperty('active_connections');
    });

    it('should return null on stats retrieval failure', async () => {
      jest
        .spyOn(service, '$queryRaw')
        .mockRejectedValue(new Error('Query failed'));

      const stats = await service.getDatabaseStats();
      expect(stats).toBeNull();
    });
  });
});
