import request from 'supertest';
import app from '../src/index.js';
import Community from '../src/models/communityModel.js';
import Circle from '../src/models/circleModel.js';
import User from '../src/models/userModel.js';

describe('Performance & Capacity Constraints', () => {
  let token;
  let communityId;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      display_name: 'Perf User', email: 'perf@test.com', password: 'password123'
    });
    token = res.body.token;

    const community = await Community.create({ name: 'Perf Comm', description: 'desc' });
    communityId = String(community._id);
  });

  it('should prevent circle capacity from exceeding limit', async () => {
    // Create a circle with max capacity (assuming 8)
    const members = [];
    for(let i = 0; i < 8; i++) {
      const u = await User.create({ display_name: `U${i}`, email: `u${i}@test.com`, password: 'pwd' });
      members.push(u._id);
    }
    
    const circle = new Circle({
      community_id: communityId,
      members,
      capacity: 8
    });
    await circle.save();

    // Now adding 9th member manually should fail schema validation
    const u9 = await User.create({ display_name: 'U9', email: 'u9@test.com', password: 'pwd' });
    circle.members.push(u9._id);
    
    let error = null;
    try {
      await circle.save();
    } catch (err) {
      error = err;
    }
    
    expect(error).not.toBeNull();
    expect(error.message).toMatch(/exceeds capacity/i);
  });

  it('should efficiently assign user to new circle if existing is full', async () => {
    // Create full circle
    const members = [];
    for(let i = 0; i < 8; i++) {
      const u = await User.create({ display_name: `U2_${i}`, email: `u2_${i}@test.com`, password: 'pwd' });
      members.push(u._id);
    }
    
    const fullCircle = await Circle.create({
      community_id: communityId,
      members,
      capacity: 8
    });

    const startTime = Date.now();
    const joinRes = await request(app)
      .post(`/api/communities/${communityId}/join`)
      .set('Authorization', `Bearer ${token}`);
    const duration = Date.now() - startTime;

    expect(joinRes.statusCode).toEqual(200);
    // Should be placed in a new circle, not the full one
    expect(joinRes.body.data.circle_id).not.toEqual(String(fullCircle._id));
    // Fast response ensures the aggregation pipeline avoided O(N) looping
    expect(duration).toBeLessThan(500);
  });
});
