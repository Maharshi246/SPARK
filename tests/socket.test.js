import http from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import app from '../src/index.js';
import { initSocket } from '../src/socket/index.js';
import request from 'supertest';
import Community from '../src/models/communityModel.js';
import Circle from '../src/models/circleModel.js';
import jwt from 'jsonwebtoken';

describe('Socket.IO API', () => {
  let io, serverSocket, clientSocket;
  let port;
  let token;
  let circleId;

  beforeAll((done) => {
    const httpServer = http.createServer(app);
    io = initSocket(httpServer);
    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  beforeEach(async () => {
    // Setup user, token, community, and circle
    const res = await request(app).post('/api/auth/register').send({
      display_name: 'Socket User', email: 'sock@example.com', password: 'password123'
    });
    token = res.body.token;

    const community = await Community.create({ name: 'Sock Comm', description: 'desc' });
    const joinRes = await request(app)
      .post(`/api/communities/${community._id}/join`)
      .set('Authorization', `Bearer ${token}`);
    
    circleId = joinRes.body.data.circle_id;

    // Connect client socket
    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token }
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should allow joining circle room if member', (done) => {
    clientSocket.emit('join_circle', { circleId }, (response) => {
      try {
        expect(response.success).toBeTruthy();
        expect(response.room).toBe(`circle_${circleId}`);
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('should emit unauthorized error if joining non-member circle', async () => {
    // create another circle without this user
    const otherCircle = await Circle.create({
      community_id: circleId, // mock ID is fine
      members: [],
      capacity: 8
    });

    const response = await new Promise((resolve) => {
      clientSocket.emit('join_circle', { circleId: String(otherCircle._id) }, resolve);
    });

    expect(response.success).toBeFalsy();
    expect(response.message).toMatch(/not a member/i);
  });
});
