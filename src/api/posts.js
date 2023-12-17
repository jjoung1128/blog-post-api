const express = require('express');
const { Post, UserPost } = require('../db/models');

const router = express.Router();

/**
 * Create a new blog post
 * req.body is expected to contain {text: required(string), tags: optional(Array<string>)}
 */
router.post('/', async (req, res, next) => {
  try {
    // Validation
    if (!req.user) {
      return res.sendStatus(401);
    }

    const { text, tags } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ error: 'Must provide text for the new post' });
    }

    // Create new post
    const values = {
      text,
    };
    if (tags) {
      values.tags = tags.join(',');
    }
    const post = await Post.create(values);
    await UserPost.create({
      userId: req.user.id,
      postId: post.id,
    });

    res.json({ post });
  } catch (error) {
    next(error);
  }
});

function isValidAuthorIds(authorIds) {
  // Split the string by comma
  const ids = authorIds.split(',');

  // Check each element in the array
  for (let id of ids) {
    // Trim any whitespace and check if the element is an integer
    if (!/^\d+$/.test(id.trim())) {
      return false;
    }
  }

  // Return true if all elements are integers
  return true;
}

/**
 * Get blog posts by the authors.
 */
router.get('/', async (req, res, next) => {
  try {
    // Validation
    if (!req.user) {
      return res.sendStatus(401);
    }

    if (!req.query || !req.query.authorIds) {
      return res.status(400).json({ error: 'Must provide authorIds' });
    }

    if (!isValidAuthorIds(req.query.authorIds)) {
      return res.status(400).json({
        error:
          'Invalid authorIds format. authorIds should be a string of comma separated list of user IDs',
      });
    }

    const validSortBy = ['id', 'likes', 'popularity', 'reads'];
    if (req.query.sortBy && !validSortBy.includes(req.query.sortBy)) {
      return res.status(400).json({
        error: `Invalid sortBy. sortBy must be one of ${validSortBy.join(
          ', '
        )}`,
      });
    }

    const validDirection = ['asc', 'desc'];
    if (req.query.direction && !validDirection.includes(req.query.direction)) {
      return res.status(400).json({
        error: `Invalid direction. direction must be one of ${validDirection.join(
          ', '
        )}`,
      });
    }

    const authorIds = req.query.authorIds.split(',');

    const postIdSet = new Set();
    const posts = [];

    await Promise.all(
      authorIds.map(async (authorId) => {
        const postsByTheUser = await Post.getPostsByUserId(authorId);
        for (let post of postsByTheUser) {
          if (!postIdSet.has(post.id)) {
            postIdSet.add(post.id);
            posts.push({
              id: post.id,
              likes: post.likes,
              popularity: post.popularity,
              reads: post.reads,
              tags: post.tags ? post.tags.split(',') : [],
              text: post.text,
            });
          }
        }
      })
    );

    const sortBy = req.query.sortBy || 'id';
    const direction = req.query.direction || 'asc';

    if (direction === 'asc') {
      posts.sort((a, b) => a[sortBy] - b[sortBy]);
    } else if (direction === 'desc') {
      posts.sort((a, b) => b[sortBy] - a[sortBy]);
    }

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

/**
 * Util functions for updating post
 */
function isValidTags(tags) {
  if (!tags) {
    return true;
  }

  if (!Array.isArray(tags)) {
    return false;
  }

  for (let tag of tags) {
    if (typeof tag !== 'string') {
      return false;
    }
  }

  return true;
}

function isValidText(text) {
  if (!text) {
    return true;
  }

  if (typeof text !== 'string') {
    return false;
  }

  return true;
}

function isAuthorIdsValid(authorIds) {
  if (!authorIds) {
    return true;
  }

  if (!Array.isArray(authorIds) || authorIds.length === 0) {
    return false;
  }

  for (let id of authorIds) {
    if (typeof id !== 'number') {
      return false;
    }
  }

  return true;
}

/**
 * Update blog post for an author.
 */
router.patch('/:postId', async (req, res, next) => {
  try {
    // Validation
    if (!req.user) {
      return res.sendStatus(401);
    }

    if (!req.params.postId || !/^\d+$/.test(req.params.postId)) {
      return res.status(400).json({ error: 'Must provide valid postId' });
    }

    const { authorIds, tags, text } = req.body;

    if (!isAuthorIdsValid(authorIds)) {
      return res.status(400).json({
        error:
          'Invalid authorIds format. authorIds should be an array of user IDs',
      });
    }

    if (!isValidTags(tags)) {
      return res.status(400).json({
        error: 'Invalid tags format. tags should be an array of strings',
      });
    }

    if (!isValidText(text)) {
      return res.status(400).json({
        error: 'Invalid text format. text should be a string',
      });
    }

    const { postId } = req.params;
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user.id;
    const userPost = await UserPost.findOne({
      where: { userId: userId, postId: postId },
    });

    if (!userPost) {
      return res
        .status(403)
        .json({ error: `You cannot update the other author's post` });
    }

    if (tags || text) {
      const updatedTags = tags ? tags.join(',') : post.tags;
      const updatedText = text ? text : post.text;

      const updatedPost = {
        ...post,
        tags: updatedTags,
        text: updatedText,
      };

      await post.update(updatedPost);
      await post.save();
    }

    if (authorIds) {
      await UserPost.destroy({
        where: { postId: postId },
      });
      authorIds.forEach(async (authorId) => {
        await UserPost.upsert(
          {
            userId: authorId,
            postId: postId,
          },
          {
            where: { userId: authorId, postId: postId },
          }
        );
      });
    }

    const updatedAuthorIds = [];
    const userPosts = await UserPost.findAll({ where: { postId: postId } });
    userPosts.forEach((userPost) => {
      updatedAuthorIds.push(userPost.userId);
    });

    res.json({
      post: {
        id: post.id,
        authorIds: updatedAuthorIds,
        likes: post.likes,
        popularity: post.popularity,
        reads: post.reads,
        tags: post.tags ? post.tags.split(',') : [],
        text: post.text,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
