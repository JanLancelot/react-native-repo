import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Architecture Board Exam Review Platform — MVP Convex Database Schema
 *
 * Core Domains:
 * 1. USERS & ACCESS (users + authTables)
 * 2. LEARNING CONTENT (subjects, topics, materials, flashcards)
 * 3. ASSESSMENTS (questions, quizzes, quizAttempts, quizAnswers)
 * 4. COLLABORATION (studyRooms, studyRoomMembers)
 * 5. SYSTEM (notifications)
 */

export default defineSchema({
  ...authTables,

  // ---------------------------------------------------------------------------
  // 1. USERS & ACCESS
  // ---------------------------------------------------------------------------
  users: defineTable({
    // Convex Auth identifier string (unique identity mapping)
    userId: v.optional(v.string()),

    email: v.optional(v.string()),
    username: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),

    profileImageId: v.optional(v.id("_storage")),

    role: v.union(
      v.literal("student"),
      v.literal("admin"),
      v.literal("content_manager")
    ),

    isActive: v.boolean(),

    fcmToken: v.optional(v.string()),
    lastActiveAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  passwordResetTokens: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_email_and_code", ["email", "code"]),

  // ---------------------------------------------------------------------------
  // 2. LEARNING CONTENT
  // ---------------------------------------------------------------------------
  subjects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    isPublished: v.boolean(),
    order: v.number(),
    createdBy: v.id("users"),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_published", ["isPublished"])
    .index("by_order", ["order"]),

  topics: defineTable({
    subjectId: v.id("subjects"),
    name: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    isPublished: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subject", ["subjectId"])
    .index("by_subject_and_order", ["subjectId", "order"]),

  materials: defineTable({
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),

    title: v.string(),
    description: v.optional(v.string()),

    type: v.union(
      v.literal("article"),
      v.literal("pdf"),
      v.literal("image"),
      v.literal("document")
    ),

    content: v.optional(v.string()), // Inline markdown / article body
    storageId: v.optional(v.id("_storage")), // Uploaded document / PDF storage reference

    isPublished: v.boolean(),
    createdBy: v.id("users"),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subject", ["subjectId"])
    .index("by_topic", ["topicId"]),

  flashcards: defineTable({
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),

    front: v.string(),
    back: v.string(),

    imageId: v.optional(v.id("_storage")),

    isPublished: v.boolean(),
    createdBy: v.id("users"),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subject", ["subjectId"])
    .index("by_topic", ["topicId"]),

  // ---------------------------------------------------------------------------
  // 3. ASSESSMENTS
  // ---------------------------------------------------------------------------
  questions: defineTable({
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),

    question: v.string(),
    questionImageId: v.optional(v.id("_storage")),

    // Embedded answer choices array
    choices: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        imageId: v.optional(v.id("_storage")),
      })
    ),

    correctChoiceId: v.string(),
    explanation: v.optional(v.string()),

    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard")
    ),

    isPublished: v.boolean(),
    createdBy: v.id("users"),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subject", ["subjectId"])
    .index("by_topic", ["topicId"])
    .index("by_difficulty", ["difficulty"]),

  quizzes: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    type: v.union(
      v.literal("practice"),
      v.literal("mock_exam")
    ),

    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),

    // Ordered list of question document references
    questionIds: v.array(v.id("questions")),

    timeLimitSeconds: v.optional(v.number()),
    passingScore: v.optional(v.number()),

    isPublished: v.boolean(),
    createdBy: v.id("users"),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_subject", ["subjectId"])
    .index("by_topic", ["topicId"]),

  quizAttempts: defineTable({
    userId: v.id("users"),
    quizId: v.id("quizzes"),

    status: v.union(
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("expired")
    ),

    score: v.optional(v.number()),
    correctAnswers: v.optional(v.number()),
    totalQuestions: v.number(),

    startedAt: v.number(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_quiz", ["quizId"])
    .index("by_user_and_quiz", ["userId", "quizId"]),

  quizAnswers: defineTable({
    attemptId: v.id("quizAttempts"),
    questionId: v.id("questions"),

    selectedChoiceId: v.optional(v.string()),
    isCorrect: v.optional(v.boolean()),
    answeredAt: v.optional(v.number()),
  })
    .index("by_attempt", ["attemptId"])
    .index("by_question", ["questionId"]),

  // ---------------------------------------------------------------------------
  // 4. COLLABORATION
  // ---------------------------------------------------------------------------
  studyRooms: defineTable({
    name: v.string(),
    description: v.optional(v.string()),

    createdBy: v.id("users"),
    subjectId: v.optional(v.id("subjects")),

    providerRoomName: v.string(), // LiveKit WebRTC room identifier

    status: v.union(
      v.literal("active"),
      v.literal("closed")
    ),

    maxParticipants: v.number(),
    isPrivate: v.boolean(),

    createdAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_creator", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_subject", ["subjectId"]),

  studyRoomMembers: defineTable({
    roomId: v.id("studyRooms"),
    userId: v.id("users"),

    role: v.union(
      v.literal("host"),
      v.literal("participant")
    ),

    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"])
    .index("by_room_and_user", ["roomId", "userId"]),

  // ---------------------------------------------------------------------------
  // 5. SYSTEM
  // ---------------------------------------------------------------------------
  notifications: defineTable({
    userId: v.id("users"),

    type: v.union(
      v.literal("announcement"),
      v.literal("study_room"),
      v.literal("exam"),
      v.literal("system")
    ),

    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()), // Extra navigation/payload data

    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "isRead"]),
});
