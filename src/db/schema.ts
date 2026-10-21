import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("member"), // member | merchant | admin
  merchantSlug: text("merchant_slug").default(""),
  displayName: text("display_name").notNull().default(""),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by").default(""),
  streak: integer("streak").notNull().default(0),
  streakFreezes: integer("streak_freezes").notNull().default(1),
  lastCheckin: text("last_checkin").default(""),
  leaderboardOptin: boolean("leaderboard_optin").notNull().default(true),
  pauseNotifications: boolean("pause_notifications").notNull().default(false),
  takeBreak: boolean("take_break").notNull().default(false),
  emailPrefs: boolean("email_prefs").notNull().default(true),
  birthday: text("birthday").default(""),
  hasOnboarded: boolean("has_onboarded").notNull().default(false),
  lastSpinDay: text("last_spin_day").default(""),
  birthdayBonusYear: integer("birthday_bonus_year").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ledger = pgTable("ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // earn | redeem | expiry | adjustment | refund | transfer_in | transfer_out | pool
  amount: integer("amount").notNull(), // signed
  balanceAfter: integer("balance_after").notNull(),
  description: text("description").notNull(),
  source: text("source").notNull().default(""),
  idempotencyKey: text("idempotency_key").unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  rewardId: text("reward_id").notNull(),
  rewardTitle: text("reward_title").notNull(),
  merchant: text("merchant").notNull().default(""),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("Active"), // Active | Used | Expired
  pointsCost: integer("points_cost").notNull(),
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const checkins = pgTable("checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  day: text("day").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("checkin_user_day").on(t.userId, t.day)]);

export const spinResults = pgTable("spin_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  day: text("day").notNull(),
  prize: text("prize").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const missionProgress = pgTable("mission_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  missionId: text("mission_id").notNull(),
  progress: integer("progress").notNull().default(0),
  claimed: boolean("claimed").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("mission_user").on(t.userId, t.missionId)]);

export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  badgeId: text("badge_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("badge_user").on(t.userId, t.badgeId)]);

export const surveyResponses = pgTable("survey_responses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  surveyId: text("survey_id").notNull(),
  answers: text("answers").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("survey_user").on(t.userId, t.surveyId)]);

export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  merchant: text("merchant").notNull(),
  amount: integer("amount").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  imageHash: text("image_hash").notNull().default(""),
  status: text("status").notNull().default("Pending"), // Pending Approved Rejected
  points: integer("points").notNull().default(0),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupsTbl = pgTable("groups_tbl", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  goalReward: text("goal_reward").notNull().default("Family Movie Night Bundle"),
  goalPoints: integer("goal_points").notNull().default(2000),
  poolPoints: integer("pool_points").notNull().default(0),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("gm_unique").on(t.groupId, t.userId)]);

export const contributions = pgTable("contributions", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull().default(""),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  merchant: text("merchant").notNull(),
  title: text("title").notNull(),
  budget: integer("budget").notNull().default(10000),
  spent: integer("spent").notNull().default(0),
  multiplier: integer("multiplier").notNull().default(2),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  status: text("status").notNull().default("Live"),
  createdBy: integer("created_by").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fraudFlags = pgTable("fraud_flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("Open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customRewards = pgTable("custom_rewards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  merchant: text("merchant").notNull(),
  category: text("category").notNull().default("Vouchers"),
  pointsCost: integer("points_cost").notNull(),
  cashTopup: integer("cash_topup").notNull().default(0),
  stock: integer("stock").notNull().default(50),
  tierRequired: text("tier_required").notNull().default("Spark"),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id").notNull(),
  status: text("status").notNull().default("Pending"), // Pending Qualified
  bonusAwarded: boolean("bonus_awarded").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const earnRules = pgTable("earn_rules", {
  id: serial("id").primaryKey(),
  merchant: text("merchant").notNull().unique(),
  pointsPerUnit: integer("points_per_unit").notNull().default(10),
  bonusDays: text("bonus_days").notNull().default("Saturday,Sunday"),
  tierMultiplier: integer("tier_multiplier").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
