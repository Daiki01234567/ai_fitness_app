/**
 * Cloud Tasks Service Tests - Extended
 */
jest.mock('@google-cloud/tasks', () => {
  const mockClient = {
    queuePath: jest.fn((p, l, q) => "projects/" + p + "/locations/" + l + "/queues/" + q),
    createTask: jest.fn(() => Promise.resolve([{ name: 'task-123' }])),
    deleteTask: jest.fn(() => Promise.resolve()),
    pauseQueue: jest.fn(() => Promise.resolve()),
    resumeQueue: jest.fn(() => Promise.resolve()),
  };
  return {
    CloudTasksClient: jest.fn(() => mockClient),
    protos: { google: { cloud: { tasks: { v2: { ITask: {}, ICreateTaskRequest: {} } } } } },
  };
});

jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/date', () => ({
  addMinutes: jest.fn((d, m) => { const r = new Date(d); r.setMinutes(r.getMinutes() + m); return r; }),
  getExponentialBackoffDelay: jest.fn((a) => Math.pow(2, a) * 1000),
}));

import { CloudTasksClient } from '@google-cloud/tasks';
import { CloudTasksService, QueueNames, DEFAULT_RETRY_CONFIG } from '../../src/services/cloudTasks';
import { logger } from '../../src/utils/logger';

describe('Cloud Tasks Service', () => {
  let service: CloudTasksService;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCLOUD_PROJECT = 'test-project';
    process.env.FUNCTIONS_BASE_URL = 'https://test.cloudfunctions.net';
    service = new CloudTasksService('test-project', 'asia-northeast1');
    mockClient = (CloudTasksClient as jest.MockedClass<typeof CloudTasksClient>).mock.results[0].value;
  });

  describe('Constructor', () => {
    it('initializes with project ID', () => {
      expect(new CloudTasksService('proj')).toBeDefined();
    });
    it('uses env var', () => {
      process.env.GCLOUD_PROJECT = 'env-proj';
      expect(new CloudTasksService()).toBeDefined();
    });
  });

  describe('createTask', () => {
    it('creates basic task', async () => {
      const name = await service.createTask({ queueName: QueueNames.DEFAULT, url: 'https://test.com', payload: { x: 1 } });
      expect(name).toBe('task-123');
      expect(logger.info).toHaveBeenCalled();
    });

    it('creates scheduled task', async () => {
      const t = new Date('2025-12-01');
      await service.createTask({ queueName: QueueNames.DEFAULT, url: 'https://test.com', payload: {}, scheduleTime: t });
      expect(mockClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.objectContaining({ scheduleTime: { seconds: Math.floor(t.getTime() / 1000) } })
      }));
    });

    it('handles failure', async () => {
      mockClient.createTask.mockRejectedValueOnce(new Error('fail'));
      await expect(service.createTask({ queueName: QueueNames.DEFAULT, url: 'https://test.com', payload: {} })).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createBigQuerySyncTask', () => {
    it('creates BQ sync task', async () => {
      const name = await service.createBigQuerySyncTask('users', 'doc1', { f: 1 }, 0);
      expect(name).toBe('task-123');
      expect(mockClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
        parent: expect.stringContaining('bigquery-sync')
      }));
    });

    it('includes retry count', async () => {
      await service.createBigQuerySyncTask('sessions', 's1', {}, 2);
      expect(mockClient.createTask).toHaveBeenCalled();
    });
  });

  describe('createDataExportTask', () => {
    it('creates export task', async () => {
      const name = await service.createDataExportTask('u1', 'r1');
      expect(name).toBe('task-123');
      expect(mockClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
        parent: expect.stringContaining('data-export')
      }));
    });
  });

  describe('createDataDeletionTask', () => {
    it('creates deletion task', async () => {
      const d = new Date('2025-12-25');
      const name = await service.createDataDeletionTask('u1', 'r1', d);
      expect(name).toBe('task-123');
      expect(mockClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.objectContaining({ scheduleTime: { seconds: Math.floor(d.getTime() / 1000) } })
      }));
    });
  });

  describe('createNotificationTask', () => {
    it('creates notification task', async () => {
      const name = await service.createNotificationTask('u1', 'reminder', { msg: 'hi' });
      expect(name).toBe('task-123');
      expect(mockClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
        parent: expect.stringContaining('notifications')
      }));
    });

    it('creates scheduled notification', async () => {
      const t = new Date('2025-12-01');
      await service.createNotificationTask('u1', 'reminder', {}, t);
      expect(mockClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.objectContaining({ scheduleTime: { seconds: Math.floor(t.getTime() / 1000) } })
      }));
    });
  });

  describe('createRetryTask', () => {
    it('creates retry task', async () => {
      const name = await service.createRetryTask(QueueNames.BIGQUERY_SYNC, 'https://test.com', {}, 1, 5);
      expect(name).toBe('task-123');
    });

    it('returns null when max retries exceeded', async () => {
      const name = await service.createRetryTask(QueueNames.DEFAULT, 'https://test.com', {}, 5, 5);
      expect(name).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Max retries exceeded', expect.objectContaining({ currentRetry: 5 }));
    });
  });

  describe('deleteTask', () => {
    it('deletes task', async () => {
      await service.deleteTask('task-123');
      expect(mockClient.deleteTask).toHaveBeenCalledWith({ name: 'task-123' });
      expect(logger.info).toHaveBeenCalled();
    });

    it('handles delete failure', async () => {
      mockClient.deleteTask.mockRejectedValueOnce(new Error('fail'));
      await expect(service.deleteTask('task-123')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('pauseQueue', () => {
    it('pauses queue', async () => {
      await service.pauseQueue(QueueNames.BIGQUERY_SYNC);
      expect(mockClient.pauseQueue).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('resumes queue', async () => {
      await service.resumeQueue(QueueNames.DATA_EXPORT);
      expect(mockClient.resumeQueue).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('Constants', () => {
    it('has default retry config', () => {
      expect(DEFAULT_RETRY_CONFIG).toEqual({ maxRetries: 5, minBackoffSeconds: 10, maxBackoffSeconds: 3600, maxDoublings: 5 });
    });

    it('has queue names', () => {
      expect(QueueNames.BIGQUERY_SYNC).toBe('bigquery-sync');
      expect(QueueNames.DATA_EXPORT).toBe('data-export');
      expect(QueueNames.DATA_DELETION).toBe('data-deletion');
      expect(QueueNames.NOTIFICATIONS).toBe('notifications');
      expect(QueueNames.DEFAULT).toBe('default');
    });
  });
});
