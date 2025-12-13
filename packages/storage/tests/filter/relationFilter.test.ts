import { describe, it, expect, beforeEach } from "vitest";
import { Storage } from "../../src/index.js";
import type { Entry, EntryInput } from "../../src/index.js";

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
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();

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
});
