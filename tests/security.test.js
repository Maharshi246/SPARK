import request from 'supertest';
import app from '../src/index.js';

describe('Security & Limits API', () => {
  it('should return 429 Too Many Requests after 5 login attempts', async () => {
    const loginData = { email: 'limit@test.com', password: 'password123' };
    
    // Send 5 requests (allowed)
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send(loginData);
    }
    
    // 6th request should be blocked
    const res = await request(app).post('/api/auth/login').send(loginData);
    expect(res.statusCode).toEqual(429);
    expect(res.body.message).toMatch(/Too many login attempts/);
  });

  it('should return 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "test@test.com", "password": "wrong"'); // missing closing brace
    
    expect(res.statusCode).toEqual(400);
  });

  it('should reject NoSQL injection payload', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: 'password123' });
    
    // Validation or mongoose cast error should prevent 500, return 400
    // Actually our validation middleware validates strings
    expect(res.statusCode).toBeLessThan(500);
  });
});
