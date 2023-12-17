/* eslint-disable no-undef */
const request = require('supertest');
const app = require('./app');

describe('GET /posts', () => {
  describe('when a user is not logged in', () => {
    it('should return an unauthorized error', async () => {
      const response = await request(app).get('/api/posts');
      expect(response.statusCode).toBe(401);
    });
  });
  describe('when a user is logged in', () => {
    let authToken;
    const loginInfo = { username: 'thomas', password: '123456' };

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/login')
        .set('Content-Type', 'application/json')
        .send(loginInfo);
      authToken = response.body.token;
    });

    describe('when author id is not provided', () => {
      it('should return a bad request error', async () => {
        const response = await request(app)
          .get('/api/posts')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(400);
      });
    });

    describe('when author id is invalid', () => {
      it('should return a bad request error', async () => {
        const response = await request(app)
          .get('/api/posts?authorIds=abc')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(400);
      });
    });

    describe('when author id is valid', () => {
      it('should return a list of posts', async () => {
        const response = await request(app)
          .get('/api/posts?authorIds=1')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(200);
        expect(response.body.posts.length).toBe(1);
      });
    });

    describe('when author id is valid but does not exist', () => {
      it('should return an empty list', async () => {
        const response = await request(app)
          .get('/api/posts?authorIds=100')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(200);
        expect(response.body.posts.length).toBe(0);
      });
    });

    describe('when multiple author ids are provided', () => {
      it('should return a list of posts', async () => {
        const response = await request(app)
          .get('/api/posts?authorIds=1,2')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(200);
        expect(response.body.posts.length).toBe(2);
      });

      it('should return a list of posts without duplicates', async () => {
        const response = await request(app)
          .get('/api/posts?authorIds=1,1,2')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(200);
        expect(response.body.posts.length).toBe(2);
      });

      it('should return a list of posts sorted by id in ascending order', async () => {
        const response = await request(app)
          .get('/api/posts?authorIds=1,2&direction=asc')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(200);
        expect(response.body.posts.length).toBe(2);
        expect(response.body.posts[0].id).toBeLessThan(
          response.body.posts[1].id
        );
      });

      describe('when sortBy is provided', () => {
        describe('when sortBy is valid', () => {
          it('should return a list of posts sorted by the given field', async () => {
            const response = await request(app)
              .get('/api/posts?authorIds=1,2&sortBy=likes')
              .set('Content-Type', 'application/json')
              .set('x-access-token', authToken);
            expect(response.statusCode).toBe(200);
            expect(response.body.posts.length).toBe(2);
            expect(response.body.posts[0].likes).toBeLessThan(
              response.body.posts[1].likes
            );
          });
        });

        describe('when sortBy is invalid', () => {
          it('should return a bad request error', async () => {
            const response = await request(app)
              .get('/api/posts?authorIds=1,2&sortBy=invalid')
              .set('Content-Type', 'application/json')
              .set('x-access-token', authToken);
            expect(response.statusCode).toBe(400);
          });
        });

        describe('when direction is provided', () => {
          describe('when direction is valid', () => {
            it('should return a list of posts sorted by the given field and direction', async () => {
              const response = await request(app)
                .get('/api/posts?authorIds=1,2&sortBy=likes&direction=desc')
                .set('Content-Type', 'application/json')
                .set('x-access-token', authToken);
              expect(response.statusCode).toBe(200);
              expect(response.body.posts.length).toBe(2);
              expect(response.body.posts[0].likes).toBeGreaterThan(
                response.body.posts[1].likes
              );
            });
          });

          describe('when direction is invalid', () => {
            it('should return a bad request error', async () => {
              const response = await request(app)
                .get('/api/posts?authorIds=1,2&sortBy=likes&direction=invalid')
                .set('Content-Type', 'application/json')
                .set('x-access-token', authToken);
              expect(response.statusCode).toBe(400);
            });
          });
        });
      });
    });
  });
});

describe('PATCH /posts/:postId', () => {
  describe('when a user is not logged in', () => {
    it('should return an unauthorized error', async () => {
      const response = await request(app).patch('/api/posts/1');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('when a user is logged in', () => {
    let authToken;
    const loginInfo = { username: 'thomas', password: '123456' };

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/login')
        .set('Content-Type', 'application/json')
        .send(loginInfo);
      authToken = response.body.token;
    });

    describe('when post id is invalid', () => {
      it('should return a bad request error', async () => {
        const response = await request(app)
          .patch('/api/posts/abc')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken);
        expect(response.statusCode).toBe(400);
      });
    });

    describe('when tags are invalid', () => {
      it('should return a bad request error', async () => {
        const response = await request(app)
          .patch('/api/posts/1')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken)
          .send({ tags: 'new tag' });
        expect(response.statusCode).toBe(400);
      });

      it('should return a bad request error', async () => {
        const response = await request(app)
          .patch('/api/posts/1')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken)
          .send({ tags: [1] });
        expect(response.statusCode).toBe(400);
      });
    });

    describe('when text is invalid', () => {
      it('should return a bad request error', async () => {
        const response = await request(app)
          .patch('/api/posts/1')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken)
          .send({ text: 1 });
        expect(response.statusCode).toBe(400);
      });
    });

    describe('when authorIds are invalid', () => {
      it('should return a bad request error', async () => {
        const response = await request(app)
          .patch('/api/posts/1')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken)
          .send({ authorIds: '1' });
        expect(response.statusCode).toBe(400);
      });

      it('should return a bad request error', async () => {
        const response = await request(app)
          .patch('/api/posts/1')
          .set('Content-Type', 'application/json')
          .set('x-access-token', authToken)
          .send({ authorIds: [1, '2'] });
        expect(response.statusCode).toBe(400);
      });
    });

    describe('when post id is valid', () => {
      describe('when post id does not exist', () => {
        it('should return a not found error', async () => {
          const response = await request(app)
            .patch('/api/posts/100')
            .set('Content-Type', 'application/json')
            .set('x-access-token', authToken);
          expect(response.statusCode).toBe(404);
        });
      });

      describe('when post id exists', () => {
        describe('when user is not the author of the post', () => {
          it('should return a forbidden error', async () => {
            const response = await request(app)
              .patch('/api/posts/2')
              .set('Content-Type', 'application/json')
              .set('x-access-token', authToken);
            expect(response.statusCode).toBe(403);
          });
        });

        describe('when user is the author of the post', () => {
          describe('when tags are provided', () => {
            describe('when tags are valid', () => {
              it('should update the tags of the post', async () => {
                const response = await request(app)
                  .patch('/api/posts/1')
                  .set('Content-Type', 'application/json')
                  .set('x-access-token', authToken)
                  .send({ tags: ['new tag'] });
                expect(response.statusCode).toBe(200);
                expect(response.body.post.tags).toEqual(['new tag']);
              });
            });
          });

          describe('when text is provided', () => {
            describe('when text is valid', () => {
              it('should update the text of the post', async () => {
                const response = await request(app)
                  .patch('/api/posts/1')
                  .set('Content-Type', 'application/json')
                  .set('x-access-token', authToken)
                  .send({ text: 'new text' });
                expect(response.statusCode).toBe(200);
                expect(response.body.post.text).toBe('new text');
              });
            });
          });

          describe('when authorIds are provided', () => {
            describe('when authorIds are valid', () => {
              it('should update the authorIds of the post', async () => {
                const response = await request(app)
                  .patch('/api/posts/1')
                  .set('Content-Type', 'application/json')
                  .set('x-access-token', authToken)
                  .send({ authorIds: [1, 2] });
                expect(response.statusCode).toBe(200);
                expect(response.body.post.authorIds).toEqual([1, 2]);
              });
            });
          });
        });
      });
    });
  });
});
