import request from 'supertest';
import app from '../src/index.js';
import Community from '../src/models/communityModel.js';
import Circle from '../src/models/circleModel.js';
import EngagementEvent from '../src/models/engagementEventModel.js';

describe('Community API', () => {
  let token;
  let communityId;

  const userData = {
    display_name: 'Community User',
    email: 'community@example.com',
    password: 'password123'
  };

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(userData);
    token = res.body.token;

    const community = await Community.create({
      name: 'Test Community',
      description: 'A test community',
      category: 'technology'
    });
    communityId = String(community._id);
  });

  it('should auto-assign user to a circle and log events when joining a community', async () => {
    // Join community
    const joinRes = await request(app)
      .post(`/api/communities/${communityId}/join`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(joinRes.statusCode).toEqual(200);
    expect(joinRes.body.success).toBeTruthy();
    expect(joinRes.body.data.circle_id).toBeDefined();

    const circleId = joinRes.body.data.circle_id;

    // Verify Circle model contains user
    const circle = await Circle.findById(circleId);
    expect(circle).not.toBeNull();
    // In our payload the token id matches user id
    expect(circle.members.length).toBeGreaterThan(0);

    // Fetch single community
    const fetchRes = await request(app)
      .get(`/api/communities/${communityId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetchRes.statusCode).toEqual(200);

    // Give asynchronous engagement logging a small window to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify Engagement events (circle_joined & community_viewed)
    const events = await EngagementEvent.find({});
    const eventTypes = events.map(e => e.event_type);
    
    expect(eventTypes).toContain('community_viewed');
    expect(eventTypes).toContain('circle_joined');
  });
});
