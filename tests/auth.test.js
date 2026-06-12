import request from 'supertest';
import app from '../src/index.js';

describe('Authentication API', () => {
  const userData = {
    display_name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  };

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(userData);
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBeTruthy();
    expect(res.body.token).toBeDefined();
  });

  it('should login with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(userData);
    
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userData.email, password: userData.password });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBeTruthy();
    expect(res.body.token).toBeDefined();
  });

  it('should return 401 with wrong password', async () => {
    await request(app).post('/api/auth/register').send(userData);
    
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userData.email, password: 'wrongpassword' });
    
    expect(res.statusCode).toEqual(401);
  });

  it('should return 401 when accessing protected route without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.statusCode).toEqual(401);
  });

  it('should return 401 when accessing protected route with invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toEqual(401);
  });
});
