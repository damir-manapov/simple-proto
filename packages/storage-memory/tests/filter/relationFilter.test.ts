import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../../src/index.js";
import type { Entry, EntryInput } from "@simple-proto/storage-types";

interface User extends Entry {
  name: string;
  age: number;
}

interface UserInput extends EntryInput {
  name: string;
  age: number;
}

interface Post extends Entry {
  title: string;
  authorId: string;
  tagIds: string[];
}

interface PostInput extends EntryInput {
  title: string;
  authorId: string;
  tagIds: string[];
}

interface Tag extends Entry {
  name: string;
}

interface TagInput extends EntryInput {
  name: string;
}

describe("Relation Filters", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();

    storage.registerCollection({
      name: "users",
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      },
    });

    storage.registerCollection({
      name: "tags",
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["name"],
      },
    });

    storage.registerCollection({
      name: "posts",
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          authorId: { type: "string", "x-link-to": "users" },
          tagIds: {
            type: "array",
            items: { type: "string", "x-link-to": "tags" },
          },
        },
        required: ["title", "authorId", "tagIds"],
      },
    });
  });

  describe("single relation filter", () => {
    it("should filter by related entity field", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });

      postRepo.create({ title: "Post 1", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Post 2", authorId: jane.id, tagIds: [] });
      postRepo.create({ title: "Post 3", authorId: john.id, tagIds: [] });

      // Find posts where author name is John
      const johnsPosts = postRepo.findAll({
        authorId: { name: { eq: "John" } },
      } as never);

      expect(johnsPosts).toHaveLength(2);
      expect(johnsPosts.map((p) => p.title).sort()).toEqual(["Post 1", "Post 3"]);
    });

    it("should filter by multiple related entity fields", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });
      const jack = userRepo.create({ name: "Jack", age: 35 });

      postRepo.create({ title: "Post 1", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Post 2", authorId: jane.id, tagIds: [] });
      postRepo.create({ title: "Post 3", authorId: jack.id, tagIds: [] });

      // Find posts where author is over 28
      const postsFromOlderAuthors = postRepo.findAll({
        authorId: { age: { gt: 28 } },
      } as never);

      expect(postsFromOlderAuthors).toHaveLength(2);
      expect(postsFromOlderAuthors.map((p) => p.title).sort()).toEqual(["Post 1", "Post 3"]);
    });

    it("should return empty array when no related entity matches", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      postRepo.create({ title: "Post 1", authorId: john.id, tagIds: [] });

      const posts = postRepo.findAll({
        authorId: { name: { eq: "NonExistent" } },
      } as never);

      expect(posts).toEqual([]);
    });
  });

  describe("array relation filter", () => {
    it("should filter by array relation where at least one matches", () => {
      const tagRepo = storage.getRepository<Tag, TagInput>("tags");
      const postRepo = storage.getRepository<Post, PostInput>("posts");
      const userRepo = storage.getRepository<User, UserInput>("users");

      const john = userRepo.create({ name: "John", age: 30 });
      const typescript = tagRepo.create({ name: "typescript" });
      const javascript = tagRepo.create({ name: "javascript" });
      const rust = tagRepo.create({ name: "rust" });

      postRepo.create({
        title: "TS Post",
        authorId: john.id,
        tagIds: [typescript.id],
      });
      postRepo.create({
        title: "JS Post",
        authorId: john.id,
        tagIds: [javascript.id],
      });
      postRepo.create({
        title: "Multi Post",
        authorId: john.id,
        tagIds: [typescript.id, javascript.id],
      });
      postRepo.create({
        title: "Rust Post",
        authorId: john.id,
        tagIds: [rust.id],
      });

      // Find posts with typescript tag
      const tsPosts = postRepo.findAll({
        tagIds: { name: { eq: "typescript" } },
      } as never);

      expect(tsPosts).toHaveLength(2);
      expect(tsPosts.map((p) => p.title).sort()).toEqual(["Multi Post", "TS Post"]);
    });
  });

  describe("combined filters", () => {
    it("should combine relation filter with regular field filter", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });

      postRepo.create({ title: "Hello World", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Hello Again", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Hello Jane", authorId: jane.id, tagIds: [] });

      // Find posts with title starting with "Hello" and author named John
      const posts = postRepo.findAll({
        title: { startsWith: "Hello" },
        authorId: { name: { eq: "John" } },
      } as never);

      expect(posts).toHaveLength(2);
      expect(posts.map((p) => p.title).sort()).toEqual(["Hello Again", "Hello World"]);
    });

    it("should work with and/or operators", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });

      postRepo.create({ title: "Post A", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Post B", authorId: jane.id, tagIds: [] });

      // Find posts where author is John OR title is "Post B"
      const posts = postRepo.findAll({
        or: [{ authorId: { name: { eq: "John" } } }, { title: { eq: "Post B" } }],
      } as never);

      expect(posts).toHaveLength(2);
    });
  });

  describe("reverse relation filter (some/none/every)", () => {
    it("should find users that have at least one post with some: true", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });
      userRepo.create({ name: "Jack", age: 35 }); // Jack has no posts

      postRepo.create({ title: "Post 1", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Post 2", authorId: jane.id, tagIds: [] });

      const usersWithPosts = userRepo.findAll({
        posts: { some: true },
      } as never);

      expect(usersWithPosts).toHaveLength(2);
      expect(usersWithPosts.map((u) => u.name).sort()).toEqual(["Jane", "John"]);
    });

    it("should find users that have no posts with none: true", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });
      userRepo.create({ name: "Jack", age: 35 }); // Jack has no posts

      postRepo.create({ title: "Post 1", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Post 2", authorId: jane.id, tagIds: [] });

      const usersWithoutPosts = userRepo.findAll({
        posts: { none: true },
      } as never);

      expect(usersWithoutPosts).toHaveLength(1);
      expect(usersWithoutPosts[0]?.name).toBe("Jack");
    });

    it("should find users that have at least one post matching filter with some", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });

      postRepo.create({ title: "Draft Post", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Published Post", authorId: jane.id, tagIds: [] });

      // Find users with a post that has "Published" in title
      const usersWithPublished = userRepo.findAll({
        posts: { some: { title: { contains: "Published" } } },
      } as never);

      expect(usersWithPublished).toHaveLength(1);
      expect(usersWithPublished[0]?.name).toBe("Jane");
    });

    it("should find users that have no posts matching filter with none", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });

      postRepo.create({ title: "Draft Post", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Published Post", authorId: jane.id, tagIds: [] });

      // Find users with no "Draft" posts
      const usersWithoutDraft = userRepo.findAll({
        posts: { none: { title: { contains: "Draft" } } },
      } as never);

      expect(usersWithoutDraft).toHaveLength(1);
      expect(usersWithoutDraft[0]?.name).toBe("Jane");
    });

    it("should find users where all posts match filter with every", () => {
      const userRepo = storage.getRepository<User, UserInput>("users");
      const postRepo = storage.getRepository<Post, PostInput>("posts");

      const john = userRepo.create({ name: "John", age: 30 });
      const jane = userRepo.create({ name: "Jane", age: 25 });
      userRepo.create({ name: "Jack", age: 35 }); // Jack has no posts (vacuously true for every)

      // John has 2 posts, both with "Tech" in title
      postRepo.create({ title: "Tech News", authorId: john.id, tagIds: [] });
      postRepo.create({ title: "Tech Review", authorId: john.id, tagIds: [] });

      // Jane has 1 tech post and 1 non-tech post
      postRepo.create({ title: "Tech Tips", authorId: jane.id, tagIds: [] });
      postRepo.create({ title: "Cooking Recipe", authorId: jane.id, tagIds: [] });

      // Jack has no posts (vacuously true for every)
      const usersWithAllTechPosts = userRepo.findAll({
        posts: { every: { title: { contains: "Tech" } } },
      } as never);

      expect(usersWithAllTechPosts).toHaveLength(2);
      expect(usersWithAllTechPosts.map((u) => u.name).sort()).toEqual(["Jack", "John"]);
    });
  });
});
