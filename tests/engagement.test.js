import request from 'supertest';
import app from '../src/index.js';
import EngagementEvent from '../src/models/engagementEventModel.js';

describe('Engagement API', () => {
  let token;
  let userId;
  let otherUserId;

  const user1 = { display_name: 'User 1', email: 'u1@test.com', password: 'password123' };
  const user2 = { display_name: 'User 2', email: 'u2@test.com', password: 'password123' };

  beforeEach(async () => {
    let res = await request(app).post('/api/auth/register').send(user1);
    token = res.body.token;
    userId = res.body.data.id;

    res = await request(app).post('/api/auth/register').send(user2);
    otherUserId = res.body.data.id;

    // Simulate some events in the database
    await EngagementEvent.create([
      { user_id: userId, event_type: 'session_start' },
      { user_id: userId, event_type: 'community_viewed', createdAt: new Date('2025-01-01') },
      { user_id: otherUserId, event_type: 'message_sent' },
    ]);
  });

  it('should return only events belonging to the authenticated user (IDOR prevention)', async () => {
    const res = await request(app)
      .get('/api/engagement/events')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toEqual(2);
    
    const returnedUserIds = res.body.data.map(e => e.user_id.toString());
    expect(returnedUserIds.every(id => id === userId)).toBeTruthy();
  });

  it('should ignore user_id query parameter and return own events', async () => {
    const res = await request(app)
      .get(`/api/engagement/events?user_id=${otherUserId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    // Should still only be 2 events for user1
    expect(res.body.data.length).toEqual(2);
    const returnedUserIds = res.body.data.map(e => e.user_id.toString());
    expect(returnedUserIds.every(id => id === userId)).toBeTruthy();
  });

  it('should filter events by event_type', async () => {
    const res = await request(app)
      .get(`/api/engagement/events?event_type=community_viewed`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toEqual(1);
    expect(res.body.data[0].event_type).toEqual('community_viewed');
  });

  it('should filter events by date range', async () => {
    const res = await request(app)
      .get(`/api/engagement/events?startDate=2024-12-31&endDate=2025-01-02`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toEqual(1);
    expect(res.body.data[0].event_type).toEqual('community_viewed');
  });
});
