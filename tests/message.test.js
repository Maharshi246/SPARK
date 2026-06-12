import request from 'supertest';
import app from '../src/index.js';
import Community from '../src/models/communityModel.js';
import Circle from '../src/models/circleModel.js';
import Message from '../src/models/messageModel.js';
import EngagementEvent from '../src/models/engagementEventModel.js';

describe('Message API', () => {
  let memberToken;
  let nonMemberToken;
  let circleId;

  const memberData = { display_name: 'Member', email: 'member@test.com', password: 'password123' };
  const nonMemberData = { display_name: 'NonMember', email: 'non@test.com', password: 'password123' };

  beforeEach(async () => {
    // Register member
    let res = await request(app).post('/api/auth/register').send(memberData);
    memberToken = res.body.token;

    // Register non-member
    res = await request(app).post('/api/auth/register').send(nonMemberData);
    nonMemberToken = res.body.token;

    // Create community & auto-join member
    const community = await Community.create({ name: 'Msg Comm', description: 'desc', category: 'technology' });
    
    const joinRes = await request(app)
      .post(`/api/communities/${community._id}/join`)
      .set('Authorization', `Bearer ${memberToken}`);
    
    circleId = joinRes.body.data.circle_id;
  });

  it('should send a message successfully if member', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ circleId, content: 'Hello Circle' });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBeTruthy();
    expect(res.body.data.message).toEqual('Hello Circle');
    expect(res.body.data.sender_id).toBeDefined();

    // Give asynchronous engagement logging a small window
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify Message in DB
    const dbMsg = await Message.findOne({ circle_id: circleId });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg.message).toEqual('Hello Circle');

    // Verify Engagement Event
    const events = await EngagementEvent.find({ event_type: 'message_sent' });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].context.circle_id.toString()).toEqual(circleId.toString());
  });

  it('should return 403 Forbidden if non-member tries to send message', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${nonMemberToken}`)
      .send({ circleId, content: 'Sneaky Message' });

    expect(res.statusCode).toEqual(403);
  });
});
